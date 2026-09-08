const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);

module.exports = router;
