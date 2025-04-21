const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const { query } = require("../../database/db");
const { generateTokens, storeRefreshToken, setCookies } = require("../utils/generateTokens");

// create a new viewer account
exports.createViewer = asyncHandler (async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: "error", message: "All fields are required" });
    }

    try {
        // check if user already exists
        const [existingUsers] = await query(
            `SELECT * FROM Users WHERE email = ? OR username = ?`,
            [email, username]
        );

        if (existingUsers.length > 0) {
            if (existingUsers[0].email === email) {
                return res.status(400).json({ status: "error", message: "Email already in use" });
            } else {
                return res.status(400).json({ status: "error", message: "Username already taken" });
            }
        };

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert viewer
        await query(
            `INSERT INTO Users (username, email, password_hash, role, is_active) VALUES(?, ?, ?, ?, ?)`,
            [username, email, passwordHash, 'viewer', true]
        );

        res.status(201).json({ status: "success", message: "Viewer account created successfully" });

    } catch (error) {
        console.error("Error creating viewer account:", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});

// login viewer
exports.loginViewer = asyncHandler (async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: "error", message: "Username and password are required" });
    }

    try {
        // find user by username
        const [users] = await query(
            `SELECT * FROM Users WHERE username = ? AND role = 'viewer'`,
            [email]
        );

        const user = users[0];

        if (!user) {
            return res.status(401).json({ status: "error", message: "Invalid email or password" });
        };

        // check if account is active
        if (!user.is_active) {
            return res.status(403).json({ status: "error", message: "Account is not active. Please contact administrator." });
        };


        // verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ status: "error", message: "Invalid email or password" });
        };


        // Generate and store tokens
        const { accessToken, refreshToken } = generateTokens(user.user_id);
        await storeRefreshToken(user.user_id, refreshToken);

        setCookies(res, accessToken, refreshToken);

        res.status(200).json({
            status: "success",
            message: "Login Successful",
            data: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Error during viewer login:", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});

// get viewer profile details
exports.getViewerProfile = asyncHandler (async (req, res) => {
    try {
        res.status(200).json({
            status: "success",
            message: "Viewer profile fetched successfully",
            data: req.user
        });

    } catch (error) {
        console.error("Error fetching viewer profile:", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});

//Update viewer profile
exports.updateViewerProfile = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { username, email } = req.body;

    if (!username && !email) {
        return res.status(400).json({ status: "error", message: "At least one field is required" });
    }

    try {
        const [existingUser] = await query(
            `SELECT * FROM Users WHERE user_id = ? AND is_active = TRUE`,
            [userId]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ status: "error", message: "Viewer not found" });
        }

        let updates = [];
        let values = [];

        if (username) {
            updates.push('username = ?');
            values.push(username);
        }

        if (email) {
            updates.push('email = ?');
            values.push(email);
        }

        // Check if email is already in use by another user
        if (email) {
            const [emailCheck] = await query(
                `SELECT user_id FROM Users WHERE email = ? AND user_id != ?`,
                [email, userId]
            );
            
            if (emailCheck.length > 0) {
                return res.status(400).json({ status: "error", message: "Email is already in use by another user." });
            }
        }

        // Check if username is already in use
        if (username) {
            const [usernameCheck] = await query(
                `SELECT user_id FROM Users WHERE username = ? AND user_id != ?`,
                [username, userId]
            );
            
            if (usernameCheck.length > 0) {
                return res.status(400).json({ status: "error", message: "Username is already taken." });
            }
        }

        values.push(userId);
        
        const [result] = await query(
            `UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ status: "error", message: "Failed to update viewer details" });
        }

        const updatedData = {
            user_id: userId,
            username: username || existingUser[0].username,
            email: email || existingUser[0].email,
            role: existingUser[0].role
        };

        res.status(200).json({
            status: "success",
            message: "Viewer profile updated successfully",
            data: updatedData
        });

    } catch (error) {
        console.error("Error updating viewer profile:", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});

//Change viewer password
exports.changeViewerPassword = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ status: "error", message: "New password is required" });
    }

    try {
        const [existingUser] = await query(
            `SELECT * FROM Users WHERE user_id = ? AND is_active = TRUE`,
            [userId]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ status: "error", message: "Viewer not found" });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const [result] = await query(
            `UPDATE Users SET password_hash = ? WHERE user_id = ?`,
            [passwordHash, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ status: "error", message: "Failed to update password" });
        }

        res.status(200).json({
            status: "success",
            message: "Password updated successfully"
        });

    } catch (error) {
        console.error("Error changing viewer password:", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});