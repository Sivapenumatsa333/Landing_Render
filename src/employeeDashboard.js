// src/employeeDashboard.js
const express = require("express");
const { requireAuth } = require("./middleware.auth");
const { pool } = require("./db");

const router = express.Router();

// Get employee profile data for dashboard (simplified)
router.get("/employee/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Simple query to get just the user's name from users table
    const userResult = await pool.query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userResult.rows[0];

    // Simple response with just name and basic info
    const profileData = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      connections: 0, // Default values
      profile_views: 0,
      member_since: new Date().getFullYear()
    };

    console.log("Profile data fetched successfully:", profileData);
    res.json(profileData);
  } catch (err) {
    console.error("Error fetching employee profile:", err);
    res.status(500).json({ error: "Server error while fetching profile data" });
  }
});

module.exports = router;
