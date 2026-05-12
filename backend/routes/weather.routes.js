const router = require('express').Router();
const {
  getWeather,
  refreshWeather,
  getForex,
  refreshForex,
} = require('../controllers/weather.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Weather — accessible by any authenticated user (displays call via REST or Socket)
router.get('/weather', protect, getWeather);
router.post('/weather/refresh', protect, restrictTo('admin'), refreshWeather);

// Forex — same access pattern
router.get('/forex', protect, getForex);
router.post('/forex/refresh', protect, restrictTo('admin'), refreshForex);

module.exports = router;
