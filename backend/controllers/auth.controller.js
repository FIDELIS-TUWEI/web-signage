const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { query } = require("../../database/db");
const { generateTokens, storeRefreshToken, setCookies } = require('../utils/generateTokens');
const config = require('../utils/config');
const client = require('../utils/redis');

// admin login
exports.adminRoute = asyncHandler ( async (req, res) => {
    const { email, password } = req.body;

    try {
        const [result] = await query('SELECT * FROM Users WHERE email = ?', [email]);
        const admin = result[0];

        if (!admin) {
            return res.status(401).json({ status: 'error', message: "Invalid email or password" });
        };

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: "Invalid email or password" })
        };

        const { accessToken, refreshToken } = generateTokens(admin.user_id);
        await storeRefreshToken(admin.user_id, refreshToken);

        setCookies(res, accessToken, refreshToken);

        res.status(200).json({
            status: "success",
            message: "Admin Login successful",
            data: {
                id: admin.user_id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });
        
    } catch (error) {
        console.error("Error Occured on adminRoute controller", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});

// get admin profile
exports.getAdminProfile = asyncHandler (async (req, res) => {
    try {
        res.status(200).json({
            status: "success",
            message: "Admin profile fetched successfully",
            data: req.user
        })
    } catch (error) {
        console.error("Error occured on getAdminProfile controller", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" })
    }
});

// logout
exports.logout = asyncHandler (async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            const decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);
            await client.del(`refresh_token: ${decoded.userId}`);
        };

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        res.status(200).json({ status: "success", message: "Logged out successfully" });
    } catch (error) {
        console.error("Error occured on logout controller", error);
        return res.status(500).json({ status: "error", message: "Internal server error" })
    }
});

// refreshtoken
exports.refreshToken = asyncHandler (async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ status: "error", message: "No refresh Token provided" })
        };

        const decoded = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);
        const storedToken = await client.get(`refresh_token: ${decoded.userId}`);

        if (storedToken !== refreshToken) {
            return res.status(401).json({ status: "error", message: "Invalid refresh Token" });
        };

        const accessToken = jwt.sign({ userId: decoded.userId }, config.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: config.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60 * 1000
        });

        res.status(200).json({ status: "success", message: "Token refreshed successfully" });

    } catch (error) {
        console.error("Error Occurred on adminLogout controller:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});