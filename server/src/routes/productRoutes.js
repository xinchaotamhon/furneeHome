const router = require('express').Router();
const productController = require('../controllers/productController');
const {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
} = require('../middleware/authMiddleware');

router.get('/', optionalAuthenticate, productController.list);
router.get('/:id', optionalAuthenticate, productController.getById);
router.post('/', authenticate, requireAdmin, productController.create);
router.post('/:id/images', authenticate, requireAdmin, productController.addImage);
router.put('/:id', authenticate, requireAdmin, productController.update);
router.delete('/:id', authenticate, requireAdmin, productController.remove);

module.exports = router;
