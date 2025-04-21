const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const config = require("../utils/config");
const { query } = require("../../database/db");


exports.protectMe = asyncHandler (async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        if (!accessToken) {
            return res.status(401).json({ status: "error", message: "Unauthorized - No access token provided" });
        };

        try {
            const decoded = jwt.verify(accessToken, config.ACCESS_TOKEN_SECRET);
            const userQuery = (`SELECT user_id, username, email, role FROM Users WHERE user_id = ?`);
            const result = await query(userQuery, [decoded.userId]);

            if (result[0].length === 0) {
                res.status(401).json({ status: "error", message: "Unauthorized - User not found" });
            };

            req.user = result[0][0];

            next();
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ status: "error", message: "Unauthorized - Access Token expired" });
            }
            throw error;
        }
    } catch (error) {
        console.error("Error occurred in protectRoute Middleware:", error.message);
        res.status(500).json({ status: "error", message: "Unauthorized - Invalid access token" });
    }
})

exports.protectAdmin = (req, res, next) => {
    if (req.user?.role === "super_admin") {
        next();
    } else {
        return res.status(403).json({ status: "error", message: "Access Denied - You are not authorized to access this route" });
    }
};

exports.protectRoute = (roles) => {
    return (req, res, next) => {
        if (roles.includes(req.user?.role)) {
            next();
        } else {
            return res.status(403).json({ status: "error", message: "Access Denied - You are not authorized to access this route" })
        }
    }
};