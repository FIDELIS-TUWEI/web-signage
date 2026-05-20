const asyncHandler = require('express-async-handler');
const Display = require('../models/display.model');
const { AppError } = require('../middleware/errorHandler');
const { buildDisplayPayload } = require('../services/display.service');
const { emitToAdmin, emitToDisplay } = require('../socket');
const logger = require('../utils/logger');

const ADMIN_SELECTABLE_FIELDS =
  'name location orientation screenSize status pairedRoomId config isOnline lastSeen ipAddress isActive registeredAt';

// Must match the threshold used by dashboard.controller.js
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function enrichOnlineStatus(display) {
  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  return { ...display, isOnline: display.lastSeen ? display.lastSeen >= cutoff : false };
}

exports.createDisplay = asyncHandler(async (req, res, next) => {
  const { name, location, orientation, screenSize, config: cfg } = req.body;
  if (!name || !location) {
    return next(new AppError('name and location are required.', 400));
  }

  const display = await Display.create({ name, location, orientation, screenSize, config: cfg });

  // Return the deviceKey only on creation — it cannot be retrieved again
  const withKey = await Display.findById(display._id).select('+deviceKey').lean();

  logger.info(`Display created: ${display.name}`);

  res.status(201).json({
    status: 'success',
    message: 'Display created. Store the deviceKey securely — it will not be shown again.',
    data: { display: withKey },
  });
});

exports.getAllDisplays = asyncHandler(async (req, res) => {
  const { status, isActive, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (Number(page) - 1) * Number(limit);

  const [displays, total] = await Promise.all([
    Display.find(filter)
      .select(ADMIN_SELECTABLE_FIELDS)
      .populate('pairedRoomId', 'name status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Display.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: displays.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: { displays: displays.map(enrichOnlineStatus) },
  });
});

exports.getDisplayById = asyncHandler(async (req, res, next) => {
  const display = await Display.findById(req.params.id)
    .select(ADMIN_SELECTABLE_FIELDS)
    .populate('pairedRoomId', 'name displayName status floor')
    .lean();
  if (!display) return next(new AppError('Display not found.', 404));
  res.status(200).json({ status: 'success', data: { display: enrichOnlineStatus(display) } });
});

exports.updateDisplay = asyncHandler(async (req, res, next) => {
  const allowed = ['name', 'location', 'orientation', 'screenSize', 'status', 'config', 'isActive'];
  const updateData = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  });

  const display = await Display.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  })
    .select(ADMIN_SELECTABLE_FIELDS)
    .populate('pairedRoomId', 'name status')
    .lean();

  if (!display) return next(new AppError('Display not found.', 404));

  emitToDisplay(req.params.id, 'display:config', { config: display.config });
  emitToAdmin('display:updated', { displayId: req.params.id });

  res.status(200).json({ status: 'success', message: 'Display updated.', data: { display } });
});

exports.deleteDisplay = asyncHandler(async (req, res, next) => {
  const display = await Display.findByIdAndDelete(req.params.id);
  if (!display) return next(new AppError('Display not found.', 404));
  res.status(200).json({ status: 'success', message: 'Display deleted.' });
});

exports.pairRoom = asyncHandler(async (req, res, next) => {
  const { roomId } = req.body;
  const display = await Display.findByIdAndUpdate(
    req.params.id,
    { pairedRoomId: roomId || null },
    { new: true, runValidators: true }
  )
    .select(ADMIN_SELECTABLE_FIELDS)
    .populate('pairedRoomId', 'name status')
    .lean();

  if (!display) return next(new AppError('Display not found.', 404));

  emitToDisplay(req.params.id, 'display:config', { pairedRoomId: roomId || null });

  res.status(200).json({
    status: 'success',
    message: roomId ? 'Room paired.' : 'Room unlinked.',
    data: { display },
  });
});

exports.heartbeat = asyncHandler(async (req, res, next) => {
  const display = await Display.findOneAndUpdate(
    { _id: req.params.id, isActive: true },
    { isOnline: true, lastSeen: new Date(), ipAddress: req.ip },
    { new: true, select: '_id isOnline lastSeen' }
  ).lean();

  if (!display) return next(new AppError('Display not found.', 404));

  res.status(200).json({ status: 'success', data: { lastSeen: display.lastSeen } });
});

exports.getDisplayContent = asyncHandler(async (req, res, next) => {
  const payload = await buildDisplayPayload(req.params.id);
  if (!payload) return next(new AppError('Display not found.', 404));
  res.status(200).json({ status: 'success', data: payload });
});
