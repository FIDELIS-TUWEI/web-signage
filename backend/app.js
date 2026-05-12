const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const config = require('./utils/config');
const { globalErrorHandler } = require('./middleware/errorHandler');

const app = express();

// CORS — validate against whitelist from env
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin "${origin}" not allowed`));
      }
    },
    credentials: true,
  })
);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://openweathermap.org'],
        connectSrc: ["'self'", 'wss:'],
      },
    },
  })
);

// HTTP request logging
app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// HTTP Parameter Pollution protection
app.use(hpp({ whitelist: ['sort', 'fields', 'page', 'limit', 'type', 'status'] }));

// Disable fingerprinting
app.disable('x-powered-by');

// Health check — used by Docker and load balancers
app.get('/health', (_req, res) =>
  res.status(200).json({
    status: 'ok',
    app: config.APP_NAME,
    env: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
);

// API routes
app.use('/api/v1', require('./routes'));

// 404 — unmatched routes
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler (must be last)
app.use(globalErrorHandler);

module.exports = app;
