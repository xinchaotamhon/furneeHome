const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  if (!env.mongoUri) throw new Error('MONGO_URI chưa được cấu hình.');
  await mongoose.connect(env.mongoUri);
  console.log('Đã kết nối MongoDB.');

  try {
    const collections = await mongoose.connection.db.listCollections({ name: 'reviews' }).toArray();
    if (collections.length > 0) {
      const reviewIndexes = await mongoose.connection.collection('reviews').indexes();
      if (reviewIndexes.some((idx) => idx.name === 'user_1_product_1')) {
        await mongoose.connection.collection('reviews').dropIndex('user_1_product_1');
        console.log('Đã dọn dẹp index cũ user_1_product_1 để hỗ trợ đánh giá theo từng đơn.');
      }
    }
  } catch {
    // Bỏ qua nếu không kiểm tra được index
  }
}

module.exports = connectDatabase;
