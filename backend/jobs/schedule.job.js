const cron = require('node-cron');
const { rotateSchedules } = require('../services/schedule.service');
const { emitToAll } = require('../socket');
const logger = require('../utils/logger');

/**
 * Runs at midnight every day.
 * Expires stale schedules and activates pending ones that start today.
 * Broadcasts a global refresh so all display screens re-fetch their payload.
 */
const startScheduleRotationJob = () => {
  cron.schedule('0 0 * * *', async () => {
    logger.info('Schedule rotation job: starting');
    try {
      const result = await rotateSchedules();
      logger.success(
        `Schedule rotation: ${result.activated} activated, ${result.expired} expired`
      );
      emitToAll('schedule:rotate', { ...result, rotatedAt: new Date().toISOString() });
    } catch (err) {
      logger.error('Schedule rotation job failed:', err.message);
    }
  });

  logger.info('Cron: schedule rotation job registered (daily at midnight)');
};

module.exports = { startScheduleRotationJob };
