const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Login required', data: null });
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = await User.findById(payload.userId).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'Invalid account', data: null });
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid session', data: null });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only', data: null });
  return next();
}

module.exports = { authenticate, requireAdmin };
