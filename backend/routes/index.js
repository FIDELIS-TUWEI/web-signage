const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({ status: "success", message: `Welcome to the Backend API Server` });
});

router.get("/favicon.ico", (req, res) => {
    res.status(404);
});

router.all("*", (req, res) => {
    res.status(404).json({ status: "error", message: `Could not find requested url: ${req.originalUrl} on the server` });
});

module.exports = router;