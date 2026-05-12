const router = require('express').Router();
const {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
  uploadRoomImage,
} = require('../controllers/room.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

router
  .route('/')
  .post(restrictTo('admin'), bustCache('rooms'), createRoom)
  .get(cacheGet('rooms', 30), getAllRooms);

router
  .route('/:id')
  .get(getRoomById)
  .patch(restrictTo('admin'), bustCache('rooms'), updateRoom)
  .delete(restrictTo('admin'), bustCache('rooms'), deleteRoom);

router.patch('/:id/status', restrictTo('admin', 'editor'), bustCache('rooms'), updateRoomStatus);

router.patch(
  '/:id/image',
  restrictTo('admin', 'editor'),
  upload.single('image'),
  bustCache('rooms'),
  uploadRoomImage
);

module.exports = router;
