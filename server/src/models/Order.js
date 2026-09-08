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
    note: { type: String, default: '', trim: true },
  },
  paymentMethod: { type: String, enum: ['COD'], default: 'COD' },
  paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  subtotal: { type: Number, required: true, min: 0 },
  shippingFee: { type: Number, required: true, min: 0, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  // Set in the same conditional update that changes status to Cancelled.
  // This makes stock restoration idempotent without requiring Mongo transactions.
  stockRestored: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
