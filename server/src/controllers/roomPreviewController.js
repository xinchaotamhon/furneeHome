const imageService = require('../services/cloudflareImageService');
const env = require('../config/env');

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validate(body) {
  if (!body || typeof body !== 'object') throw invalid('Dữ liệu tạo ảnh không hợp lệ.');
  for (const field of ['roomImageDataUrl', 'guideImageDataUrl', 'productImageDataUrl', 'productName']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) throw invalid(`Thiếu ${field}.`);
  }
  if (body.productName.length > 200) throw invalid('Tên sản phẩm quá dài.');
  if (String(body.userPrompt || '').length > 300) throw invalid('Ghi chú tối đa 300 ký tự.');
  if (!body.placement || !Number.isFinite(body.placement.x) || !Number.isFinite(body.placement.y)
    || body.placement.x < 0 || body.placement.x > 1 || body.placement.y < 0 || body.placement.y > 1) {
    throw invalid('Vị trí sản phẩm không hợp lệ.');
  }
}

function sceneProduct(body) {
  const product = Array.isArray(body.sceneProducts) ? body.sceneProducts[0] : {};
  return {
    usageType: ['floor-seating', 'standard', 'unknown'].includes(product?.usageType) ? product.usageType : 'unknown',
    placementSurface: ['floor', 'wall', 'tabletop', 'unknown'].includes(product?.placementSurface) ? product.placementSurface : 'unknown',
    dimensionsCm: product?.dimensionsCm && typeof product.dimensionsCm === 'object' ? product.dimensionsCm : {},
    aiDescription: String(product?.aiDescription || '').trim().slice(0, 300),
  };
}

async function create(req, res, next) {
  try {
    validate(req.body);
    const result = await imageService.generateRoomPreview({
      roomImageDataUrl: req.body.roomImageDataUrl,
      guideImageDataUrl: req.body.guideImageDataUrl,
      productImageDataUrl: req.body.productImageDataUrl,
      productName: req.body.productName.trim(),
      imageSize: req.body.imageSize,
      placement: req.body.placement,
      editRegion: req.body.editRegion || { x: 0, y: 0, width: 1, height: 1 },
      userPrompt: String(req.body.userPrompt || '').trim(),
      designBrief: {
        desiredPosition: String(req.body.designBrief?.desiredPosition || '').trim().slice(0, 120),
        keepClear: String(req.body.designBrief?.keepClear || '').trim().slice(0, 120),
      },
      sceneProduct: sceneProduct(req.body),
    });
    return res.json({ success: true, message: 'Đã tạo ảnh.', data: result });
  } catch (error) {
    if (!env.isProduction && error.diagnostic) console.warn(error.diagnostic.join('\n'));
    return next(error);
  }
}

module.exports = { create, validate, sceneProduct };
