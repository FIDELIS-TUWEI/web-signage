const cron = require('node-cron');
const { refreshWeather } = require('../services/weather.service');
const { refreshForex } = require('../services/forex.service');
const { emitToAll } = require('../socket');
const config = require('../utils/config');
const logger = require('../utils/logger');

const startWeatherForexJob = () => {
  // Refresh weather every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Weather refresh job: starting');
    try {
      const weather = await refreshWeather(config.OPENWEATHER_DEFAULT_CITY);
      if (weather) {
        emitToAll('weather:update', weather);
        logger.success('Weather refreshed successfully');
      }
    } catch (err) {
      logger.error('Weather refresh job failed:', err.message);
    }
  });

  // Refresh forex rates every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Forex refresh job: starting');
    try {
      const forex = await refreshForex();
      if (forex) {
        emitToAll('forex:update', forex);
        logger.success('Forex rates refreshed successfully');
      }
    } catch (err) {
      logger.error('Forex refresh job failed:', err.message);
    }
  });

  logger.info('Cron: weather job registered (every 30 min)');
  logger.info('Cron: forex job registered (every hour)');
};

module.exports = { startWeatherForexJob };
