const asyncHandler = require('express-async-handler');
const Schedule = require('../models/schedule.model');
const { AppError } = require('../middleware/errorHandler');
const { emitToDisplay, emitToAdmin } = require('../socket');

exports.createSchedule = asyncHandler(async (req, res, next) => {
  const {
    name,
    displayId,
    playlistId,
    startDate,
    endDate,
    startTime,
    endTime,
    daysOfWeek,
    priority,
  } = req.body;

  if (!name || !displayId || !playlistId || !startDate || !endDate || !startTime || !endTime) {
    return next(
      new AppError('name, displayId, playlistId, startDate, endDate, startTime, endTime are required.', 400)
    );
  }

  if (new Date(startDate) > new Date(endDate)) {
    return next(new AppError('startDate must be before endDate.', 400));
  }

  const now = new Date();
  const status =
    new Date(startDate) <= now && new Date(endDate) >= now ? 'active' : 'pending';

  const schedule = await Schedule.create({
    name,
    displayId,
    playlistId,
    startDate,
    endDate,
    startTime,
    endTime,
    daysOfWeek,
    priority,
    status,
    createdBy: req.user._id,
  });

  emitToDisplay(displayId, 'schedule:update', { scheduleId: schedule._id });
  emitToAdmin('schedule:created', { scheduleId: schedule._id, displayId });

  res.status(201).json({ status: 'success', message: 'Schedule created.', data: { schedule } });
});

exports.getAllSchedules = asyncHandler(async (req, res) => {
  const { displayId, status: schedStatus, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (displayId) filter.displayId = displayId;
  if (schedStatus) filter.status = schedStatus;

  const skip = (Number(page) - 1) * Number(limit);

  const [schedules, total] = await Promise.all([
    Schedule.find(filter)
      .populate('displayId', 'name location')
      .populate('playlistId', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Schedule.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: schedules.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: { schedules },
  });
});

exports.getScheduleById = asyncHandler(async (req, res, next) => {
  const schedule = await Schedule.findById(req.params.id)
    .populate('displayId', 'name location')
    .populate('playlistId', 'name')
    .lean();
  if (!schedule) return next(new AppError('Schedule not found.', 404));
  res.status(200).json({ status: 'success', data: { schedule } });
});

exports.updateSchedule = asyncHandler(async (req, res, next) => {
  const allowed = ['name', 'startDate', 'endDate', 'startTime', 'endTime', 'daysOfWeek', 'priority', 'isActive', 'playlistId'];
  const updateData = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  });

  const schedule = await Schedule.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).lean();

  if (!schedule) return next(new AppError('Schedule not found.', 404));

  emitToDisplay(schedule.displayId.toString(), 'schedule:update', { scheduleId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Schedule updated.', data: { schedule } });
});

exports.deleteSchedule = asyncHandler(async (req, res, next) => {
  const schedule = await Schedule.findByIdAndDelete(req.params.id);
  if (!schedule) return next(new AppError('Schedule not found.', 404));

  emitToDisplay(schedule.displayId.toString(), 'schedule:update', { removed: req.params.id });
  res.status(200).json({ status: 'success', message: 'Schedule deleted.' });
});

exports.getDisplayActiveSchedule = asyncHandler(async (req, res) => {
  const { resolveActiveSchedule } = require('../services/schedule.service');
  const result = await resolveActiveSchedule(req.params.displayId);
  res.status(200).json({ status: 'success', data: result || { schedule: null, playlist: null } });
});
