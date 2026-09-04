const { sourceUrlMetadata } = require('./productCatalogService');

const SHOPEE_API_ORIGIN = 'https://shopee.vn';
const IMAGE_ORIGIN = 'https://down-vn.img.susercontent.com/file/';
const REQUEST_TIMEOUT_MS = 7000;
const MAX_RESPONSE_BYTES = 750 * 1024;

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function numberValue(value) {
  if (typeof value === 'string') {
    let cleaned = value.trim().replace(/[^\d,.-]/g, '');
    if (/^-?\d{1,3}(?:[.,]\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/[.,]/g, '');
    else if (cleaned.includes(',') && !cleaned.includes('.')) cleaned = cleaned.replace(',', '.');
    value = cleaned;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// Shopee's public item API commonly represents VND in 1/100000 units.
function shopeePrice(value) {
  const number = numberValue(value);
  if (number === null) return null;
  return number >= 1000000 ? Math.round(number / 100000) : Math.round(number);
}

function sourceImageUrl(value) {
  const image = String(
    (value && typeof value === 'object' ? value.url || value.image_url || value.image : value) || '',
  ).trim();
  if (!image) return '';
  if (/^https:\/\/(?:[\w-]+\.)+susercontent\.com\//i.test(image)) return image;
  return /^[a-z0-9_-]+$/i.test(image) ? `${IMAGE_ORIGIN}${image}` : '';
}

function imageList(value) {
  const images = [];
  const visit = (entry) => {
    if (Array.isArray(entry)) return entry.forEach(visit);
    const image = sourceImageUrl(entry);
    if (image) images.push(image);
  };
  visit(value);
  return [...new Set(images)].slice(0, 9);
}

function firstNumeric(value, depth = 0) {
  if (value === null || value === undefined || depth > 3) return null;
  if (typeof value !== 'object') return numberValue(value);
  const keys = ['single_value', 'value', 'price', 'price_min', 'min_price', 'amount', 'raw_value'];
  for (const key of keys) {
    if (Object.hasOwn(value, key)) {
      const number = firstNumeric(value[key], depth + 1);
      if (number !== null) return number;
    }
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const number = firstNumeric(entry, depth + 1);
      if (number !== null) return number;
    }
  }
  return null;
}

function categoryName(...groups) {
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    const category = [...group].reverse().find((entry) => normalizeText(entry?.display_name || entry?.name));
    if (category) return normalizeText(category.display_name || category.name);
  }
  return '';
}

function structuredProduct(value, expected) {
  if (!value || typeof value !== 'object') return null;
  const item = value.item || value.data?.item || value.data || value;
  if (!item || typeof item !== 'object') return null;

  const shopId = String(item.shopid ?? item.shop_id ?? expected.shopeeShopId ?? '');
  const itemId = String(item.itemid ?? item.item_id ?? expected.shopeeItemId ?? '');
  if (shopId && expected.shopeeShopId && shopId !== expected.shopeeShopId) return null;
  if (itemId && expected.shopeeItemId && itemId !== expected.shopeeItemId) return null;

  const offers = item.offers || item.offer || {};
  const productPrice = value.product_price || value.productPrice || {};
  const rawPrice = firstNumeric(
    item.price ?? item.price_min ?? offers.price ?? offers.lowPrice ?? item.models
      ?? productPrice.price ?? productPrice.price_min ?? productPrice,
  );
  const price = shopeePrice(rawPrice);
  const productImages = value.product_images || value.productImages || {};
  const images = imageList([
    item.images,
    item.image,
    item.image_url,
    item.imageUrl,
    productImages.images,
    productImages.gallery_contents?.map((entry) => entry?.image),
    productImages.models?.map((entry) => entry?.gallery_image),
  ]);
  const name = normalizeText(item.name ?? item.title);
  if (!name || price === null || !images.length) return null;

  const shop = value.shop_detailed || value.shop || item.shop || item.seller || {};
  const review = value.product_review || item.item_rating || {};
  const rating = numberValue(review.rating_star ?? item.rating_star ?? item.rating);

  return {
    name,
    description: normalizeText(item.description),
    price,
    category: categoryName(item.categories, value.product_attributes?.categories),
    sellerName: normalizeText(item.shop_name ?? shop.name ?? shop.shop_name ?? shop.username),
    isOfficial: Boolean(item.is_official_shop ?? item.is_shopee_mart ?? shop.is_official_shop ?? value.product_meta?.show_official_shop_label_in_title),
    rating: rating !== null && rating <= 5 ? rating : null,
    sourceImages: images,
  };
}

function readAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

function metaValues(html) {
  const values = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = readAttributes(match[0]);
    const key = (attributes.property || attributes.name || '').toLowerCase();
    if (key && attributes.content && !values[key]) values[key] = attributes.content;
  }
  return values;
}

function extractJsonScripts(html) {
  const values = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = readAttributes(match[1]);
    if (attributes.type !== 'application/ld+json' && attributes.type !== 'application/json' && attributes.id !== '__NEXT_DATA__') continue;
    try { values.push(JSON.parse(match[2].trim())); } catch { /* ignore invalid third-party script data */ }
  }
  return values;
}

function balancedJsonAt(value, start) {
  const opening = value[start];
  if (opening !== '{' && opening !== '[') return '';
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === opening) depth += 1;
    if (character === closing) {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }
  return '';
}

// A safe MFE fallback: parse JSON assigned to a page-data variable, never execute page JavaScript.
function extractMfePayloads(html) {
  const values = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = readAttributes(match[1]);
    if (attributes.type !== 'text/mfe-initial-data') continue;
    try { values.push(JSON.parse(match[2].trim())); } catch { /* invalid page state */ }
  }
  const marker = /(?:window\.)?__(?:MFE|NEXT|SHOPEE)_[A-Z0-9_]+__\s*=\s*/gi;
  for (const match of html.matchAll(marker)) {
    const start = match.index + match[0].length;
    const raw = balancedJsonAt(html, start);
    if (!raw) continue;
    try { values.push(JSON.parse(raw)); } catch { /* page state was not JSON */ }
  }
  return values;
}

function findStructuredProduct(value, expected) {
  const queue = [value];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    const candidate = structuredProduct(current, expected);
    if (candidate) return candidate;
    Object.values(current).forEach((child) => {
      if (child && typeof child === 'object') queue.push(child);
    });
  }
  return null;
}

function jsonLdProduct(value) {
  const queue = Array.isArray(value) ? [...value] : [value];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current['@graph'])) queue.push(...current['@graph']);
    if (String(current['@type'] || '').toLowerCase().includes('product')) {
      const offers = Array.isArray(current.offers) ? current.offers[0] : current.offers || {};
      const price = numberValue(offers.price ?? current.price);
      const images = imageList(current.image);
      const name = normalizeText(current.name);
      if (name && price !== null && images.length) {
        return {
          name,
          description: normalizeText(current.description),
          price: Math.round(price),
          sellerName: normalizeText(current.brand?.name ?? current.brand),
          isOfficial: false,
          rating: numberValue(current.aggregateRating?.ratingValue),
          sourceImages: images,
        };
      }
    }
  }
  return null;
}

function metaProduct(html) {
  const meta = metaValues(html);
  const name = normalizeText(meta['og:title'] || meta.title);
  const price = numberValue(meta['product:price:amount'] || meta['og:price:amount']);
  const images = imageList(meta['og:image']);
  if (!name || price === null || !images.length) return null;
  return {
    name,
    description: normalizeText(meta['og:description'] || meta.description),
    price: Math.round(price),
    sellerName: '',
    isOfficial: false,
    rating: null,
    sourceImages: images,
  };
}

async function readResponse(response, maxBytes) {
  if (!response?.ok) return null;
  const length = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw createError('Phản hồi Shopee quá lớn.', 422);

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw createError('Phản hồi Shopee quá lớn.', 422);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
  }

  const text = await response.text();
  if (Buffer.byteLength(text) > maxBytes) throw createError('Phản hồi Shopee quá lớn.', 422);
  return text;
}

async function fetchText(url, { fetchImpl = global.fetch, timeoutMs = REQUEST_TIMEOUT_MS, maxBytes = MAX_RESPONSE_BYTES } = {}) {
  if (typeof fetchImpl !== 'function') throw createError('Máy chủ chưa hỗ trợ đọc dữ liệu Shopee.', 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9',
        'User-Agent': 'FurneeHome/1.0 (+student project; public product metadata only)',
      },
      // The initial URL has already been restricted to shopee.vn. Do not follow
      // redirects to a host controlled outside that allowlist.
      redirect: 'manual',
      signal: controller.signal,
    });
    return readResponse(response, maxBytes);
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function importMetadataFromShopee(sourceUrl, options = {}) {
  const source = sourceUrlMetadata(sourceUrl);
  if (!source.shopeeShopId || !source.shopeeItemId) {
    throw createError('URL Shopee phải chứa mã cửa hàng và mã sản phẩm.', 400);
  }

  const apiUrl = `${SHOPEE_API_ORIGIN}/api/v4/item/get?itemid=${encodeURIComponent(source.shopeeItemId)}&shopid=${encodeURIComponent(source.shopeeShopId)}`;
  const apiText = await fetchText(apiUrl, options);
  if (apiText) {
    try {
      const product = findStructuredProduct(JSON.parse(apiText), source);
      if (product) return { ...source, ...product, metadataSource: 'shopee-api' };
    } catch { /* API did not return product JSON */ }
  }

  const html = await fetchText(source.sourceUrl, options);
  if (html) {
    for (const value of extractJsonScripts(html)) {
      const product = jsonLdProduct(value) || findStructuredProduct(value, source);
      if (product) return { ...source, ...product, metadataSource: 'html-structured-data' };
    }
    for (const value of extractMfePayloads(html)) {
      const product = findStructuredProduct(value, source);
      if (product) return { ...source, ...product, metadataSource: 'html-mfe-data' };
    }
    const product = metaProduct(html);
    if (product) return { ...source, ...product, metadataSource: 'html-meta' };
  }

  throw createError('Shopee chưa trả đủ tên, giá và ảnh sản phẩm. Hãy thử lại sau.', 422);
}

module.exports = {
  extractJsonScripts,
  extractMfePayloads,
  findStructuredProduct,
  importMetadataFromShopee,
  jsonLdProduct,
  metaProduct,
  sourceImageUrl,
  structuredProduct,
};
