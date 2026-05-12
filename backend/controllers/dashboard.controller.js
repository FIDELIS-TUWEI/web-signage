const asyncHandler = require('express-async-handler');
const Display = require('../models/display.model');
const Room = require('../models/room.model');
const Meeting = require('../models/meeting.model');
const Content = require('../models/content.model');
const Playlist = require('../models/playlist.model');
const Schedule = require('../models/schedule.model');
const Offer = require('../models/offer.model');
const User = require('../models/user.model');

const startOfDay = (d = new Date()) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};

const endOfDay = (d = new Date()) => {
  const s = new Date(d);
  s.setHours(23, 59, 59, 999);
  return s;
};

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * GET /dashboard/overview
 * All high-level KPI cards for the admin dashboard.
 */
exports.getOverview = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const onlineCutoff = new Date(now - ONLINE_THRESHOLD_MS);
  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [
    totalDisplays,
    onlineDisplays,
    totalRooms,
    occupiedRooms,
    maintenanceRooms,
    todayMeetingsTotal,
    todayMeetingsOngoing,
    upcomingMeetings2h,
    totalContent,
    totalPlaylists,
    activeSchedules,
    expiringSchedules,
    totalOffers,
    activeOffers,
    expiringOffers,
    totalUsers,
  ] = await Promise.all([
    Display.countDocuments({ isActive: true }),
    Display.countDocuments({ isActive: true, lastSeen: { $gte: onlineCutoff } }),
    Room.countDocuments({ isActive: true }),
    Room.countDocuments({ status: 'occupied', isActive: true }),
    Room.countDocuments({ status: 'maintenance', isActive: true }),
    Meeting.countDocuments({ startTime: { $gte: todayStart, $lte: todayEnd } }),
    Meeting.countDocuments({ status: 'ongoing' }),
    Meeting.countDocuments({
      status: 'scheduled',
      startTime: { $gte: now, $lte: in2Hours },
    }),
    Content.countDocuments({ isActive: true }),
    Playlist.countDocuments({ isActive: true }),
    Schedule.countDocuments({ status: 'active', isActive: true }),
    Schedule.countDocuments({
      status: 'active',
      isActive: true,
      endDate: { $gte: now, $lte: in24Hours },
    }),
    Offer.countDocuments(),
    Offer.countDocuments({ isActive: true }),
    Offer.countDocuments({
      isActive: true,
      validTo: { $gte: now, $lte: in24Hours },
    }),
    User.countDocuments({ isActive: true }),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      displays: {
        total: totalDisplays,
        online: onlineDisplays,
        offline: totalDisplays - onlineDisplays,
      },
      rooms: {
        total: totalRooms,
        occupied: occupiedRooms,
        vacant: totalRooms - occupiedRooms - maintenanceRooms,
        maintenance: maintenanceRooms,
      },
      meetings: {
        today: todayMeetingsTotal,
        ongoing: todayMeetingsOngoing,
        upcomingIn2h: upcomingMeetings2h,
      },
      content: {
        total: totalContent,
        playlists: totalPlaylists,
      },
      schedules: {
        active: activeSchedules,
        expiringSoon: expiringSchedules,
      },
      offers: {
        total: totalOffers,
        active: activeOffers,
        expiringSoon: expiringOffers,
      },
      users: { total: totalUsers },
      generatedAt: now.toISOString(),
    },
  });
});

/**
 * GET /dashboard/rooms/status
 * Per-room status grid: occupancy + current/upcoming meetings.
 */
exports.getRoomsStatus = asyncHandler(async (req, res) => {
  const now = new Date();

  const rooms = await Room.find({ isActive: true })
    .sort({ floor: 1, name: 1 })
    .lean({ virtuals: true });

  const roomIds = rooms.map((r) => r._id);

  const [ongoingMeetings, upcomingMeetings] = await Promise.all([
    Meeting.find({
      roomId: { $in: roomIds },
      status: 'ongoing',
    })
      .select('roomId title organizerName startTime endTime attendeesCount isPrivate')
      .lean(),

    Meeting.find({
      roomId: { $in: roomIds },
      status: 'scheduled',
      startTime: { $gt: now },
    })
      .sort({ startTime: 1 })
      .select('roomId title organizerName startTime endTime attendeesCount isPrivate')
      .lean(),
  ]);

  const ongoingMap = new Map(ongoingMeetings.map((m) => [m.roomId.toString(), m]));
  const upcomingMap = upcomingMeetings.reduce((acc, m) => {
    const key = m.roomId.toString();
    if (!acc[key]) acc[key] = [];
    if (acc[key].length < 3) acc[key].push(m);
    return acc;
  }, {});

  const roomsWithStatus = rooms.map((room) => ({
    ...room,
    currentMeeting: ongoingMap.get(room._id.toString()) || null,
    upcomingMeetings: upcomingMap[room._id.toString()] || [],
  }));

  res.status(200).json({ status: 'success', data: { rooms: roomsWithStatus } });
});

/**
 * GET /dashboard/displays/health
 * Per-display health: online/offline, last seen, paired room, active schedule.
 */
exports.getDisplaysHealth = asyncHandler(async (req, res) => {
  const onlineCutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);

  const displays = await Display.find({ isActive: true })
    .select('name location orientation screenSize status isOnline lastSeen ipAddress pairedRoomId config')
    .populate('pairedRoomId', 'name status')
    .sort({ name: 1 })
    .lean();

  const enriched = displays.map((d) => ({
    ...d,
    isOnline: d.lastSeen ? d.lastSeen >= onlineCutoff : false,
  }));

  res.status(200).json({ status: 'success', data: { displays: enriched } });
});

/**
 * GET /dashboard/schedule/today
 * Timeline of all scheduled/active schedule blocks for today.
 */
exports.getTodaySchedule = asyncHandler(async (req, res) => {
  const now = new Date();

  const schedules = await Schedule.find({
    isActive: true,
    status: { $in: ['active', 'pending'] },
    startDate: { $lte: endOfDay(now) },
    endDate: { $gte: startOfDay(now) },
    daysOfWeek: now.getDay(),
  })
    .populate('displayId', 'name location')
    .populate('playlistId', 'name')
    .sort({ startTime: 1, priority: -1 })
    .lean();

  res.status(200).json({ status: 'success', data: { schedules } });
});

/**
 * GET /dashboard/meetings/upcoming
 * All meetings in the next 24 hours across all rooms.
 */
exports.getUpcomingMeetings = asyncHandler(async (req, res) => {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const meetings = await Meeting.find({
    status: { $in: ['scheduled', 'ongoing'] },
    startTime: { $gte: now, $lte: in24h },
  })
    .populate('roomId', 'name displayName floor')
    .sort({ startTime: 1 })
    .lean({ virtuals: true });

  res.status(200).json({ status: 'success', data: { meetings } });
});

/**
 * GET /dashboard/offers/active
 * Currently valid and active offers, grouped by type.
 */
exports.getActiveOffers = asyncHandler(async (req, res) => {
  const now = new Date();

  const offers = await Offer.find({
    isActive: true,
    $or: [{ validFrom: null }, { validFrom: { $lte: now } }],
    $and: [{ $or: [{ validTo: null }, { validTo: { $gte: now } }] }],
  })
    .select('-imagePublicId -createdBy')
    .sort({ type: 1, priority: -1 })
    .lean({ virtuals: true });

  const grouped = offers.reduce((acc, offer) => {
    if (!acc[offer.type]) acc[offer.type] = [];
    acc[offer.type].push(offer);
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      total: offers.length,
      grouped,
      offers,
    },
  });
});
