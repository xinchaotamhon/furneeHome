const router = require('express').Router();
const reviewController = require('../controllers/reviewController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.get('/product/:productId', reviewController.getByProduct);
router.post('/', authenticate, reviewController.createReview);
router.patch('/:id/moderation', authenticate, requireAdmin, reviewController.moderateReview);
router.delete('/:id', authenticate, requireAdmin, reviewController.deleteReview);

module.exports = router;
