const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function getDashboardStats(req, res, next) {
  try {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    const deliveredOrders = await Order.find({ orderStatus: 'Delivered' });
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    const pendingOrders = await Order.countDocuments({ orderStatus: 'Pending' });
    const processingOrders = await Order.countDocuments({ orderStatus: 'Processing' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'Shipped' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'Cancelled' });

    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      success: true,
      message: 'Đã tải số liệu thống kê.',
      data: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalUsers,
        ordersByStatus: {
          pending: pendingOrders,
          processing: processingOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders.length,
          cancelled: cancelledOrders,
        },
        recentOrders,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await User.find()
      .select('name email avatarUrl role isActive createdAt')
      .sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải người dùng.', data: users });
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
      if (!['customer', 'admin'].includes(req.body.role)) {
        return res.status(400).json({ success: false, message: 'Quyền người dùng không hợp lệ.', data: null });
      }
      user.role = req.body.role;
    }
    if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);
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

async function updateFeedback(req, res, next) {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã phản hồi không hợp lệ.', data: null });
    }
    if (!['new', 'reviewed', 'resolved'].includes(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái phản hồi không hợp lệ.', data: null });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { returnDocument: 'after', runValidators: true },
    );
    if (!feedback) return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi.', data: null });
    return res.json({ success: true, message: 'Đã cập nhật phản hồi.', data: feedback });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDashboardStats, listUsers, updateUser, listFeedback, updateFeedback };
