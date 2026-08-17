const Cart = require('../models/Cart');

function get(userId) {
  return Cart.findOne({ user: userId }).populate('items.product');
}

function update(userId, items) {
  return Cart.findOneAndUpdate({ user: userId }, { items }, { upsert: true, returnDocument: 'after' }).populate('items.product');
}

module.exports = { get, update };
