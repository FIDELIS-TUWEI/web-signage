const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const { AppError } = require('../middleware/errorHandler');
const { generateTokenAsCookie, verifyRefreshToken } = require('../utils/generateTokens');
const tokenStore = require('../utils/tokenStore');
const config = require('../utils/config');
const logger = require('../utils/logger');

// When Redis is not configured the token store is in-memory and is wiped on
// every restart.  In that case we skip the whitelist check and rely solely on
// the JWT signature + expiry, so users aren't logged out on every deploy/reload.
const WHITELIST_ENABLED = !!(config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN);

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Email and password are required.', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Contact an administrator.', 403));
  }

  await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

  const { accessToken, refreshToken, expiresIn } = await generateTokenAsCookie(
    user._id,
    res,
    { role: user.role, email: user.email }
  );

  logger.info(`User logged in: ${user.email} (${user.role})`);

  res.status(200).json({
    status: 'success',
    message: 'Login successful.',
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar ?? null,
      },
      accessToken,
      refreshToken,
      expiresIn,
    },
  });
});

exports.refresh = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError('Refresh token is required.', 400));

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return next(new AppError('Invalid or expired refresh token.', 401));
  }

  if (decoded.type !== 'refresh') {
    return next(new AppError('Invalid token type.', 401));
  }

  if (WHITELIST_ENABLED) {
    const isWhitelisted = await tokenStore.exists(decoded.userId, decoded.jti);
    if (!isWhitelisted) {
      return next(new AppError('Refresh token has been revoked. Please log in again.', 401));
    }
  }

  const user = await User.findById(decoded.userId).lean();
  if (!user || !user.isActive) {
    return next(new AppError('User not found or inactive.', 401));
  }

  // Rotate: revoke old token, issue new pair
  await tokenStore.revoke(decoded.userId, decoded.jti);
  const { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn } = await generateTokenAsCookie(
    user._id,
    res,
    { role: user.role, email: user.email }
  );

  res.status(200).json({
    status: 'success',
    message: 'Token refreshed.',
    data: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn },
  });
});

exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.jwt;
  if (token) {
    res.clearCookie('jwt', { path: '/', httpOnly: true, sameSite: 'none', secure: true });
  }
  res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean({ virtuals: true });
  res.status(200).json({ status: 'success', data: { user } });
});

exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return next(new AppError('Both currentPassword and newPassword are required.', 400));
  }
  if (newPassword.length < 8) {
    return next(new AppError('New password must be at least 8 characters.', 400));
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.password = newPassword;
  await user.save();

  // Revoke all existing sessions
  await tokenStore.revokeAll(req.user._id.toString());
  res.clearCookie('jwt', { path: '/', httpOnly: true, sameSite: 'none', secure: true });

  res.status(200).json({
    status: 'success',
    message: 'Password changed. Please log in again.',
  });
});
