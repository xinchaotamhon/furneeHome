const router = require('express').Router();
const roomDesignController = require('../controllers/roomDesignController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', roomDesignController.listMine);
router.get('/mine', roomDesignController.listMine);
router.get('/mine/:id', roomDesignController.getMine);
router.post('/', roomDesignController.create);
router.patch('/:id', roomDesignController.update);
router.put('/:id', roomDesignController.update);
router.delete('/:id', roomDesignController.remove);

module.exports = router;
