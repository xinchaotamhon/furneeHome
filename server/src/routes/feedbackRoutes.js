const router = require('express').Router();
const feedbackController = require('../controllers/feedbackController');
const { optionalAuthenticate } = require('../middleware/authMiddleware');

router.post('/', optionalAuthenticate, feedbackController.create);

module.exports = router;
