const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

const PROVINCE_CODES = new Set([
  1, 2, 4, 6, 8, 10, 11, 12, 14, 15, 17, 19, 20, 22, 24, 25, 26, 27, 30, 31,
  33, 34, 35, 36, 37, 38, 40, 42, 44, 45, 46, 48, 49, 51, 52, 54, 56, 58, 60,
  62, 64, 66, 67, 68, 70, 72, 74, 75, 77, 79, 80, 82, 83, 84, 86, 87, 89, 91,
  92, 93, 94, 95, 96,
]);

const CUSTOMER_CANCELLABLE = ['Pending', 'Processing'];
const ADMIN_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Returned'], // Khách nhận hàng đồng kiểm: hoặc nhận (Delivered), hoặc hoàn hàng (Returned)
  Delivered: [],
  Returned: [],
  Cancelled: [],
};
const CORRECTION_STATES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Returned'];

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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function calculateShippingFee(provinceCode) {
  const code = Number(provinceCode);
  if (!PROVINCE_CODES.has(code)) throw createError('Tỉnh hoặc thành phố không hợp lệ.');
  if (code === 79) return 20000;
  if (code >= 48) return 35000;
  return 45000;
}

function calculateVoucherDiscount(voucherCode, subtotal) {
  const voucherRules = {
    SHIP20K: { discount: 20000, minOrder: 100000 },
    SHIP30K: { discount: 30000, minOrder: 200000 },
    SHIP35K: { discount: 35000, minOrder: 300000 },
  };
  const voucher = voucherRules[String(voucherCode || '').trim()];
  if (!voucher) return 0;
  if (subtotal < voucher.minOrder) {
    throw createError('Đơn hàng chưa đạt giá trị tối thiểu để sử dụng voucher.');
  }
  return voucher.discount;
}

function cleanAddress(input) {
  const fullName = String(input?.fullName || '').trim();
  const phone = String(input?.phone || '').trim().replace(/[.\s-]/g, '');
  const address = String(input?.address || '').normalize('NFC').trim();
  const provinceCode = Number(input?.provinceCode);
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
  const hasInvalidChars = /[^\p{L}\p{M}\p{N}\s.,/–-]/u.test(address);
  const hasLetters = /\p{L}/u.test(address);
  const hasSpamRepetition = /(.)\1{4,}/u.test(address);

  if (address.length < 8 || address.length > 300 || hasInvalidChars || !hasLetters || hasSpamRepetition) {
    throw createError('Địa chỉ giao hàng không hợp lệ. Vui lòng không nhập ký tự đặc biệt hoặc ký tự spam.');
  }

  if (note.length > 500) {
    throw createError('Ghi chú đơn hàng tối đa 500 ký tự.');
  }

  return { fullName, phone, address, provinceCode, note };
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
  if (requested) return requestedProductIds(requested);
  const cart = await Cart.findOne({ user: userId });
  return requestedProductIds(cart?.items || []);
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
    const { shippingAddress, paymentMethod = 'COD', voucherCode = '' } = req.body;
    if (paymentMethod !== 'COD' && paymentMethod !== 'BANK_TRANSFER') {
      throw createError('Phương thức thanh toán không hợp lệ.');
    }
    const address = cleanAddress(shippingAddress);
    const baseShippingFee = calculateShippingFee(address.provinceCode);
    const items = await sourceItems(req.user._id, req.body);
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
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

    const voucherDiscount = Math.min(
      calculateVoucherDiscount(voucherCode, subtotal),
      baseShippingFee,
    );
    const shippingFee = baseShippingFee - voucherDiscount;

    const order = await Order.create({
      orderNumber: orderNumber(),
      user: req.user._id,
      orderItems,
      shippingAddress: address,
      paymentMethod,
      paymentStatus: 'Pending',
      orderStatus: 'Pending',
      subtotal,
      shippingFee,
      totalAmount: subtotal + shippingFee,
    });
    persisted = true;
    const purchasedIds = items.map((item) => item.productId);
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: { product: { $in: purchasedIds } } } },
    );
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
      const value = escapeRegex(String(search).trim());
      filter.$or = [
        { orderNumber: { $regex: value, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: value, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: value, $options: 'i' } },
      ];
    }
    const orders = await Order.find(filter)
      .populate('user', 'name username email phone address provinceCode districtCode districtName wardCode wardName deliveryNote role isActive createdAt')
      .sort({ createdAt: -1 });
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
    { $set: {
      orderStatus: 'Cancelled',
      paymentStatus: existing.paymentStatus === 'Paid' ? 'Paid' : 'Cancelled',
      stockRestored: true,
    } },
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
      $set: {
        orderStatus: existing.orderStatus,
        paymentStatus: existing.paymentStatus,
        stockRestored: false,
      },
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

    const normalNextStates = ADMIN_TRANSITIONS[order.orderStatus] || [];

    // TRƯỜNG HỢP 1: Hủy đơn hàng (Cancelled)
    if (orderStatus === 'Cancelled') {
      if (!normalNextStates.includes('Cancelled')) {
        throw createError('Đơn hàng ở trạng thái này không thể hủy.', 409);
      }
      const cancelled = await cancelOrder(req.params.id);
      return res.json({ success: true, message: 'Đã hủy đơn hàng và hoàn lại tồn kho.', data: cancelled });
    }

    // TRƯỜNG HỢP 2: Hoàn trả hàng (Returned - khách từ chối khi xem hàng đồng kiểm)
    if (orderStatus === 'Returned') {
      const allowedStates = req.user.role === 'superadmin' ? CORRECTION_STATES : normalNextStates;
      if (!allowedStates.includes('Returned')) {
        throw createError('Chỉ đơn hàng đang giao mới có thể chuyển sang trạng thái Hoàn hàng.', 409);
      }

      // 1. Tự động khôi phục tồn kho cho các sản phẩm trong đơn (nếu chưa hoàn)
      if (!order.stockRestored) {
        for (const item of order.orderItems) {
          await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
        }
        order.stockRestored = true;
      }

      // 2. Xử lý trạng thái thanh toán:
      // - Nếu đơn chuyển khoản QR đã thanh toán -> Chuyển sang "Chờ hoàn tiền" (Refunding) để Admin chuyển khoản trả lại
      // - Nếu đơn COD chưa thanh toán -> Chuyển sang "Đã hủy" (Cancelled) vì khách chưa trả tiền
      if (order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus === 'Paid') {
        order.paymentStatus = 'Refunding';
      } else if (order.paymentStatus !== 'Refunded') {
        order.paymentStatus = 'Cancelled';
      }

      order.orderStatus = 'Returned';
      await order.save();

      const returnNotice = order.paymentStatus === 'Refunding'
        ? 'Đã chuyển sang Hoàn hàng, khôi phục tồn kho và chuyển trạng thái sang Chờ hoàn tiền.'
        : 'Đã chuyển sang Hoàn hàng và khôi phục tồn kho thành công.';

      return res.json({ success: true, message: returnNotice, data: order });
    }

    // TRƯỜNG HỢP 3: Cập nhật các trạng thái đơn hàng thông thường khác
    if (orderStatus) {
      if (order.orderStatus === 'Cancelled') {
        throw createError('Không thể mở lại đơn đã hủy vì tồn kho đã được hoàn.', 409);
      }
      if (order.orderStatus === 'Returned') {
        throw createError('Không thể thay đổi đơn đã hoàn hàng vì tồn kho đã được khôi phục.', 409);
      }
      const allowedStates = req.user.role === 'superadmin' ? CORRECTION_STATES : normalNextStates;
      if (!allowedStates.includes(orderStatus)) {
        throw createError('Chuyển trạng thái đơn hàng không hợp lệ.', 409);
      }
      const update = { orderStatus };
      const result = await Order.findOneAndUpdate(
        { _id: order._id, orderStatus: order.orderStatus },
        { $set: update },
        { returnDocument: 'after' }
      );
      if (!result) throw createError('Đơn hàng vừa được thay đổi, vui lòng tải lại.', 409);
      return res.json({ success: true, message: 'Đã cập nhật trạng thái đơn hàng.', data: result });
    }

    // TRƯỜNG HỢP 4: Cập nhật trạng thái thanh toán (paymentStatus)
    if (paymentStatus) {
      // 4.1: Xác nhận Đã hoàn tiền (Admin đã chuyển khoản trả lại cho khách)
      if (paymentStatus === 'Refunded') {
        if (order.paymentStatus !== 'Refunding') {
          throw createError('Chỉ đơn hàng đang ở trạng thái "Chờ hoàn tiền" mới có thể xác nhận đã hoàn tiền.', 409);
        }
        order.paymentStatus = 'Refunded';
        await order.save();
        return res.json({ success: true, message: 'Đã xác nhận hoàn tiền thành công cho khách hàng.', data: order });
      }

      // 4.2: Xác nhận Đã thanh toán (Paid)
      if (paymentStatus === 'Paid') {
        if (order.paymentMethod === 'COD' && order.orderStatus !== 'Delivered') {
          throw createError('Đơn COD chỉ xác nhận thanh toán sau khi giao thành công.', 409);
        }
        order.paymentStatus = 'Paid';
        await order.save();
        return res.json({ success: true, message: 'Đã xác nhận thanh toán thành công.', data: order });
      }

      throw createError('Trạng thái thanh toán không hợp lệ.');
    }

    return res.json({ success: true, message: 'Đã cập nhật đơn hàng.', data: order });
  } catch (error) {
    return next(error);
  }
}

// Cập nhật thông tin tài khoản ngân hàng nhận tiền hoàn (dành cho khách hàng)
// Nhập text thuần túy (Ngân hàng, STK, Chủ TK) để tránh gian lận / mã QR độc hại
async function updateRefundInfo(req, res, next) {
  try {
    checkId(req.params.id);
    const bankName = String(req.body.bankName || '').trim();
    const accountNumber = String(req.body.accountNumber || '').trim().replace(/[\s-]/g, '');
    const accountHolder = String(req.body.accountHolder || '').trim().toUpperCase();

    if (!bankName) throw createError('Vui lòng chọn hoặc nhập tên ngân hàng.');
    if (!accountNumber || accountNumber.length < 5 || accountNumber.length > 30) {
      throw createError('Số tài khoản ngân hàng phải từ 5 đến 30 ký tự.');
    }
    if (!accountHolder || accountHolder.length < 2) {
      throw createError('Vui lòng nhập họ tên chủ tài khoản ngân hàng.');
    }

    // Khách hàng chỉ cập nhật đơn của chính mình, Admin có thể hỗ trợ
    const filter = { _id: req.params.id };
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      filter.user = req.user._id;
    }

    const order = await Order.findOne(filter);
    if (!order) throw createError('Không tìm thấy đơn hàng.', 404);

    if (order.orderStatus !== 'Returned' && order.paymentStatus !== 'Refunding') {
      throw createError('Chỉ đơn hàng đang ở trạng thái Hoàn hàng / Chờ hoàn tiền mới có thể cung cấp thông tin tài khoản hoàn tiền.', 400);
    }

    order.refundInfo = {
      bankName,
      accountNumber,
      accountHolder,
      updatedAt: new Date(),
    };
    await order.save();

    return res.json({
      success: true,
      message: 'Đã lưu thông tin tài khoản nhận tiền hoàn thành công.',
      data: order,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  updateRefundInfo,
  cancelMyOrder,
  cleanAddress,
  calculateShippingFee,
  escapeRegex,
  requestedProductIds,
  ADMIN_TRANSITIONS,
};
