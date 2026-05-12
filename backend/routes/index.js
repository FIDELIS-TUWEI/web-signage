const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/displays', require('./display.routes'));
router.use('/content', require('./content.routes'));
router.use('/playlists', require('./playlist.routes'));
router.use('/schedules', require('./schedule.routes'));
router.use('/rooms', require('./room.routes'));
router.use('/meetings', require('./meeting.routes'));
router.use('/offers', require('./offer.routes'));
router.use('/', require('./weather.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;
