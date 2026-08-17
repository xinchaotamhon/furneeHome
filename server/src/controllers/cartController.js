const cartService = require('../services/cartService');

async function get(req, res, next) {
  try { res.json({ success: true, message: 'Cart loaded', data: await cartService.get(req.user._id) }); }
  catch (error) { next(error); }
}

async function update(req, res, next) {
  try { res.json({ success: true, message: 'Cart updated', data: await cartService.update(req.user._id, req.body.items || []) }); }
  catch (error) { next(error); }
}

module.exports = { get, update };
