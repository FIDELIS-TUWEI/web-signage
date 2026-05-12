const axios = require('axios');
const config = require('../utils/config');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const CACHE_KEY = 'weather:current';
const CACHE_TTL = 30 * 60; // 30 minutes
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

const normalise = (raw) => ({
  city: raw.name,
  country: raw.sys.country,
  temperature: Math.round(raw.main.temp),
  feelsLike: Math.round(raw.main.feels_like),
  humidity: raw.main.humidity,
  description: raw.weather[0].description,
  icon: raw.weather[0].icon,
  iconUrl: `https://openweathermap.org/img/wn/${raw.weather[0].icon}@2x.png`,
  windSpeed: raw.wind.speed,
  visibility: raw.visibility,
  fetchedAt: new Date().toISOString(),
});

const fetchWeather = async (city = config.OPENWEATHER_DEFAULT_CITY) => {
  if (!config.OPENWEATHER_API_KEY) {
    logger.warn('Weather: OPENWEATHER_API_KEY not set — skipping fetch');
    return null;
  }

  const { data } = await axios.get(BASE_URL, {
    params: {
      q: city,
      appid: config.OPENWEATHER_API_KEY,
      units: 'metric',
    },
    timeout: 8000,
  });

  return normalise(data);
};

exports.getWeather = async (city) => {
  const cacheKey = city ? `weather:${city.toLowerCase()}` : CACHE_KEY;

  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  try {
    const weather = await fetchWeather(city);
    if (weather) await cache.set(cacheKey, weather, CACHE_TTL);
    return weather;
  } catch (err) {
    logger.error('Weather fetch failed:', err.message);
    return null;
  }
};

exports.refreshWeather = async (city) => {
  const cacheKey = city
    ? `weather:${city.toLowerCase()}`
    : CACHE_KEY;
  try {
    const weather = await fetchWeather(city);
    if (weather) await cache.set(cacheKey, weather, CACHE_TTL);
    return weather;
  } catch (err) {
    logger.error('Weather refresh failed:', err.message);
    return null;
  }
};
