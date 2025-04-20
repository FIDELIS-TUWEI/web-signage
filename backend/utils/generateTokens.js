const jwt = require('jsonwebtoken');
const config = require('./config');
const client = require('./redis');

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ userId }, config.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m"
    });

    const refreshToken = jwt.sign({ userId }, config.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d"
    });

    return { accessToken, refreshToken }
};

const storeRefreshToken = async (userId, refreshToken) => {
    await client.set(`refresh_token: ${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60)
};

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};

module.exports = { generateTokens, storeRefreshToken, setCookies };