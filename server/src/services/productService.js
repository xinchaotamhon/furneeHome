const Product = require('../models/Product');

async function list({ search = '', category } = {}) {
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };
  return Product.find(filter).populate('category', 'name slug').sort({ createdAt: -1 });
}

module.exports = { list };
