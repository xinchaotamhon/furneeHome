const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const User = require('../models/User');
const { isLocalRequest, localOnlyAccountAllowed } = require('../middleware/authMiddleware');

const RESET_OTP_TTL_MS = 10 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashOtp(email, otp) {
  return crypto.createHash('sha256').update(`${env.jwtSecret}:${email}:${otp}`).digest('hex');
}

function smtpConfigured() {
  return Boolean(env.smtpHost && env.smtpFrom);
}

function localOtpAllowed(req) {
  return !env.isProduction && env.authOtpDevMode && isLocalRequest(req);
}

async function sendResetOtp(email, otp) {
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    ...(env.smtpUser || env.smtpPass ? { auth: { user: env.smtpUser, pass: env.smtpPass } } : {}),
  });
  await transport.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: 'Mã đặt lại mật khẩu FurneeHome',
    text: `Mã đặt lại mật khẩu của bạn là ${otp}. Mã có hiệu lực trong 10 phút.`,
  });
}

function userData(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username || '',
    email: user.email,
    avatarUrl: user.avatarUrl || '',
    role: user.role,
  };
}

function authResponse(user) {
  const token = jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' });
  return { token, user: userData(user) };
}

async function register(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !isValidEmail(email) || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập họ tên, email hợp lệ và mật khẩu từ 6 ký tự.',
        data: null,
      });
    }
    if (name.length > 80) {
      return res.status(400).json({ success: false, message: 'Họ tên tối đa 80 ký tự.', data: null });
    }
    if (username && !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập không hợp lệ.', data: null });
    }

    const duplicateConditions = [{ email }];
    if (username) duplicateConditions.push({ username });
    const existing = await User.findOne({ $or: duplicateConditions });
    if (existing && existing.emailVerified !== false) {
      return res.status(409).json({ success: false, message: 'Email hoặc tên đăng nhập đã được sử dụng.', data: null });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = existing || new User();
    user.name = name;
    user.email = email;
    user.password = passwordHash;
    user.emailVerified = true;
    user.role = 'customer';
    user.localOnly = false;
    user.isActive = true;
    if (username) user.username = username;
    await user.save();

    return res.status(201).json({ success: true, message: 'Đăng ký thành công.', data: authResponse(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email hoặc tên đăng nhập đã được sử dụng.', data: null });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const identity = String(req.body.identity || req.body.username || req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!identity || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.', data: null });
    }

    const user = await User.findOne({
      isActive: true,
      $or: [{ email: identity }, { username: identity }],
    });
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordMatches || user.emailVerified === false || !localOnlyAccountAllowed(req, user)) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.', data: null });
    }

    return res.json({ success: true, message: 'Đăng nhập thành công.', data: authResponse(user) });
  } catch (error) {
    return next(error);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ.', data: null });
    }
    if (!smtpConfigured() && !localOtpAllowed(req)) {
      return res.status(503).json({ success: false, message: 'Máy chủ chưa cấu hình gửi email.', data: null });
    }

    const user = await User.findOne({ email, isActive: true });
    const data = {};
    if (user) {
      const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      user.resetOtpHash = hashOtp(email, otp);
      user.resetOtpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MS);
      await user.save();
      if (smtpConfigured()) await sendResetOtp(email, otp);
      else data.devOtp = otp;
    }

    return res.json({
      success: true,
      message: 'Nếu email đã đăng ký, mã đặt lại mật khẩu sẽ được gửi đến email đó.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || req.body.code || '').trim();
    const password = String(req.body.password || '');
    if (!isValidEmail(email) || !/^\d{6}$/.test(otp) || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Email, mã OTP hoặc mật khẩu không hợp lệ.', data: null });
    }

    const user = await User.findOne({ email, isActive: true }).select('+resetOtpHash +resetOtpExpiresAt');
    const otpValid = user
      && user.resetOtpHash === hashOtp(email, otp)
      && user.resetOtpExpiresAt
      && user.resetOtpExpiresAt.getTime() > Date.now();
    if (!otpValid) {
      return res.status(400).json({ success: false, message: 'Mã OTP không đúng hoặc đã hết hạn.', data: null });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    await user.save();
    return res.json({ success: true, message: 'Đã đặt lại mật khẩu.', data: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  register,
  requestPasswordReset,
  resetPassword,
  normalizeEmail,
  isValidEmail,
  userData,
  authResponse,
  hashOtp,
};
