const router = require('express').Router();
const {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  getCurrentMeeting,
  getUpcomingMeetings,
} = require('../controllers/meeting.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');

router.use(protect);

// Room-scoped meeting queries (used by display payloads and room panels)
router.get('/room/:roomId/current', getCurrentMeeting);
router.get('/room/:roomId/upcoming', getUpcomingMeetings);

router
  .route('/')
  .post(restrictTo('admin', 'editor'), bustCache('meetings'), createMeeting)
  .get(cacheGet('meetings', 30), getAllMeetings);

router
  .route('/:id')
  .get(getMeetingById)
  .patch(restrictTo('admin', 'editor'), bustCache('meetings'), updateMeeting)
  .delete(restrictTo('admin'), bustCache('meetings'), deleteMeeting);

module.exports = router;
