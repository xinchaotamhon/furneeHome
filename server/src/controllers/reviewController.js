const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã không hợp lệ.');
}

function reviewData(body) {
  const rating = Number(body.rating);
  const comment = String(body.comment || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw createError('Đánh giá phải từ 1 đến 5 sao.');
  }
  if (!comment || comment.length > 1000) {
    throw createError('Nội dung đánh giá không hợp lệ.');
  }
  return { rating, comment };
}

async function refreshRating(productId) {
  const reviews = await Review.find({
    product: productId,
    isHidden: { $ne: true },
    isDeleted: { $ne: true },
  }).select('rating');
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  await Product.findByIdAndUpdate(productId, {
    ratingAverage: reviews.length ? Number((total / reviews.length).toFixed(1)) : 0,
    reviewCount: reviews.length,
  });
}

async function saveReview(userId, productId, orderId, body) {
  const data = reviewData(body);

  const product = await Product.findById(productId);
  if (!product) throw createError('Sản phẩm không tồn tại.', 404);

  try {
    const review = await Review.create({
      user: userId,
      product: productId,
      order: orderId,
      ...data,
    });

    await refreshRating(productId);
    await review.populate('user', 'name avatarUrl');

    return review;
  } catch (error) {
    if (error?.code === 11000) {
      throw createError('Bạn đã đánh giá sản phẩm này trong đơn hàng này.', 409);
    }
    throw error;
  }
}

async function createReview(req, res, next) {
  try {
    const productId = req.body.productId;
    checkId(productId);

    const order = await Order.findOne({
      user: req.user._id,
      orderStatus: 'Delivered',
      paymentStatus: 'Paid',
      'orderItems.product': productId,
    }).sort({ createdAt: -1 });

    if (!order) {
      throw createError(
        'Chỉ khách đã thanh toán và nhận sản phẩm mới có thể đánh giá.',
        403
      );
    }

    const review = await saveReview(
      req.user._id,
      productId,
      order._id,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: 'Đã gửi đánh giá.',
      data: review,
    });
  } catch (error) {
    return next(error);
  }
}

async function getByProduct(req, res, next) {
  try {
    checkId(req.params.productId);
    const reviews = await Review.find({
      product: req.params.productId,
      isHidden: { $ne: true },
      isDeleted: { $ne: true },
    }).populate('user', 'name avatarUrl').sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải đánh giá.', data: reviews });
  } catch (error) {
    return next(error);
  }
}

async function getOrderReviewStatus(req, res, next) {
  try {
    checkId(req.params.orderId);
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) throw createError('Không tìm thấy đơn hàng.', 404);
    if (order.orderStatus !== 'Delivered') {
      throw createError('Chỉ đơn hàng đã giao mới có thể đánh giá.', 403);
    }

    const productIds = order.orderItems.map((item) => item.product);
    const reviews = await Review.find({
      user: req.user._id,
      order: order._id,
      product: { $in: productIds },
    }).select('product rating comment');
    const reviewByProduct = new Map(reviews.map((review) => [String(review.product), review]));
    const items = order.orderItems.map((item) => ({
      productId: String(item.product),
      name: item.name,
      image: item.image,
      price: item.price,
      qty: item.qty,
      reviewed: reviewByProduct.has(String(item.product)),
      review: reviewByProduct.get(String(item.product)) || null,
    }));

    return res.json({
      success: true,
      message: 'Đã tải sản phẩm cần đánh giá.',
      data: { orderNumber: order.orderNumber, items },
    });
  } catch (error) {
    return next(error);
  }
}

async function createOrderReview(req, res, next) {
  try {
    checkId(req.params.orderId);
    checkId(req.body.productId);
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) throw createError('Không tìm thấy đơn hàng.', 404);
    if (order.orderStatus !== 'Delivered') {
      throw createError('Chỉ đơn hàng đã giao mới có thể đánh giá.', 403);
    }
    const belongsToOrder = order.orderItems.some(
      (item) => String(item.product) === String(req.body.productId),
    );
    if (!belongsToOrder) throw createError('Sản phẩm không thuộc đơn hàng này.', 403);

    const review = await saveReview(req.user._id, req.body.productId, order._id, req.body);
    return res.status(201).json({ success: true, message: 'Đã gửi đánh giá.', data: review });
  } catch (error) {
    return next(error);
  }
}

async function moderateReview(req, res, next) {
  try {
    checkId(req.params.id);
    const isHidden = req.body.isHidden === true || req.body.isHidden === 'true';
    const reason = String(req.body.reason || '').trim();
    if (reason.length > 200) throw createError('Lý do kiểm duyệt quá dài.');
    const review = await Review.findByIdAndUpdate(req.params.id, {
      isHidden,
      moderationReason: isHidden ? reason : '',
      moderatedAt: new Date(),
    }, { returnDocument: 'after', runValidators: true }).populate('user', 'name avatarUrl');
    if (!review) throw createError('Không tìm thấy đánh giá.', 404);
    await refreshRating(review.product);
    return res.json({ success: true, message: isHidden ? 'Đã ẩn đánh giá.' : 'Đã hiện đánh giá.', data: review });
  } catch (error) {
    return next(error);
  }
}

async function deleteReview(req, res, next) {
  try {
    checkId(req.params.id);

    const review = await Review.findById(req.params.id);

    if (!review) {
      throw createError('Không tìm thấy đánh giá.', 404);
    }

    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const isOwner = String(review.user) === String(req.user._id);

    if (!isOwner) {
      throw createError('Bạn chỉ được xóa đánh giá của chính mình.', 403);
    }

    await Review.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      {
        runValidators: true,
      }
    );

    await refreshRating(review.product);

    return res.json({
      success: true,
      message: 'Đã xóa đánh giá. Bạn sẽ không thể đánh giá lại sản phẩm này.',
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createReview,
  getByProduct,
  getOrderReviewStatus,
  createOrderReview,
  moderateReview,
  deleteReview,
  refreshRating,
};
