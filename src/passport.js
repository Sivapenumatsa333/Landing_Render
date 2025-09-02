// src/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const OIDCStrategy = require("passport-azure-ad").OIDCStrategy;
const { pool } = require("./db");

require("dotenv").config();

async function findOrCreateUser(profile, provider) {
  const email = profile.emails?.[0]?.value;
  const name = profile.displayName || email || "User";

  if (!email) throw new Error("No email from provider");

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (result.rows.length > 0) {
    return result.rows[0];
  }

  const inserted = await pool.query(
    "INSERT INTO users (name, email, password_hash, role, provider_id) VALUES ($1, $2, '', 'employee', $3) RETURNING *",
    [name, email, profile.id]
  );
  return inserted.rows[0];
}

// GOOGLE
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.BACKEND_BASE_URL + "/api/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateUser(profile, "google");
      return done(null, profile); // pass profile to authRoutes
    } catch (err) {
      return done(err, null);
    }
  }
));

// MICROSOFT
passport.use(new OIDCStrategy(
  {
    identityMetadata: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.MICROSOFT_CLIENT_ID,
    responseType: "code",
    responseMode: "form_post",
    redirectUrl: process.env.BACKEND_BASE_URL + "/api/auth/microsoft/callback",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    allowHttpForRedirectUrl: process.env.NODE_ENV !== "production",
    scope: ["profile", "email", "openid"],
  },
  async (iss, sub, profile, accessToken, refreshToken, done) => {
    try {
      const user = await findOrCreateUser(profile, "microsoft");
      return done(null, profile);
    } catch (err) {
      return done(err, null);
    }
  }
));

module.exports = passport;
