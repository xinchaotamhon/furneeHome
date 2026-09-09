const router = require('express').Router();
const productController = require('../controllers/productController');
const {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
} = require('../middleware/authMiddleware');

router.get('/', optionalAuthenticate, productController.list);
router.post('/sync-json', authenticate, requireAdmin, productController.syncJson);
router.get('/:id', optionalAuthenticate, productController.getById);
router.post('/', authenticate, requireAdmin, productController.create);
router.post('/:id/images', authenticate, requireAdmin, productController.addImage);
router.put('/:id', authenticate, requireAdmin, productController.update);
router.delete('/:id/permanent', authenticate, requireAdmin, productController.permanentRemove);
router.delete('/:id', authenticate, requireAdmin, productController.remove);

module.exports = router;
