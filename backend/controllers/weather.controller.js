const asyncHandler = require('express-async-handler');
const { getWeather, refreshWeather } = require('../services/weather.service');
const { getForex, refreshForex } = require('../services/forex.service');
const { AppError } = require('../middleware/errorHandler');

exports.getWeather = asyncHandler(async (req, res) => {
  const { city } = req.query;
  const weather = await getWeather(city);
  res.status(200).json({ status: 'success', data: { weather } });
});

exports.refreshWeather = asyncHandler(async (req, res) => {
  const { city } = req.body;
  const weather = await refreshWeather(city);
  res.status(200).json({ status: 'success', message: 'Weather cache refreshed.', data: { weather } });
});

exports.getForex = asyncHandler(async (req, res) => {
  const forex = await getForex();
  res.status(200).json({ status: 'success', data: { forex } });
});

exports.refreshForex = asyncHandler(async (req, res) => {
  const forex = await refreshForex();
  res.status(200).json({ status: 'success', message: 'Forex cache refreshed.', data: { forex } });
});
