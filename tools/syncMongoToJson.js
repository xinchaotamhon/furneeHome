const path = require('path');
const mongoose = require(path.join(__dirname, '../server/node_modules/mongoose'));
const env = require('../server/src/config/env');
require('../server/src/models/Category');
const Product = require('../server/src/models/Product');
const { exportProductsToCanonicalJson } = require('../server/src/services/productCatalogService');

async function syncMongoToJson() {
  if (!env.mongoUri) {
    console.error('❌ Không tìm thấy MONGO_URI trong file .env');
    process.exit(1);
  }

  console.log('🔌 Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(env.mongoUri);
  const result = await exportProductsToCanonicalJson(Product);
  if (result.skipped) throw new Error('Chỉ đồng bộ JSON trên máy local, không chạy ở production.');
  console.log(`🎉 Đã đồng bộ ${result.count} sản phẩm thật vào JSON.`);
  console.log(`   👉 ${result.path}\n`);

  await mongoose.disconnect();
}

syncMongoToJson().catch((err) => {
  console.error('❌ Lỗi đồng bộ:', err);
  process.exit(1);
});
