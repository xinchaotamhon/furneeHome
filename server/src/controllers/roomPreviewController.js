const cloudflareImageService = require('../services/cloudflareImageService');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateRequest(body) {
  if (!body || typeof body !== 'object') throw createError('Dữ liệu yêu cầu không hợp lệ.');
  if (typeof body.roomImageDataUrl !== 'string' || !body.roomImageDataUrl) throw createError('Thiếu ảnh phòng gốc.');
  if (typeof body.guideImageDataUrl !== 'string' || !body.guideImageDataUrl) throw createError('Thiếu ảnh hướng dẫn của căn phòng.');
  if (body.maskImageDataUrl != null && typeof body.maskImageDataUrl !== 'string') throw createError('Mask vùng chỉnh sửa không hợp lệ.');
  if (typeof body.productImageDataUrl !== 'string' || !body.productImageDataUrl) throw createError('Thiếu ảnh sản phẩm tách nền.');
  if (typeof body.productName !== 'string' || !body.productName.trim()) throw createError('Thiếu tên sản phẩm.');
  if (body.productName.trim().length > 200) throw createError('Tên sản phẩm quá dài.');
  if (body.userPrompt != null && typeof body.userPrompt !== 'string') throw createError('Mô tả mong muốn không hợp lệ.');
  if ((body.userPrompt || '').trim().length > 300) throw createError('Mô tả mong muốn tối đa 300 ký tự.');

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
    const result = await cloudflareImageService.generateRoomPreview({
      roomImageDataUrl: req.body.roomImageDataUrl,
      guideImageDataUrl: req.body.guideImageDataUrl,
      maskImageDataUrl: req.body.maskImageDataUrl,
      productImageDataUrl: req.body.productImageDataUrl,
      productName: req.body.productName.trim(),
      userPrompt: (req.body.userPrompt || '').trim(),
      placement: req.body.placement,
      editRegion: req.body.editRegion,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.status) {
      const response = { success: false, message: error.message, data: null };
      if (process.env.NODE_ENV !== 'production' && error.diagnostic) response.diagnostic = error.diagnostic;
      return res.status(error.status).json(response);
    }
    return next(error);
  }
}

module.exports = { create };
