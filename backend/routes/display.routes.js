const router = require('express').Router();
const {
  createDisplay,
  getAllDisplays,
  getDisplayById,
  updateDisplay,
  deleteDisplay,
  pairRoom,
  heartbeat,
  getDisplayContent,
} = require('../controllers/display.controller');
const { protect, restrictTo, protectDisplay } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');

// Public display screen endpoints (device-key auth)
router.get('/:id/content', protectDisplay, getDisplayContent);
router.post('/:id/heartbeat', protectDisplay, heartbeat);

// Admin-only management endpoints
router.use(protect);

router
  .route('/')
  .post(restrictTo('admin'), bustCache('displays'), createDisplay)
  .get(cacheGet('displays', 30), getAllDisplays);

router
  .route('/:id')
  .get(getDisplayById)
  .patch(restrictTo('admin'), bustCache('displays'), updateDisplay)
  .delete(restrictTo('admin'), bustCache('displays'), deleteDisplay);

router.patch('/:id/pair-room', protect, restrictTo('admin'), bustCache('displays'), pairRoom);

module.exports = router;
