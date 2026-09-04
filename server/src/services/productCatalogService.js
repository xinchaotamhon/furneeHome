const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../config/env');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DATA_JSON_FILE = path.join(PROJECT_ROOT, 'client', 'public', 'data_import', 'data_import.json');
const PRODUCT_IMAGE_DIRECTORY = path.join(PROJECT_ROOT, 'client', 'public', 'images', 'products');
let canonicalExportQueue = Promise.resolve();

function removeUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
}

function toPlainProduct(product, { includeDataUrls = true } = {}) {
  const value = typeof product?.toObject === 'function' ? product.toObject() : { ...product };
  const categoryName = typeof value.category === 'object' ? value.category?.name : value.categoryName;
  const keepImage = (image) => includeDataUrls || !String(image || '').startsWith('data:');
  const gallery = Array.isArray(value.images) ? value.images.filter((image) => Boolean(image) && keepImage(image)) : [];
  const primaryImage = [value.image, value.transparentImage, ...gallery].find((image) => image && keepImage(image)) || '';
  const transparentImage = [value.transparentImage, value.image, ...gallery].find((image) => image && keepImage(image)) || '';
  return removeUndefinedFields({
    _id: String(value._id),
    name: value.name || 'Sản phẩm nội thất',
    slug: value.slug || '',
    category: categoryName || value.categoryName || 'Nội thất',
    categoryName: categoryName || value.categoryName || 'Nội thất',
    price: Number.isFinite(value.price) ? value.price : 0,
    stock: Number.isFinite(value.stock) ? value.stock : 0,
    image: primaryImage,
    images: gallery,
    transparentImage,
    sourceUrl: value.sourceUrl || value.shopeeSearchUrl || '',
    shopeeSearchUrl: value.shopeeSearchUrl || value.sourceUrl || '',
    sourcePlatform: value.sourcePlatform || '',
    shopeeShopId: value.shopeeShopId || '',
    shopeeItemId: value.shopeeItemId || '',
    sourceImages: Array.isArray(value.sourceImages) ? value.sourceImages : [],
    sourceFetchedAt: value.sourceFetchedAt || undefined,
    importStatus: value.importStatus || 'complete',
    sellerName: value.sellerName || '',
    isOfficial: Boolean(value.isOfficial),
    rating: Number.isFinite(value.rating) ? value.rating : 0,
    description: value.description || '',
    dimensions: value.dimensions || undefined,
    dimensionsCm: value.dimensionsCm || undefined,
    usageType: value.usageType || 'unknown',
    placementSurface: value.placementSurface || 'unknown',
    aiDescription: value.aiDescription || '',
    colors: Array.isArray(value.colors) ? value.colors : [],
    searchKeywords: Array.isArray(value.searchKeywords) ? value.searchKeywords : [],
    isActive: value.isActive !== false,
  });
}

async function writeJsonAtomically(filePath, contents) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function readExistingCanonicalJson() {
  try {
    const raw = await fs.readFile(DATA_JSON_FILE, 'utf8');
    const existing = JSON.parse(raw);
    if (!Array.isArray(existing)) throw new Error('JSON sản phẩm phải là một mảng.');
    return existing;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function mergeCanonicalProducts(existing, products, { removedIds = [], includeDataUrls = true } = {}) {
  const existingById = new Map(existing.map((item) => [String(item?._id || ''), item]));
  const databaseIds = new Set(products.map((product) => String(product._id)));
  const removed = new Set(removedIds.map(String));
  const preservedJsonOnly = existing.filter((item) => {
    const id = String(item?._id || '');
    return id && !databaseIds.has(id) && !removed.has(id);
  });
  const databaseProducts = products.map((product) => ({
    ...(existingById.get(String(product._id)) || {}),
    ...toPlainProduct(product, { includeDataUrls }),
  }));
  return [...databaseProducts, ...preservedJsonOnly];
}

async function buildCanonicalProducts(Product, { removedIds = [], includeDataUrls = true } = {}) {
  const [products, existing] = await Promise.all([
    Product.find({}).populate('category', 'name slug').sort({ createdAt: -1 }),
    readExistingCanonicalJson(),
  ]);
  return mergeCanonicalProducts(existing, products, { removedIds, includeDataUrls });
}

async function exportProductsToCanonicalJson(Product, { removedIds = [] } = {}) {
  if (env.isProduction) return { skipped: true, message: 'Production does not write a bundled static JSON file.' };
  const runExport = async () => {
    // Each queued operation re-reads both sources, so concurrent admin requests
    // cannot overwrite another request's newly added fields with a stale snapshot.
    const payload = await buildCanonicalProducts(Product, { removedIds, includeDataUrls: false });
    await writeJsonAtomically(DATA_JSON_FILE, `${JSON.stringify(payload, null, 2)}\n`);
    return { path: DATA_JSON_FILE, count: payload.length };
  };
  const scheduled = canonicalExportQueue.then(runExport, runExport);
  canonicalExportQueue = scheduled.catch(() => {});
  return scheduled;
}

function validateShopeeProductUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    const error = new Error('URL Shopee không hợp lệ.');
    error.status = 400;
    throw error;
  }
  if (parsed.protocol !== 'https:' || !/(^|\.)shopee\.vn$/i.test(parsed.hostname)) {
    const error = new Error('Chỉ chấp nhận URL HTTPS thuộc shopee.vn.');
    error.status = 400;
    throw error;
  }
  return parsed;
}

function sourceUrlMetadata(value) {
  const parsed = validateShopeeProductUrl(value);
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    const error = new Error('Đường dẫn URL Shopee chứa ký tự mã hóa không hợp lệ.');
    error.status = 400;
    throw error;
  }
  const name = decodedPath
    .replace(/^\/+|\/+$/g, '')
    .replace(/(?:-i\.|i\.)\d+\.\d+.*$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const identifiers = decodedPath.match(/(?:-i\.|i\.|\/product\/)(\d+)(?:\.|\/)(\d+)/i);
  return {
    sourceUrl: `${parsed.origin}${parsed.pathname}`,
    name: name || '',
    shopeeShopId: identifiers?.[1] || '',
    shopeeItemId: identifiers?.[2] || '',
    // This is intentionally URL-derived only. The server never fetches arbitrary
    // URLs, logs into Shopee, or bypasses a captcha merely to prefill a form.
    metadataSource: 'url-slug',
  };
}

const MIME_TO_EXTENSION = Object.freeze({
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
});

function hasExpectedImageSignature(mimeType, contents) {
  if (mimeType === 'image/png') return contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return contents.length >= 3 && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff;
  return contents.length >= 12
    && contents.subarray(0, 4).equals(Buffer.from('RIFF'))
    && contents.subarray(8, 12).equals(Buffer.from('WEBP'));
}

function dataUrlBytes(value) {
  const match = /^data:[^;]+;base64,([a-z0-9+/=]+)$/i.exec(String(value || ''));
  return match ? Buffer.from(match[1], 'base64').length : 0;
}

function validateAdminProductImage(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!match) {
    const error = new Error('Ảnh phải là dữ liệu PNG, JPEG hoặc WebP hợp lệ.');
    error.status = 400;
    throw error;
  }
  const contents = Buffer.from(match[2], 'base64');
  if (!contents.length || contents.length > 512 * 1024) {
    const error = new Error('Ảnh cần lớn hơn 0 và không quá 512 KB sau khi nén.');
    error.status = 400;
    throw error;
  }
  if (!hasExpectedImageSignature(match[1].toLowerCase(), contents)) {
    const error = new Error('Nội dung file không khớp định dạng ảnh đã khai báo.');
    error.status = 400;
    throw error;
  }
  return `data:${match[1].toLowerCase()};base64,${contents.toString('base64')}`;
}

function productImageId(product) {
  const fromProduct = String(product?.shopeeItemId || '').trim();
  if (/^\d+$/.test(fromProduct)) return fromProduct;

  // Older records may not have shopeeItemId populated yet. Keep the filename
  // deterministic by deriving it from the canonical URL before falling back to
  // the Mongo id.
  if (product?.sourceUrl) {
    try {
      const fromUrl = sourceUrlMetadata(product.sourceUrl).shopeeItemId;
      if (/^\d+$/.test(fromUrl)) return fromUrl;
    } catch { /* the image can still be kept durably as a data URL */ }
  }

  const fromMongo = String(product?._id || '').trim().replace(/[^a-z0-9_-]/gi, '');
  return fromMongo || '';
}

function adminProductImageTarget(product, mimeType = 'image/png') {
  const id = productImageId(product);
  const extension = MIME_TO_EXTENSION[mimeType.toLowerCase()];
  if (!id || !extension) return null;
  return {
    publicPath: `/images/products/${id}${extension}`,
    filePath: path.join(PRODUCT_IMAGE_DIRECTORY, `${id}${extension}`),
  };
}

/**
 * Store an admin image in the durable form appropriate for the runtime.
 *
 * Local/dev deployments can serve a checked-out public file, while production
 * filesystems are ephemeral and therefore keep the validated data URL in Mongo.
 * A local write failure deliberately falls back to that same Mongo-safe value.
 */
async function persistAdminProductImage(product, dataUrl, {
  isProduction = env.isProduction,
  fsImpl = fs,
} = {}) {
  const validated = validateAdminProductImage(dataUrl);
  if (isProduction) return { value: validated, publicPath: '', written: false };

  const mimeType = /^data:([^;]+);base64,/i.exec(validated)?.[1]?.toLowerCase() || '';
  const target = adminProductImageTarget(product, mimeType);
  if (!target) return { value: validated, publicPath: '', written: false };

  try {
    await fsImpl.mkdir(PRODUCT_IMAGE_DIRECTORY, { recursive: true });
    const encoded = validated.slice(validated.indexOf(',') + 1);
    await fsImpl.writeFile(target.filePath, Buffer.from(encoded, 'base64'));
    return { value: target.publicPath, publicPath: target.publicPath, written: true };
  } catch {
    // Do not put an unusable local path in Mongo when the file could not be
    // written. Mongo remains the source of truth for this uploaded image.
    return { value: validated, publicPath: '', written: false };
  }
}

function validateProductImageGallery(product, images) {
  if (images.length > 6) {
    const error = new Error('Mỗi sản phẩm chỉ có tối đa 6 ảnh bổ sung.');
    error.status = 400;
    throw error;
  }
  const allImages = [...new Set([product.image, product.transparentImage, ...images].filter(Boolean))];
  if (allImages.reduce((total, image) => total + dataUrlBytes(image), 0) > 3 * 1024 * 1024) {
    const error = new Error('Tổng dung lượng ảnh lưu trong sản phẩm không được quá 3 MB.');
    error.status = 400;
    throw error;
  }
}

module.exports = {
  DATA_JSON_FILE,
  exportProductsToCanonicalJson,
  buildCanonicalProducts,
  validateAdminProductImage,
  productImageId,
  adminProductImageTarget,
  persistAdminProductImage,
  validateProductImageGallery,
  hasExpectedImageSignature,
  mergeCanonicalProducts,
  validateShopeeProductUrl,
  sourceUrlMetadata,
  toPlainProduct,
};
