const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

function userData(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

function createToken(user) {
  return jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' });
}

function authResponse(user) {
  return { token: createToken(user), user: userData(user) };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.', data: null });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase(), isActive: true });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
        data: null,
      });
    }

    res.json({ success: true, message: 'Đăng nhập thành công', data: authResponse(user) });
  } catch (error) { next(error); }
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ họ tên, email và mật khẩu.', data: null });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.', data: null });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email này đã được đăng ký.', data: null });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: 'customer',
    });

    res.status(201).json({ success: true, message: 'Tạo tài khoản thành công', data: authResponse(user) });
  } catch (error) { next(error); }
}

module.exports = { login, register };
