const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw createError('Mã sản phẩm không hợp lệ.');
}

function itemProductId(item) {
  return String(item.product?._id || item.product);
}

function isSellable(product) {
  return product
    && product.isActive
    && Number.isInteger(product.price)
    && product.price > 0
    && Number.isInteger(product.stock)
    && product.stock > 0;
}

async function loadCart(userId) {
  let cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// Product price and availability are authoritative. This removes stale items and
// refreshes the display cache so a cart can never become a pricing source.
async function refreshCart(cart) {
  await cart.populate('items.product');
  let changed = false;
  const refreshed = [];

  for (const item of cart.items) {
    const product = item.product;
    if (!isSellable(product)) {
      changed = true;
      continue;
    }

    const quantity = Math.min(Math.max(1, Number(item.quantity) || 1), product.stock);
    if (item.quantity !== quantity || item.price !== product.price) changed = true;
    item.quantity = quantity;
    item.price = product.price;
    refreshed.push(item);
  }

  if (changed) {
    cart.items = refreshed;
    await cart.save();
    await cart.populate('items.product');
  }
  return cart;
}

async function getCart(req, res, next) {
  try {
    const cart = await refreshCart(await loadCart(req.user._id));
    return res.json({ success: true, message: 'Đã tải giỏ hàng.', data: cart });
  } catch (error) {
    return next(error);
  }
}

async function syncCart(req, res, next) {
  try {
    const inputItems = Array.isArray(req.body.items) ? req.body.items : [];
    const itemMap = new Map();

    for (const item of inputItems) {
      if (!item || typeof item !== 'object') continue;
      const productId = String(item.productId || '');
      const quantity = Number(item.quantity);
      if (mongoose.isValidObjectId(productId) && Number.isInteger(quantity) && quantity > 0) {
        itemMap.set(productId, quantity);
      }
    }

    const products = await Product.find({ _id: { $in: [...itemMap.keys()] } });
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const cart = await refreshCart(await loadCart(req.user._id));

    for (const [productId, quantity] of itemMap) {
      const product = productMap.get(productId);
      if (!isSellable(product)) continue;

      const finalQuantity = Math.min(quantity, product.stock);
      const item = cart.items.find((cartItem) => itemProductId(cartItem) === productId);
      if (item) {
        item.quantity = finalQuantity;
        item.price = product.price;
      } else {
        cart.items.push({ product: product._id, quantity: finalQuantity, price: product.price });
      }
    }

    await cart.save();
    await cart.populate('items.product');
    return res.json({ success: true, message: 'Đã đồng bộ giỏ hàng.', data: cart });
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
    if (!isSellable(product)) throw createError('Sản phẩm không tồn tại, hết hàng hoặc đã ngừng bán.', 404);

    const cart = await refreshCart(await loadCart(req.user._id));
    const itemIndex = cart.items.findIndex((item) => itemProductId(item) === String(productId));
    const nextQuantity = (itemIndex < 0 ? 0 : cart.items[itemIndex].quantity) + qty;
    if (nextQuantity > product.stock) {
      throw createError(`Sản phẩm "${product.name}" chỉ còn ${product.stock} món trong kho.`);
    }

    if (itemIndex < 0) {
      cart.items.push({ product: product._id, quantity: qty, price: product.price });
    } else {
      cart.items[itemIndex].quantity = nextQuantity;
      cart.items[itemIndex].price = product.price;
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

    const cart = await refreshCart(await loadCart(req.user._id));
    const itemIndex = cart.items.findIndex((item) => itemProductId(item) === String(productId));
    if (qty === 0) {
      cart.items = cart.items.filter((item) => itemProductId(item) !== String(productId));
    } else {
      if (itemIndex < 0) throw createError('Sản phẩm không có trong giỏ hàng.', 404);
      const product = await Product.findById(productId);
      if (!isSellable(product)) throw createError('Sản phẩm đã hết hàng hoặc ngừng bán.', 409);
      if (qty > product.stock) throw createError(`Sản phẩm "${product.name}" chỉ còn ${product.stock} món trong kho.`);
      cart.items[itemIndex].quantity = qty;
      cart.items[itemIndex].price = product.price;
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
    const cart = await loadCart(req.user._id);
    cart.items = cart.items.filter((item) => itemProductId(item) !== String(productId));
    await cart.save();
    await cart.populate('items.product');
    return res.json({ success: true, message: 'Đã xóa sản phẩm khỏi giỏ.', data: cart });
  } catch (error) {
    return next(error);
  }
}

async function clearCart(req, res, next) {
  try {
    const cart = await loadCart(req.user._id);
    cart.items = [];
    await cart.save();
    return res.json({ success: true, message: 'Đã làm trống giỏ hàng.', data: cart });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getCart, syncCart, addToCart, updateQuantity, removeItem, clearCart, isSellable };
