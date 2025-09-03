// src/socialAuth.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const MicrosoftStrategy = require("passport-microsoft").Strategy;
const { pool } = require("./db"); // PostgreSQL pool
const bcrypt = require("bcryptjs");

// Save user in DB if not exists
async function findOrCreateUser(profile, defaultRole = "employee") {
  const email = profile.emails?.[0]?.value;
  const name = profile.displayName || profile.name?.givenName || "Unknown";

  if (!email) throw new Error("No email from provider");

  // Check if user already exists (PostgreSQL syntax)
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);
  
  if (result.rows.length > 0) return result.rows[0];

  // Insert new user (no password for social logins) - PostgreSQL syntax
  const insertQuery = `
    INSERT INTO users (name, email, role, password_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role
  `;
  const insertResult = await pool.query(insertQuery, [
    name, 
    email, 
    defaultRole, 
    ""
  ]);

  return insertResult.rows[0];
}

// Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "https://landing-render-1.onrender.com/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateUser(profile, "employee");
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));

// Microsoft OAuth
passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: process.env.MICROSOFT_CALLBACK_URL || "http://localhost:4000/api/auth/microsoft/callback",
    scope: ["user.read", "email", "openid", "profile"]
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateUser(profile, "employee");
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));

// Serialize / Deserialize user
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
