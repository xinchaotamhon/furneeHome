const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.registerRequest);
router.post('/register/request', authController.registerRequest);
router.post('/register/complete', authController.completeRegistration);
router.post('/forgot-password/request', authController.requestPasswordReset);
router.post('/forgot-password/reset', authController.resetPassword);
module.exports = router;
