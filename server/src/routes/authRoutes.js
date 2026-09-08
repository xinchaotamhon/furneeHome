const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/forgot-password/request', authController.requestPasswordReset);
router.post('/forgot-password/reset', authController.resetPassword);
module.exports = router;
