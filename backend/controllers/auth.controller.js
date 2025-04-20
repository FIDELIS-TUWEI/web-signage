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
})