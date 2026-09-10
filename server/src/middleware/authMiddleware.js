const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

function isLocalRequest(req) {
  const address = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}

async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Login required', data: null });
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = await User.findById(payload.userId).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'Invalid account', data: null });
    if (!req.user.isActive) return res.status(403).json({ success: false, code: 'ACCOUNT_LOCKED', message: 'Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ.', data: null });
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid session', data: null });
  }
}

async function optionalAuthenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return next();
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.userId).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid session', data: null });
    if (!user.isActive) return res.status(403).json({ success: false, code: 'ACCOUNT_LOCKED', message: 'Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ.', data: null });
    req.user = user;
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid session', data: null });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!['admin', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền quản trị.', data: null });
  }
  return next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
  isLocalRequest,
};
