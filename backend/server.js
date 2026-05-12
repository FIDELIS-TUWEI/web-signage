const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const config = require('./utils/config');
const logger = require('./utils/logger');
const { initSocket } = require('./socket');
const { startScheduleRotationJob } = require('./jobs/schedule.job');
const { startMeetingTransitionJob } = require('./jobs/meeting.job');
const { startWeatherForexJob } = require('./jobs/weather.job');

// Catch sync errors before the server even starts
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — shutting down:', err.message, err.stack);
  process.exit(1);
});

const server = http.createServer(app);

const startServer = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.success(`MongoDB connected: ${mongoose.connection.host}`);

    // Real-time layer
    initSocket(server);

    // Scheduled jobs
    startScheduleRotationJob();
    startMeetingTransitionJob();
    startWeatherForexJob();

    server.listen(config.PORT, () => {
      logger.success(
        `🚀 ${config.APP_NAME} running in ${config.NODE_ENV} mode on port ${config.PORT}`
      );
    });
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();

// Handle async errors that escape try/catch
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION — shutting down:', err.message);
  server.close(() => process.exit(1));
});

// Graceful shutdown on SIGTERM (Docker stop, K8s pod termination)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — closing server gracefully');
  server.close(async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed. Process exiting.');
    process.exit(0);
  });
});
