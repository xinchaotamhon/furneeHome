/**
 * Tool Nạp Dữ Liệu Sản Phẩm Shopee vào MongoDB cho FurneeHome
 * - Cấu trúc JSON & Document tinh gọn, minh bạch, chính xác 100%.
 * - Tự động liên kết mã Shopee Item ID với file ảnh tách nền PNG.
 * - Không lưu thông tin khuyến mãi tạm thời (như -46%) để tránh sai lệch dữ liệu theo thời gian.
 */

const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');

// Đọc biến môi trường từ .env
try {
  const envContent = require('fs').readFileSync(ENV_FILE, 'utf8');
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
} catch { }

const mongoose = require(path.join(ROOT_DIR, 'server/node_modules/mongoose'));
const DATA_JSON_FILE = path.join(ROOT_DIR, 'client/public/data_import/data_import.json');

// Danh sách sản phẩm Shopee thực tế
const DEFAULT_PRODUCTS = [
  'https://shopee.vn/B%C3%A0n-H%E1%BB%8Dc-G%E1%BA%A5p-G%E1%BB%8Dn-AIODIY-B%C3%A0n-L%C3%A0m-Vi%E1%BB%87c-Mini-%C4%90%E1%BB%83-Gi%C6%B0%E1%BB%9Dng-C%C3%B3-Khay-%C4%90%E1%BB%B1ng-C%E1%BB%91c-Khe-C%E1%BA%AFm-iPad-%C4%90a-N%C4%83ng-Cho-H%E1%BB%8Dc-Sinh-i.1709649747.52663854319?extraParams=%7B%22display_model_id%22%3A411197840842%2C%22model_selection_logic%22%3A3%7D'
];

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

function inferCategory(name) {
  const lower = removeVietnameseAccents(name).toLowerCase();
  if (/den|lamp|đèn/.test(lower)) return 'Đèn';
  if (/ghe|chair|ghế/.test(lower)) return 'Ghế';
  if (/tu|cabinet|tủ/.test(lower)) return 'Tủ';
  if (/ban|desk|table|bàn/.test(lower)) return 'Bàn học';
  if (/ke|shelf|kệ/.test(lower)) return 'Kệ sách';
  if (/tham|carpet|thảm|tranh|decor|cây/.test(lower)) return 'Đồ decor';
  return 'Nội thất';
}

function getShopeeCode(sourceUrl) {
  const match = sourceUrl.match(/(?:i\.|-i\.)(\d+)\.(\d+)/i);
  return match ? `${match[1]}-${match[2]}` : `sp-${Date.now()}`;
}

function processProductItem(item) {
  const url = typeof item === 'string' ? item : item.url;
  const productCode = getShopeeCode(url);

  let rawName = item.name;
  if (!rawName) {
    try {
      const parsed = new URL(url);
      const slugPart = parsed.pathname.replace(/^\/|\/$/g, '').replace(/(?:-i\.|i\.)\d+\.\d+.*$/i, '');
      rawName = decodeURIComponent(slugPart).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    } catch { }
  }
  const name = rawName || 'Sản phẩm nội thất Shopee';
  const categoryName = item.category || inferCategory(name);
  const price = Number(item.price) || 0;

  // Tự động kiểm tra file ảnh cắt theo mã Item ID (ví dụ: 45263771450.png)
  const rawItemId = productCode.includes('-') ? productCode.split('-')[1] : productCode;
  const localCutoutPath = path.join(ROOT_DIR, 'client/public/images/products', `${rawItemId}.png`);

  let transparentImage = item.transparentImage;
  if (!transparentImage && require('fs').existsSync(localCutoutPath)) {
    transparentImage = `/images/products/${rawItemId}.png`;
  }

  const image = item.image || transparentImage || '/images/products/desk-4060.png';
  const finalCutout = transparentImage || image;
  const sellerName = item.sellerName || (item.isOfficial ? 'Shopee Mall' : 'Shopee Seller');
  const description = item.description || name;

  return {
    name,
    slug: `${toSlug(name)}-${productCode}`.slice(0, 100),
    categoryName,
    price,
    image,
    transparentImage: finalCutout,
    sourceUrl: url,
    shopeeSearchUrl: url,
    sellerName,
    isOfficial: Boolean(item.isOfficial),
    rating: item.rating || 5.0,
    description,
    stock: 100,
    isActive: true,
  };
}

async function saveToMongo(products) {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log('\n⚠️  Chưa cấu hình MONGO_URI trong file .env ở thư mục gốc.');
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
      images: [item.image],
      image: item.image,
      transparentImage: item.transparentImage,
      shopeeSearchUrl: item.shopeeSearchUrl,
      sourceUrl: item.sourceUrl,
      sellerName: item.sellerName,
      isOfficial: item.isOfficial,
      rating: item.rating,
      isActive: true,
      updatedAt: new Date(),
    };

    await productsCol.updateOne(
      { slug: item.slug },
      { $set: productData, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    importedCount += 1;
    console.log(`  👉 Đã nạp MongoDB: "${item.name}" | Giá: ${item.price.toLocaleString('vi-VN')} ₫ | Ảnh cắt: ${item.transparentImage}`);
  }

  await mongoose.disconnect();
  console.log(`\n🎉 Thành công! Đã cập nhật ${importedCount} sản phẩm chuẩn vào MongoDB collection 'products'.\n`);
}

async function saveToJsonBackup(products) {
  try {
    const cleanOutput = products.map((p) => ({
      name: p.name,
      slug: p.slug,
      category: p.categoryName,
      price: p.price,
      image: p.image,
      transparentImage: p.transparentImage,
      sourceUrl: p.sourceUrl,
      sellerName: p.sellerName,
      isOfficial: p.isOfficial,
      rating: p.rating,
      description: p.description,
    }));

    await fs.mkdir(path.dirname(DATA_JSON_FILE), { recursive: true });
    await fs.writeFile(DATA_JSON_FILE, JSON.stringify(cleanOutput, null, 2), 'utf8');
    console.log(`💾 Đã sao lưu dữ liệu sạch vào: client/public/data_import/data_import.json`);
  } catch (error) {
    console.warn(`Không lưu được file backup: ${error.message}`);
  }
}

async function main() {
  console.log('\n🚀 Bắt đầu nạp dữ liệu sản phẩm Shopee...\n');
  const processedProducts = DEFAULT_PRODUCTS.map(processProductItem);

  await saveToJsonBackup(processedProducts);
  await saveToMongo(processedProducts);
}

main().catch((err) => {
  console.error('\n❌ Lỗi thực thi importProducts:', err.message);
  process.exit(1);
});
