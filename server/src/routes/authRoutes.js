const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/register/request', authController.registerRequest);
router.post('/register/verify', authController.verifyRegistrationCode);
router.post('/register/complete', authController.completeRegistration);
module.exports = router;
