require('../models/Category');
const Product = require('../models/Product');

// Lấy danh sách sản phẩm (có tìm kiếm & lọc danh mục)
async function list(req, res, next) {
  try {
    const { search, category } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
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
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, message: 'Product created', data: product });
  } catch (error) { next(error); }
}

// Cập nhật thông tin sản phẩm
async function update(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    res.json({ success: true, message: 'Product updated', data: product });
  } catch (error) { next(error); }
}

// Xóa sản phẩm
async function remove(req, res, next) {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted', data: null });
  } catch (error) { next(error); }
}

module.exports = { list, create, update, remove };
