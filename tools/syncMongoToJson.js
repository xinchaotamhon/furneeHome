const fs = require('fs/promises');
const path = require('path');
const mongoose = require(path.join(__dirname, '../server/node_modules/mongoose'));

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

async function syncMongoToJson() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Không tìm thấy MONGO_URI trong file .env');
    process.exit(1);
  }

  console.log('🔌 Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(mongoUri, { dbName: 'furneeHome' });
  console.log('✅ Đã kết nối MongoDB (Database: furneeHome)');

  const db = mongoose.connection.db;
  const productsCol = db.collection('products');
  const categoriesCol = db.collection('categories');

  // Lấy tất cả categories để map tên
  const categories = await categoriesCol.find({}).toArray();
  const categoryMap = new Map(categories.map((c) => [String(c._id), c.name]));

  // Lấy tất cả products
  const products = await productsCol.find({}).sort({ createdAt: -1 }).toArray();
  console.log(`📦 Tìm thấy ${products.length} sản phẩm trong MongoDB collection 'products'.`);

  const cleanData = products.map((p) => {
    let categoryName = 'Nội thất';
    if (p.category && categoryMap.has(String(p.category))) {
      categoryName = categoryMap.get(String(p.category));
    } else if (p.categoryName) {
      categoryName = p.categoryName;
    }

    const cleanSlug = (p.slug || '').replace(/-+$/, '');

    return {
      _id: String(p._id),
      name: p.name || 'Sản phẩm nội thất Shopee',
      slug: cleanSlug,
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

  console.log(`🎉 Đã đồng bộ thành công ${cleanData.length} sản phẩm từ MongoDB về file:`);
  console.log(`   👉 ${DATA_JSON_FILE}\n`);

  await mongoose.disconnect();
}

syncMongoToJson().catch((err) => {
  console.error('❌ Lỗi đồng bộ:', err);
  process.exit(1);
});
