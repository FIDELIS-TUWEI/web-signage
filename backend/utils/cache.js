const config = require('./config');
const logger = require('./logger');

class UpstashCache {
  constructor() {
    const { Redis } = require('@upstash/redis');
    this.client = new Redis({
      url: config.UPSTASH_REDIS_REST_URL,
      token: config.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ?? null;
    } catch {
      return null;
    }
  }

  async set(key, value, ttl = config.CACHE_TTL) {
    try {
      await this.client.set(key, value, { ex: ttl });
    } catch {}
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch {}
  }

  async invalidate(prefix) {
    try {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, {
          match: `${prefix}*`,
          count: 100,
        });
        cursor = Number(nextCursor);
        if (keys.length) await this.client.del(...keys);
      } while (cursor !== 0);
    } catch {}
  }
}

class MemoryCache {
  constructor() {
    this._store = new Map();
  }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttl = config.CACHE_TTL) {
    this._store.set(key, {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
    });
  }

  async del(key) {
    this._store.delete(key);
  }

  async invalidate(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key);
    }
  }
}

function createCache() {
  if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
    logger.info('Cache: using Upstash Redis');
    return new UpstashCache();
  }
  logger.warn('Cache: Upstash not configured — falling back to in-memory cache');
  return new MemoryCache();
}

module.exports = createCache();
