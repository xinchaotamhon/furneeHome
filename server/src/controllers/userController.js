const User = require('../models/User');

function profileData(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username || '',
    email: user.email,
    avatarUrl: user.avatarUrl || '',
    role: user.role,
  };
}

async function getMe(req, res) {
  return res.json({ success: true, message: 'Đã tải hồ sơ.', data: profileData(req.user) });
}

async function updateMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.', data: null });

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name || name.length > 80) {
        return res.status(400).json({ success: false, message: 'Họ tên không hợp lệ.', data: null });
      }
      user.name = name;
    }

    if (req.body.avatarUrl !== undefined) {
      const avatarUrl = String(req.body.avatarUrl || '').trim();
      const isWebUrl = !avatarUrl || /^https?:\/\/[^\s]+$/i.test(avatarUrl);
      if (!isWebUrl || avatarUrl.length > 2_000) {
        return res.status(400).json({ success: false, message: 'Ảnh đại diện không hợp lệ.', data: null });
      }
      user.avatarUrl = avatarUrl;
    }

    await user.save();
    return res.json({ success: true, message: 'Đã cập nhật hồ sơ.', data: profileData(user) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMe, updateMe, profileData };
