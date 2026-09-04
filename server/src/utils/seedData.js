const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const env = require('../config/env');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');

async function seed() {
  await connectDatabase();
  await Category.findOneAndUpdate(
    { slug: 'ban-hoc' },
    { name: 'Bàn học', slug: 'ban-hoc', description: 'Bàn học và làm việc cho phòng nhỏ' },
    { upsert: true, returnDocument: 'after' },
  );
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    if (env.isProduction && process.env.ADMIN_PASSWORD.length < 12) {
      throw new Error('ADMIN_PASSWORD production phải có tối thiểu 12 ký tự.');
    }
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const username = process.env.ADMIN_USERNAME.trim().toLowerCase();
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing && (existing.email !== email || existing.username !== username)) {
      throw new Error('ADMIN_EMAIL hoặc ADMIN_USERNAME đang thuộc tài khoản khác; seed không ghi đè tài khoản đó.');
    }
    await User.findOneAndUpdate(
      existing ? { _id: existing._id } : { email },
      {
        name: 'Administrator',
        username,
        email,
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
        role: 'admin',
        localOnly: false,
        isActive: true,
      },
      { upsert: true },
    );
    console.log(`Admin account ready: ${process.env.ADMIN_EMAIL}`);
  } else {
    console.log('Admin account skipped: set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD in local .env first.');
  }
  await mongoose.disconnect();
  console.log('Seed completed');
}

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
