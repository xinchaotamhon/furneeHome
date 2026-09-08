const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã không hợp lệ.');
}

async function applyCoupon(req, res, next) {
  try {
    const { code } = req.body;
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) throw createError('Vui lòng nhập mã giảm giá.');

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    const subtotal = (cart?.items || []).reduce((total, item) => {
      const product = item.product;
      if (!product?.isActive || !Number.isInteger(product.price) || product.price < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) return total;
      return total + product.price * item.quantity;
    }, 0);
    if (subtotal <= 0) throw createError('Giỏ hàng không có sản phẩm hợp lệ.');

    const coupon = await Coupon.findOne({ code: cleanCode, isActive: true });
    if (!coupon) {
      throw createError('Mã giảm giá không tồn tại hoặc đã hết hiệu lực.', 404);
    }

    if (subtotal < coupon.minOrder) {
      throw createError(`Đơn hàng tối thiểu từ ${coupon.minOrder.toLocaleString('vi-VN')} đ để dùng mã này.`);
    }

    let discountAmount = Math.round((subtotal * coupon.discountPercent) / 100);
    if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }

    const finalAmount = Math.max(0, subtotal - discountAmount);

    return res.json({
      success: true,
      message: 'Áp dụng mã giảm giá thành công.',
      data: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        discountAmount,
        finalAmount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function listCoupons(req, res, next) {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải danh sách mã giảm giá.', data: coupons });
  } catch (error) {
    return next(error);
  }
}

async function createCoupon(req, res, next) {
  try {
    const { code, discountPercent, maxDiscount = 0, minOrder = 0, isActive = true } = req.body;
    const cleanCode = String(code || '').trim().toUpperCase();

    if (!cleanCode) throw createError('Mã giảm giá không được để trống.');

    const percent = Number(discountPercent);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      throw createError('Phần trăm giảm giá phải từ 1 đến 100.');
    }

    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) throw createError('Mã giảm giá này đã tồn tại.');

    const coupon = await Coupon.create({
      code: cleanCode,
      discountPercent: percent,
      maxDiscount: Number(maxDiscount) || 0,
      minOrder: Number(minOrder) || 0,
      isActive: Boolean(isActive),
    });

    return res.status(201).json({ success: true, message: 'Đã tạo mã giảm giá thành công.', data: coupon });
  } catch (error) {
    return next(error);
  }
}

async function deleteCoupon(req, res, next) {
  try {
    checkId(req.params.id);
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) throw createError('Không tìm thấy mã giảm giá.', 404);
    return res.json({ success: true, message: 'Đã xóa mã giảm giá.', data: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { applyCoupon, listCoupons, createCoupon, deleteCoupon };
