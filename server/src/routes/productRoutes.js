const router = require('express').Router();
const productController = require('../controllers/productController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.get('/', productController.list);
router.post('/', authenticate, requireAdmin, productController.create);
router.put('/:id', authenticate, requireAdmin, productController.update);
router.delete('/:id', authenticate, requireAdmin, productController.remove);
module.exports = router;
