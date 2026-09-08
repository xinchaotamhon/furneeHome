const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/cart', require('./cartRoutes'));
router.use('/orders', require('./orderRoutes'));
router.use('/reviews', require('./reviewRoutes'));
router.use('/coupons', require('./couponRoutes'));
router.use('/room-designs', require('./roomDesignRoutes'));
router.use('/room-previews', require('./roomPreviewRoutes'));
router.use('/feedback', require('./feedbackRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
