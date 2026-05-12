const cron = require('node-cron');
const Meeting = require('../models/meeting.model');
const Room = require('../models/room.model');
const { emitToAdmin, emitToDisplay } = require('../socket');
const Display = require('../models/display.model');
const logger = require('../utils/logger');

const transitionMeetings = async () => {
  const now = new Date();

  // scheduled → ongoing when startTime has passed
  const toStart = await Meeting.find({
    status: 'scheduled',
    startTime: { $lte: now },
    endTime: { $gt: now },
  }).lean();

  // ongoing → completed when endTime has passed
  const toEnd = await Meeting.find({
    status: 'ongoing',
    endTime: { $lte: now },
  }).lean();

  if (!toStart.length && !toEnd.length) return;

  const roomUpdates = [];

  if (toStart.length) {
    const ids = toStart.map((m) => m._id);
    await Meeting.updateMany({ _id: { $in: ids } }, { status: 'ongoing' });

    const roomIds = [...new Set(toStart.map((m) => m.roomId.toString()))];
    await Room.updateMany({ _id: { $in: roomIds } }, { status: 'occupied' });
    roomUpdates.push(...roomIds.map((id) => ({ roomId: id, status: 'occupied' })));
  }

  if (toEnd.length) {
    const ids = toEnd.map((m) => m._id);
    await Meeting.updateMany({ _id: { $in: ids } }, { status: 'completed' });

    const roomIds = [...new Set(toEnd.map((m) => m.roomId.toString()))];

    // Only mark vacant if no other ongoing meeting in the same room
    for (const roomId of roomIds) {
      const stillOccupied = await Meeting.exists({
        roomId,
        status: 'ongoing',
      });
      if (!stillOccupied) {
        await Room.findByIdAndUpdate(roomId, { status: 'vacant' });
        roomUpdates.push({ roomId, status: 'vacant' });
      }
    }
  }

  // Push room status change to all displays paired to affected rooms
  for (const { roomId, status } of roomUpdates) {
    const displays = await Display.find({ pairedRoomId: roomId, isActive: true })
      .select('_id')
      .lean();

    for (const display of displays) {
      emitToDisplay(display._id.toString(), 'room:status', { roomId, status });
    }
  }

  emitToAdmin('meeting:transitions', {
    started: toStart.length,
    ended: toEnd.length,
    checkedAt: now.toISOString(),
  });

  logger.info(
    `Meeting job: ${toStart.length} started, ${toEnd.length} ended`
  );
};

const startMeetingTransitionJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      await transitionMeetings();
    } catch (err) {
      logger.error('Meeting transition job failed:', err.message);
    }
  });

  logger.info('Cron: meeting transition job registered (every minute)');
};

module.exports = { startMeetingTransitionJob };
