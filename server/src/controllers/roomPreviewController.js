const imageService = require('../services/cloudflareImageService');
const env = require('../config/env');

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanProduct(item, index) {
  const productName = cleanText(item?.productName || item?.name, 200);
  const image = cleanText(item?.image || item?.imageDataUrl || item?.productImageDataUrl, 8_000_000);
  const desiredPosition = cleanText(item?.desiredPosition || item?.position, 160);
  if (!productName || !image) throw invalid(`Sản phẩm ${index + 1} chưa có đủ tên và ảnh.`);
  return {
    productId: cleanText(item?.productId, 100),
    productName,
    image,
    desiredPosition,
    usageType: ['floor-seating', 'standard', 'unknown'].includes(item?.usageType) ? item.usageType : 'unknown',
    placementSurface: ['floor', 'wall', 'tabletop', 'unknown'].includes(item?.placementSurface) ? item.placementSurface : 'unknown',
    dimensionsCm: item?.dimensionsCm && typeof item.dimensionsCm === 'object' ? item.dimensionsCm : {},
    aiDescription: cleanText(item?.aiDescription, 300),
  };
}

function readProducts(body) {
  let items = body.inspirationProducts || body.products;
  if (!Array.isArray(items) && body.productImageDataUrl) {
    const scene = Array.isArray(body.sceneProducts) ? body.sceneProducts[0] : {};
    items = [{
      ...scene,
      productName: body.productName,
      image: body.productImageDataUrl,
      desiredPosition: body.designBrief?.desiredPosition || body.userPrompt || 'vị trí phù hợp trong phòng',
    }];
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 3) {
    throw invalid('Chọn từ 1 đến 3 sản phẩm để tạo ảnh.');
  }
  return items.map(cleanProduct);
}

function validate(body) {
  if (!body || typeof body !== 'object') throw invalid('Dữ liệu tạo ảnh không hợp lệ.');
  if (typeof body.roomImageDataUrl !== 'string' || !body.roomImageDataUrl.trim()) {
    throw invalid('Chưa có ảnh phòng.');
  }
  if (String(body.userPrompt || '').length > 500) throw invalid('Ghi chú tối đa 500 ký tự.');
  return readProducts(body);
}

async function create(req, res, next) {
  try {
    const products = validate(req.body);
    const result = await imageService.generateRoomPreview({
      roomImageDataUrl: req.body.roomImageDataUrl,
      imageSize: req.body.imageSize,
      products,
      userPrompt: cleanText(req.body.userPrompt, 500),
    });
    return res.json({ success: true, message: 'Đã tạo ảnh.', data: result });
  } catch (error) {
    if (!env.isProduction && error.diagnostic) console.warn(error.diagnostic.join('\n'));
    return next(error);
  }
}

module.exports = { create, validate, readProducts };
