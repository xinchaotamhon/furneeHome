const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const User = require('../models/User');

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listUsers(req, res, next) {
  try {
    const filter = {};
    if (req.query.scope === 'admins') filter.role = { $in: ['admin', 'superadmin'] };
    if (req.query.scope === 'customers') filter.role = 'customer';

    const search = String(req.query.search || '').trim();
    if (search) {
      const keyword = escapeRegex(search);
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { username: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name username email avatarUrl phone address provinceCode districtCode districtName wardCode wardName deliveryNote role isActive createdAt')
      .sort({ createdAt: -1 });
    const data = users.map((user) => ({
      ...user.toObject(),
      profileComplete: Boolean(user.phone && user.address && user.provinceCode && user.districtCode && user.wardCode),
    }));
    return res.json({ success: true, message: 'Đã tải người dùng.', data });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ.', data: null });
    }
    if (String(req.user._id) === req.params.id) {
      return res.status(400).json({ success: false, message: 'Không thể thay đổi quyền của chính bạn.', data: null });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.', data: null });
    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Không thể thay đổi quản trị cao nhất.', data: null });
    }

    if (req.body.role !== undefined) {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Chỉ quản trị cao nhất được thay đổi quyền.', data: null });
      }
      if (!['customer', 'admin'].includes(req.body.role)) {
        return res.status(400).json({ success: false, message: 'Quyền người dùng không hợp lệ.', data: null });
      }
      user.role = req.body.role;
    }
    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Trạng thái tài khoản không hợp lệ.', data: null });
      }
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Chỉ Orchestra Admin mới có quyền khóa hoặc mở khóa tài khoản.', data: null });
      }
      user.isActive = req.body.isActive;
    }
    await user.save();

    return res.json({
      success: true,
      message: 'Đã cập nhật người dùng.',
      data: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    });
  } catch (error) {
    return next(error);
  }
}

async function listFeedback(req, res, next) {
  try {
    const feedback = await Feedback.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải phản hồi.', data: feedback });
  } catch (error) {
    return next(error);
  }
}

const FEEDBACK_TRANSITIONS = {
  new: ['reviewed', 'resolved'],
  reviewed: ['resolved'],
  resolved: [],
};
const ALL_FEEDBACK_STATUSES = ['new', 'reviewed', 'resolved'];

async function updateFeedback(req, res, next) {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã phản hồi không hợp lệ.', data: null });
    }
    const nextStatus = req.body.status;
    if (!ALL_FEEDBACK_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Trạng thái phản hồi không hợp lệ.', data: null });
    }

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi.', data: null });

    if (feedback.status !== nextStatus) {
      const isSuperadmin = req.user?.role === 'superadmin';
      const allowedNext = isSuperadmin ? ALL_FEEDBACK_STATUSES : (FEEDBACK_TRANSITIONS[feedback.status] || []);
      if (!allowedNext.includes(nextStatus)) {
        return res.status(409).json({
          success: false,
          message: 'Admin không được phép đổi lại trạng thái này. Chỉ Orchestra Admin mới có thể đổi lại.',
          data: null,
        });
      }
      feedback.status = nextStatus;
      await feedback.save();
    }

    return res.json({ success: true, message: 'Đã cập nhật phản hồi.', data: feedback });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listUsers, updateUser, listFeedback, updateFeedback, FEEDBACK_TRANSITIONS };

