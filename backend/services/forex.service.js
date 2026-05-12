const axios = require('axios');
const config = require('../utils/config');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const CACHE_KEY = 'forex:rates';
const CACHE_TTL = 60 * 60; // 1 hour
const BASE_URL = 'https://open.er-api.com/v6/latest';

const fetchRates = async (base = config.FOREX_BASE_CURRENCY) => {
  const params = {};
  if (config.EXCHANGERATE_API_KEY) params.apikey = config.EXCHANGERATE_API_KEY;

  const { data } = await axios.get(`${BASE_URL}/${base}`, {
    params,
    timeout: 8000,
  });

  if (data.result !== 'success') throw new Error('ExchangeRate API error');

  const targets = config.FOREX_TARGET_CURRENCIES;
  const filtered = targets.reduce((acc, cur) => {
    if (data.rates[cur] !== undefined) acc[cur] = data.rates[cur];
    return acc;
  }, {});

  return {
    base,
    rates: filtered,
    fetchedAt: new Date().toISOString(),
  };
};

exports.getForex = async () => {
  const cached = await cache.get(CACHE_KEY);
  if (cached) return cached;

  try {
    const forex = await fetchRates();
    await cache.set(CACHE_KEY, forex, CACHE_TTL);
    return forex;
  } catch (err) {
    logger.error('Forex fetch failed:', err.message);
    return null;
  }
};

exports.refreshForex = async () => {
  try {
    const forex = await fetchRates();
    await cache.set(CACHE_KEY, forex, CACHE_TTL);
    return forex;
  } catch (err) {
    logger.error('Forex refresh failed:', err.message);
    return null;
  }
};
