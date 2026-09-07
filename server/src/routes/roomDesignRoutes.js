const router = require('express').Router();
const roomDesignController = require('../controllers/roomDesignController');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');

// Khách có thể xem Collection đã được chủ sở hữu công khai.
router.get('/public', optionalAuthenticate, roomDesignController.listPublic);
router.get('/public/creators/:creatorId', optionalAuthenticate, roomDesignController.listPublicByCreator);
router.get('/public/:shareSlug', optionalAuthenticate, roomDesignController.getPublicBySlug);

router.use(authenticate);

// Giữ GET / để frontend cũ vẫn hoạt động.
router.get('/', roomDesignController.listMine);
router.get('/mine', roomDesignController.listMine);
router.post('/', roomDesignController.create);
router.patch('/:id', roomDesignController.update);
router.put('/:id', roomDesignController.update);
router.delete('/:id', roomDesignController.remove);
router.post('/:id/like', roomDesignController.toggleLike);
router.post('/:id/reuse', roomDesignController.reuse);

module.exports = router;
