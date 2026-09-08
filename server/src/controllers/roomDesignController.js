const mongoose = require('mongoose');
const RoomDesign = require('../models/RoomDesign');

const MAX_IMAGE_LENGTH = 8_000_000;
const MAX_PREVIEW_LENGTH = 800_000;

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value, maxLength) {
  if (value === undefined) return undefined;
  const text = String(value || '').trim();
  if (text.length > maxLength) throw createError('Nội dung gửi lên quá dài.');
  return text;
}

function cleanNumber(value, label, minimum, maximum) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw createError(`${label} không hợp lệ.`);
  }
  return number;
}

function cleanImage(value, maximum = MAX_IMAGE_LENGTH) {
  if (value === undefined) return undefined;
  const image = String(value || '').trim();
  if (image.length > maximum) throw createError('Ảnh gửi lên quá lớn.');
  return image;
}

function cleanPoint(value, label) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw createError(`${label} không hợp lệ.`);
  return {
    x: cleanNumber(value.x, `${label} X`, 0, 1),
    y: cleanNumber(value.y, `${label} Y`, 0, 1),
  };
}

function cleanProductId(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!mongoose.isValidObjectId(value)) throw createError('Mã sản phẩm không hợp lệ.');
  return value;
}

function cleanPlacements(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 1) throw createError('Mỗi thiết kế chỉ dùng một sản phẩm.');

  return value.map((item, index) => ({
    productId: cleanProductId(item.productId),
    productName: cleanText(item.productName, 200) || '',
    image: cleanImage(item.image, 500_000) || '',
    transparentImage: cleanImage(item.transparentImage, 500_000) || '',
    target: cleanPoint(item.target, `Vị trí sản phẩm ${index + 1}`),
    scale: cleanNumber(item.scale, 'Tỷ lệ', 0.1, 4) ?? 1,
    isFlipped: Boolean(item.isFlipped ?? item.flip),
  }));
}

function cleanDesignInput(body = {}, isCreate = false) {
  const data = {};
  const name = cleanText(body.name, 120);
  if (isCreate && !name) data.name = `Thiết kế ${new Date().toLocaleDateString('vi-VN')}`;
  else if (name !== undefined) data.name = name;

  const textFields = { productName: 200, userPrompt: 300, model: 100 };
  for (const [field, maxLength] of Object.entries(textFields)) {
    const value = cleanText(body[field], maxLength);
    if (value !== undefined) data[field] = value;
  }

  const imageFields = { productImage: 500_000, roomImage: MAX_IMAGE_LENGTH, resultImage: MAX_IMAGE_LENGTH, previewImage: MAX_PREVIEW_LENGTH };
  for (const [field, maxLength] of Object.entries(imageFields)) {
    const value = cleanImage(body[field], maxLength);
    if (value !== undefined) data[field] = value;
  }

  const productId = cleanProductId(body.productId);
  if (productId !== undefined) data.productId = productId;
  const target = cleanPoint(body.target, 'Vị trí sản phẩm');
  if (target !== undefined) data.target = target;

  const scale = cleanNumber(body.scale, 'Tỷ lệ', 0.1, 4);
  const elapsedMs = cleanNumber(body.elapsedMs, 'Thời gian tạo ảnh', 0, 600_000);
  if (scale !== undefined) data.scale = scale;
  if (elapsedMs !== undefined) data.elapsedMs = elapsedMs;
  if (body.flip !== undefined) data.flip = Boolean(body.flip);
  if (body.resultMatchesLayout !== undefined) data.resultMatchesLayout = Boolean(body.resultMatchesLayout);

  const placements = cleanPlacements(body.placements);
  if (placements !== undefined) data.placements = placements;

  if (body.designBrief !== undefined) {
    if (!body.designBrief || typeof body.designBrief !== 'object' || Array.isArray(body.designBrief)) {
      throw createError('Mong muốn thiết kế không hợp lệ.');
    }
    data.designBrief = {
      desiredPosition: cleanText(body.designBrief.desiredPosition, 120) || '',
      avoid: cleanText(body.designBrief.avoid || body.designBrief.keepClear, 120) || '',
    };
  }

  if (body.imageSize !== undefined && body.imageSize !== null) {
    data.imageSize = {
      width: cleanNumber(body.imageSize.width, 'Chiều rộng ảnh', 1, 50_000),
      height: cleanNumber(body.imageSize.height, 'Chiều cao ảnh', 1, 50_000),
    };
  }
  return data;
}

function validateId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã thiết kế không hợp lệ.');
}

async function listMine(req, res, next) {
  try {
    const designs = await RoomDesign.find({ user: req.user._id })
      .select('-roomImage -resultImage')
      .sort({ updatedAt: -1 });
    return res.json({ success: true, message: 'Đã tải bộ sưu tập.', data: designs });
  } catch (error) {
    return next(error);
  }
}

async function getMine(req, res, next) {
  try {
    validateId(req.params.id);
    const design = await RoomDesign.findOne({ _id: req.params.id, user: req.user._id });
    if (!design) throw createError('Không tìm thấy thiết kế.', 404);
    return res.json({ success: true, message: 'Đã tải thiết kế.', data: design });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = cleanDesignInput(req.body, true);
    const design = await RoomDesign.create({ ...data, user: req.user._id });
    return res.status(201).json({ success: true, message: 'Đã lưu thiết kế.', data: design });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    validateId(req.params.id);
    const design = await RoomDesign.findOne({ _id: req.params.id, user: req.user._id });
    if (!design) throw createError('Không tìm thấy thiết kế.', 404);

    design.set(cleanDesignInput(req.body));
    await design.save();
    return res.json({ success: true, message: 'Đã cập nhật thiết kế.', data: design });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    validateId(req.params.id);
    const design = await RoomDesign.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!design) throw createError('Không tìm thấy thiết kế.', 404);
    return res.json({ success: true, message: 'Đã xóa thiết kế.', data: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listMine, getMine, create, update, remove, cleanDesignInput };
