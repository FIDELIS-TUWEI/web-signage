const router = require('express').Router();
const {
  createOffer,
  getAllOffers,
  getOfferById,
  updateOffer,
  deleteOffer,
  toggleOffer,
} = require('../controllers/offer.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { bustCache, cacheGet } = require('../middleware/cache.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

router
  .route('/')
  .post(
    restrictTo('admin', 'editor'),
    upload.single('image'),
    bustCache('offers'),
    createOffer
  )
  .get(cacheGet('offers', 60), getAllOffers);

router
  .route('/:id')
  .get(getOfferById)
  .patch(
    restrictTo('admin', 'editor'),
    upload.single('image'),
    bustCache('offers'),
    updateOffer
  )
  .delete(restrictTo('admin'), bustCache('offers'), deleteOffer);

router.patch('/:id/toggle', restrictTo('admin', 'editor'), bustCache('offers'), toggleOffer);

module.exports = router;
