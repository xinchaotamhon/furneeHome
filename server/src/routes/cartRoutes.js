const router = require('express').Router();
const cartController = require('../controllers/cartController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);
router.get('/', cartController.get);
router.put('/', cartController.update);
module.exports = router;
