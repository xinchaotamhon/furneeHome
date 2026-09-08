const router = require('express').Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.use(authenticate, requireAdmin);

router.get('/users', adminController.listUsers);
router.patch('/users/:id', adminController.updateUser);
router.get('/feedback', adminController.listFeedback);
router.patch('/feedback/:id', adminController.updateFeedback);

module.exports = router;
