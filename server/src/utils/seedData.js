const path = require('node:path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');

const catalogPath = path.resolve(__dirname, '../../../client/public/data_import/data_import.json');
const catalog = require(catalogPath);

const categoryDescriptions = {
  'Phòng khách': 'Sofa, bàn, ghế và nội thất phòng khách.',
  'Phòng ngủ': 'Giường, tủ và nội thất phòng ngủ.',
  'Bếp & Phòng ăn': 'Bàn ghế và nội thất khu vực ăn uống.',
  'Phòng làm việc': 'Bàn ghế và nội thất học tập, làm việc.',
  'Trang trí & Đèn': 'Đèn, thảm, gương, tranh và đồ trang trí.',
};

function slug(value) {
  return String(value || 'noi-that')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'noi-that';
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function dimensionsText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const width = positiveNumber(value.widthCm ?? value.width);
  const depth = positiveNumber(value.depthCm ?? value.depth);
  const height = positiveNumber(value.heightCm ?? value.height);
  return [width, depth, height].filter(Boolean).join(' x ') + (width || depth || height ? ' cm' : '');
}

async function seedCategories() {
  const names = [...new Set(catalog.map((item) => item.categoryName).filter(Boolean))];
  const categories = {};

  for (const name of names) {
    const item = await Category.findOneAndUpdate(
      { slug: slug(name) },
      { $set: { name, slug: slug(name), description: categoryDescriptions[name] || '', isActive: true } },
      { upsert: true, returnDocument: 'after' },
    );
    categories[name] = item;
  }

  return categories;
}

function productData(item, category) {
  const dimensionsCm = {
    width: positiveNumber(item.dimensionsCm?.width ?? item.dimensions?.widthCm ?? item.dimensions?.width),
    depth: positiveNumber(item.dimensionsCm?.depth ?? item.dimensions?.depthCm ?? item.dimensions?.depth),
    height: positiveNumber(item.dimensionsCm?.height ?? item.dimensions?.heightCm ?? item.dimensions?.height),
  };

  return {
    name: item.name,
    slug: item.slug || `${slug(item.name)}-${item.shopeeItemId || item._id}`,
    category: category._id,
    categoryName: category.name,
    price: Math.max(1, Math.round(Number(item.price))),
    stock: Math.max(0, Math.round(Number(item.stock))),
    dimensions: dimensionsText(item.dimensions),
    dimensionsCm,
    description: item.description || item.name,
    image: item.image || '',
    images: Array.isArray(item.images) ? item.images : [],
    transparentImage: item.transparentImage || item.image || '',
    sourceImages: Array.isArray(item.sourceImages) ? item.sourceImages : [],
    specifications: Array.isArray(item.specifications) ? item.specifications : [],
    usageType: ['floor-seating', 'standard', 'unknown'].includes(item.usageType) ? item.usageType : 'unknown',
    placementSurface: ['floor', 'wall', 'tabletop', 'unknown'].includes(item.placementSurface) ? item.placementSurface : 'unknown',
    aiDescription: String(item.aiDescription || item.name).slice(0, 300),
    isActive: item.isActive !== false,
  };
}

async function seedProducts(categories) {
  let count = 0;

  for (const item of catalog) {
    const category = categories[item.categoryName];
    if (!category || !item.name || Number(item.price) <= 0) continue;
    const data = productData(item, category);

    await Product.findOneAndUpdate(
      { slug: data.slug },
      { $set: data, $setOnInsert: { ratingAverage: 0, reviewCount: 0 } },
      { upsert: true, runValidators: true },
    );
    count += 1;
  }

  return count;
}

async function seedAccounts() {
  const adminPassword = process.env.ADMIN_PASSWORD || '123';
  const teamAdminPassword = process.env.TEAM_ADMIN_PASSWORD || adminPassword;
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@furneehome.vn').toLowerCase();
  const adminUsername = String(process.env.ADMIN_USERNAME || 'admin').toLowerCase();

  const adminAccounts = [
    { name: 'Hiệp - Orchestra Admin', username: adminUsername, email: adminEmail, password: adminPassword, role: 'superadmin' },
    { name: 'Phúc - Admin', username: 'phuc', email: 'phuc@furneehome.vn', password: teamAdminPassword, role: 'admin' },
    { name: 'Triều - Admin', username: 'trieu', email: 'trieu@furneehome.vn', password: teamAdminPassword, role: 'admin' },
    { name: 'Dũng - Admin', username: 'dung', email: 'dung@furneehome.vn', password: teamAdminPassword, role: 'admin' },
  ];

  for (const account of adminAccounts) {
    const byUsername = await User.findOne({ username: account.username });
    const byEmail = await User.findOne({ email: account.email });
    let admin = byUsername || byEmail;
    const emailBelongsToAnotherAccount = byUsername && byEmail && String(byUsername._id) !== String(byEmail._id);
    if (emailBelongsToAnotherAccount) {
      byEmail.role = 'customer';
      byEmail.isActive = false;
      await byEmail.save();
    }
    if (!admin) admin = new User({ username: account.username, email: account.email });
    admin.name = account.name;
    admin.username = account.username;
    if (!emailBelongsToAnotherAccount) admin.email = account.email;
    admin.password = await bcrypt.hash(account.password, 10);
    admin.role = account.role;
    admin.emailVerified = true;
    admin.isActive = true;
    await admin.save();
  }

  let customer = await User.findOne({ username: 'customer' });
  if (!customer) customer = await User.findOne({ email: 'customer@furneehome.vn' });
  if (!customer) customer = new User({ username: 'customer', email: 'customer@furneehome.vn' });
  customer.name = 'Khách hàng demo';
  customer.password = await bcrypt.hash('user123456', 10);
  customer.role = 'customer';
  customer.emailVerified = true;
  customer.isActive = true;
  await customer.save();
}

async function seed() {
  await connectDatabase();
  const categories = await seedCategories();
  const productCount = await seedProducts(categories);
  await seedAccounts();
  console.log(`Đã nạp ${productCount} sản phẩm và tài khoản demo.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { seed };
