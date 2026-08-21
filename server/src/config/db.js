const dns = require('node:dns');
const mongoose = require('mongoose');
const env = require('./env');

// Khắc phục triệt để lỗi DNS SRV (querySrv ECONNREFUSED) trên Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Môi trường không hỗ trợ đổi DNS
}

async function connectDatabase(retries = 3) {
  if (!env.mongoUri) throw new Error('MONGO_URI is missing trong file .env');
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(env.mongoUri);
      console.log('✅ Connected to MongoDB Atlas successfully');
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ Lỗi kết nối MongoDB (${err.message}). Đang thử lại lần ${i + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

module.exports = connectDatabase;

