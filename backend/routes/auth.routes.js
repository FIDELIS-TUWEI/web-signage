const router = require('express').Router();
const {
  login,
  refresh,
  logout,
  getProfile,
  changePassword,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/profile', protect, getProfile);
router.patch('/change-password', protect, changePassword);

module.exports = router;
