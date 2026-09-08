const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã đơn hàng không hợp lệ.');
}

async function createOrder(req, res, next) {
  try {
    const { items, orderItems, shippingAddress, paymentMethod = 'COD', couponCode } = req.body;
    const rawItems = items || orderItems;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw createError('Đơn hàng phải có ít nhất một sản phẩm.');
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.address) {
      throw createError('Vui lòng điền đầy đủ thông tin giao hàng.');
    }

    const processedItems = [];
    let subtotal = 0;

    for (const rawItem of rawItems) {
      const productId = rawItem.productId || rawItem.product?._id || rawItem.product;
      const qty = Number(rawItem.qty || rawItem.quantity || 1);

      if (!mongoose.isValidObjectId(productId)) throw createError('Mã sản phẩm trong đơn không hợp lệ.');
      if (!Number.isInteger(qty) || qty < 1) throw createError('Số lượng sản phẩm không hợp lệ.');

      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        throw createError(`Sản phẩm "${rawItem.name || productId}" không tồn tại hoặc đã ngừng bán.`);
      }

      if (product.stock < qty) {
        throw createError(`Sản phẩm "${product.name}" chỉ còn ${product.stock} món trong kho.`);
      }

      product.stock -= qty;
      await product.save();

      const itemTotal = product.price * qty;
      subtotal += itemTotal;

      processedItems.push({
        product: product._id,
        name: product.name,
        qty,
        price: product.price,
        image: product.image || product.transparentImage || (product.sourceImages && product.sourceImages[0]) || '',
      });
    }

    let discountAmount = 0;
    let validCouponCode = '';

    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const coupon = await Coupon.findOne({ code: normalizedCode, isActive: true });
      if (coupon && subtotal >= coupon.minOrder) {
        validCouponCode = coupon.code;
        discountAmount = Math.round((subtotal * coupon.discountPercent) / 100);
        if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
          discountAmount = coupon.maxDiscount;
        }
      }
    }

    const totalAmount = Math.max(0, subtotal - discountAmount);

    const order = await Order.create({
      user: req.user._id,
      orderItems: processedItems,
      shippingAddress: {
        fullName: String(shippingAddress.fullName).trim(),
        phone: String(shippingAddress.phone).trim(),
        address: String(shippingAddress.address).trim(),
        note: String(shippingAddress.note || '').trim(),
      },
      paymentMethod: ['COD', 'VietQR'].includes(paymentMethod) ? paymentMethod : 'COD',
      paymentStatus: 'Pending',
      orderStatus: 'Pending',
      totalAmount,
      discountAmount,
      couponCode: validCouponCode,
    });

    await Cart.findOneAndUpdate({ user: req.user._id }, { $set: { items: [] } });

    return res.status(201).json({ success: true, message: 'Đặt hàng thành công.', data: order });
  } catch (error) {
    return next(error);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('orderItems.product', 'name slug image transparentImage price categoryName')
      .sort({ createdAt: -1 });

    return res.json({ success: true, message: 'Đã tải danh sách đơn hàng.', data: orders });
  } catch (error) {
    return next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    checkId(req.params.id);
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name slug image transparentImage price categoryName');

    if (!order) throw createError('Không tìm thấy đơn hàng.', 404);

    const isOwner = order.user && (order.user._id || order.user).toString() === req.user._id.toString();
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw createError('Bạn không có quyền xem đơn hàng này.', 403);
    }

    return res.json({ success: true, message: 'Đã tải chi tiết đơn hàng.', data: order });
  } catch (error) {
    return next(error);
  }
}

async function getAllOrders(req, res, next) {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.orderStatus = status;
    }

    if (search) {
      filter.$or = [
        { 'shippingAddress.fullName': { $regex: String(search).trim(), $options: 'i' } },
        { 'shippingAddress.phone': { $regex: String(search).trim(), $options: 'i' } },
        { 'shippingAddress.address': { $regex: String(search).trim(), $options: 'i' } },
      ];
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name slug price image')
      .sort({ createdAt: -1 });

    return res.json({ success: true, message: 'Đã tải toàn bộ đơn hàng.', data: orders });
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    checkId(req.params.id);
    const { orderStatus, paymentStatus } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) throw createError('Không tìm thấy đơn hàng.', 404);

    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (orderStatus && !validStatuses.includes(orderStatus)) {
      throw createError('Trạng thái đơn hàng không hợp lệ.');
    }

    if (orderStatus === 'Cancelled' && order.orderStatus !== 'Cancelled') {
      for (const item of order.orderItems) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.qty } });
        }
      }
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus && ['Pending', 'Paid'].includes(paymentStatus)) order.paymentStatus = paymentStatus;
    if (orderStatus === 'Delivered') order.paymentStatus = 'Paid';

    await order.save();
    return res.json({ success: true, message: 'Đã cập nhật trạng thái đơn hàng.', data: order });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createOrder, getMyOrders, getOrderById, getAllOrders, updateOrderStatus };
