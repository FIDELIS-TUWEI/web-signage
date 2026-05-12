const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const config = require('../utils/config');
const { AppError } = require('./errorHandler');
const User = require('../models/user.model');
const Display = require('../models/display.model');

exports.protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) return next(new AppError('Not authenticated. Please log in.', 401));

  const decoded = jwt.verify(token, config.JWT_SECRET);

  const user = await User.findById(decoded.userId)
    .select('-password -passwordChangedAt')
    .lean();

  if (!user) return next(new AppError('User no longer exists.', 401));
  if (!user.isActive) return next(new AppError('Account is deactivated.', 403));

  req.user = user;
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }
    next();
  };

// Used by display screens — they authenticate via their unique deviceKey
exports.protectDisplay = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Display device key is missing.', 401));
  }

  const deviceKey = authHeader.split(' ')[1];
  const display = await Display.findOne({ deviceKey, isActive: true }).lean();

  if (!display) return next(new AppError('Invalid or inactive device key.', 401));

  req.display = display;
  next();
});
