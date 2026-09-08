const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const emailService = require('../services/emailService');

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

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email.', data: null });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail, isActive: true });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Token có hiệu lực 15 phút
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;
      await emailService.sendResetPasswordEmail(user.email, resetUrl);
    }

    // Trả về phản hồi đồng nhất (chống user enumeration)
    return res.json({
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã xác thực và mật khẩu mới.',
        data: null,
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
        data: null,
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
      isActive: true,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.',
        data: null,
      });
    }

    // Cập nhật mật khẩu và hủy token (chỉ dùng 1 lần)
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, register, forgotPassword, resetPassword };
