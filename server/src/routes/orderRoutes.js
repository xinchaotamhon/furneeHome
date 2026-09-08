const router = require('express').Router();
const orderController = require('../controllers/orderController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/', orderController.createOrder);
router.get('/my-orders', orderController.getMyOrders);
router.patch('/:id/cancel', orderController.cancelMyOrder);
router.get('/:id', orderController.getOrderById);

router.get('/', requireAdmin, orderController.getAllOrders);
router.put('/:id/status', requireAdmin, orderController.updateOrderStatus);

module.exports = router;
