const Product = require('../models/Product');
const productService = require('../services/productService');

async function list(req, res, next) {
  try {
    const products = await productService.list({ search: req.query.search, category: req.query.category });
    res.json({ success: true, message: 'Products loaded', data: products });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, message: 'Product created', data: product });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    res.json({ success: true, message: 'Product updated', data: product });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted', data: null });
  } catch (error) { next(error); }
}

module.exports = { list, create, update, remove };
