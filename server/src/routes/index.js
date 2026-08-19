const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/room-designs', require('./roomDesignRoutes'));
router.use('/room-previews', require('./roomPreviewRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
