const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã không hợp lệ.');
}

async function createReview(req, res, next) {
  try {
    const { productId, rating, comment } = req.body;
    checkId(productId);

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      throw createError('Đánh giá phải từ 1 đến 5 sao.');
    }

    const textComment = String(comment || '').trim();
    if (!textComment) {
      throw createError('Vui lòng nhập nội dung đánh giá.');
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw createError('Sản phẩm không tồn tại hoặc đã ngừng bán.', 404);
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating: numRating,
      comment: textComment,
    });

    const allReviews = await Review.find({ product: productId });
    const sum = allReviews.reduce((total, r) => total + r.rating, 0);
    product.ratingAverage = Number((sum / allReviews.length).toFixed(1));
    product.reviewCount = allReviews.length;
    await product.save();

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

    const reviews = await Review.find({ product: productId })
      .populate('user', 'name avatarUrl')
      .sort({ createdAt: -1 });

    return res.json({ success: true, message: 'Đã tải danh sách đánh giá.', data: reviews });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createReview, getByProduct };
