const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  slug: { type: String, default: '' },
  categoryName: { type: String, default: '' },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 1 },
  image: { type: String, default: '' },
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, immutable: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderItems: [orderItemSchema],
  shippingAddress: {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    provinceCode: { type: Number, min: 1, max: 99 },
    note: { type: String, default: '', trim: true },
  },
  paymentMethod: { type: String, enum: ['COD', 'BANK_TRANSFER'], default: 'COD' },
  // Trạng thái thanh toán: Chờ thanh toán, Đã thanh toán, Chờ hoàn tiền (đơn trả về), Đã hoàn tiền (Admin đã CK trả), Đã hủy
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Refunding', 'Refunded', 'Cancelled'],
    default: 'Pending',
  },
  // Trạng thái đơn hàng: Chờ xử lý, Đang chuẩn bị, Đang giao, Đã giao, Hoàn hàng, Đã hủy
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Returned', 'Cancelled'],
    default: 'Pending',
  },
  subtotal: { type: Number, required: true, min: 0 },
  shippingFee: { type: Number, required: true, min: 0, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  // Đánh dấu đã khôi phục tồn kho sản phẩm để tránh cộng trùng lặp
  stockRestored: { type: Boolean, default: false },
  // Thông tin tài khoản ngân hàng khách hàng cung cấp để nhận tiền hoàn (chống gian lận quét mã QR lạ)
  refundInfo: {
    bankName: { type: String, default: '', trim: true },
    accountNumber: { type: String, default: '', trim: true },
    accountHolder: { type: String, default: '', trim: true },
    updatedAt: { type: Date },
  },
  // Khách hàng chủ động bấm xác nhận đã chuyển khoản thành công qua QR
  customerConfirmedPayment: { type: Boolean, default: false },
  customerConfirmedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
