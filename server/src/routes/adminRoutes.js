const router = require('express').Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin, requireSuperadmin } = require('../middleware/authMiddleware');

router.use(authenticate, requireAdmin);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.listUsers);
router.patch('/users/:id', requireSuperadmin, adminController.updateUser);
router.get('/feedback', adminController.listFeedback);
router.patch('/feedback/:id', adminController.updateFeedback);

module.exports = router;
