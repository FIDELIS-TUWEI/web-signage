const express = require("express");
const { adminRoute, logout, getAdminProfile, refreshToken } = require("../controllers/auth.controller");
const { protectMe, protectAdmin } = require("../middleware/admin.middleware");
const router = express.Router();

router.post("/super-admin/login", adminRoute);
router.post("/logout", logout);
router.get("/super-admin/profile", protectMe, protectAdmin, getAdminProfile);
router.get("/refresh-token", refreshToken);

module.exports = router;