const router = require('express').Router();
const roomDesignController = require('../controllers/roomDesignController');
const { authenticate } = require('../middleware/authMiddleware');

// Khách có thể xem Collection đã được chủ sở hữu công khai.
router.get('/public', roomDesignController.listPublic);
router.get('/public/:shareSlug', roomDesignController.getPublicBySlug);

router.use(authenticate);

// Giữ GET / để frontend cũ vẫn hoạt động.
router.get('/', roomDesignController.listMine);
router.get('/mine', roomDesignController.listMine);
router.post('/', roomDesignController.create);
router.patch('/:id', roomDesignController.update);
router.put('/:id', roomDesignController.update);
router.delete('/:id', roomDesignController.remove);
router.post('/:id/reuse', roomDesignController.reuse);

module.exports = router;
