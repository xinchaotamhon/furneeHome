const cloudflareImageService = require('../services/cloudflareImageService');
const env = require('../config/env');
const { cleanDesignBrief, cleanSceneProducts } = require('../utils/roomSceneInput');
const { markAnonymousGenerationSucceeded, releaseAnonymousGeneration } = require('../services/anonymousGenerationQuotaService');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateRequest(body) {
  if (!body || typeof body !== 'object') throw createError('Dữ liệu yêu cầu không hợp lệ.');
  if (typeof body.roomImageDataUrl !== 'string' || !body.roomImageDataUrl) throw createError('Thiếu ảnh phòng gốc.');
  if (body.mode != null && !['placement', 'inspiration'].includes(body.mode)) throw createError('Chế độ tạo ảnh không hợp lệ.');
  if (body.smallRoomImageDataUrl != null && typeof body.smallRoomImageDataUrl !== 'string') throw createError('Ảnh phòng thu nhỏ không hợp lệ.');
  if (body.productImageDataUrl != null && typeof body.productImageDataUrl !== 'string') throw createError('Ảnh tham chiếu sản phẩm không hợp lệ.');
  if (body.productImageDataUrls != null) {
    if (!Array.isArray(body.productImageDataUrls) || body.productImageDataUrls.length < 1 || body.productImageDataUrls.length > 3
      || body.productImageDataUrls.some((image) => typeof image !== 'string' || !image)) {
      throw createError('Ảnh tham chiếu sản phẩm phải là mảng tối đa 3 data URL ảnh.');
    }
    if (body.mode !== 'inspiration') throw createError('productImageDataUrls chỉ dùng cho chế độ gợi ý AI.');
  }
  if (body.userPrompt != null && typeof body.userPrompt !== 'string') throw createError('Mô tả mong muốn không hợp lệ.');
  if ((body.userPrompt || '').trim().length > 300) throw createError('Mô tả mong muốn tối đa 300 ký tự.');
  if (body.imageSize != null) {
    for (const field of ['width', 'height']) {
      if (!Number.isFinite(body.imageSize[field]) || body.imageSize[field] <= 0 || body.imageSize[field] > 50_000) {
        throw createError('Kích thước ảnh phòng không hợp lệ.');
      }
    }
  }
  // Gợi ý cả phòng chỉ cần ảnh gốc; danh sách và ảnh tham chiếu sản phẩm là tùy chọn.
  if (body.mode === 'inspiration') return;
  if (typeof body.guideImageDataUrl !== 'string' || !body.guideImageDataUrl) throw createError('Thiếu ảnh hướng dẫn của căn phòng.');
  if (body.maskImageDataUrl != null && typeof body.maskImageDataUrl !== 'string') throw createError('Mask vùng chỉnh sửa không hợp lệ.');
  if (typeof body.productImageDataUrl !== 'string' || !body.productImageDataUrl) throw createError('Thiếu ảnh sản phẩm tách nền.');
  if (typeof body.productName !== 'string' || !body.productName.trim()) throw createError('Thiếu tên sản phẩm.');
  if (body.productName.trim().length > 200) throw createError('Tên sản phẩm quá dài.');

  const placement = body.placement;
  if (!placement || typeof placement !== 'object') throw createError('Thiếu vị trí đặt sản phẩm.');
  if (!Number.isFinite(placement.x) || placement.x < 0 || placement.x > 1) throw createError('placement.x phải là số từ 0 đến 1.');
  if (!Number.isFinite(placement.y) || placement.y < 0 || placement.y > 1) throw createError('placement.y phải là số từ 0 đến 1.');
  if (placement.anchor !== 'bottom-center') throw createError('placement.anchor phải là bottom-center.');

  const editRegion = body.editRegion;
  if (!editRegion || typeof editRegion !== 'object') throw createError('Thiếu vùng chỉnh sửa editRegion.');
  for (const field of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(editRegion[field]) || editRegion[field] < 0 || editRegion[field] > 1) {
      throw createError(`editRegion.${field} phải là số từ 0 đến 1.`);
    }
  }
  if (editRegion.width <= 0 || editRegion.height <= 0 || editRegion.x + editRegion.width > 1 || editRegion.y + editRegion.height > 1) {
    throw createError('editRegion phải là hình chữ nhật nằm trong ảnh phòng.');
  }
}

async function create(req, res, next) {
  try {
    validateRequest(req.body);
    const designBrief = cleanDesignBrief(req.body.designBrief);
    const sceneProducts = cleanSceneProducts(req.body.sceneProducts);
    if (req.body.mode === 'inspiration' && req.body.productImageDataUrls != null
      && (sceneProducts.length < 1 || sceneProducts.length > 3 || sceneProducts.length !== req.body.productImageDataUrls.length)) {
      throw createError('Gợi ý AI cần 1–3 ảnh tham chiếu và số ảnh phải khớp danh sách sản phẩm.');
    }
    const result = await cloudflareImageService.generateRoomPreview({
      mode: req.body.mode || 'placement',
      imageSize: req.body.imageSize,
      designBrief,
      sceneProducts,
      roomImageDataUrl: req.body.roomImageDataUrl,
      smallRoomImageDataUrl: req.body.smallRoomImageDataUrl,
      guideImageDataUrl: req.body.guideImageDataUrl,
      maskImageDataUrl: req.body.maskImageDataUrl,
      productImageDataUrl: req.body.productImageDataUrl,
      productImageDataUrls: req.body.productImageDataUrls,
      productName: req.body.mode === 'inspiration' ? '' : req.body.productName.trim(),
      userPrompt: (req.body.userPrompt || '').trim(),
      placement: req.body.placement,
      editRegion: req.body.editRegion,
    });

    await markAnonymousGenerationSucceeded(req);
    res.json({ success: true, data: result });
  } catch (error) {
    await releaseAnonymousGeneration(req).catch(() => {}); // Reservation tự hết hạn nếu DB tạm mất kết nối.
    if (error.status) {
      const response = { success: false, message: error.message, data: null };
      if (!env.isProduction && error.diagnostic) response.diagnostic = error.diagnostic;
      return res.status(error.status).json(response);
    }
    return next(error);
  }
}

module.exports = { create };
