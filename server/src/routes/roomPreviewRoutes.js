const router = require('express').Router();
const roomPreviewController = require('../controllers/roomPreviewController');
const { optionalAuthenticate } = require('../middleware/authMiddleware');
const { reserveAnonymousGeneration } = require('../services/anonymousGenerationQuotaService');

// Người đăng nhập không dùng quota khách. Khách chỉ được giữ một lượt tại một
// thời điểm và chỉ bị trừ khi provider thật sự trả về ảnh thành công.
router.post('/', optionalAuthenticate, reserveAnonymousGeneration, roomPreviewController.create);

module.exports = router;
