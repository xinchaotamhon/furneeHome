const router = require('express').Router();
const roomPreviewController = require('../controllers/roomPreviewController');

router.post('/', roomPreviewController.create);

module.exports = router;
