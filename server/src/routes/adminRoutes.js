const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

router.use(authenticate, requireAdmin);
router.get('/users', adminController.listUsers);
module.exports = router;
