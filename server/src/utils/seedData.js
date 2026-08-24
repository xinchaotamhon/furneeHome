const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
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
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await User.findOneAndUpdate(
      { email: process.env.ADMIN_EMAIL.toLowerCase() },
      { name: 'Administrator', email: process.env.ADMIN_EMAIL.toLowerCase(), password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin' },
      { upsert: true },
    );
    console.log(`Admin account ready: ${process.env.ADMIN_EMAIL}`);
  } else {
    console.log('Admin account skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
  }
  await mongoose.disconnect();
  console.log('Seed completed');
}

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
