const asyncHandler = require('express-async-handler');
const Room = require('../models/room.model');
const Display = require('../models/display.model');
const { AppError } = require('../middleware/errorHandler');
const { uploadBuffer, deleteByPublicId } = require('../utils/cloudinary');
const { emitToDisplay, emitToAdmin } = require('../socket');

exports.createRoom = asyncHandler(async (req, res, next) => {
  const { name, displayName, capacity, floor, building, amenities, description } = req.body;
  if (!name) return next(new AppError('name is required.', 400));

  const room = await Room.create({
    name,
    displayName,
    capacity,
    floor,
    building,
    amenities: amenities || [],
    description,
  });

  res.status(201).json({ status: 'success', message: 'Room created.', data: { room } });
});

exports.getAllRooms = asyncHandler(async (req, res) => {
  const { status, isActive, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (Number(page) - 1) * Number(limit);

  const [rooms, total] = await Promise.all([
    Room.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean({ virtuals: true }),
    Room.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: rooms.length,
    total,
    data: { rooms },
  });
});

exports.getRoomById = asyncHandler(async (req, res, next) => {
  const room = await Room.findById(req.params.id).lean({ virtuals: true });
  if (!room) return next(new AppError('Room not found.', 404));
  res.status(200).json({ status: 'success', data: { room } });
});

exports.updateRoom = asyncHandler(async (req, res, next) => {
  const allowed = ['name', 'displayName', 'capacity', 'floor', 'building', 'amenities', 'description', 'isActive'];
  const updateData = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  });

  const room = await Room.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).lean({ virtuals: true });

  if (!room) return next(new AppError('Room not found.', 404));
  res.status(200).json({ status: 'success', message: 'Room updated.', data: { room } });
});

exports.deleteRoom = asyncHandler(async (req, res, next) => {
  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) return next(new AppError('Room not found.', 404));

  if (room.imagePublicId) {
    await deleteByPublicId(room.imagePublicId).catch(() => {});
  }

  // Unpair any displays linked to this room
  await Display.updateMany({ pairedRoomId: req.params.id }, { pairedRoomId: null });

  res.status(200).json({ status: 'success', message: 'Room deleted.' });
});

exports.updateRoomStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  if (!status || !Room.ROOM_STATUSES.includes(status)) {
    return next(
      new AppError(`status must be one of: ${Room.ROOM_STATUSES.join(', ')}`, 400)
    );
  }

  const room = await Room.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).lean();

  if (!room) return next(new AppError('Room not found.', 404));

  // Push status update to displays paired to this room
  const displays = await Display.find({ pairedRoomId: req.params.id, isActive: true })
    .select('_id')
    .lean();

  displays.forEach((d) => {
    emitToDisplay(d._id.toString(), 'room:status', { roomId: req.params.id, status });
  });

  emitToAdmin('room:statusChanged', { roomId: req.params.id, status });

  res.status(200).json({ status: 'success', message: 'Room status updated.', data: { room } });
});

exports.uploadRoomImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('No file uploaded.', 400));

  const room = await Room.findById(req.params.id);
  if (!room) return next(new AppError('Room not found.', 404));

  if (room.imagePublicId) {
    await deleteByPublicId(room.imagePublicId).catch(() => {});
  }

  const result = await uploadBuffer(req.file.buffer, {
    folder: 'web-signage/rooms',
    transformation: [{ width: 1920, height: 1080, crop: 'fill' }],
  });

  room.imageUrl = result.secure_url;
  room.imagePublicId = result.public_id;
  await room.save();

  res.status(200).json({
    status: 'success',
    message: 'Room image updated.',
    data: { imageUrl: room.imageUrl },
  });
});
