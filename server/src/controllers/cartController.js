const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã không hợp lệ.');
}

async function getCart(req, res, next) {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    return res.json({ success: true, message: 'Đã tải giỏ hàng.', data: cart });
  } catch (error) {
    return next(error);
  }
}

async function addToCart(req, res, next) {
  try {
    const { productId, quantity = 1 } = req.body;
    checkId(productId);

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) throw createError('Số lượng không hợp lệ.');

    const product = await Product.findById(productId);
    if (!product || !product.isActive) throw createError('Sản phẩm không tồn tại hoặc đã ngừng bán.', 404);

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += qty;
      cart.items[itemIndex].price = product.price;
    } else {
      cart.items.push({
        product: product._id,
        quantity: qty,
        price: product.price,
      });
    }

    await cart.save();
    await cart.populate('items.product');
    return res.json({ success: true, message: 'Đã thêm vào giỏ hàng.', data: cart });
  } catch (error) {
    return next(error);
  }
}

async function updateQuantity(req, res, next) {
  try {
    const { productId, quantity } = req.body;
    checkId(productId);

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0) throw createError('Số lượng không hợp lệ.');

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    if (qty === 0) {
      cart.items = cart.items.filter((item) => item.product.toString() !== productId);
    } else {
      const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity = qty;
      }
    }

    await cart.save();
    await cart.populate('items.product');
    return res.json({ success: true, message: 'Đã cập nhật giỏ hàng.', data: cart });
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const { productId } = req.params;
    checkId(productId);

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    cart.items = cart.items.filter((item) => item.product.toString() !== productId);
    await cart.save();
    await cart.populate('items.product');
    return res.json({ success: true, message: 'Đã xóa sản phẩm khỏi giỏ.', data: cart });
  } catch (error) {
    return next(error);
  }
}

async function clearCart(req, res, next) {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    } else {
      cart.items = [];
      await cart.save();
    }
    return res.json({ success: true, message: 'Đã làm trống giỏ hàng.', data: cart });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getCart, addToCart, updateQuantity, removeItem, clearCart };
