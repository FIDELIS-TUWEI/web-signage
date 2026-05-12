const Display = require('../models/display.model');
const Meeting = require('../models/meeting.model');
const Offer = require('../models/offer.model');
const { resolveActiveSchedule } = require('./schedule.service');
const { getWeather } = require('./weather.service');
const { getForex } = require('./forex.service');

const UPCOMING_MEETINGS_LIMIT = 3;
const OFFERS_LIMIT = 10;

/**
 * Builds the complete content payload delivered to a display screen.
 * Called on initial load and re-fetched on Socket.IO refresh events.
 */
exports.buildDisplayPayload = async (displayId) => {
  const display = await Display.findById(displayId)
    .populate('pairedRoomId', 'name displayName status capacity floor amenities')
    .lean();

  if (!display) return null;

  const now = new Date();
  const { config: displayConfig, pairedRoomId: room } = display;

  const [scheduleData, weather, forex, currentMeeting, upcomingMeetings, offers] =
    await Promise.all([
      displayConfig.slideshowEnabled
        ? resolveActiveSchedule(displayId, now)
        : Promise.resolve(null),

      displayConfig.showWeather
        ? getWeather(displayConfig.weatherCity || undefined)
        : Promise.resolve(null),

      displayConfig.showForex ? getForex() : Promise.resolve(null),

      room
        ? Meeting.findOne({
            roomId: room._id,
            status: 'ongoing',
          })
            .select('title organizerName startTime endTime attendeesCount isPrivate')
            .lean()
        : Promise.resolve(null),

      room
        ? Meeting.find({
            roomId: room._id,
            status: 'scheduled',
            startTime: { $gt: now },
          })
            .sort({ startTime: 1 })
            .limit(UPCOMING_MEETINGS_LIMIT)
            .select('title organizerName startTime endTime attendeesCount isPrivate')
            .lean()
        : Promise.resolve([]),

      displayConfig.showOffers
        ? Offer.find({
            isActive: true,
            $or: [{ validFrom: null }, { validFrom: { $lte: now } }],
            $and: [
              {
                $or: [{ validTo: null }, { validTo: { $gte: now } }],
              },
              {
                $or: [
                  { displayOnScreens: { $size: 0 } },
                  { displayOnScreens: displayId },
                ],
              },
            ],
          })
            .sort({ priority: -1 })
            .limit(OFFERS_LIMIT)
            .select('-imagePublicId -createdBy')
            .lean()
        : Promise.resolve([]),
    ]);

  return {
    display: {
      _id: display._id,
      name: display.name,
      location: display.location,
      orientation: display.orientation,
      config: displayConfig,
    },
    room: room || null,
    currentMeeting: currentMeeting || null,
    upcomingMeetings: upcomingMeetings || [],
    schedule: scheduleData
      ? {
          name: scheduleData.schedule.name,
          priority: scheduleData.schedule.priority,
          startTime: scheduleData.schedule.startTime,
          endTime: scheduleData.schedule.endTime,
        }
      : null,
    playlist: scheduleData?.playlist || null,
    weather,
    forex,
    offers,
    generatedAt: now.toISOString(),
  };
};
