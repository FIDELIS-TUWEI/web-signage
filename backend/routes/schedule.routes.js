const router = require('express').Router();
const {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  getDisplayActiveSchedule,
} = require('../controllers/schedule.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');

router.use(protect);

router.get('/display/:displayId/active', getDisplayActiveSchedule);

router
  .route('/')
  .post(restrictTo('admin', 'editor'), bustCache('schedules'), createSchedule)
  .get(cacheGet('schedules', 30), getAllSchedules);

router
  .route('/:id')
  .get(getScheduleById)
  .patch(restrictTo('admin', 'editor'), bustCache('schedules'), updateSchedule)
  .delete(restrictTo('admin'), bustCache('schedules'), deleteSchedule);

module.exports = router;
