const router = require('express').Router();
const productController = require('../controllers/productController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.get('/', productController.list);
router.get('/metadata', authenticate, requireAdmin, productController.metadataFromSourceUrl);
router.get('/export-json', authenticate, requireAdmin, productController.exportJson);
router.post('/import-shopee', authenticate, requireAdmin, productController.importShopee);
router.post('/', authenticate, requireAdmin, productController.create);
router.post('/:id/images', authenticate, requireAdmin, productController.addImage);
router.put('/:id', authenticate, requireAdmin, productController.update);
router.delete('/:id', authenticate, requireAdmin, productController.remove);
module.exports = router;
