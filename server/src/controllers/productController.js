const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const env = require('../config/env');
const Cart = require('../models/Cart');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');

const MAX_IMAGE_LENGTH = 5_000_000;
const JSON_FILE = path.resolve(__dirname, '../../../client/public/data_import/data_import.json');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'noi-that';
}

function text(value, maximum) {
  if (value === undefined) return undefined;
  const result = String(value || '').trim();
  if (result.length > maximum) throw createError('Nội dung nhập quá dài.');
  return result;
}

function number(value, label, minimum = 0, whole = false) {
  if (value === undefined || value === '') return undefined;
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum || (whole && !Number.isInteger(result))) throw createError(`${label} không hợp lệ.`);
  return result;
}

async function findCategory(value) {
  const name = text(typeof value === 'object' ? value?.name : value, 80);
  if (!name) throw createError('Danh mục không được để trống.');
  const slug = toSlug(name);
  return Category.findOneAndUpdate(
    { slug },
    { $setOnInsert: { name, slug, isActive: true } },
    { upsert: true, returnDocument: 'after' },
  );
}

async function productData(body, creating = false) {
  const data = {};
  const name = text(body.name, 200);
  if (creating && !name) throw createError('Tên sản phẩm không được để trống.');
  if (name !== undefined) data.name = name;

  const price = number(body.price, 'Giá sản phẩm', 1, true);
  if (creating && price === undefined) throw createError('Giá sản phẩm không được để trống.');
  if (price !== undefined) data.price = price;

  const stock = number(body.stock, 'Số lượng tồn kho', 0, true);
  if (stock !== undefined) data.stock = stock;

  const dimensions = text(body.dimensions, 100);
  if (dimensions !== undefined) data.dimensions = dimensions;

  const categoryValue = body.categoryName ?? body.category;
  if (categoryValue !== undefined) {
    const category = await findCategory(categoryValue);
    data.category = category._id;
    data.categoryName = category.name;
  } else if (creating) {
    throw createError('Danh mục không được để trống.');
  }

  for (const [field, maximum] of Object.entries({ description: 2000, aiDescription: 300 })) {
    const value = text(body[field], maximum);
    if (value !== undefined) data[field] = value;
  }

  if (Array.isArray(body.images)) {
    data.images = body.images.filter((img) => typeof img === 'string' && img.trim().length > 0);
  }

  if (body.dimensionsCm) {
    data.dimensionsCm = {
      width: number(body.dimensionsCm.width, 'Chiều rộng', 1),
      depth: number(body.dimensionsCm.depth, 'Chiều sâu', 1),
      height: number(body.dimensionsCm.height, 'Chiều cao', 1),
    };
  }
  if (['floor-seating', 'standard', 'unknown'].includes(body.usageType)) data.usageType = body.usageType;
  if (['floor', 'wall', 'tabletop', 'unknown'].includes(body.placementSurface)) data.placementSurface = body.placementSurface;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  return data;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã sản phẩm không hợp lệ.');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicImage(value) {
  const image = String(value || '').trim();
  return image && !image.startsWith('data:') ? image : '';
}

function publicImages(values) {
  return Array.isArray(values) ? values.map(publicImage).filter(Boolean) : [];
}

function jsonProduct(product, oldProduct = {}) {
  const data = product.toObject();
  const categoryName = data.category?.name || data.categoryName || 'Nội thất';
  const images = publicImages(data.images);
  const oldImages = publicImages(oldProduct.images);
  const image = publicImage(data.image)
    || publicImage(data.transparentImage)
    || images[0]
    || publicImage(oldProduct.image);

  return {
    ...oldProduct,
    _id: String(data._id),
    name: data.name,
    slug: data.slug,
    category: categoryName,
    categoryName,
    price: data.price,
    stock: data.stock,
    dimensions: data.dimensions || '',
    dimensionsCm: data.dimensionsCm || {},
    description: data.description || '',
    image: image || '',
    images: images.length ? images : oldImages,
    transparentImage: publicImage(data.transparentImage) || image || '',
    sourceImages: publicImages(data.sourceImages).length
      ? publicImages(data.sourceImages)
      : publicImages(oldProduct.sourceImages),
    specifications: Array.isArray(data.specifications) ? data.specifications : [],
    usageType: data.usageType || 'unknown',
    placementSurface: data.placementSurface || 'unknown',
    aiDescription: data.aiDescription || '',
    ratingAverage: data.ratingAverage || 0,
    reviewCount: data.reviewCount || 0,
    isActive: data.isActive !== false,
  };
}

async function buildJsonProducts() {
  let oldProducts = [];
  try {
    oldProducts = JSON.parse(await fs.readFile(JSON_FILE, 'utf8'));
  } catch {
    oldProducts = [];
  }

  const oldById = new Map(oldProducts.map((product) => [String(product._id), product]));
  const oldBySlug = new Map(oldProducts.map((product) => [product.slug, product]));
  const products = await Product.find().populate('category', 'name').sort({ createdAt: -1 });

  return products.map((product) => {
    const oldProduct = oldById.get(String(product._id)) || oldBySlug.get(product.slug) || {};
    return jsonProduct(product, oldProduct);
  });
}

async function list(req, res, next) {
  try {
    const { search, category, sort, minPrice, maxPrice } = req.query;
    const baseFilter = ['admin', 'superadmin'].includes(req.user?.role) ? {} : { isActive: true, price: { $gt: 0 } };
    const filter = { ...baseFilter };

    if (search) {
      const searchText = String(search).trim();
      if (searchText) {
        const keyword = escapeRegex(searchText);
        const slugKeyword = escapeRegex(toSlug(searchText));
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { slug: { $regex: slugKeyword, $options: 'i' } },
          { categoryName: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
        ];
      }
    }

    if (category && category !== 'Tất cả') {
      filter.categoryName = category;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price-asc' || sort === 'low') sortOption = { price: 1 };
    else if (sort === 'price-desc' || sort === 'high') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { ratingAverage: -1 };

    const query = Product.find(filter).populate('category', 'name slug').sort(sortOption);
    if (!req.query.page && !req.query.limit) {
      const products = await query;
      return res.json({ success: true, message: 'Đã tải sản phẩm.', data: products });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const total = await Product.countDocuments(filter);
    const products = await query.skip((page - 1) * limit).limit(limit);
    const categories = await Product.distinct('categoryName', baseFilter);
    return res.json({
      success: true,
      message: 'Đã tải sản phẩm.',
      data: products,
      categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')),
      pagination: { total, page, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    checkId(req.params.id);
    const filter = ['admin', 'superadmin'].includes(req.user?.role) ? { _id: req.params.id } : { _id: req.params.id, isActive: true, price: { $gt: 0 } };
    const product = await Product.findOne(filter).populate('category', 'name slug');
    if (!product) throw createError('Không tìm thấy sản phẩm.', 404);
    return res.json({ success: true, message: 'Đã tải chi tiết sản phẩm.', data: product });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await productData(req.body, true);
    data.slug = `${toSlug(data.name)}-${Date.now()}`;
    const product = await Product.create(data);
    await product.populate('category', 'name slug');
    return res.status(201).json({ success: true, message: 'Đã thêm sản phẩm.', data: product });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    checkId(req.params.id);
    const product = await Product.findById(req.params.id);
    if (!product) throw createError('Không tìm thấy sản phẩm.', 404);
    product.set(await productData(req.body));
    await product.save();
    await product.populate('category', 'name slug');
    return res.json({ success: true, message: 'Đã cập nhật sản phẩm.', data: product });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    checkId(req.params.id);
    // Preserve order snapshots and the ability to restore stock if a pending order is cancelled.
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { returnDocument: 'after' });
    if (!product) throw createError('Không tìm thấy sản phẩm.', 404);
    return res.json({ success: true, message: 'Đã ngừng bán sản phẩm.', data: null });
  } catch (error) {
    return next(error);
  }
}

async function permanentRemove(req, res, next) {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Chỉ Orchestra Admin mới có quyền xóa vĩnh viễn sản phẩm khỏi MongoDB.', data: null });
    }
    checkId(req.params.id);

    const [hasOrder, hasReview, hasCart] = await Promise.all([
      Order.exists({ 'orderItems.product': req.params.id }),
      Review.exists({ product: req.params.id }),
      Cart.exists({ 'items.product': req.params.id }),
    ]);
    if (hasOrder || hasReview || hasCart) {
      throw createError('Sản phẩm đã có đơn hàng, đánh giá hoặc giỏ hàng. Hãy dùng Ngừng bán để giữ lịch sử.', 409);
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw createError('Không tìm thấy sản phẩm.', 404);
    return res.json({ success: true, message: 'Đã xóa sản phẩm khỏi MongoDB.', data: null });
  } catch (error) {
    return next(error);
  }
}

async function syncJson(req, res, next) {
  try {
    if (env.isProduction) throw createError('Chỉ đồng bộ JSON khi chạy localhost.', 409);
    const products = await buildJsonProducts();
    await fs.writeFile(JSON_FILE, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
    return res.json({ success: true, message: `Đã đồng bộ ${products.length} sản phẩm từ MongoDB sang JSON.`, data: { count: products.length } });
  } catch (error) {
    return next(error);
  }
}

async function addImage(req, res, next) {
  try {
    checkId(req.params.id);
    const image = String(req.body.dataUrl || '').trim();
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(image)) throw createError('Chọn ảnh JPG, PNG hoặc WebP.');
    if (image.length > MAX_IMAGE_LENGTH) throw createError('Ảnh sản phẩm quá lớn.');

    const product = await Product.findById(req.params.id);
    if (!product) throw createError('Không tìm thấy sản phẩm.', 404);
    product.image = image;
    product.transparentImage = image;
    if (!product.images) product.images = [];
    product.images.push(image);
    await product.save();
    return res.json({ success: true, message: 'Đã cập nhật ảnh sản phẩm.', data: product });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  permanentRemove,
  addImage,
  syncJson,
  buildJsonProducts,
  productData,
  toSlug,
  escapeRegex,
};
