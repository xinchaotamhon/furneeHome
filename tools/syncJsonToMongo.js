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
} catch (err) {
  console.warn('⚠️ Không thể đọc file .env:', err.message);
}

async function syncJsonToMongo() {
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

  // Lấy categories để map
  const categories = await categoriesCol.find({}).toArray();
  const categoryByName = new Map();
  const categoryById = new Map();
  for (const cat of categories) {
    categoryByName.set(cat.name.trim().toLowerCase(), cat);
    categoryById.set(String(cat._id), cat);
  }

  // Đọc file JSON
  const rawJson = await fs.readFile(DATA_JSON_FILE, 'utf8');
  const jsonData = JSON.parse(rawJson);
  console.log(`📄 Đã đọc ${jsonData.length} sản phẩm từ ${DATA_JSON_FILE}`);

  let updatedFromJson = 0;
  let slugsFixedFromJson = 0;
  let categoryNamesFixed = 0;

  for (const item of jsonData) {
    const cleanSlug = (item.slug || '').replace(/-+$/, '');
    let matchedCategory = null;

    if (item.categoryName && categoryByName.has(item.categoryName.trim().toLowerCase())) {
      matchedCategory = categoryByName.get(item.categoryName.trim().toLowerCase());
    } else if (item.category && categoryByName.has(item.category.trim().toLowerCase())) {
      matchedCategory = categoryByName.get(item.category.trim().toLowerCase());
    }

    const updateDoc = {
      $set: {
        name: item.name,
        slug: cleanSlug,
        price: Number(item.price) || 0,
        image: item.image,
        transparentImage: item.transparentImage || item.image,
        sourceUrl: item.sourceUrl || '',
        shopeeSearchUrl: item.shopeeSearchUrl || item.sourceUrl || '',
        sellerName: item.sellerName || 'Shopee Seller',
        isOfficial: Boolean(item.isOfficial),
        rating: Number(item.rating) || 5,
        description: item.description || item.name,
        stock: Number(item.stock) || 100,
        isActive: item.isActive !== false,
      }
    };

    if (matchedCategory) {
      updateDoc.$set.category = matchedCategory._id;
      updateDoc.$set.categoryName = matchedCategory.name;
    }

    let filter = {};
    if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
      filter = { _id: new mongoose.Types.ObjectId(item._id) };
    } else {
      filter = { slug: { $in: [item.slug, cleanSlug] } };
    }

    const existing = await productsCol.findOne(filter);
    if (existing) {
      if (existing.slug && existing.slug.endsWith('-')) {
        slugsFixedFromJson++;
      }
      if (!existing.categoryName && matchedCategory) {
        categoryNamesFixed++;
      }
      await productsCol.updateOne(filter, updateDoc);
      updatedFromJson++;
    } else {
      console.log(`ℹ️ Không tìm thấy sản phẩm MongoDB cho: ${item.name.slice(0, 40)}...`);
    }
  }

  console.log(`\n📊 Kết quả đồng bộ từ JSON sang MongoDB:`);
  console.log(`   - Sản phẩm đã cập nhật từ JSON: ${updatedFromJson}/${jsonData.length}`);
  console.log(`   - Slugs có dấu gạch ngang cuối đã sửa từ JSON: ${slugsFixedFromJson}`);

  // Quét toàn bộ MongoDB để dọn sạch các trailing hyphens và thiếu categoryName còn lại (bao gồm 11 sản phẩm mới hơn)
  console.log('\n🧹 Đang kiểm tra toàn bộ collection products trong MongoDB...');
  const allProducts = await productsCol.find({}).toArray();
  let remainingSlugsFixed = 0;
  let remainingCatsFixed = 0;

  for (const prod of allProducts) {
    const originalSlug = prod.slug || '';
    const cleanSlug = originalSlug.replace(/-+$/, '');
    const updates = {};

    if (originalSlug !== cleanSlug) {
      updates.slug = cleanSlug;
      remainingSlugsFixed++;
    }

    if (!prod.categoryName && prod.category && categoryById.has(String(prod.category))) {
      updates.categoryName = categoryById.get(String(prod.category)).name;
      remainingCatsFixed++;
    }

    if (Object.keys(updates).length > 0) {
      await productsCol.updateOne({ _id: prod._id }, { $set: updates });
    }
  }

  console.log(`   - Thêm ${remainingSlugsFixed} slug MongoDB đã được loại bỏ dấu gạch ngang cuối.`);
  console.log(`   - Thêm ${remainingCatsFixed} sản phẩm đã được bổ sung categoryName.`);
  console.log(`\n🎉 Hoàn thành đồng bộ MongoDB!`);

  await mongoose.disconnect();
}

syncJsonToMongo().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
