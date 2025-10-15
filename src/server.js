// src/server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const session = require("express-session");
require("dotenv").config();

const { init } = require("./db");
const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");
const searchRoutes = require('./searchRoutes');
const networkingRoutes = require('./networkingRoutes');
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
// Profile routes
app.use("/api", profileRoutes);
app.use('/api', searchRoutes);

app.use('/api', networkingRoutes);
// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Add this route to your server.js on Render
app.get('/api/employee/profile/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    console.log('🔍 Fetching profile for user ID:', userId);
    
    // Get basic profile info
    const profileResult = await pool.query(
      `SELECT p.*, u.name, u.email, u.role
       FROM profiles p 
       RIGHT JOIN users u ON p.user_id = u.id 
       WHERE u.id = $1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      console.log('❌ Profile not found for user ID:', userId);
      return res.status(404).json({ error: "Profile not found" });
    }

    let profile = profileResult.rows[0];
    console.log('✅ Found profile:', profile.name);
    
    // Get experiences
    const experienceResult = await pool.query(
      `SELECT * FROM experiences WHERE user_id = $1 ORDER BY start_date DESC`,
      [userId]
    );
    
    // Get education
    const educationResult = await pool.query(
      `SELECT * FROM educations WHERE user_id = $1 ORDER BY start_date DESC`,
      [userId]
    );
    
    // Get skills
    const skillResult = await pool.query(
      `SELECT * FROM skills WHERE user_id = $1 ORDER BY endorsements DESC`,
      [userId]
    );
    
    // Get certifications
    const certificationResult = await pool.query(
      `SELECT * FROM certifications WHERE user_id = $1 ORDER BY issue_date DESC`,
      [userId]
    );

    const responseData = {
      profile: {
        id: profile.id,
        user_id: profile.user_id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        headline: profile.headline,
        location: profile.location,
        about: profile.about,
        avatar_url: profile.avatar_url,
        cover_url: profile.cover_url,
        website: profile.website,
        birthday: profile.birthday,
        gender: profile.gender,
        languages: profile.languages,
        interests: profile.interests
      },
      experiences: experienceResult.rows,
      education: educationResult.rows,
      skills: skillResult.rows,
      certifications: certificationResult.rows
    };

    console.log('✅ Successfully fetched profile data for:', profile.name);
    res.json(responseData);
    
  } catch (err) {
    console.error("❌ Error fetching profile by ID:", err);
    res.status(500).json({ error: "Server error while fetching profile" });
  }
});

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
