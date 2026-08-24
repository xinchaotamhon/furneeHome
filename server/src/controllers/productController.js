const Category = require('../models/Category');
const Product = require('../models/Product');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'noi-that';
}

async function findCategory(value) {
  const categoryName = typeof value === 'object' ? value?.name : value;
  if (!String(categoryName || '').trim()) throw createError('Danh mục sản phẩm không được để trống.');

  const name = String(categoryName).trim();
  return Category.findOneAndUpdate(
    { slug: toSlug(name) },
    { $setOnInsert: { name, slug: toSlug(name), isActive: true } },
    { upsert: true, returnDocument: 'after' },
  );
}

async function normalizeProduct(body, requireCategory = false) {
  const data = { ...body };
  delete data._id;

  const categoryValue = body.category || body.categoryName;
  if (categoryValue) {
    const category = await findCategory(categoryValue);
    data.category = category._id;
    data.categoryName = category.name;
  } else if (requireCategory) {
    throw createError('Danh mục sản phẩm không được để trống.');
  }
  return data;
}

async function list(req, res, next) {
  try {
    const { search, category } = req.query;
    const filter = { isActive: true };
    if (category) {
      const categoryDoc = await Category.findOne({ $or: [{ slug: category }, { name: category }] });
      if (!categoryDoc) return res.json({ success: true, message: 'Products loaded', data: [] });
      filter.category = categoryDoc._id;
    }
    if (search) filter.$text = { $search: search };

    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 });

    res.json({ success: true, message: 'Products loaded', data: products });
  } catch (error) { next(error); }
}

// Thêm sản phẩm mới
async function create(req, res, next) {
  try {
    const data = await normalizeProduct(req.body, true);
    if (!data.slug && data.name) data.slug = `${toSlug(data.name)}-${Date.now()}`;
    const product = await Product.create(data);
    await product.populate('category', 'name slug');
    res.status(201).json({ success: true, message: 'Product created', data: product });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, await normalizeProduct(req.body), {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.', data: null });
    await product.populate('category', 'name slug');
    res.json({ success: true, message: 'Product updated', data: product });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.', data: null });
    res.json({ success: true, message: 'Product deleted', data: null });
  } catch (error) { next(error); }
}

module.exports = { list, create, update, remove };
