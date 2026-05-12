const router = require('express').Router();
const {
  getOverview,
  getRoomsStatus,
  getDisplaysHealth,
  getTodaySchedule,
  getUpcomingMeetings,
  getActiveOffers,
} = require('../controllers/dashboard.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { cacheGet } = require('../middleware/cache.middleware');

// All dashboard routes require at minimum an authenticated user
router.use(protect, restrictTo('admin', 'editor'));

router.get('/overview', cacheGet('dashboard:overview', 15), getOverview);
router.get('/rooms/status', cacheGet('dashboard:rooms', 15), getRoomsStatus);
router.get('/displays/health', cacheGet('dashboard:displays', 15), getDisplaysHealth);
router.get('/schedule/today', cacheGet('dashboard:schedule', 30), getTodaySchedule);
router.get('/meetings/upcoming', cacheGet('dashboard:meetings', 15), getUpcomingMeetings);
router.get('/offers/active', cacheGet('dashboard:offers', 30), getActiveOffers);

module.exports = router;
