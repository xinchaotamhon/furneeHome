const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const User = require('../models/User');
const AnonymousGenerationQuota = require('../models/AnonymousGenerationQuota');
const { isLocalRequest, localOnlyAccountAllowed } = require('../middleware/authMiddleware');
const { getClientAddress, hashAddress } = require('../services/anonymousGenerationQuotaService');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_SENDS = 5;
const OTP_MAX_SENDS_PER_IP = 10;
const OTP_MAX_ATTEMPTS = 5;
const REGISTRATION_TOKEN_TTL_MS = 15 * 60 * 1000;
const OTP_FIELDS = '+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +emailOtpSentAt +emailOtpWindowStartedAt +emailOtpSendCount +registrationTokenHash +registrationTokenExpiresAt';

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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashValue(value) {
  return crypto.createHash('sha256').update(`${env.jwtSecret}:${value}`).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function generateRegistrationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function otpUserQuery(query) {
  const result = User.findOne(query);
  return typeof result.select === 'function' ? result.select(OTP_FIELDS) : result;
}

function smtpConfigured() {
  return Boolean(env.smtpHost && env.smtpFrom);
}

function devOtpAllowed(req) {
  return !env.isProduction && env.authOtpDevMode && isLocalRequest(req);
}

function assertOtpDeliveryAvailable(req) {
  if (smtpConfigured() || devOtpAllowed(req)) return;
  const error = new Error(env.isProduction
    ? 'Máy chủ chưa cấu hình SMTP để gửi email xác minh.'
    : 'Chưa cấu hình SMTP. Local có thể bật AUTH_OTP_DEV_MODE=true và chỉ thử trên localhost.');
  error.status = 503;
  error.code = 'AUTH_OTP_DELIVERY_NOT_CONFIGURED';
  throw error;
}

async function sendOtpEmail(email, otp) {
  // The OTP is never returned when using a real SMTP transport.
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    ...(env.smtpUser || env.smtpPass ? { auth: { user: env.smtpUser, pass: env.smtpPass } } : {}),
  });
  await transport.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: 'Mã xác minh email FurneeHome',
    text: `Mã xác minh FurneeHome của bạn là ${otp}. Mã có hiệu lực trong 10 phút.`,
    html: `<p>Mã xác minh FurneeHome của bạn là <strong>${otp}</strong>.</p><p>Mã có hiệu lực trong 10 phút.</p>`,
  });
}

function ensureSendRate(user, now) {
  const sentAt = user.emailOtpSentAt ? new Date(user.emailOtpSentAt).getTime() : 0;
  if (sentAt && now - sentAt < OTP_RESEND_COOLDOWN_MS) {
    const error = new Error('Vui lòng chờ một phút trước khi gửi lại mã.');
    error.status = 429;
    error.code = 'AUTH_OTP_RESEND_TOO_SOON';
    throw error;
  }
  const windowStart = user.emailOtpWindowStartedAt ? new Date(user.emailOtpWindowStartedAt).getTime() : 0;
  if (windowStart && now - windowStart < OTP_WINDOW_MS && Number(user.emailOtpSendCount || 0) >= OTP_MAX_SENDS) {
    const error = new Error('Bạn đã yêu cầu quá nhiều mã. Hãy thử lại sau một giờ.');
    error.status = 429;
    error.code = 'AUTH_OTP_SEND_LIMIT';
    throw error;
  }
}

async function reserveIpSend(req, now) {
  const ipHash = hashAddress(getClientAddress(req));
  const windowStart = new Date(now - OTP_WINDOW_MS);
  try {
    await AnonymousGenerationQuota.updateOne(
      { ipHash },
      { $setOnInsert: { ipHash, emailOtpWindowStartedAt: new Date(now), emailOtpSendCount: 0 } },
      { upsert: true },
    );
  } catch (error) {
    // Two first requests can race to create the same hashed-address row. The
    // unique index chooses one winner; the other safely continues on that row.
    if (error?.code !== 11000) throw error;
  }
  await AnonymousGenerationQuota.updateOne(
    {
      ipHash,
      $or: [
        { emailOtpWindowStartedAt: null },
        { emailOtpWindowStartedAt: { $lt: windowStart } },
      ],
    },
    { $set: { emailOtpWindowStartedAt: new Date(now), emailOtpSendCount: 0 } },
  );
  const quota = await AnonymousGenerationQuota.findOneAndUpdate(
    { ipHash, emailOtpSendCount: { $lt: OTP_MAX_SENDS_PER_IP } },
    { $inc: { emailOtpSendCount: 1 } },
    { new: true },
  );
  if (!quota) {
    const error = new Error('Thiết bị này đã yêu cầu quá nhiều mã. Hãy thử lại sau một giờ.');
    error.status = 429;
    error.code = 'AUTH_OTP_IP_LIMIT';
    throw error;
  }
  return ipHash;
}

async function releaseIpSend(ipHash) {
  if (!ipHash) return;
  await AnonymousGenerationQuota.updateOne(
    { ipHash, emailOtpSendCount: { $gt: 0 } },
    { $inc: { emailOtpSendCount: -1 } },
  );
}

async function login(req, res, next) {
  try {
    const { email, username, identity, password } = req.body;
    const normalizedIdentity = String(identity || username || email || '').trim().toLowerCase();
    if (!normalizedIdentity || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.', data: null });
    }
    const user = await User.findOne(buildLoginLookup(normalizedIdentity));
    if (!user || user.emailVerified === false || !(await bcrypt.compare(password, user.password)) || !localOnlyAccountAllowed(req, user)) {
      return res.status(401).json({ success: false, message: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.', data: null });
    }
    res.json({ success: true, message: 'Đăng nhập thành công', data: authResponse(user) });
  } catch (error) { next(error); }
}

async function registerRequest(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Vui lòng nhập email hợp lệ.', data: null });
    assertOtpDeliveryAvailable(req);
    const now = Date.now();
    let user = await otpUserQuery({ email });
    let createdPendingUser = false;
    if (user?.emailVerified !== false) {
      if (user) return res.status(409).json({ success: false, message: 'Email này đã được đăng ký. Hãy đăng nhập.', data: null });
    } else {
      ensureSendRate(user, now);
    }
    const ipReservation = await reserveIpSend(req, now);
    if (!user) {
      try {
        const temporaryPassword = await bcrypt.hash(generateRegistrationToken(), 12);
        user = await User.create({ name: email.split('@')[0].slice(0, 20), email, password: temporaryPassword, emailVerified: false, isActive: true, role: 'customer' });
        createdPendingUser = true;
      } catch (error) {
        await releaseIpSend(ipReservation).catch(() => {});
        throw error;
      }
    }
    const otp = generateOtp();
    try {
      if (smtpConfigured()) await sendOtpEmail(email, otp);
    } catch (error) {
      await releaseIpSend(ipReservation).catch(() => {});
      if (createdPendingUser && typeof user.deleteOne === 'function') await user.deleteOne().catch(() => {});
      error.status = 502;
      error.code = 'AUTH_OTP_SEND_FAILED';
      throw error;
    }
    const oldWindow = user.emailOtpWindowStartedAt && now - new Date(user.emailOtpWindowStartedAt).getTime() < OTP_WINDOW_MS;
    user.emailOtpHash = hashValue(`${email}:${otp}`);
    user.emailOtpExpiresAt = new Date(now + OTP_TTL_MS);
    user.emailOtpAttempts = 0;
    user.emailOtpSentAt = new Date(now);
    user.emailOtpWindowStartedAt = oldWindow ? user.emailOtpWindowStartedAt : new Date(now);
    user.emailOtpSendCount = oldWindow ? Number(user.emailOtpSendCount || 0) + 1 : 1;
    await user.save();
    const data = { email, expiresInSeconds: OTP_TTL_MS / 1000 };
    if (devOtpAllowed(req)) data.devOtp = otp;
    return res.status(202).json({ success: true, message: 'Mã xác minh đã được gửi đến email của bạn.', data });
  } catch (error) { return next(error); }
}

async function verifyRegistrationCode(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || req.body.otp || '').trim();
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Email hoặc mã xác minh không hợp lệ.', data: null });
    const user = await otpUserQuery({ email, emailVerified: false });
    if (!user || !user.emailOtpHash || !user.emailOtpExpiresAt) return res.status(400).json({ success: false, message: 'Mã xác minh không tồn tại hoặc đã hết hạn.', data: null });
    if (new Date(user.emailOtpExpiresAt).getTime() < Date.now()) return res.status(400).json({ success: false, message: 'Mã xác minh đã hết hạn. Vui lòng gửi mã mới.', data: null });
    if (Number(user.emailOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) return res.status(429).json({ success: false, message: 'Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi mã mới.', data: null });
    if (user.emailOtpHash !== hashValue(`${email}:${code}`)) {
      user.emailOtpAttempts = Number(user.emailOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Mã xác minh không đúng.', data: null });
    }
    const registrationToken = generateRegistrationToken();
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    user.emailOtpAttempts = 0;
    user.registrationTokenHash = hashValue(registrationToken);
    user.registrationTokenExpiresAt = new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS);
    await user.save();
    return res.json({ success: true, message: 'Email đã được xác minh. Hãy tạo thông tin tài khoản.', data: { email, registrationToken } });
  } catch (error) { next(error); }
}

async function completeRegistration(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const registrationToken = String(req.body.registrationToken || '').trim();
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    if (!isValidEmail(email) || !registrationToken || !name || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ họ tên và mật khẩu.', data: null });
    if (name.length > 80) return res.status(400).json({ success: false, message: 'Họ tên không được dài quá 80 ký tự.', data: null });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.', data: null });
    const user = await otpUserQuery({ email, emailVerified: false, registrationTokenHash: hashValue(registrationToken) });
    if (!user || !user.registrationTokenExpiresAt || new Date(user.registrationTokenExpiresAt).getTime() < Date.now()) return res.status(400).json({ success: false, message: 'Phiên đăng ký đã hết hạn. Vui lòng xác minh email lại.', data: null });
    user.name = name;
    user.password = await bcrypt.hash(password, 12);
    user.emailVerified = true;
    user.registrationTokenHash = undefined;
    user.registrationTokenExpiresAt = undefined;
    await user.save();
    return res.status(201).json({ success: true, message: 'Tạo tài khoản thành công', data: authResponse(user) });
  } catch (error) { next(error); }
}

// Kept at the old route for clients that only know /auth/register. It now
// starts verification; completing registration is intentionally a separate step.
const register = registerRequest;

module.exports = { login, register, registerRequest, verifyRegistrationCode, completeRegistration, buildLoginLookup, userData, authResponse, generateOtp, hashValue, reserveIpSend, releaseIpSend, OTP_TTL_MS, OTP_MAX_ATTEMPTS, OTP_MAX_SENDS, OTP_MAX_SENDS_PER_IP };
