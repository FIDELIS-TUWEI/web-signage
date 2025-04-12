const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const app = express();

const indexRoutes = require("./routes/index");
const errorHandler = require("./middleware/errorHandler");

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors());
app.use(morgan("dev"));

app.use(helmet.xssFilter()); // xss protection
app.use(helmet.frameguard({ action: 'deny' })); // prevent clickjacking
app.use(helmet.noSniff()); // MIME Type sniffing protection
app.use(helmet.referrerPolicy({ policy: 'no-referrer' })); // privacy protection

app.disable("x-powered-by");

app.use("/api/v1", indexRoutes);

app.use(errorHandler);

module.exports = app;