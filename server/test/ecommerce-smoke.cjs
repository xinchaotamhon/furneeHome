const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const Review = require('../src/models/Review');
const Order = require('../src/models/Order');
const { cleanAddress, requestedProductIds, ADMIN_TRANSITIONS } = require('../src/controllers/orderController');
const { isSellable } = require('../src/controllers/cartController');

const productId = new mongoose.Types.ObjectId().toString();

test('checkout accepts product ids and quantities but never a client price', () => {
  const items = requestedProductIds([
    { productId, quantity: 2, price: 1 },
    { product: productId, qty: 3, price: 999999999 },
  ]);
  assert.deepEqual(items, [{ productId, qty: 5 }]);
});

test('shipping information rejects malformed phone numbers and short addresses', () => {
  assert.throws(() => cleanAddress({ fullName: 'A', phone: '123', address: 'short' }));
  assert.deepEqual(cleanAddress({ fullName: 'Nguyen Van A', phone: '0901 234 567', address: '12 Duong Noi, Ha Noi' }), {
    fullName: 'Nguyen Van A', phone: '0901234567', address: '12 Duong Noi, Ha Noi', note: '',
  });
});

test('sellable products require active state, whole VND pricing, and available stock', async () => {
  assert.equal(isSellable({ isActive: true, price: 1200000, stock: 1 }), true);
  assert.equal(isSellable({ isActive: true, price: 0, stock: 1 }), false);
  assert.equal(isSellable({ isActive: true, price: 1.5, stock: 1 }), false);
  assert.equal(isSellable({ isActive: false, price: 1200000, stock: 1 }), false);
  const invalidProduct = new Product({
    name: 'Bàn', slug: 'ban', category: new mongoose.Types.ObjectId(), categoryName: 'Bàn', price: 1000000, stock: 1.5,
  });
  await assert.rejects(invalidProduct.validate(), /stock/);
});

test('order status graph is one-way and cancellation cannot follow shipment', () => {
  assert.deepEqual(ADMIN_TRANSITIONS.Pending, ['Processing', 'Cancelled']);
  assert.deepEqual(ADMIN_TRANSITIONS.Processing, ['Shipped', 'Cancelled']);
  assert.deepEqual(ADMIN_TRANSITIONS.Shipped, ['Delivered']);
  assert.deepEqual(ADMIN_TRANSITIONS.Delivered, []);
  assert.deepEqual(ADMIN_TRANSITIONS.Cancelled, []);
});

test('schemas preserve COD-only orders and a one-review-per-customer invariant', () => {
  assert.deepEqual(Order.schema.path('paymentMethod').enumValues, ['COD']);
  assert.ok(Review.schema.indexes().some(([keys, options]) => keys.user === 1 && keys.product === 1 && options.unique));
});
