// src/socialAuth.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const OIDCStrategy = require("passport-azure-ad").OIDCStrategy;
const { pool } = require("./db"); // PostgreSQL pool
const bcrypt = require("bcryptjs");

// Helper: find or create user
async function findOrCreateUser(profile, provider) {
  try {
    // Check if user already exists
    const existing = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [profile.emails[0].value]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new user (default: employee)
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, provider)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        profile.displayName || profile.emails[0].value,
        profile.emails[0].value,
        await bcrypt.hash(Math.random().toString(36).slice(-8), 10), // random password
        "employee", // ✅ Default role for social logins
        provider
      ]
    );

    return result.rows[0];
  } catch (err) {
    console.error("findOrCreateUser error:", err);
    throw err;
  }
}

// ------------------- GOOGLE STRATEGY -------------------
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "https://landing-render-1.onrender.com/api/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser(profile, "google");
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ------------------- MICROSOFT STRATEGY -------------------
passport.use(
  new OIDCStrategy(
    {
      identityMetadata: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}/v2.0/.well-known/openid-configuration`,
      clientID: process.env.MICROSOFT_CLIENT_ID,
      responseType: "code",
      responseMode: "query",
      redirectUrl: process.env.MICROSOFT_CALLBACK_URL || "https://landing-render-1.onrender.com/api/auth/microsoft/callback",
      allowHttpForRedirectUrl: true, // ⚠️ allow http for local dev, use https in prod
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      validateIssuer: false,
      passReqToCallback: false,
      scope: ["profile", "email", "openid"]
    },
    async (iss, sub, profile, accessToken, refreshToken, done) => {
      try {
        if (!profile || !profile._json) {
          return done(new Error("Invalid Microsoft profile"), null);
        }

        const user = await findOrCreateUser(profile, "microsoft");
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ------------------- SERIALIZE -------------------
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
