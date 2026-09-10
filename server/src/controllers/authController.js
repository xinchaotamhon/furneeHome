const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const User = require('../models/User');
const { isLocalRequest } = require('../middleware/authMiddleware');

const OTP_TTL_MS = 10 * 60 * 1000;

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function createOtp() { return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); }
function hashOtp(email, otp) { return crypto.createHash('sha256').update(`${env.jwtSecret}:${email}:${otp}`).digest('hex'); }
function smtpConfigured() { return Boolean(env.smtpHost && env.smtpFrom && env.smtpUser && env.smtpPass); }
function localOtpAllowed(req) { return !env.isProduction && env.authOtpDevMode && isLocalRequest(req); }

async function sendOtp(email, otp, subject, text) {
  const transport = nodemailer.createTransport({ host: env.smtpHost, port: env.smtpPort, secure: env.smtpSecure, auth: { user: env.smtpUser, pass: env.smtpPass } });
  await transport.sendMail({ from: env.smtpFrom, to: email, subject, text: `${text} ${otp}. Mã có hiệu lực trong 10 phút.` });
}

function userData(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username || '',
    email: user.email,
    avatarUrl: user.avatarUrl || '',
    phone: user.phone || '',
    address: user.address || '',
    provinceCode: user.provinceCode || '',
    districtCode: user.districtCode || '',
    districtName: user.districtName || '',
    wardCode: user.wardCode || '',
    wardName: user.wardName || '',
    deliveryNote: user.deliveryNote || '',
    profileComplete: Boolean(user.phone && user.address && user.provinceCode && user.districtCode && user.wardCode),
    role: user.role,
  };
}

function authResponse(user) {
  return { token: jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' }), user: userData(user) };
}

function validUsername(username) { return !username || /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username); }

async function registerRequest(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.', data: null });
    if (!smtpConfigured() && !localOtpAllowed(req)) return res.status(503).json({ success: false, message: 'Máy chủ chưa cấu hình gửi email.', data: null });

    let user = await User.findOne({ email }).select('+registrationOtpHash +registrationOtpExpiresAt +registrationOtpAttempts');
    if (user && user.emailVerified !== false) return res.status(409).json({ success: false, message: 'Email đã được sử dụng. Hãy đăng nhập.', data: null });
    if (!user) {
      user = new User({ name: email.split('@')[0].slice(0, 80), email, password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10), emailVerified: false, role: 'customer', isActive: true });
    }

    const otp = createOtp();
    user.registrationOtpHash = hashOtp(email, otp);
    user.registrationOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.registrationOtpAttempts = 0;
    await user.save();
    if (smtpConfigured()) await sendOtp(email, otp, 'Mã xác minh FurneeHome', 'Mã xác minh email FurneeHome của bạn là');

    const data = { email };
    if (localOtpAllowed(req)) data.devOtp = otp;
    return res.status(202).json({ success: true, message: 'Mã xác minh đã được gửi.', data });
  } catch (error) { return next(error); }
}

async function completeRegistration(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || req.body.code || '').trim();
    const name = String(req.body.name || '').trim();
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!isValidEmail(email) || !/^\d{6}$/.test(otp) || !name || name.length > 80 || password.length < 6 || (username && !validUsername(username))) {
      return res.status(400).json({ success: false, message: 'Thông tin đăng ký không hợp lệ.', data: null });
    }
    const user = await User.findOne({ email, emailVerified: false }).select('+registrationOtpHash +registrationOtpExpiresAt +registrationOtpAttempts');
    if (!user || !user.registrationOtpExpiresAt || user.registrationOtpExpiresAt.getTime() <= Date.now() || user.registrationOtpAttempts >= 5) {
      return res.status(400).json({ success: false, message: 'Mã xác minh không đúng hoặc đã hết hạn.', data: null });
    }
    if (user.registrationOtpHash !== hashOtp(email, otp)) {
      user.registrationOtpAttempts = Number(user.registrationOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Mã xác minh không đúng hoặc đã hết hạn.', data: null });
    }
    if (username) {
      const duplicate = await User.findOne({ username, _id: { $ne: user._id } });
      if (duplicate) return res.status(409).json({ success: false, message: 'Tên đăng nhập đã được sử dụng.', data: null });
    }
    user.name = name;
    user.username = username || undefined;
    user.password = await bcrypt.hash(password, 10);
    user.emailVerified = true;
    user.registrationOtpHash = undefined;
    user.registrationOtpExpiresAt = undefined;
    user.registrationOtpAttempts = 0;
    await user.save();
    return res.status(201).json({ success: true, message: 'Đăng ký thành công.', data: authResponse(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Email hoặc tên đăng nhập đã được sử dụng.', data: null });
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!isValidEmail(email) || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.', data: null });
    const user = await User.findOne({ email });
    if (user && !user.isActive) {
      return res.status(403).json({ success: false, code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị khóa.', data: null });
    }
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordMatches || user.emailVerified === false) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.', data: null });
    }
    return res.json({ success: true, message: 'Đăng nhập thành công.', data: authResponse(user) });
  } catch (error) { return next(error); }
}

async function requestPasswordReset(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ.', data: null });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, code: 'EMAIL_NOT_REGISTERED', message: 'Email chưa được đăng ký. Vui lòng tạo tài khoản mới.', data: null });
    if (!user.isActive) return res.status(403).json({ success: false, code: 'ACCOUNT_LOCKED', message: 'Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ.', data: null });
    if (!smtpConfigured() && !localOtpAllowed(req)) return res.status(503).json({ success: false, message: 'Máy chủ chưa cấu hình gửi email.', data: null });
    const data = {};
    const otp = createOtp();
    user.resetOtpHash = hashOtp(email, otp);
    user.resetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.resetOtpAttempts = 0;
    await user.save();
    if (smtpConfigured()) await sendOtp(email, otp, 'Mã đặt lại mật khẩu FurneeHome', 'Mã đặt lại mật khẩu FurneeHome của bạn là');
    else data.devOtp = otp;
    return res.json({ success: true, message: 'Nếu email đã đăng ký, mã đặt lại mật khẩu sẽ được gửi đến email đó.', data });
  } catch (error) { return next(error); }
}

async function resetPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || req.body.code || '').trim();
    const password = String(req.body.password || '');
    if (!isValidEmail(email) || !/^\d{6}$/.test(otp) || password.length < 6) return res.status(400).json({ success: false, message: 'Email, mã OTP hoặc mật khẩu không hợp lệ.', data: null });
    const user = await User.findOne({ email, isActive: true }).select('+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts');
    if (!user || !user.resetOtpExpiresAt || user.resetOtpExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Mã OTP không đúng hoặc đã hết hạn.', data: null });
    }
    if (user.resetOtpAttempts >= 5) {
      user.resetOtpHash = undefined;
      user.resetOtpExpiresAt = undefined;
      user.resetOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ success: false, message: 'Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới.', data: null });
    }
    if (user.resetOtpHash !== hashOtp(email, otp)) {
      user.resetOtpAttempts = Number(user.resetOtpAttempts || 0) + 1;
      if (user.resetOtpAttempts >= 5) {
        user.resetOtpHash = undefined;
        user.resetOtpExpiresAt = undefined;
        user.resetOtpAttempts = 0;
        await user.save();
        return res.status(400).json({ success: false, message: 'Bạn đã nhập sai OTP 5 lần. Vui lòng yêu cầu mã mới.', data: null });
      }
      await user.save();
      return res.status(400).json({ success: false, message: 'Mã OTP không đúng hoặc đã hết hạn.', data: null });
    }
    user.password = await bcrypt.hash(password, 10);
    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    user.resetOtpAttempts = 0;
    await user.save();
    return res.json({ success: true, message: 'Đã đặt lại mật khẩu.', data: null });
  } catch (error) { return next(error); }
}

module.exports = { login, register: registerRequest, registerRequest, completeRegistration, requestPasswordReset, resetPassword, normalizeEmail, isValidEmail, userData, authResponse, hashOtp, smtpConfigured, OTP_TTL_MS };
