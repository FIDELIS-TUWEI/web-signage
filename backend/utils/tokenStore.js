const cache = require('./cache');

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const key = (userId, jti) => `rt:${userId}:${jti}`;

const tokenStore = {
  async store(userId, jti) {
    await cache.set(key(userId, jti), '1', TTL_SECONDS);
  },

  async exists(userId, jti) {
    const val = await cache.get(key(userId, jti));
    return val === '1';
  },

  async revoke(userId, jti) {
    await cache.del(key(userId, jti));
  },

  async revokeAll(userId) {
    await cache.invalidate(`rt:${userId}:`);
  },
};

module.exports = tokenStore;
