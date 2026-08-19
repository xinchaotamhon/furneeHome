const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

// Xử lý đăng nhập
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase(), isActive: true });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
        data: null,
      });
    }

    const token = jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' });
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (error) { next(error); }
}

module.exports = { login };
