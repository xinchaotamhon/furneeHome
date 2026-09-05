const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

function isLocalRequest(req) {
  const address = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}

function localOnlyAccountAllowed(req, user, isProduction = env.isProduction) {
  return !user?.localOnly || (!isProduction && isLocalRequest(req));
}

function localShopeeImportAllowed(req, isProduction = env.isProduction) {
  return !isProduction && isLocalRequest(req);
}

async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Login required', data: null });
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = await User.findById(payload.userId).select('-password');
    if (!req.user?.isActive || !localOnlyAccountAllowed(req, req.user)) return res.status(401).json({ success: false, message: 'Invalid account', data: null });
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid session', data: null });
  }
}

// A preview may be created by a guest, but a valid signed-in user must not
// consume the guest's one-image allowance. A supplied invalid token is rejected
// instead of silently downgrading the request to a guest session.
async function optionalAuthenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return next();
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.userId).select('-password');
    if (!user?.isActive || !localOnlyAccountAllowed(req, user)) return res.status(401).json({ success: false, message: 'Invalid session', data: null });
    req.user = user;
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid session', data: null });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only', data: null });
  return next();
}

function requireLocalShopeeImport(req, res, next) {
  if (!localShopeeImportAllowed(req)) {
    return res.status(403).json({
      success: false,
      message: 'Thao tác này chỉ được phép trên localhost.',
      data: null,
    });
  }
  return next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
  requireLocalShopeeImport,
  isLocalRequest,
  localOnlyAccountAllowed,
  localShopeeImportAllowed,
};
