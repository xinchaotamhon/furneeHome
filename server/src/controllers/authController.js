const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const data = await authService.login(req.body.email, req.body.password);
    res.json({ success: true, message: 'Login successful', data });
  } catch (error) { next(error); }
}

module.exports = { login };
