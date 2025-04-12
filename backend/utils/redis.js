const redis = require("redis");
const logger = require("./logger");
const config = require("./config");

const client = redis.createClient({
    url: config.REDIS_URL
});

client.on('error', (error) => logger.error("Redis client error", error));
client.on('connect', () => logger.info("Connected to Redis client"));

client.connect();

module.exports = client;