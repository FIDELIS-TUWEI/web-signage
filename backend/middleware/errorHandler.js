const logger = require("../utils/logger");
const config = require("../utils/config");

const errorHandler = (err, req, res, next) => {
    logger.error(err);

    const statusCode = err.statusCode || 500;
    const status = err.status || 'error';
    const message = err.message || "An unexpected error occured";

    res.status(statusCode).json({
        status,
        message,
        ...(config.NODE_ENV === "development" && { stack: err.stack })
    });
};

module.exports = errorHandler;