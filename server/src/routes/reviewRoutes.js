const router = require('express').Router();
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/product/:productId', reviewController.getByProduct);
router.post('/', authenticate, reviewController.createReview);

module.exports = router;
