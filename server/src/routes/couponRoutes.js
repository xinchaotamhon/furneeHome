const router = require('express').Router();
const couponController = require('../controllers/couponController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.post('/apply', couponController.applyCoupon);

router.get('/', authenticate, requireAdmin, couponController.listCoupons);
router.post('/', authenticate, requireAdmin, couponController.createCoupon);
router.delete('/:id', authenticate, requireAdmin, couponController.deleteCoupon);

module.exports = router;
