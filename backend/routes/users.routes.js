const express = require("express");
const { protectAdmin, protectMe, protectRoute } = require("../middleware/admin.middleware");
const { createViewer, loginViewer, getViewerProfile, updateViewerProfile, changeViewerPassword } = require("../controllers/users.controller");
const router = express.Router();

router.post("/viewer/setup", protectMe, protectAdmin, createViewer);
router.post("/auth/login/viewer", loginViewer);
router.get("/viewer/profile", protectMe, protectRoute(["viewer"]), getViewerProfile);
router.put("/update-profile/viewer", protectMe, protectRoute(["viewer"]), updateViewerProfile);
router.put("/update-viewer/password", protectMe, protectRoute(["viewer"]), changeViewerPassword);

module.exports = router;