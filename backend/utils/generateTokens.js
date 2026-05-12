const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const tokenStore = require('./tokenStore');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
  path: '/',
};

const buildAccessToken = (userId, payload = {}) =>
  jwt.sign({ userId, ...payload }, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES,
  });

const buildRefreshToken = (userId) => {
  const jti = uuidv4();
  const token = jwt.sign(
    { userId, type: 'refresh', jti },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES }
  );
  return { token, jti };
};

exports.generateTokenAsCookie = async (userId, res, payload = {}) => {
  const accessToken = buildAccessToken(userId, payload);
  const { token: refreshToken, jti } = buildRefreshToken(userId);

  await tokenStore.store(userId.toString(), jti);

  res.cookie('jwt', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000,
  });

  return { accessToken, refreshToken, expiresIn: 900 };
};

exports.verifyRefreshToken = (token) =>
  jwt.verify(token, config.JWT_REFRESH_SECRET);
