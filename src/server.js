// src/server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const session = require("express-session");
require("dotenv").config();

const { init } = require("./db");
const authRoutes = require("./authRoutes");
const employeeDashboardRoutes = require("./employeeDashboard");
require("./socialAuth");

const app = express();
const PORT = process.env.PORT || 4000;

// Get your frontend URL from environment
const FRONTEND_URL = process.env.FRONTEND_BASE_URL || "https://landing-front-end.onrender.com";

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS Configuration - FIXED for cross-domain
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With']
  })
);

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Must be true for Render
    sameSite: 'none', // Must be none for cross-domain
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Init DB
init().catch((err) => console.error("DB init error", err));

// Health check
app.get("/", (req, res) =>
  res.json({ 
    status: "ok", 
    message: "Career backend (PostgreSQL) is running",
    cors: `Configured for: ${FRONTEND_URL}`
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", employeeDashboardRoutes);

// Test endpoint to verify CORS and cookies
app.get("/api/debug", (req, res) => {
  res.json({
    message: "Debug endpoint",
    cookies: req.headers.cookie || "No cookies",
    origin: req.headers.origin,
    cors: "Working"
  });
});

// Example protected endpoint
const { requireAuth } = require("./middleware.auth");
app.get("/api/protected", requireAuth, (req, res) => {
  res.json({ 
    message: "You are authenticated", 
    user: req.user,
    cookies: req.headers.cookie 
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`🔧 CORS configured for: ${FRONTEND_URL}`);
});
