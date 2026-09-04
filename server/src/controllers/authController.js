const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { localOnlyAccountAllowed } = require('../middleware/authMiddleware');

function userData(user) {
  return { id: user._id, name: user.name, username: user.username || '', email: user.email, role: user.role };
}

function createToken(user) {
  return jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' });
}

function authResponse(user) {
  return { token: createToken(user), user: userData(user) };
}

function buildLoginLookup(identity) {
  return { isActive: true, $or: [{ email: identity }, { username: identity }] };
}

async function login(req, res, next) {
  try {
    const { email, username, identity, password } = req.body;
    const normalizedIdentity = String(identity || username || email || '').trim().toLowerCase();
    if (!normalizedIdentity || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.', data: null });
    }

    const user = await User.findOne(buildLoginLookup(normalizedIdentity));
    if (!user || !(await bcrypt.compare(password, user.password)) || !localOnlyAccountAllowed(req, user)) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
        data: null,
      });
    }

    res.json({ success: true, message: 'Đăng nhập thành công', data: authResponse(user) });
  } catch (error) { next(error); }
}

async function register(req, res, next) {
  try {
    const { name, username, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ họ tên, email và mật khẩu.', data: null });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.', data: null });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username?.trim().toLowerCase();
    if (normalizedUsername && !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedUsername)) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập cần 3–32 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.', data: null });
    }
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        ...(normalizedUsername ? [{ username: normalizedUsername }] : []),
      ],
    });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email hoặc tên đăng nhập này đã được đăng ký.', data: null });
    }

    const user = await User.create({
      name: name.trim(),
      ...(normalizedUsername ? { username: normalizedUsername } : {}),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: 'customer',
    });

    res.status(201).json({ success: true, message: 'Tạo tài khoản thành công', data: authResponse(user) });
  } catch (error) { next(error); }
}

module.exports = { login, register, buildLoginLookup };
