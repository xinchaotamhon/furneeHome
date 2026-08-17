const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');

async function seed() {
  await connectDatabase();
  const category = await Category.findOneAndUpdate(
    { slug: 'ban-hoc' },
    { name: 'Bàn học', slug: 'ban-hoc', description: 'Bàn học và làm việc cho phòng nhỏ' },
    { upsert: true, returnDocument: 'after' },
  );
  await Product.findOneAndUpdate(
    { slug: 'ban-hoc-mau' },
    { name: 'Bàn học mẫu', slug: 'ban-hoc-mau', description: 'Sản phẩm mẫu', price: 0, stock: 0, category: category._id, dimensions: { widthCm: 120, depthCm: 60, heightCm: 75 } },
    { upsert: true },
  );
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await User.findOneAndUpdate(
      { email: process.env.ADMIN_EMAIL.toLowerCase() },
      { name: 'Administrator', email: process.env.ADMIN_EMAIL.toLowerCase(), password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin' },
      { upsert: true },
    );
  }
  await mongoose.disconnect();
  console.log('Seed completed');
}

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
