const config = require('./config');

const timestamp = () => new Date().toISOString();

const logger = {
  info: (...args) => console.log(`[${timestamp()}] ℹ️ `, ...args),
  success: (...args) => console.log(`[${timestamp()}] ✅`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] ⚠️ `, ...args),
  error: (...args) => console.error(`[${timestamp()}] ❌`, ...args),
  debug: (...args) => {
    if (config.NODE_ENV === 'development') {
      console.log(`[${timestamp()}] 🐛`, ...args);
    }
  },
};

module.exports = logger;
