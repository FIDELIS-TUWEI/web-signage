const router = require('express').Router();
const {
  createPlaylist,
  getAllPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addItem,
  reorderItems,
  removeItem,
} = require('../controllers/playlist.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');

router.use(protect);

router
  .route('/')
  .post(restrictTo('admin', 'editor'), bustCache('playlists'), createPlaylist)
  .get(cacheGet('playlists', 60), getAllPlaylists);

router
  .route('/:id')
  .get(getPlaylistById)
  .patch(restrictTo('admin', 'editor'), bustCache('playlists'), updatePlaylist)
  .delete(restrictTo('admin'), bustCache('playlists'), deletePlaylist);

// Playlist item management
router
  .route('/:id/items')
  .post(restrictTo('admin', 'editor'), bustCache('playlists'), addItem)
  .patch(restrictTo('admin', 'editor'), bustCache('playlists'), reorderItems);

router.delete(
  '/:id/items/:itemId',
  restrictTo('admin', 'editor'),
  bustCache('playlists'),
  removeItem
);

module.exports = router;
