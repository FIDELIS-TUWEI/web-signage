const Schedule = require('../models/schedule.model');
const Playlist = require('../models/playlist.model');

/**
 * Returns the highest-priority matching schedule for a display at the given
 * moment, with its playlist populated (including content items).
 */
exports.resolveActiveSchedule = async (displayId, now = new Date()) => {
  const todayDay = now.getDay(); // 0-6
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Compare dates only — endDate is stored at T00:00:00Z so comparing with a
  // time-of-day "now" (e.g. T18:10Z) would always fail after midnight on the
  // end date. Use start/end of today so date boundaries are date-only.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const candidates = await Schedule.find({
    displayId,
    isActive: true,
    status: 'active',
    daysOfWeek: todayDay,
    startDate: { $lte: endOfToday },
    endDate:   { $gte: startOfToday },
  })
    .sort({ priority: -1 })
    .lean();

  // "00:00" as endTime means run until end-of-day (midnight). Treat it as
  // "23:59" so the string comparison works correctly at any hour of the day.
  const match = candidates.find((s) => {
    const effectiveEnd = s.endTime === '00:00' ? '23:59' : s.endTime;
    return currentTime >= s.startTime && currentTime <= effectiveEnd;
  });

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
