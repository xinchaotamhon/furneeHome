const mongoose = require('mongoose');
const RoomDesign = require('../models/RoomDesign');

const MAX_PLACEMENTS = 12;
const MAX_MARKED_CORNERS = 16;
const MAX_IMAGE_LENGTH = 4_000_000;
const MAX_PLACEMENT_IMAGE_LENGTH = 350_000;

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.status = statusCode;
  return error;
}

function cleanText(value, label, maxLength, allowEmpty = true) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw createError(`${label} không hợp lệ`);

  const text = value.trim();
  if (!allowEmpty && !text) throw createError(`${label} là bắt buộc`);
  if (text.length > maxLength) throw createError(`${label} quá dài`);
  return text;
}

function cleanNumber(value, label, min, max, fallback) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw createError(`${label} không hợp lệ`);
  }
  return value;
}

function cleanTarget(value, label = 'Vị trí') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError(`${label} không hợp lệ`);
  }

  return {
    x: cleanNumber(value.x, `${label} X`, 0, 1),
    y: cleanNumber(value.y, `${label} Y`, 0, 1),
  };
}

function cleanProductId(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!mongoose.isValidObjectId(value)) throw createError('Mã sản phẩm không hợp lệ');
  return value;
}

function cleanPlacements(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw createError('Danh sách sản phẩm không hợp lệ');
  if (value.length > MAX_PLACEMENTS) {
    throw createError(`Chỉ được đặt tối đa ${MAX_PLACEMENTS} sản phẩm`);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw createError(`Sản phẩm thứ ${index + 1} không hợp lệ`);
    }

    const image = cleanText(item.image, 'Ảnh sản phẩm', MAX_PLACEMENT_IMAGE_LENGTH);
    const transparentImage = cleanText(
      item.transparentImage,
      'Ảnh sản phẩm trong suốt',
      MAX_PLACEMENT_IMAGE_LENGTH,
    );

    return {
      productId: cleanProductId(item.productId),
      productName: cleanText(item.productName, 'Tên sản phẩm', 140, false),
      image,
      transparentImage,
      target: cleanTarget(item.target, `Vị trí sản phẩm ${index + 1}`),
      scale: cleanNumber(item.scale, 'Tỷ lệ', 0.1, 4, 1),
      rotation: cleanNumber(item.rotation, 'Góc xoay', -180, 180, 0),
      isFlipped: Boolean(item.isFlipped ?? item.flip),
      zIndex: cleanNumber(item.zIndex, 'Thứ tự lớp', 0, 100, index),
    };
  });
}

function cleanMarkedCorners(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw createError('Các điểm đánh dấu không hợp lệ');
  if (value.length > MAX_MARKED_CORNERS) {
    throw createError(`Chỉ được lưu tối đa ${MAX_MARKED_CORNERS} điểm đánh dấu`);
  }

  return value.map((point, index) => cleanTarget(point, `Điểm đánh dấu ${index + 1}`));
}

function cleanImageSize(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError('Kích thước ảnh không hợp lệ');
  }

  return {
    width: cleanNumber(value.width, 'Chiều rộng ảnh', 0, 10_000, 0),
    height: cleanNumber(value.height, 'Chiều cao ảnh', 0, 10_000, 0),
  };
}

function cleanDesignInput(body = {}) {
  const data = {};
  const fields = {
    name: cleanText(body.name, 'Tên thiết kế', 120, false),
    productId: cleanProductId(body.productId),
    productName: cleanText(body.productName, 'Tên sản phẩm', 140),
    productImage: cleanText(body.productImage, 'Ảnh sản phẩm', MAX_PLACEMENT_IMAGE_LENGTH),
    photo: cleanText(body.photo, 'Ảnh thiết kế cũ', MAX_IMAGE_LENGTH),
    roomImage: cleanText(body.roomImage, 'Ảnh căn phòng', MAX_IMAGE_LENGTH),
    resultImage: cleanText(body.resultImage, 'Ảnh kết quả', MAX_IMAGE_LENGTH),
    model: cleanText(body.model, 'Tên model', 100),
    elapsedMs: body.elapsedMs === undefined
      ? undefined
      : cleanNumber(body.elapsedMs, 'Thời gian tạo ảnh', 0, 600_000),
    imageSize: cleanImageSize(body.imageSize),
    target: body.target === undefined ? undefined : cleanTarget(body.target),
    scale: body.scale === undefined ? undefined : cleanNumber(body.scale, 'Tỷ lệ', 0.1, 4, 1),
    rotation: body.rotation === undefined
      ? undefined
      : cleanNumber(body.rotation, 'Góc xoay', -180, 180, 0),
    flip: body.flip === undefined ? undefined : Boolean(body.flip),
    placements: cleanPlacements(body.placements),
    markedCorners: cleanMarkedCorners(body.markedCorners),
    visibility: body.visibility,
  };

  if (fields.visibility !== undefined && !['private', 'public'].includes(fields.visibility)) {
    throw createError('Chế độ chia sẻ không hợp lệ');
  }

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined) data[key] = value;
  });
  return data;
}

async function createShareSlug() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = new mongoose.Types.ObjectId().toString();
    const exists = await RoomDesign.exists({ shareSlug: slug });
    if (!exists) return slug;
  }
  throw createError('Không thể tạo liên kết chia sẻ, vui lòng thử lại', 503);
}

function isOwner(design, userId) {
  return String(design.user) === String(userId);
}

function getCreatorName(user) {
  return user?.name || user?.fullName || user?.email || 'Thành viên FurneeHome';
}

async function listMine(req, res, next) {
  try {
    const designs = await RoomDesign.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, message: 'Đã tải thiết kế', data: designs });
  } catch (error) {
    next(error);
  }
}

async function listPublic(req, res, next) {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 12;
    const limit = Math.min(Math.max(requestedLimit, 1), 30);
    const designs = await RoomDesign.find({ visibility: 'public' })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('-roomImage');
    res.json({ success: true, message: 'Đã tải bộ sưu tập cộng đồng', data: designs });
  } catch (error) {
    next(error);
  }
}

async function getPublicBySlug(req, res, next) {
  try {
    const design = await RoomDesign.findOne({
      shareSlug: req.params.shareSlug,
      visibility: 'public',
    });
    if (!design) throw createError('Không tìm thấy thiết kế công khai', 404);
    res.json({ success: true, message: 'Đã tải thiết kế', data: design });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = cleanDesignInput(req.body);
    if (!data.name) data.name = `Thiết kế ${new Date().toLocaleDateString('vi-VN')}`;
    if (data.visibility === 'public') data.shareSlug = await createShareSlug();

    const design = await RoomDesign.create({
      ...data,
      user: req.user._id,
      creatorName: getCreatorName(req.user),
    });
    res.status(201).json({ success: true, message: 'Đã lưu thiết kế', data: design });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const design = await RoomDesign.findById(req.params.id);
    if (!design) throw createError('Không tìm thấy thiết kế', 404);
    if (!isOwner(design, req.user._id)) throw createError('Bạn không có quyền sửa thiết kế này', 403);

    const data = cleanDesignInput(req.body);
    if (data.visibility === 'public' && !design.shareSlug) {
      data.shareSlug = await createShareSlug();
    }
    if (data.visibility === 'private') data.shareSlug = undefined;

    Object.assign(design, data);
    await design.save();
    res.json({ success: true, message: 'Đã cập nhật thiết kế', data: design });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const design = await RoomDesign.findById(req.params.id);
    if (!design) throw createError('Không tìm thấy thiết kế', 404);
    if (!isOwner(design, req.user._id)) throw createError('Bạn không có quyền xóa thiết kế này', 403);

    await design.deleteOne();
    res.json({ success: true, message: 'Đã xóa thiết kế' });
  } catch (error) {
    next(error);
  }
}

async function reuse(req, res, next) {
  try {
    const source = await RoomDesign.findById(req.params.id);
    if (!source || source.visibility !== 'public') {
      throw createError('Không tìm thấy thiết kế công khai', 404);
    }

    const copy = await RoomDesign.create({
      user: req.user._id,
      name: `${source.name} - bản sao`,
      productId: source.productId,
      productName: source.productName,
      productImage: source.productImage,
      photo: source.photo,
      roomImage: source.roomImage,
      resultImage: source.resultImage,
      imageSize: source.imageSize,
      target: source.target,
      scale: source.scale,
      rotation: source.rotation,
      flip: source.flip,
      placements: source.placements,
      markedCorners: source.markedCorners,
      visibility: 'private',
      creatorName: getCreatorName(req.user),
      reusedFrom: source._id,
    });

    await RoomDesign.updateOne({ _id: source._id }, { $inc: { reuseCount: 1 } });
    res.status(201).json({ success: true, message: 'Đã sao chép thiết kế', data: copy });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listMine,
  listPublic,
  getPublicBySlug,
  create,
  update,
  remove,
  reuse,
};
