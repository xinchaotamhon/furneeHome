const User = require('../models/User');

async function listUsers(req, res, next) {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, message: 'Users loaded', data: users });
  } catch (error) { next(error); }
}

module.exports = { listUsers };
