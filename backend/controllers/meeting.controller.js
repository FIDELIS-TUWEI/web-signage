const asyncHandler = require('express-async-handler');
const Meeting = require('../models/meeting.model');
const Room = require('../models/room.model');
const Display = require('../models/display.model');
const { AppError } = require('../middleware/errorHandler');
const { emitToDisplay, emitToAdmin } = require('../socket');

const pushRoomStatusToDisplays = async (roomId, status) => {
  const displays = await Display.find({ pairedRoomId: roomId, isActive: true })
    .select('_id')
    .lean();
  displays.forEach((d) => {
    emitToDisplay(d._id.toString(), 'room:status', { roomId, status });
  });
};

exports.createMeeting = asyncHandler(async (req, res, next) => {
  const { title, roomId, organizerName, organizerEmail, startTime, endTime, attendeesCount, isPrivate, notes } = req.body;

  if (!title || !roomId || !organizerName || !startTime || !endTime) {
    return next(new AppError('title, roomId, organizerName, startTime, endTime are required.', 400));
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) return next(new AppError('endTime must be after startTime.', 400));

  const room = await Room.exists({ _id: roomId, isActive: true });
  if (!room) return next(new AppError('Room not found or inactive.', 404));

  // Conflict check — overlapping meetings in the same room
  const conflict = await Meeting.exists({
    roomId,
    status: { $in: ['scheduled', 'ongoing'] },
    startTime: { $lt: end },
    endTime: { $gt: start },
  });

  if (conflict) {
    return next(new AppError('This room already has a meeting scheduled in the requested time slot.', 409));
  }

  const now = new Date();
  const status = start <= now && end > now ? 'ongoing' : 'scheduled';

  const meeting = await Meeting.create({
    title,
    roomId,
    organizerName,
    organizerEmail,
    startTime: start,
    endTime: end,
    status,
    attendeesCount,
    isPrivate,
    notes,
    createdBy: req.user?._id || null,
  });

  if (status === 'ongoing') {
    await Room.findByIdAndUpdate(roomId, { status: 'occupied' });
    await pushRoomStatusToDisplays(roomId, 'occupied');
  }

  emitToAdmin('meeting:created', { meetingId: meeting._id, roomId, status });

  res.status(201).json({ status: 'success', message: 'Meeting created.', data: { meeting } });
});

exports.getAllMeetings = asyncHandler(async (req, res) => {
  const { roomId, status: meetStatus, date, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (roomId) filter.roomId = roomId;
  if (meetStatus) filter.status = meetStatus;
  if (date) {
    const d = new Date(date);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    filter.startTime = { $gte: d, $lt: next };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [meetings, total] = await Promise.all([
    Meeting.find(filter)
      .populate('roomId', 'name displayName floor')
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean({ virtuals: true }),
    Meeting.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: meetings.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: { meetings },
  });
});

exports.getMeetingById = asyncHandler(async (req, res, next) => {
  const meeting = await Meeting.findById(req.params.id)
    .populate('roomId', 'name displayName floor capacity')
    .lean({ virtuals: true });
  if (!meeting) return next(new AppError('Meeting not found.', 404));
  res.status(200).json({ status: 'success', data: { meeting } });
});

exports.updateMeeting = asyncHandler(async (req, res, next) => {
  const allowed = ['title', 'organizerName', 'organizerEmail', 'startTime', 'endTime', 'attendeesCount', 'isPrivate', 'notes', 'status'];
  const updateData = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  });

  const meeting = await Meeting.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('roomId', 'name')
    .lean({ virtuals: true });

  if (!meeting) return next(new AppError('Meeting not found.', 404));

  emitToAdmin('meeting:updated', { meetingId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Meeting updated.', data: { meeting } });
});

exports.deleteMeeting = asyncHandler(async (req, res, next) => {
  const meeting = await Meeting.findByIdAndDelete(req.params.id);
  if (!meeting) return next(new AppError('Meeting not found.', 404));

  // If it was ongoing, free the room
  if (meeting.status === 'ongoing') {
    const stillOccupied = await Meeting.exists({ roomId: meeting.roomId, status: 'ongoing' });
    if (!stillOccupied) {
      await Room.findByIdAndUpdate(meeting.roomId, { status: 'vacant' });
      await pushRoomStatusToDisplays(meeting.roomId.toString(), 'vacant');
    }
  }

  res.status(200).json({ status: 'success', message: 'Meeting deleted.' });
});

exports.getCurrentMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({
    roomId: req.params.roomId,
    status: 'ongoing',
  })
    .populate('roomId', 'name displayName')
    .lean({ virtuals: true });

  res.status(200).json({ status: 'success', data: { meeting: meeting || null } });
});

exports.getUpcomingMeetings = asyncHandler(async (req, res) => {
  const meetings = await Meeting.find({
    roomId: req.params.roomId,
    status: 'scheduled',
    startTime: { $gt: new Date() },
  })
    .sort({ startTime: 1 })
    .limit(5)
    .lean({ virtuals: true });

  res.status(200).json({ status: 'success', data: { meetings } });
});
