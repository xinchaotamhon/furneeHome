const Feedback = require('../models/Feedback');

async function create(req, res, next) {
  try {
    const type = String(req.body.type || '').trim();
    const content = String(req.body.content || '').trim();
    if (!['suggestion', 'report'].includes(type) || !content || content.length > 2_000) {
      return res.status(400).json({ success: false, message: 'Nội dung góp ý không hợp lệ.', data: null });
    }

    const feedback = await Feedback.create({
      user: req.user?._id || null,
      name: req.user?.name || String(req.body.name || '').trim().slice(0, 80),
      email: req.user?.email || String(req.body.email || '').trim().toLowerCase().slice(0, 150),
      type,
      targetType: req.body.targetType === 'product' ? 'product' : 'general',
      targetId: String(req.body.targetId || '').trim().slice(0, 100),
      targetName: String(req.body.targetName || '').trim().slice(0, 200),
      content,
    });
    return res.status(201).json({ success: true, message: 'Đã gửi góp ý.', data: feedback });
  } catch (error) {
    return next(error);
  }
}

module.exports = { create };
