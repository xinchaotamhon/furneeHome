const router = require('express').Router();
const roomPreviewController = require('../controllers/roomPreviewController');
const { optionalAuthenticate } = require('../middleware/authMiddleware');

router.post('/', optionalAuthenticate, roomPreviewController.create);

module.exports = router;
