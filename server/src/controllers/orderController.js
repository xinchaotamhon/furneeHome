const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

const CUSTOMER_CANCELLABLE = ['Pending', 'Processing'];
const ADMIN_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã đơn hàng không hợp lệ.');
}

function readQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) throw createError('Số lượng sản phẩm không hợp lệ.');
  return quantity;
}

function cleanAddress(input) {
  const fullName = String(input?.fullName || '').trim();
  const phone = String(input?.phone || '').trim().replace(/[.\s-]/g, '');
  const address = String(input?.address || '').trim();
  const note = String(input?.note || '').trim();

  if (fullName.length < 2 || fullName.length > 100) {
    throw createError('Họ và tên người nhận phải từ 2 đến 100 ký tự.');
  }

  // Kiểm tra số điện thoại chỉ thuộc vùng Việt Nam
  const isVnPhone = /^(?:\+?84|0)[35789]\d{8}$/.test(phone);
  if (!isVnPhone) {
    throw createError('Số điện thoại phải thuộc vùng Việt Nam hợp lệ (gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84).');
  }

  // Kiểm tra địa chỉ: độ dài, không chứa ký tự bậy/đặc biệt, phải có chữ cái, không lặp ký tự spam
  const hasInvalidChars = /[^a-zA-Z0-9\sÀ-ỹà-ỹ.,/–\-]/.test(address);
  const hasLetters = /[a-zA-ZÀ-ỹà-ỹ]/.test(address);
  const hasSpamRepetition = /(.)\1{4,}/.test(address);

  if (address.length < 8 || address.length > 300 || hasInvalidChars || !hasLetters || hasSpamRepetition) {
    throw createError('Địa chỉ giao hàng không hợp lệ. Vui lòng không nhập ký tự đặc biệt hoặc ký tự spam.');
  }

  if (note.length > 500) {
    throw createError('Ghi chú đơn hàng tối đa 500 ký tự.');
  }

  return { fullName, phone, address, note };
}

function orderNumber() {
  return `FUR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function requestedProductIds(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw createError('Đơn hàng phải có ít nhất một sản phẩm.');
  const quantities = new Map();
  for (const item of rawItems) {
    const productId = item?.productId || item?.product?._id || item?.product;
    if (!mongoose.isValidObjectId(productId)) throw createError('Mã sản phẩm trong đơn không hợp lệ.');
    const qty = readQuantity(item?.qty ?? item?.quantity ?? 1);
    quantities.set(String(productId), (quantities.get(String(productId)) || 0) + qty);
  }
  return [...quantities.entries()].map(([productId, qty]) => ({ productId, qty }));
}

async function sourceItems(userId, body) {
  const requested = body.items || body.orderItems;
  if (requested) return { items: requestedProductIds(requested), fromCart: false };
  const cart = await Cart.findOne({ user: userId });
  return { items: requestedProductIds(cart?.items || []), fromCart: true };
}

async function restoreReservedStock(reserved) {
  for (const item of [...reserved].reverse()) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
  }
}

async function createOrder(req, res, next) {
  const reserved = [];
  let persisted = false;
  try {
    const { shippingAddress, paymentMethod = 'COD' } = req.body;
    if (paymentMethod !== 'COD') throw createError('Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).');
    const address = cleanAddress(shippingAddress);
    const source = await sourceItems(req.user._id, req.body);
    const orderItems = [];
    let subtotal = 0;

    for (const item of source.items) {
      // This conditional update is the stock reservation: it cannot make stock negative.
      const product = await Product.findOneAndUpdate(
        { _id: item.productId, isActive: true, price: { $gt: 0 }, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
        { returnDocument: 'after' },
      );
      if (!product || !Number.isInteger(product.price) || !Number.isInteger(product.stock)) {
        throw createError('Có sản phẩm đã ngừng bán, hết hàng hoặc có giá không hợp lệ.', 409);
      }
      reserved.push({ product: product._id, qty: item.qty });
      subtotal += product.price * item.qty;
      orderItems.push({
        product: product._id,
        name: product.name,
        slug: product.slug,
        categoryName: product.categoryName,
        qty: item.qty,
        price: product.price,
        image: product.image || product.transparentImage || product.sourceImages?.[0] || '',
      });
    }

    const requestedShippingFee = Number(req.body.shippingFee);
    const shippingFee = Number.isFinite(requestedShippingFee) && requestedShippingFee >= 0 ? requestedShippingFee : 0;
    const order = await Order.create({
      orderNumber: orderNumber(),
      user: req.user._id,
      orderItems,
      shippingAddress: address,
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      orderStatus: 'Pending',
      subtotal,
      shippingFee,
      totalAmount: subtotal + shippingFee,
    });
    persisted = true;
    if (source.fromCart) await Cart.findOneAndUpdate({ user: req.user._id }, { $set: { items: [] } });
    return res.status(201).json({ success: true, message: 'Đặt hàng thành công.', data: order });
  } catch (error) {
    if (!persisted && reserved.length) {
      try {
        await restoreReservedStock(reserved);
      } catch {
        error.message = 'Không thể hoàn tất đơn hàng; hệ thống đang khôi phục tồn kho. Vui lòng thử lại sau.';
        error.status = 503;
      }
    }
    return next(error);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải danh sách đơn hàng.', data: orders });
  } catch (error) {
    return next(error);
  }
}

async function getAllOrders(req, res, next) {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && Object.hasOwn(ADMIN_TRANSITIONS, status)) filter.orderStatus = status;
    if (search) {
      const value = String(search).trim();
      filter.$or = [
        { orderNumber: { $regex: value, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: value, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: value, $options: 'i' } },
      ];
    }
    const orders = await Order.find(filter).populate('user', 'name email').sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải toàn bộ đơn hàng.', data: orders });
  } catch (error) {
    return next(error);
  }
}

async function cancelOrder(orderId, extraFilter = {}) {
  const existing = await Order.findOne({
    _id: orderId,
    ...extraFilter,
    orderStatus: { $in: CUSTOMER_CANCELLABLE },
    stockRestored: false,
  });
  if (!existing) throw createError('Đơn hàng không còn có thể hủy hoặc đã được xử lý.', 409);
  const order = await Order.findOneAndUpdate(
    { _id: orderId, ...extraFilter, orderStatus: { $in: CUSTOMER_CANCELLABLE }, stockRestored: false },
    { $set: { orderStatus: 'Cancelled', stockRestored: true } },
    { returnDocument: 'after' },
  );
  if (!order) throw createError('Đơn hàng vừa được thay đổi, vui lòng tải lại.', 409);
  const restored = [];
  try {
    for (const item of order.orderItems) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
      restored.push(item);
    }
    return order;
  } catch (error) {
    for (const item of restored.reverse()) {
      await Product.updateOne({ _id: item.product, stock: { $gte: item.qty } }, { $inc: { stock: -item.qty } });
    }
    await Order.updateOne({ _id: order._id, orderStatus: 'Cancelled', stockRestored: true }, {
      $set: { orderStatus: existing.orderStatus, stockRestored: false },
    });
    throw error;
  }
}

async function cancelMyOrder(req, res, next) {
  try {
    checkId(req.params.id);
    const order = await cancelOrder(req.params.id, { user: req.user._id });
    return res.json({ success: true, message: 'Đã hủy đơn hàng và hoàn lại tồn kho.', data: order });
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
    if (orderStatus === 'Cancelled') {
      const cancelled = await cancelOrder(req.params.id);
      return res.json({ success: true, message: 'Đã hủy đơn hàng và hoàn lại tồn kho.', data: cancelled });
    }
    if (orderStatus) {
      if (!Object.hasOwn(ADMIN_TRANSITIONS, orderStatus) || !ADMIN_TRANSITIONS[order.orderStatus]?.includes(orderStatus)) {
        throw createError('Chuyển trạng thái đơn hàng không hợp lệ.', 409);
      }
      const update = { orderStatus };
      if (orderStatus === 'Delivered') update.paymentStatus = 'Paid';
      const result = await Order.findOneAndUpdate({ _id: order._id, orderStatus: order.orderStatus }, { $set: update }, { returnDocument: 'after' });
      if (!result) throw createError('Đơn hàng vừa được thay đổi, vui lòng tải lại.', 409);
      return res.json({ success: true, message: 'Đã cập nhật trạng thái đơn hàng.', data: result });
    }
    if (paymentStatus && ['Pending', 'Paid'].includes(paymentStatus)) {
      if (order.orderStatus === 'Delivered' && paymentStatus !== 'Paid') throw createError('Đơn đã giao phải có trạng thái đã thanh toán.');
      order.paymentStatus = paymentStatus;
      await order.save();
    }
    return res.json({ success: true, message: 'Đã cập nhật đơn hàng.', data: order });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createOrder, getMyOrders, getAllOrders, updateOrderStatus, cancelMyOrder, cleanAddress, requestedProductIds, ADMIN_TRANSITIONS };
