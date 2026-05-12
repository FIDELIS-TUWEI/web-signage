const router = require('express').Router();
const {
  uploadContent,
  getAllContent,
  getContentById,
  updateContent,
  deleteContent,
} = require('../controllers/content.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

router
  .route('/')
  .post(
    restrictTo('admin', 'editor'),
    upload.single('file'),
    bustCache('content'),
    uploadContent
  )
  .get(cacheGet('content', 60), getAllContent);

router
  .route('/:id')
  .get(getContentById)
  .patch(restrictTo('admin', 'editor'), bustCache('content'), updateContent)
  .delete(restrictTo('admin'), bustCache('content'), deleteContent);

module.exports = router;
