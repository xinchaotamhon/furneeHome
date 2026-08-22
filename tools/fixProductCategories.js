const path = require('path');
const mongoose = require(path.join(__dirname, '../server/node_modules/mongoose'));
const fs = require('fs/promises');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const DATA_JSON_FILE = path.join(ROOT_DIR, 'client/public/data_import/data_import.json');

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
} catch {}

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

function inferCategoryAccurately(name = '') {
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

async function fixCategories() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Không tìm thấy MONGO_URI');
    process.exit(1);
  }

  console.log('🔌 Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(mongoUri, { dbName: 'furneeHome' });
  console.log('✅ Đã kết nối MongoDB (Database: furneeHome)\n');

  const db = mongoose.connection.db;
  const productsCol = db.collection('products');
  const categoriesCol = db.collection('categories');

  const products = await productsCol.find({}).toArray();
  console.log(`🔍 Đang quét và chuẩn hóa danh mục cho ${products.length} sản phẩm...\n`);

  let updatedCount = 0;

  for (const p of products) {
    const correctCategory = inferCategoryAccurately(p.name);
    const categorySlug = toSlug(correctCategory);

    // Tạo / Lấy category đúng
    const categoryDoc = await categoriesCol.findOneAndUpdate(
      { slug: categorySlug },
      { $setOnInsert: { name: correctCategory, slug: categorySlug, isActive: true, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    const categoryId = categoryDoc?._id || categoryDoc?.value?._id;

    // Cập nhật lại sản phẩm
    await productsCol.updateOne(
      { _id: p._id },
      { $set: { category: categoryId, categoryName: correctCategory } }
    );

    if (p.categoryName !== correctCategory) {
      console.log(`✏️ Sửa danh mục: "${p.name.slice(0, 45)}..." -> [${correctCategory}]`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Đã cập nhật xong ${updatedCount} sản phẩm trong CSDL!`);

  // Đồng bộ lại ra data_import.json
  const categories = await categoriesCol.find({}).toArray();
  const categoryMap = new Map(categories.map((c) => [String(c._id), c.name]));
  const allProducts = await productsCol.find({}).sort({ createdAt: -1 }).toArray();

  const cleanData = allProducts.map((p) => {
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
  await fs.writeFile(DATA_JSON_FILE, JSON.stringify(cleanData, null, 2), 'utf8');
  console.log(`💾 Đã xuất toàn bộ ${cleanData.length} sản phẩm chuẩn ra: ${DATA_JSON_FILE}\n`);

  await mongoose.disconnect();
}

fixCategories().catch((e) => {
  console.error('❌ Lỗi:', e);
  process.exit(1);
});
