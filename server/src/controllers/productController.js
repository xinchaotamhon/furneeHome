const Category = require('../models/Category');
const Product = require('../models/Product');
const {
  buildCanonicalProducts,
  exportProductsToCanonicalJson,
  validateAdminProductImage,
  validateProductImageGallery,
  sourceUrlMetadata,
} = require('../services/productCatalogService');
const { importMetadataFromShopee } = require('../services/shopeeImportService');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function compactProductListItem(product) {
  const value = typeof product?.toObject === 'function' ? product.toObject() : { ...product };
  if (value.image && value.transparentImage === value.image) value.transparentImage = '';
  return value;
}

async function mirrorProductJson(ProductModel, options = {}) {
  try {
    return await exportProductsToCanonicalJson(ProductModel, options);
  } catch (error) {
    // MongoDB remains the durable source. The caller can download a fresh JSON
    // export, so a local fallback-file failure must not undo a real admin edit.
    return { warning: 'Đã lưu MongoDB nhưng chưa đồng bộ được JSON local. Hãy tải JSON mới nhất từ trang quản trị.', error };
  }
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
  if (data.sourceUrl) data.sourceUrl = sourceUrlMetadata(data.sourceUrl).sourceUrl;
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
      .select('-images')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 });

    res.json({ success: true, message: 'Products loaded', data: products.map(compactProductListItem) });
  } catch (error) { next(error); }
}

// Thêm sản phẩm mới
async function create(req, res, next) {
  try {
    const data = await normalizeProduct(req.body, true);
    if (!data.slug && data.name) data.slug = `${toSlug(data.name)}-${Date.now()}`;
    const product = await Product.create(data);
    const mirror = await mirrorProductJson(Product);
    await product.populate('category', 'name slug');
    res.status(201).json({ success: true, message: mirror.warning || 'Product created', data: product });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.', data: null });
    product.set(await normalizeProduct(req.body));
    await product.save();
    const mirror = await mirrorProductJson(Product);
    await product.populate('category', 'name slug');
    res.json({ success: true, message: mirror.warning || 'Product updated', data: product });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.', data: null });
    const removedId = product._id;
    await product.deleteOne();
    const mirror = await mirrorProductJson(Product, { removedIds: [removedId] });
    res.json({ success: true, message: mirror.warning || 'Product deleted', data: null });
  } catch (error) { next(error); }
}

async function metadataFromSourceUrl(req, res, next) {
  try {
    res.json({ success: true, message: 'Đã đọc dữ liệu cơ bản từ URL.', data: sourceUrlMetadata(req.query.sourceUrl) });
  } catch (error) { next(error); }
}

async function importShopee(req, res, next) {
  try {
    const imported = await importMetadataFromShopee(req.body?.sourceUrl);
    const exists = await Product.findOne({
      sourcePlatform: 'shopee',
      shopeeShopId: imported.shopeeShopId,
      shopeeItemId: imported.shopeeItemId,
    });
    if (exists) {
      await exists.populate('category', 'name slug');
      return res.json({
        success: true,
        message: 'Sản phẩm đã có.',
        data: { product: exists, alreadyExists: true },
      });
    }

    const category = await findCategory(imported.category || 'Nội thất');
    const slugSuffix = `-${imported.shopeeItemId}`;
    const productSlug = `${toSlug(imported.name).slice(0, Math.max(1, 100 - slugSuffix.length)).replace(/-+$/g, '')}${slugSuffix}`;
    const product = await Product.create({
      name: imported.name,
      slug: productSlug,
      description: imported.description,
      price: imported.price,
      category: category._id,
      categoryName: category.name,
      sellerName: imported.sellerName,
      isOfficial: imported.isOfficial,
      rating: imported.rating === null ? 0 : imported.rating,
      sourceUrl: imported.sourceUrl,
      shopeeSearchUrl: imported.sourceUrl,
      sourcePlatform: 'shopee',
      shopeeShopId: imported.shopeeShopId,
      shopeeItemId: imported.shopeeItemId,
      sourceImages: imported.sourceImages,
      sourceFetchedAt: new Date(),
      // Shopee listing images are not transparent product cut-outs. Do not send
      // them into Room Studio until a separate image-processing step succeeds.
      importStatus: 'needs-image-processing',
      isActive: true,
    });
    const mirror = await mirrorProductJson(Product);
    await product.populate('category', 'name slug');
    res.status(201).json({ success: true, message: mirror.warning || `Đã thêm: ${product.name}`, data: product });
  } catch (error) { next(error); }
}

async function addImage(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.', data: null });
    const uploadedImage = validateAdminProductImage(req.body?.dataUrl);
    const priorImages = Array.isArray(product.images) ? [...product.images] : [];
    product.images = [...new Set([...priorImages, uploadedImage])];
    validateProductImageGallery(product, product.images);
    // The first uploaded image becomes the runtime reference, replacing a stale
    // local path when the file was never committed with the product metadata.
    if (!priorImages.length) {
      product.image = uploadedImage;
      product.transparentImage = '';
      product.importStatus = 'complete';
    }
    await product.save();
    const mirror = await mirrorProductJson(Product);
    await product.populate('category', 'name slug');
    res.status(201).json({ success: true, message: mirror.warning || 'Đã thêm ảnh sản phẩm.', data: product });
  } catch (error) {
    next(error);
  }
}

async function exportJson(req, res, next) {
  try {
    // The deployable fallback stays small. Full uploaded images remain durable in
    // MongoDB; embedding base64 here would make Git and Cloudflare uploads heavy.
    const products = await buildCanonicalProducts(Product, { includeDataUrls: false });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="furneehome-products.json"');
    res.send(`${JSON.stringify(products, null, 2)}\n`);
  } catch (error) { next(error); }
}

module.exports = { compactProductListItem, list, create, update, remove, metadataFromSourceUrl, importShopee, addImage, exportJson };
