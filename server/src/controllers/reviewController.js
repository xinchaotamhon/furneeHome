const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã không hợp lệ.');
}

async function refreshRating(productId) {
  const reviews = await Review.find({ product: productId }).select('rating');
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  await Product.findByIdAndUpdate(productId, {
    $set: {
      ratingAverage: reviews.length ? Number((sum / reviews.length).toFixed(1)) : 0,
      reviewCount: reviews.length,
    },
  });
}

async function createReview(req, res, next) {
  try {
    const { productId, rating, comment } = req.body;
    checkId(productId);
    const numRating = Number(rating);
    const textComment = String(comment || '').trim();
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) throw createError('Đánh giá phải từ 1 đến 5 sao.');
    if (!textComment || textComment.length > 1000) throw createError('Nội dung đánh giá không hợp lệ.');

    const product = await Product.findById(productId);
    if (!product) throw createError('Sản phẩm không tồn tại.', 404);
    const hasDeliveredPurchase = await Order.exists({
      user: req.user._id,
      orderStatus: 'Delivered',
      'orderItems.product': productId,
    });
    if (!hasDeliveredPurchase) throw createError('Chỉ khách đã nhận sản phẩm mới có thể đánh giá.', 403);

    let review;
    try {
      review = await Review.create({ user: req.user._id, product: productId, rating: numRating, comment: textComment });
    } catch (error) {
      if (error?.code === 11000) throw createError('Bạn đã đánh giá sản phẩm này.', 409);
      throw error;
    }
    await refreshRating(productId);
    await review.populate('user', 'name avatarUrl');
    return res.status(201).json({ success: true, message: 'Đã gửi đánh giá thành công.', data: review });
  } catch (error) {
    return next(error);
  }
}

async function getByProduct(req, res, next) {
  try {
    const { productId } = req.params;
    checkId(productId);
    const reviews = await Review.find({ product: productId, isHidden: { $ne: true } }).populate('user', 'name avatarUrl').sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải danh sách đánh giá.', data: reviews });
  } catch (error) {
    return next(error);
  }
}

async function moderateReview(req, res, next) {
  try {
    checkId(req.params.id);
    const isHidden = req.body.isHidden === true || req.body.isHidden === 'true';
    const moderationReason = String(req.body.reason || '').trim();
    if (moderationReason.length > 200) throw createError('Lý do kiểm duyệt quá dài.');
    const review = await Review.findByIdAndUpdate(req.params.id, {
      $set: {
        isHidden,
        moderationReason: isHidden ? moderationReason : '',
        moderatedAt: new Date(),
      },
    }, { returnDocument: 'after', runValidators: true }).populate('user', 'name avatarUrl');
    if (!review) throw createError('Không tìm thấy đánh giá.', 404);
    return res.json({ success: true, message: isHidden ? 'Đã ẩn đánh giá.' : 'Đã hiển thị lại đánh giá.', data: review });
  } catch (error) {
    return next(error);
  }
}

async function deleteReview(req, res, next) {
  try {
    checkId(req.params.id);
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) throw createError('Không tìm thấy đánh giá.', 404);
    await refreshRating(review.product);
    return res.json({ success: true, message: 'Đã xóa đánh giá.', data: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createReview, getByProduct, moderateReview, deleteReview, refreshRating };
