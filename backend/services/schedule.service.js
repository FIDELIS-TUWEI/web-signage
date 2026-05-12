const Schedule = require('../models/schedule.model');
const Playlist = require('../models/playlist.model');

/**
 * Returns the highest-priority matching schedule for a display at the given
 * moment, with its playlist populated (including content items).
 */
exports.resolveActiveSchedule = async (displayId, now = new Date()) => {
  const todayDay = now.getDay(); // 0-6
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const candidates = await Schedule.find({
    displayId,
    isActive: true,
    status: 'active',
    daysOfWeek: todayDay,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ priority: -1 })
    .lean();

  // Filter by time window (stored as HH:mm strings)
  const match = candidates.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  if (!match) return null;

  const playlist = await Playlist.findById(match.playlistId)
    .populate({
      path: 'items.contentId',
      model: 'Content',
      match: { isActive: true },
    })
    .lean();

  return { schedule: match, playlist };
};

/**
 * Activates schedules whose startDate is today or earlier and marks
 * schedules past their endDate as expired.  Called by the midnight cron.
 */
exports.rotateSchedules = async () => {
  const now = new Date();

  const [expired, activated] = await Promise.all([
    Schedule.updateMany(
      { endDate: { $lt: now }, status: { $ne: 'expired' } },
      { status: 'expired', isActive: false }
    ),
    Schedule.updateMany(
      { startDate: { $lte: now }, endDate: { $gte: now }, status: 'pending' },
      { status: 'active' }
    ),
  ]);

  return { expired: expired.modifiedCount, activated: activated.modifiedCount };
};
