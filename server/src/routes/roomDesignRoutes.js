const router = require('express').Router();
const roomDesignController = require('../controllers/roomDesignController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);
router.get('/', roomDesignController.listMine);
router.post('/', roomDesignController.save);
module.exports = router;
