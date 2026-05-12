require('dotenv').config();

const _required = ['MONGODB_URI', 'JWT_SECRET'];

const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_NAME: process.env.APP_NAME || 'HDWSS',

  MONGODB_URI: process.env.MONGODB_URI,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}_refresh`,
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  get ALLOWED_ORIGINS() {
    return this.FRONTEND_URL.split(',').map((o) => o.trim().replace(/\/$/, ''));
  },

  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  CACHE_TTL: parseInt(process.env.CACHE_TTL, 10) || 60,

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
  OPENWEATHER_DEFAULT_CITY: process.env.OPENWEATHER_DEFAULT_CITY || 'Nairobi',
  OPENWEATHER_DEFAULT_COUNTRY: process.env.OPENWEATHER_DEFAULT_COUNTRY || 'KE',

  EXCHANGERATE_API_KEY: process.env.EXCHANGERATE_API_KEY,
  FOREX_BASE_CURRENCY: process.env.FOREX_BASE_CURRENCY || 'USD',
  FOREX_TARGET_CURRENCIES: (process.env.FOREX_TARGET_CURRENCIES || 'KES,EUR,GBP,AED')
    .split(',')
    .map((c) => c.trim()),
};

_required.forEach((key) => {
  if (!config[key]) {
    console.error(`[Config] ❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

module.exports = config;
