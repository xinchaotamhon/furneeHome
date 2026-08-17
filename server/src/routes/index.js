const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/cart', require('./cartRoutes'));
router.use('/room-designs', require('./roomDesignRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
