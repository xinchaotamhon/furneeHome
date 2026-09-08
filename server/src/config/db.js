const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  if (!env.mongoUri) throw new Error('MONGO_URI chưa được cấu hình.');
  await mongoose.connect(env.mongoUri);
  console.log('Đã kết nối MongoDB.');
}

module.exports = connectDatabase;
