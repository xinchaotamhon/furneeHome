const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

const MAX_IMAGE_LENGTH = 5_000_000;
const LOCAL_CATALOG_PATH = path.resolve(__dirname, '../../../client/public/data_import/data_import.json');
const SHOPEE_API = 'https://shopee.vn/api/v4/item/get';

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

function uniqueStrings(values, maximum = 12) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
    .slice(0, maximum);
}

function parseShopeeUrl(value) {
  const sourceUrl = String(value || '').trim();
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw createError('Link Shopee không hợp lệ.');
  }
  if (!/(^|\.)shopee\.(vn|co\.id|co\.th|ph|sg|com\.my)$/i.test(parsed.hostname)) {
    throw createError('Chỉ hỗ trợ link sản phẩm Shopee.');
  }
  const match = `${parsed.pathname}${parsed.search}`.match(/(?:^|[-.])i\.(\d+)\.(\d+)(?:$|[?&#/])/i);
  if (!match) throw createError('Link Shopee thiếu mã shop hoặc mã sản phẩm.');
  return { sourceUrl, shopId: match[1], itemId: match[2] };
}

function imageUrl(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  return `https://down-vn.img.susercontent.com/file/${source}`;
}

function shopeePriceToVnd(item) {
  const price = Number(item.price_min ?? item.price ?? item.price_before_discount ?? 0);
  // Shopee item APIs represent VND in 1/100000 dong units.
  return Number.isFinite(price) && price > 0 ? Math.round(price / 100000) : 0;
}

function shopeeStock(item) {
  if (Array.isArray(item.models) && item.models.length) {
    return item.models.reduce((total, model) => total + Math.max(0, Number(model.stock) || 0), 0);
  }
  return Math.max(0, Math.round(Number(item.stock) || 0));
}

function shopeeSpecifications(item) {
  return (Array.isArray(item.attributes) ? item.attributes : [])
    .map((attribute) => ({
      name: String(attribute.name || attribute.key || '').trim(),
      value: String(attribute.value || attribute.val || '').trim(),
    }))
    .filter((attribute) => attribute.name && attribute.value)
    .slice(0, 30);
}

function suggestedCategory(name, description, sourceCategoryName) {
  const value = `${name} ${description} ${sourceCategoryName}`.toLocaleLowerCase('vi-VN');
  if (/giường|nệm|chăn|gối|tủ quần áo/.test(value)) return 'Phòng ngủ';
  if (/bếp|nồi|chảo|bát|đĩa|ly|cốc|bàn ăn/.test(value)) return 'Bếp & Phòng ăn';
  if (/thảm|đèn|gương|tranh|cây|hoa giả|rèm|decor|trang trí/.test(value)) return 'Trang trí & Đèn';
  if (/bàn|ghế|kệ sách|văn phòng|học tập|làm việc/.test(value)) return 'Phòng làm việc';
  return 'Phòng khách';
}

function shopeeProductData(item, sourceUrl, shopId, itemId) {
  const name = String(item.name || '').trim();
  const description = String(item.description || '').trim();
  const images = uniqueStrings([
    imageUrl(item.image),
    ...(Array.isArray(item.images) ? item.images.map(imageUrl) : []),
  ]);
  const sourceCategoryName = String(
    item.categories?.[item.categories.length - 1]?.display_name
      || item.category_name
      || item.category
      || '',
  ).trim();
  const price = shopeePriceToVnd(item);
  if (!name || !price) throw createError('Shopee không trả về tên hoặc giá hợp lệ.', 502);
  return {
    name,
    description: description || name,
    price,
    stock: shopeeStock(item),
    image: images[0] || '',
    images,
    sourceImages: images,
    sourceUrl,
    sourcePlatform: 'shopee',
    shopeeShopId: shopId,
    shopeeItemId: itemId,
    sourceCategoryName,
    sellerName: String(item.shop_name || item.shop?.name || '').trim(),
    specifications: shopeeSpecifications(item),
    categoryName: suggestedCategory(name, description, sourceCategoryName),
    importedAt: new Date(),
    isActive: shopeeStock(item) > 0,
  };
}

function catalogRecord(product) {
  const item = product.toObject ? product.toObject() : product;
  return {
    _id: String(item._id),
    name: item.name,
    slug: item.slug,
    category: item.categoryName,
    categoryName: item.categoryName,
    price: item.price,
    stock: item.stock,
    image: item.image,
    images: item.images || [],
    transparentImage: item.transparentImage || '',
    sourceImages: item.sourceImages || [],
    sourceUrl: item.sourceUrl,
    sourcePlatform: item.sourcePlatform,
    shopeeShopId: item.shopeeShopId,
    shopeeItemId: item.shopeeItemId,
    sourceCategoryName: item.sourceCategoryName || '',
    sellerName: item.sellerName || '',
    specifications: item.specifications || [],
    description: item.description,
    usageType: item.usageType,
    placementSurface: item.placementSurface,
    aiDescription: item.aiDescription || item.name,
    isActive: item.isActive,
    importedAt: item.importedAt ? new Date(item.importedAt).toISOString() : undefined,
  };
}

async function syncLocalCatalog(product) {
  const raw = await fs.readFile(LOCAL_CATALOG_PATH, 'utf8');
  const catalog = JSON.parse(raw);
  if (!Array.isArray(catalog)) throw createError('Catalog local không đúng định dạng.', 500);
  const record = catalogRecord(product);
  const index = catalog.findIndex((item) => (
    String(item.shopeeShopId || '') === record.shopeeShopId
    && String(item.shopeeItemId || '') === record.shopeeItemId
  ));
  if (index >= 0) catalog[index] = { ...catalog[index], ...record };
  else catalog.push(record);
  await fs.writeFile(LOCAL_CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
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

  for (const [field, maximum] of Object.entries({ description: 2000, aiDescription: 300, sourceUrl: 2000 })) {
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

async function list(req, res, next) {
  try {
    const { search, category, sort, minPrice, maxPrice } = req.query;
    const filter = ['admin', 'superadmin'].includes(req.user?.role) ? {} : { isActive: true, price: { $gt: 0 } };

    if (search) {
      filter.$or = [
        { name: { $regex: String(search).trim(), $options: 'i' } },
        { categoryName: { $regex: String(search).trim(), $options: 'i' } },
        { description: { $regex: String(search).trim(), $options: 'i' } },
      ];
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

    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortOption);

    return res.json({ success: true, message: 'Đã tải sản phẩm.', data: products });
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

async function importShopee(req, res, next) {
  try {
    const { sourceUrl, shopId, itemId } = parseShopeeUrl(req.body.sourceUrl || req.body.url);
    const response = await fetch(`${SHOPEE_API}?itemid=${encodeURIComponent(itemId)}&shopid=${encodeURIComponent(shopId)}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; FurneeHome local catalog importer)',
        referer: sourceUrl,
      },
    });
    if (!response.ok) throw createError('Shopee hiện không cho tải dữ liệu sản phẩm. Vui lòng thử lại sau.', 502);
    const payload = await response.json();
    const item = payload?.data?.item || payload?.data;
    if (!item || payload?.error) throw createError('Shopee không trả về dữ liệu sản phẩm hợp lệ.', 502);

    const data = shopeeProductData(item, sourceUrl, shopId, itemId);
    const category = await findCategory(data.categoryName);
    data.category = category._id;
    data.categoryName = category.name;
    data.aiDescription = data.name.slice(0, 300);

    const product = await Product.findOneAndUpdate(
      { sourcePlatform: 'shopee', shopeeShopId: shopId, shopeeItemId: itemId },
      { $set: data, $setOnInsert: { slug: `${toSlug(data.name)}-${itemId}` } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    await syncLocalCatalog(product);
    await product.populate('category', 'name slug');
    return res.status(201).json({ success: true, message: 'Đã import dữ liệu Shopee vào MongoDB và catalog local.', data: product });
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
  addImage,
  importShopee,
  productData,
  toSlug,
  parseShopeeUrl,
  shopeeProductData,
  suggestedCategory,
  shopeeSpecifications,
};
