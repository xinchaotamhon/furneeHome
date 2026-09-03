/**
 * Tool Nạp Dữ Liệu Sản Phẩm Shopee vào MongoDB cho FurneeHome
 * - Cấu trúc JSON & Document tinh gọn, minh bạch, chính xác 100%.
 * - Tự động liên kết mã Shopee Item ID với file ảnh tách nền PNG.
 * - CƠ CHẾ BẢO VỆ 2 TẦNG (PRE-FLIGHT VALIDATION):
 *   + Tầng 1: Kiểm tra trùng lặp ngay trong danh sách DEFAULT_PRODUCTS.
 *   + Tầng 2: Kiểm tra đối chiếu với MongoDB.
 *   => NẾU CÓ BẤT KỲ 1 LINK NÀO ĐÃ TỒN TẠI: TẠM DỪNG TOÀN BỘ TIẾN TRÌNH VÀ BÁO CỤ THỂ LINK TRÙNG.
 *   => CHỈ NẠP KHI 100% CÁC LINK ĐỀU LÀ SẢN PHẨM MỚI HỢP LỆ.
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

// Danh sách sản phẩm Shopee cần nạp
const DEFAULT_PRODUCTS = [
  'https://shopee.vn/B%C3%A0n-gaming-ng%E1%BB%93i-b%E1%BB%87t-ch%C3%A2n-s%E1%BA%AFt-ch%E1%BB%AF-K-U-Y-Z-g%E1%BA%A5p-g%E1%BB%8Dn-%C4%91a-n%C4%83ng-b%C3%A0n-h%E1%BB%8Dc-t%E1%BA%ADp-l%C3%A0m-vi%E1%BB%87c-BBG-K-i.82449232.19644951874?extraParams=%7B%22display_model_id%22%3A164431730332%2C%22model_selection_logic%22%3A3%7D',
  'https://shopee.vn/B%C3%A0n-L%C3%A0m-Vi%E1%BB%87c-B%C3%A0n-Gaming-Khung-ch%C3%A2n-ch%E1%BB%AF-U-K-Z-nhi%E1%BB%81u-phi%C3%AAn-b%E1%BA%A3n-m%E1%BA%B7t-g%E1%BB%97-MDF-ch%C3%A2n-s%E1%BA%AFt-s%C6%A1n-t%C4%A9nh-%C4%91i%E1%BB%87n-i.680006053.54950710347?extraParams=%7B%22display_model_id%22%3A272119587355%2C%22model_selection_logic%22%3A3%7D',
  'https://shopee.vn/-SALE-S%E1%BB%90C-B%C3%A0n-l%C3%A0m-vi%E1%BB%87c-ch%E1%BB%AF-U-K-Z-VX07-b%C3%A0n-v%C4%83n-ph%C3%B2ng-ch%C3%A2n-s%E1%BA%AFt-s%C6%A1n-t%C4%A9nh-%C4%91i%E1%BB%87n-thi%E1%BA%BFt-k%E1%BA%BF-ch%E1%BA%AFc-ch%E1%BA%AFn-N%E1%BB%99i-Th%E1%BA%A5t-B%C3%A0n-Gh%E1%BA%BF.-i.12841133.27173869776?extraParams=%7B%22display_model_id%22%3A139471507075%2C%22model_selection_logic%22%3A3%7D',
  'https://shopee.vn/Gh%E1%BA%BF-v%C4%83n-ph%C3%B2ng-c%C3%B4ng-th%C3%A1i-h%E1%BB%8Dc-NOVA-gh%E1%BA%BF-l%C6%B0%E1%BB%9Bi-cao-c%E1%BA%A5p-%C4%91%E1%BB%87m-d%C3%A0y-%C3%AAm-%C3%A1i-xoay-360%C2%B0-ch%C3%A2n-ch%E1%BA%AFc-ch%E1%BA%AFn-i.1801439468.51614911654?extraParams=%7B%22display_model_id%22%3A411281106724%2C%22model_selection_logic%22%3A3%7D',
  'https://shopee.vn/Gh%E1%BA%BF-c%C3%B4ng-th%C3%A1i-h%E1%BB%8Dc-NOVA-c%C3%B3-t%E1%BB%B1a-%C4%91%E1%BA%A7u-xoay-n%C3%A2ng-h%E1%BA%A1-%C4%91%E1%BB%87m-m%C3%BAt-cao-c%E1%BA%A5p-l%C6%B0ng-r%E1%BB%99ng-ch%C3%A2n-th%C3%A9p-ch%E1%BA%AFc-ch%E1%BA%AFn-i.1801439468.53714915626?extraParams=%7B%22display_model_id%22%3A376280866034%2C%22model_selection_logic%22%3A3%7D',
  'https://shopee.vn/Gh%E1%BA%BF-v%C4%83n-ph%C3%B2ng-AetheraHome-thi%E1%BA%BFt-k%E1%BA%BF-gh%E1%BA%BF-l%C6%B0%E1%BB%9Bi-cao-c%E1%BA%A5p-xoay-360-%C4%91%E1%BB%99-gh%E1%BA%BF-th%C3%ADch-h%E1%BB%A3p-h%E1%BB%8Dc-t%E1%BA%ADp-v%C3%A0-l%C3%A0m-vi%E1%BB%87c-i.1306395991.55713400615?extraParams=%7B%22display_model_id%22%3A351160050441%2C%22model_selection_logic%22%3A3%7D',
  'https://shopee.vn/BRTHORY-Gh%E1%BA%BF-v%C4%83n-ph%C3%B2ng-Gh%E1%BA%BF-m%C3%A1y-t%C3%ADnh-c%C3%B3-tay-t%E1%BB%B1a-Gh%E1%BA%BF-ti%E1%BB%87n-d%E1%BB%A5ng-ch%C6%A1i-game-l%C6%B0ng-cao-N%C3%A2ng-xoay-c%C3%B3-th%E1%BB%83-%C4%91i%E1%BB%81u-ch%E1%BB%89nh-t%E1%BA%A1i-nh%C3%A0-V%C4%83n-ph%C3%B2ng-Ti%E1%BA%BFt-ki%E1%BB%87m-kh%C3%B4ng-gian-h%E1%BB%8Dc-i.1310004765.26137523086?extraParams=%7B%22display_model_id%22%3A248513047384%2C%22model_selection_logic%22%3A3%7D'
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

function inferCategory(name = '') {
  const clean = name.trim();

  // 1. Tủ (Tủ quần áo, tủ nhựa, tủ vải, tủ đầu giường...)
  if (/(?<!\p{L})(tủ|wardrobe|cabinet|tu vai|tu nhua|tu go)(?!\p{L})/iu.test(clean)) {
    return 'Tủ';
  }

  // 2. Bàn học / Bàn làm việc / Bàn gấp (ngoại trừ "kệ để bàn" / "giá để bàn")
  if (!/(?<!\p{L})(kệ|ke|giá|gia)(?!\p{L})/iu.test(clean) && /(?<!\p{L})(bàn|ban|desk|table|laptop)(?!\p{L})/iu.test(clean)) {
    return 'Bàn học';
  }

  // 3. Ghế
  if (/(?<!\p{L})(ghế|ghe|chair|stool)(?!\p{L})/iu.test(clean)) {
    return 'Ghế';
  }

  // 4. Kệ sách / Giá treo / Kệ đa năng
  if (/(?<!\p{L})(kệ|ke|giá|gia|sào|shelf|rack)(?!\p{L})/iu.test(clean)) {
    return 'Kệ sách';
  }

  // 5. Đèn (tránh nhầm chữ 'màu đen' hoặc 'đen')
  if (/(?<!\p{L})(đèn|lamp|lighting|den ban|den hoc|den ngu|den cay|den led)(?!\p{L})/iu.test(clean) && !/(?<!\p{L})(màu đen|mau den)(?!\p{L})/iu.test(clean)) {
    return 'Đèn';
  }

  // 6. Đồ decor / Thảm
  if (/(?<!\p{L})(thảm|tham|tranh|decor|cây|gối|carpet)(?!\p{L})/iu.test(clean)) {
    return 'Đồ decor';
  }

  return 'Nội thất';
}

/**
 * Trích xuất các định danh của sản phẩm Shopee (Shop ID, Item ID, Product Code, Clean URL)
 */
function extractShopeeIdentifiers(url = '') {
  if (typeof url !== 'string') return { rawShopId: '', rawItemId: '', productCode: '', cleanUrl: '' };

  const match = url.match(/(?:i\.|-i\.|\/product\/)(\d+)(?:\.|\/)(\d+)/i);
  const rawShopId = match ? match[1] : '';
  const rawItemId = match ? match[2] : '';
  const productCode = match ? `${match[1]}-${match[2]}` : `sp-${Date.now()}`;

  let cleanUrl = url;
  try {
    const parsed = new URL(url);
    cleanUrl = `${parsed.origin}${parsed.pathname}`;
  } catch { }

  return { rawShopId, rawItemId, productCode, cleanUrl };
}

function processProductItem(item) {
  const url = typeof item === 'string' ? item : item.url;
  const { rawItemId, productCode } = extractShopeeIdentifiers(url);

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

  // Tự động kiểm tra file ảnh cắt theo mã Item ID (ví dụ: 52663854319.png)
  const localCutoutPath = path.join(ROOT_DIR, 'client/public/images/products', `${rawItemId}.png`);

  let transparentImage = item.transparentImage;
  if (!transparentImage && rawItemId && require('fs').existsSync(localCutoutPath)) {
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

/**
 * Kiểm tra xem một link Shopee / sản phẩm đã có trên MongoDB hay chưa
 */
async function checkProductExistsInMongo(itemOrUrl, productsCol) {
  const url = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl.sourceUrl || itemOrUrl.url || '');
  const { rawShopId, rawItemId, productCode, cleanUrl } = extractShopeeIdentifiers(url);

  const queryConditions = [];

  if (url) {
    queryConditions.push({ sourceUrl: url });
    queryConditions.push({ shopeeSearchUrl: url });
  }

  if (cleanUrl && cleanUrl !== url) {
    queryConditions.push({ sourceUrl: cleanUrl });
    queryConditions.push({ shopeeSearchUrl: cleanUrl });
  }

  if (rawItemId) {
    queryConditions.push({ sourceUrl: { $regex: rawItemId } });
    queryConditions.push({ shopeeSearchUrl: { $regex: rawItemId } });
    queryConditions.push({ image: { $regex: rawItemId } });
    queryConditions.push({ transparentImage: { $regex: rawItemId } });
    queryConditions.push({ slug: { $regex: rawItemId } });
  }

  if (productCode && !productCode.startsWith('sp-')) {
    queryConditions.push({ slug: { $regex: productCode } });
  }

  if (typeof itemOrUrl === 'object' && itemOrUrl.slug) {
    queryConditions.push({ slug: itemOrUrl.slug });
  }

  if (queryConditions.length === 0) {
    return { exists: false, product: null, matchBy: null, rawItemId, rawShopId, productCode };
  }

  const existingProduct = await productsCol.findOne({ $or: queryConditions });

  if (existingProduct) {
    let matchBy = 'URL';
    if (rawItemId && (existingProduct.slug?.includes(rawItemId) || existingProduct.sourceUrl?.includes(rawItemId) || existingProduct.transparentImage?.includes(rawItemId) || existingProduct.image?.includes(rawItemId))) {
      matchBy = `Mã Shopee Item ID (${rawItemId})`;
    } else if (existingProduct.slug === itemOrUrl.slug) {
      matchBy = 'Slug';
    }
    return {
      exists: true,
      product: existingProduct,
      matchBy,
      rawItemId,
      rawShopId,
      productCode
    };
  }

  return { exists: false, product: null, matchBy: null, rawItemId, rawShopId, productCode };
}

/**
 * Kiểm tra trùng lặp bên trong mảng DEFAULT_PRODUCTS
 */
function checkLocalDuplicates(products) {
  const seenIds = new Map();
  const duplicates = [];

  for (let i = 0; i < products.length; i++) {
    const item = products[i];
    const { rawItemId, cleanUrl } = extractShopeeIdentifiers(item.sourceUrl);
    const key = rawItemId || cleanUrl;

    if (seenIds.has(key)) {
      duplicates.push({
        firstIndex: seenIds.get(key) + 1,
        duplicateIndex: i + 1,
        url: item.sourceUrl,
        key,
      });
    } else {
      seenIds.set(key, i);
    }
  }

  return duplicates;
}

async function validateAndImport(products) {
  console.log('\n=================================================================');
  console.log(`🛡️  BẮT ĐẦU KIỂM TRA TOÀN DIỆN CHO ${products.length} SẢN PHẨM...`);
  console.log('=================================================================\n');

  // -------------------------------------------------------------
  // TẦNG 1: KIỂM TRA TRÙNG LẶP NỘI BỘ TRONG DEFAULT_PRODUCTS
  // -------------------------------------------------------------
  const localDuplicates = checkLocalDuplicates(products);
  if (localDuplicates.length > 0) {
    console.error('🚫 [LỖI TRÙNG LẶP TRONG DANH SÁCH DEFAULT_PRODUCTS]:');
    localDuplicates.forEach((dup) => {
      console.error(`   ❌ Link thứ [${dup.duplicateIndex}] bị trùng với link thứ [${dup.firstIndex}]:`);
      console.error(`      🔗 ${dup.url}`);
      console.error(`      🔑 Mã định danh trùng: ${dup.key}\n`);
    });
    console.error('🛑 TẠM DỪNG TOÀN BỘ TIẾN TRÌNH: Vui lòng xóa link trùng trong DEFAULT_PRODUCTS trước khi chạy lại!\n');
    return false;
  }

  // -------------------------------------------------------------
  // TẦNG 2: KIỂM TRA ĐỐI CHIẾU VỚI MONGODB
  // -------------------------------------------------------------
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log('⚠️  Chưa cấu hình MONGO_URI trong file .env ở thư mục gốc.\n');
    return false;
  }

  console.log('🔌 Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(mongoUri, { dbName: 'furneeHome' });
  console.log('✅ Đã kết nối MongoDB thành công (Database: furneeHome)\n');

  const db = mongoose.connection.db;
  const categoriesCol = db.collection('categories');
  const productsCol = db.collection('products');

  console.log('🔍 Đang kiểm tra từng link xem đã tồn tại trên MongoDB chưa...\n');

  const existingList = [];

  for (let i = 0; i < products.length; i++) {
    const item = products[i];
    const checkResult = await checkProductExistsInMongo(item, productsCol);

    if (checkResult.exists) {
      existingList.push({
        index: i + 1,
        item,
        existing: checkResult.product,
        matchBy: checkResult.matchBy,
      });
      console.log(`❌ [${i + 1}/${products.length}] ĐÃ TỒN TẠI: "${item.name.slice(0, 50)}..."`);
    } else {
      console.log(`✅ [${i + 1}/${products.length}] HỢP LỆ (MỚI): "${item.name.slice(0, 50)}..."`);
    }
  }

  // NẾU CÓ BẤT KỲ LINK NÀO ĐÃ CÓ TRÊN MONGODB -> TẠM DỪNG TOÀN BỘ
  if (existingList.length > 0) {
    console.log('\n' + '='.repeat(65));
    console.error(`🛑 PHÁT HIỆN ${existingList.length}/${products.length} SẢN PHẨM ĐÃ TỒN TẠI TRÊN MONGODB!`);
    console.error('👉 TIẾN TRÌNH NẠP ĐÃ ĐƯỢC TẠM DỪNG ĐỂ TRÁNH TRÙNG LẶP SẢN PHẨM.\n');

    existingList.forEach((dup) => {
      const p = dup.existing;
      console.error(`📌 Link thứ [${dup.index}] ĐÃ CÓ trong Database:`);
      console.error(`   🔗 Link:         ${dup.item.sourceUrl}`);
      console.error(`   🏷️  Tên trong DB: "${p.name}"`);
      console.error(`   🆔 ID MongoDB:   ${p._id}`);
      console.error(`   🎯 Khớp theo:    ${dup.matchBy}`);
      console.error(`   🖼️  Ảnh tách nền: ${p.transparentImage || p.image}\n`);
    });

    console.error('⚠️  HÀNH ĐỘNG CẦN THỰC HIỆN:');
    console.error('   1. Mở file tools/importProducts.js');
    console.error('   2. Xóa các link đã được liệt kê ở trên khỏi mảng DEFAULT_PRODUCTS.');
    console.error('   3. Chạy lại lệnh: node tools/importProducts.js');
    console.log('='.repeat(65) + '\n');

    await mongoose.disconnect();
    return false;
  }

  // -------------------------------------------------------------
  // TẤT CẢ ĐỀU HỢP LỆ (100% SẢN PHẨM MỚI) -> TIẾN HÀNH NẠP VÀO CSDL
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(65));
  console.log(`🎉 100% SẢN PHẨM ĐỀU MỚI VÀ HỢP LỆ! BẮT ĐẦU NẠP VÀO MONGODB...`);
  console.log('='.repeat(65) + '\n');

  const newlyImported = [];

  for (let i = 0; i < products.length; i++) {
    const item = products[i];

    // 1. Tạo Category nếu chưa có
    const categorySlug = toSlug(item.categoryName);
    const categoryDoc = await categoriesCol.findOneAndUpdate(
      { slug: categorySlug },
      { $setOnInsert: { name: item.categoryName, slug: categorySlug, isActive: true, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    const categoryId = categoryDoc?._id || categoryDoc?.value?._id;

    // 2. Insert Product vào collection 'products'
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await productsCol.insertOne(productData);
    newlyImported.push(item);
    console.log(`  ✨ [${i + 1}/${products.length}] Nạp thành công: "${item.name}" | Giá: ${item.price.toLocaleString('vi-VN')} ₫`);
  }

  // Tự động đồng bộ TOÀN BỘ sản phẩm trong MongoDB ra file data_import.json
  await syncAllProductsToJsonBackup(db);

  await mongoose.disconnect();

  console.log('\n' + '='.repeat(65));
  console.log(`🎉 HOÀN THÀNH TOÀN BỘ: Đã nạp ${newlyImported.length} sản phẩm mới vào MongoDB!`);
  console.log('='.repeat(65) + '\n');

  return true;
}

async function syncAllProductsToJsonBackup(db) {
  try {
    const productsCol = db.collection('products');
    const categoriesCol = db.collection('categories');

    const categories = await categoriesCol.find({}).toArray();
    const categoryMap = new Map(categories.map((c) => [String(c._id), c.name]));

    const allProducts = await productsCol.find({}).sort({ createdAt: -1 }).toArray();

    const cleanOutput = allProducts.map((p) => {
      let categoryName = 'Nội thất';
      if (p.category) {
        categoryName = categoryMap.get(String(p.category)) || p.categoryName || 'Nội thất';
      }
      return {
        _id: String(p._id),
        name: p.name || 'Sản phẩm nội thất Shopee',
        slug: p.slug,
        category: categoryName,
        categoryName,
        price: p.price || 0,
        image: p.image || p.transparentImage || '/images/products/desk-4060.png',
        transparentImage: p.transparentImage || p.image || '/images/products/desk-4060.png',
        sourceUrl: p.sourceUrl || p.shopeeSearchUrl || '',
        shopeeSearchUrl: p.shopeeSearchUrl || p.sourceUrl || '',
        sellerName: p.sellerName || 'Shopee Seller',
        isOfficial: Boolean(p.isOfficial),
        rating: p.rating || 5.0,
        description: p.description || p.name || '',
        stock: p.stock || 100,
        isActive: p.isActive !== false,
      };
    });

    await fs.mkdir(path.dirname(DATA_JSON_FILE), { recursive: true });
    await fs.writeFile(DATA_JSON_FILE, JSON.stringify(cleanOutput, null, 2), 'utf8');
    console.log(`\n💾 Đã tự động đồng bộ TOÀN BỘ ${cleanOutput.length} sản phẩm từ MongoDB về: client/public/data_import/data_import.json`);
  } catch (error) {
    console.warn(`Không lưu được file backup: ${error.message}`);
  }
}

async function main() {
  console.log('\n🚀 Bắt đầu chương trình nạp sản phẩm Shopee (FurneeHome)...\n');
  const processedProducts = DEFAULT_PRODUCTS.map(processProductItem);
  await validateAndImport(processedProducts);
}

module.exports = {
  extractShopeeIdentifiers,
  checkProductExistsInMongo,
  checkLocalDuplicates,
  processProductItem,
  validateAndImport,
};

if (require.main === module) {
  main().catch((err) => {
    console.error('\n❌ Lỗi thực thi importProducts:', err.message);
    process.exit(1);
  });
}



