const fs = require('fs/promises');
const path = require('path');

// Đọc .env từ thư mục gốc không cần phụ thuộc package ngoài
const ROOT_DIR = path.resolve(__dirname, '..');
try {
  const envContent = require('fs').readFileSync(path.join(ROOT_DIR, '.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const mongoose = require(path.join(ROOT_DIR, 'server/node_modules/mongoose'));
const DATA_JSON_FILE = path.join(ROOT_DIR, 'client/public/data_import/data_import.json');

// Danh sách URL mặc định (đồ nội thất sinh viên/phòng nhỏ phổ biến)
const DEFAULT_URLS = [
  'https://shopee.vn/B%C3%A0n-Ch%E1%BB%AF-Nh%E1%BA%ADt-G%E1%BA%A5p-G%E1%BB%8Dn-40x60-cm-G%E1%BB%97-MDF-Ph%E1%BB%A7-Melamine-Ch%E1%BB%91ng-X%C6%B0%E1%BB%9Bc-Ch%E1%BB%91ng-N%C6%B0%E1%BB%9Bc-Thi%E1%BA%BFt-K%E1%BA%BF-Ti%E1%BB%87n-L%E1%BB%A3i-Ti%E1%BA%BFt-Ki%E1%BB%87m-Kh%C3%B4ng-Gian-ND50-i.1075573860.42382415650?extraParams=%7B%22display_model_id%22%3A406180756117%2C%22model_selection_logic%22%3A3%7D'
];

const REQUEST_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_REQUESTS_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function cleanText(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function removeVietnameseAccents(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd');
}

function toSlug(value = '') {
  return removeVietnameseAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'san-pham-shopee';
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const digits = value.replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const number = Number(digits);
  return Number.isFinite(number) ? number : 0;
}

function inferCategory(name) {
  const lower = removeVietnameseAccents(name).toLowerCase();
  if (/guong|gương|tranh|anh treo|wall/.test(lower)) return 'Đồ treo tường';
  if (/den|lamp|đèn/.test(lower)) return 'Đèn';
  if (/cay|chau|plant|chậu/.test(lower)) return 'Cây và chậu';
  if (/ghe|chair|ghế/.test(lower)) return 'Ghế';
  if (/tu|cabinet|tủ/.test(lower)) return 'Tủ';
  if (/ban|desk|table|bàn/.test(lower)) return 'Bàn học';
  if (/ke|shelf|kệ/.test(lower)) return 'Kệ sách';
  return 'Nội thất';
}

function getShopeeCode(sourceUrl) {
  const match = sourceUrl.match(/(?:i\.|-i\.)(\d+)\.(\d+)/i);
  return match ? `${match[1]}-${match[2]}` : '';
}

function getAttribute(tag, attribute) {
  const match = tag.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? cleanText(match[1]) : '';
}

function getMeta(html, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = getAttribute(tag, 'property') || getAttribute(tag, 'name');
    if (wanted.has(key.toLowerCase())) return getAttribute(tag, 'content');
  }
  return '';
}

function parseJsonLd(html) {
  const values = [];
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const content = script.replace(/^<[\s\S]*?>/, '').replace(/<\/script>\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(decodeHtml(content));
      values.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {}
  }
  return values;
}

function parseEmbeddedJson(html) {
  const values = [];
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) {
    try { values.push(JSON.parse(decodeHtml(nextData[1]))); } catch {}
  }
  const stateMatches = html.matchAll(/(?:window\.)?__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?/gi);
  for (const match of stateMatches) {
    try { values.push(JSON.parse(match[1])); } catch {}
  }
  return values;
}

function findValue(value, keys, depth = 0) {
  if (!value || depth > 6) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== 'object') return undefined;
  for (const [key, item] of Object.entries(value)) {
    if (keys.includes(key.toLowerCase()) && item !== null && item !== '') return item;
  }
  for (const item of Object.values(value)) {
    const found = findValue(item, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function scrapeShopeeProduct(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const html = await response.text();
    const jsonLd = parseJsonLd(html);
    const productLd = jsonLd.find((item) => item?.['@type'] === 'Product' || item?.['@type']?.includes?.('Product')) || {};
    const offerLd = productLd?.offers || {};
    const embedded = parseEmbeddedJson(html);

    const name = cleanText(productLd.name || getMeta(html, ['og:title', 'twitter:title']) || findValue(embedded, ['name', 'title']) || 'Sản phẩm Shopee');
    const image = productLd.image || getMeta(html, ['og:image', 'twitter:image']) || findValue(embedded, ['image', 'images', 'thumbnail']) || '';
    const rawPrice = offerLd.price || getMeta(html, ['product:price:amount', 'og:price:amount']) || findValue(embedded, ['price', 'min_price', 'price_min']) || 0;
    const price = parsePrice(rawPrice);
    const categoryName = cleanText(productLd.category || findValue(embedded, ['category', 'category_name']) || inferCategory(name));
    const description = cleanText(productLd.description || getMeta(html, ['description', 'og:description']) || `Sản phẩm nội thất ${name} trên Shopee.`);
    const sellerName = cleanText(offerLd.seller?.name || findValue(embedded, ['shop_name', 'seller_name']) || 'Shopee Seller');
    const productCode = getShopeeCode(url) || toSlug(name);
    const displayPrice = price > 0 ? `${new Intl.NumberFormat('vi-VN').format(price)} ₫` : 'Liên hệ';

    return {
      name,
      slug: `${toSlug(name)}-${productCode}`.slice(0, 80),
      categoryName,
      price: price || 99000,
      description,
      images: image ? [image] : [],
      transparentImage: '',
      shopeeSearchUrl: url,
      sourceUrl: url,
      offers: [{
        id: productCode,
        name,
        displayPrice,
        url,
        image,
        sellerName,
        affiliateUrl: '',
      }],
      searchKeywords: [name.toLowerCase(), removeVietnameseAccents(name).toLowerCase(), categoryName.toLowerCase()],
      isActive: true,
    };
  } catch (error) {
    console.warn(`  ⚠️ Không đọc được đầy đủ DOM từ link (${error.message}). Tạo bản ghi dự phòng...`);
    const code = getShopeeCode(url) || `sp-${Date.now()}`;
    return {
      name: `Sản phẩm Shopee (${code})`,
      slug: `shopee-${code}`,
      categoryName: 'Nội thất',
      price: 150000,
      description: 'Sản phẩm được import từ liên kết Shopee.',
      images: [],
      transparentImage: '',
      shopeeSearchUrl: url,
      sourceUrl: url,
      offers: [{ id: code, name: 'Sản phẩm Shopee', displayPrice: '150.000 ₫', url, image: '', sellerName: '', affiliateUrl: '' }],
      searchKeywords: ['shopee', 'noi that'],
      isActive: true,
    };
  }
}

async function saveToMongo(products) {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log('\n⚠️  Chưa cấu hình MONGO_URI trong file .env ở thư mục gốc.');
    console.log('   (Dữ liệu đã được lưu vào file JSON dự phòng: client/public/data_import/data_import.json)\n');
    return;
  }

  console.log('\n🔌 Đang kết nối tới MongoDB...');
  await mongoose.connect(mongoUri, { dbName: 'furneeHome' });
  console.log('✅ Đã kết nối MongoDB (Database: furneeHome)');

  const db = mongoose.connection.db;
  const categoriesCol = db.collection('categories');
  const productsCol = db.collection('products');

  let importedCount = 0;
  for (const item of products) {
    // 1. Tạo Category nếu chưa có
    const categorySlug = toSlug(item.categoryName);
    const categoryDoc = await categoriesCol.findOneAndUpdate(
      { slug: categorySlug },
      { $setOnInsert: { name: item.categoryName, slug: categorySlug, isActive: true, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    const categoryId = categoryDoc?._id || categoryDoc?.value?._id;

    // 2. Upsert Product vào collection 'products'
    const productData = {
      name: item.name,
      slug: item.slug,
      description: item.description,
      price: item.price,
      stock: 100,
      category: categoryId,
      images: item.images,
      transparentImage: item.transparentImage,
      dimensions: { widthCm: 50, depthCm: 40, heightCm: 70 },
      shopeeSearchUrl: item.shopeeSearchUrl,
      sourceUrl: item.sourceUrl,
      offers: item.offers,
      searchKeywords: item.searchKeywords,
      isActive: true,
      updatedAt: new Date(),
    };

    await productsCol.updateOne(
      { slug: item.slug },
      { $set: productData, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    importedCount += 1;
  }

  await mongoose.disconnect();
  console.log(`\n🎉 Thành công! Đã append/upsert ${importedCount} sản phẩm vào MongoDB collection 'products'.\n`);
}

async function saveToJsonBackup(products) {
  try {
    await fs.mkdir(path.dirname(DATA_JSON_FILE), { recursive: true });
    await fs.writeFile(DATA_JSON_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log(`💾 Đã sao lưu ${products.length} sản phẩm vào: client/public/data_import/data_import.json`);
  } catch (error) {
    console.warn(`Không lưu được file backup: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let urls = DEFAULT_URLS;

  // Hỗ trợ truyền --url hoặc --file
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      urls = [args[i + 1]];
      break;
    } else if (args[i] === '--file' && args[i + 1]) {
      const fileContent = await fs.readFile(args[i + 1], 'utf8');
      urls = fileContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      break;
    }
  }

  console.log(`\n🚀 Bắt đầu cào dữ liệu từ ${urls.length} link Shopee...`);
  const products = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n[${i + 1}/${urls.length}] Đang xử lý: ${url.slice(0, 70)}...`);
    const product = await scrapeShopeeProduct(url);
    console.log(`  👉 Đã lấy: "${product.name}" | Giá: ${new Intl.NumberFormat('vi-VN').format(product.price)} ₫ | Danh mục: ${product.categoryName}`);
    products.push(product);
    if (i < urls.length - 1) await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  // 1. Lưu bản backup JSON
  await saveToJsonBackup(products);

  // 2. Đẩy thẳng lên MongoDB collection 'products'
  await saveToMongo(products);
}

main().catch((err) => {
  console.error('\n❌ Lỗi trong quá trình import:', err);
  process.exit(1);
});
