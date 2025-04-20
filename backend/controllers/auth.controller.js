const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { query } = require("../../database/db");
const { generateTokens, storeRefreshToken, setCookies } = require('../utils/generateTokens');
const config = require('../utils/config');
const client = require('../utils/redis');

// admin login route
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