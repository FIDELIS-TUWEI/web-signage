const asyncHandler = require('express-async-handler');
const Offer = require('../models/offer.model');
const { AppError } = require('../middleware/errorHandler');
const { uploadBuffer, deleteByPublicId } = require('../utils/cloudinary');
const { emitToAdmin, emitToAll } = require('../socket');

exports.createOffer = asyncHandler(async (req, res, next) => {
  const {
    title,
    description,
    type,
    price,
    validFrom,
    validTo,
    priority,
    displayOnScreens,
    tags,
  } = req.body;

  if (!title || !description || !type) {
    return next(new AppError('title, description, and type are required.', 400));
  }
  if (!Offer.OFFER_TYPES.includes(type)) {
    return next(new AppError(`type must be one of: ${Offer.OFFER_TYPES.join(', ')}`, 400));
  }

  let imageUrl = null;
  let imagePublicId = null;

  if (req.file) {
    const result = await uploadBuffer(req.file.buffer, {
      folder: 'hdwss/offers',
      transformation: [{ width: 1200, height: 800, crop: 'fill' }],
    });
    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
  }

  const offer = await Offer.create({
    title,
    description,
    type,
    imageUrl,
    imagePublicId,
    price: price ? (typeof price === 'string' ? JSON.parse(price) : price) : undefined,
    validFrom: validFrom || null,
    validTo: validTo || null,
    priority: priority ? Number(priority) : 0,
    displayOnScreens: displayOnScreens || [],
    tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
    createdBy: req.user._id,
  });

  emitToAll('offer:update', { action: 'created', offerId: offer._id });

  res.status(201).json({ status: 'success', message: 'Offer created.', data: { offer } });
});

exports.getAllOffers = asyncHandler(async (req, res) => {
  const { type, isActive, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (Number(page) - 1) * Number(limit);

  const [offers, total] = await Promise.all([
    Offer.find(filter)
      .select('-imagePublicId')
      .populate('createdBy', 'firstName lastName')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean({ virtuals: true }),
    Offer.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: offers.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: { offers },
  });
});

exports.getOfferById = asyncHandler(async (req, res, next) => {
  const offer = await Offer.findById(req.params.id)
    .select('-imagePublicId')
    .populate('createdBy', 'firstName lastName')
    .lean({ virtuals: true });
  if (!offer) return next(new AppError('Offer not found.', 404));
  res.status(200).json({ status: 'success', data: { offer } });
});

exports.updateOffer = asyncHandler(async (req, res, next) => {
  const allowed = ['title', 'description', 'price', 'validFrom', 'validTo', 'isActive', 'priority', 'displayOnScreens', 'tags'];
  const updateData = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  });

  if (req.file) {
    const existing = await Offer.findById(req.params.id).select('imagePublicId');
    if (existing?.imagePublicId) {
      await deleteByPublicId(existing.imagePublicId).catch(() => {});
    }
    const result = await uploadBuffer(req.file.buffer, {
      folder: 'hdwss/offers',
      transformation: [{ width: 1200, height: 800, crop: 'fill' }],
    });
    updateData.imageUrl = result.secure_url;
    updateData.imagePublicId = result.public_id;
  }

  const offer = await Offer.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  })
    .select('-imagePublicId')
    .lean({ virtuals: true });

  if (!offer) return next(new AppError('Offer not found.', 404));

  emitToAll('offer:update', { action: 'updated', offerId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Offer updated.', data: { offer } });
});

exports.deleteOffer = asyncHandler(async (req, res, next) => {
  const offer = await Offer.findByIdAndDelete(req.params.id);
  if (!offer) return next(new AppError('Offer not found.', 404));

  if (offer.imagePublicId) {
    await deleteByPublicId(offer.imagePublicId).catch(() => {});
  }

  emitToAll('offer:update', { action: 'deleted', offerId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Offer deleted.' });
});

exports.toggleOffer = asyncHandler(async (req, res, next) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return next(new AppError('Offer not found.', 404));

  offer.isActive = !offer.isActive;
  await offer.save();

  emitToAll('offer:update', { action: 'toggled', offerId: req.params.id, isActive: offer.isActive });
  res.status(200).json({
    status: 'success',
    message: `Offer ${offer.isActive ? 'activated' : 'deactivated'}.`,
    data: { isActive: offer.isActive },
  });
});
