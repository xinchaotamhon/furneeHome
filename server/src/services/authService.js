const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

async function login(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase(), isActive: true });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    const error = new Error('Email or password is incorrect');
    error.status = 401;
    throw error;
  }
  const token = jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' });
  return { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } };
}

module.exports = { login };
