const router = require('express').Router();
const {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  uploadAvatar,
} = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect, restrictTo('admin'));

router
  .route('/')
  .post(bustCache('users'), createUser)
  .get(cacheGet('users', 60), getAllUsers);

router
  .route('/:id')
  .get(getUserById)
  .patch(bustCache('users'), updateUser)
  .delete(bustCache('users'), deleteUser);

router.patch(
  '/:id/avatar',
  upload.single('avatar'),
  bustCache('users'),
  uploadAvatar
);

module.exports = router;
