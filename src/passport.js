// src/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { OIDCStrategy } = require("passport-azure-ad");
const { pool } = require("./db");

require("dotenv").config();

async function findOrCreateUser(profile) {
  const email = profile.emails && profile.emails[0].value;
  const name = profile.displayName || "No Name";

  // PostgreSQL query
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);

  if (result.rows.length) return result.rows[0];

  // Insert new user with PostgreSQL
  const insertQuery = `
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role
  `;
  const insertResult = await pool.query(insertQuery, [
    name, 
    email, 
    "", 
    "employee"
  ]);

  return insertResult.rows[0];
}

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "https://landing-render-1.onrender.com/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser(profile);
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// Microsoft Strategy
passport.use(
  new OIDCStrategy(
    {
      identityMetadata: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0/.well-known/openid-configuration`,
      clientID: process.env.MICROSOFT_CLIENT_ID,
      responseType: "code",
      responseMode: "query",
      redirectUrl: process.env.MICROSOFT_CALLBACK_URL || "http://localhost:4000/api/auth/microsoft/callback",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      scope: ["profile", "email", "openid"],
    },
    async (iss, sub, profile, accessToken, refreshToken, done) => {
      try {
        const user = await findOrCreateUser(profile);
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

module.exports = passport;
