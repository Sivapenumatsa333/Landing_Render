// src/server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
require("dotenv").config();

const { init } = require("./db");
const authRoutes = require("./authRoutes");
const employeeDashboardRoutes = require("./employeeDashboard");
require("./socialAuth"); // load Google & Microsoft strategies

const app = express();
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CORS_ORIGIN || "*";

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ORIGIN === "*" ? true : ORIGIN,
    credentials: true,
  })
);
app.use(passport.initialize());

// Init DB
init().catch((err) => console.error("DB init error", err));

// Health check
app.get("/", (req, res) =>
  res.json({ status: "ok", message: "Career backend (PostgreSQL) is running" })
);

// Routes
app.use("/api/auth", authRoutes);

app.use("/api", employeeDashboardRoutes);

// Example protected endpoint
const { requireAuth } = require("./middleware.auth");
app.get("/api/protected", requireAuth, (req, res) => {
  res.json({ message: "You are authenticated", user: req.user });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
