const router = require('express').Router();
const cartController = require('../controllers/cartController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);
router.get('/', cartController.getCart);
router.post('/sync', cartController.syncCart);
router.post('/add', cartController.addToCart);
router.put('/update', cartController.updateQuantity);
router.delete('/item/:productId', cartController.removeItem);
router.delete('/clear', cartController.clearCart);

module.exports = router;
