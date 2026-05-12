const cache = require('../utils/cache');
const logger = require('../utils/logger');

const buildKey = (prefix, req) => {
  const userId = req.user?._id || 'public';
  return `${prefix}:${userId}:${req.originalUrl}`;
};

exports.cacheGet = (prefix, ttl = 60) => async (req, res, next) => {
  const key = buildKey(prefix, req);

  try {
    const cached = await cache.get(key);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
  } catch (err) {
    logger.warn('Cache read failed:', err.message);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await cache.set(key, body, ttl);
      } catch (err) {
        logger.warn('Cache write failed:', err.message);
      }
    }
    originalJson(body);
  };

  next();
};

exports.bustCache = (prefix) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await cache.invalidate(prefix);
      } catch (err) {
        logger.warn('Cache bust failed:', err.message);
      }
    }
    originalJson(body);
  };
  next();
};
