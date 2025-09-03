// src/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const passport = require("passport");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const { pool } = require("./db"); // PostgreSQL connection
const {
  registerEmployee,
  registerEmployer,
  registerRecruiter,
  login: loginValidator,
} = require("./validators");
const { requireAuth } = require("./middleware.auth");

const router = express.Router();
const COOKIE_NAME = process.env.COOKIE_NAME || "token";
const FRONTEND = process.env.FRONTEND_BASE_URL || "http://localhost:8081";

// ================== JWT HELPERS ==================
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function getDashboardUrl(role) {
  switch (role) {
    case "employer":
      return `${FRONTEND}/employer.html`;
    case "recruiter":
      return `${FRONTEND}/recruiter.html`;
    case "employee":
    default:
      return `${FRONTEND}/employee.html`;
  }
}

// ========================
// LOGIN (role based)
// ========================
async function loginWithRole(req, res, allowedRoles) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "Invalid email or password" });

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: `Only ${allowedRoles.join(", ")} can login here` });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: "Invalid email or password" });

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.json({
      message: `${user.role} logged in`,
      redirect: getDashboardUrl(user.role),
      user: { id: user.id, role: user.role, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

// Routes
router.post("/login/employee", loginValidator, (req, res) =>
  loginWithRole(req, res, ["employee", "recruiter"])
);

router.post("/login/employer", loginValidator, (req, res) =>
  loginWithRole(req, res, ["employer"])
);

// ========================
// LOGOUT
// ========================
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: "Logged out" });
});

// ========================
// ME (profile)
// ========================
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ========================
// REGISTRATION
// ========================
router.post("/register/employee", registerEmployee, async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { name, email, password, phone, work_status } = req.body;
  const hash = await bcrypt.hash(password, 10);

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(400).json({ error: "Email already exists" });

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, phone, work_status) VALUES ($1, $2, $3, 'employee', $4, $5) RETURNING id",
      [name, email, hash, phone || null, work_status || null]
    );

    const insertId = result.rows[0].id;
    const token = signToken({ id: insertId, role: "employee", name, email });
    setAuthCookie(res, token);
    return res.status(201).json({
      message: "Employee registered",
      user: { id: insertId, role: "employee", name, email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/register/employer", registerEmployer, async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { name, email, password, company_name, website, gst_number } = req.body;
  const hash = await bcrypt.hash(password, 10);

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(400).json({ error: "Email already exists" });

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, company_name, website, gst_number) VALUES ($1, $2, $3, 'employer', $4, $5, $6) RETURNING id",
      [name, email, hash, company_name || null, website || null, gst_number || null]
    );

    const insertId = result.rows[0].id;
    const token = signToken({ id: insertId, role: "employer", name, email });
    setAuthCookie(res, token);
    return res.status(201).json({
      message: "Employer registered",
      user: { id: insertId, role: "employer", name, email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/register/recruiter", registerRecruiter, async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  const { name, email, password, agency_name, specialization, years_experience } = req.body;
  const hash = await bcrypt.hash(password, 10);

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(400).json({ error: "Email already exists" });

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, agency_name, specialization, years_experience) VALUES ($1, $2, $3, 'recruiter', $4, $5, $6) RETURNING id",
      [name, email, hash, agency_name || null, specialization || null, years_experience || 0]
    );

    const insertId = result.rows[0].id;
    const token = signToken({ id: insertId, role: "recruiter", name, email });
    setAuthCookie(res, token);
    return res.status(201).json({
      message: "Recruiter registered",
      user: { id: insertId, role: "recruiter", name, email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ========================
// SOCIAL LOGIN (default employee)
// ========================
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const email = extractEmail(req.user);
      const name = req.user.displayName || email;
      const providerId = req.user.id;

      let result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
      let user;

      if (result.rows.length === 0) {
        const insert = await pool.query(
          `INSERT INTO users (name, email, role, provider, provider_id)
           VALUES ($1, $2, 'employee', 'google', $3)
           RETURNING *`,
          [name, email, providerId]
        );
        user = insert.rows[0];
      } else {
        user = result.rows[0];
      }

      const token = signToken(user);
      setAuthCookie(res, token);
      res.redirect(getDashboardUrl(user.role));
    } catch (err) {
      console.error("Google login error:", err);
      res.redirect(`${FRONTEND}/page2.html?error=${encodeURIComponent(err.message || "google_login_failed")}`);
    }
  }
);


router.get(
  "/microsoft",
  passport.authenticate("azuread-openidconnect", { failureRedirect: "/" })
);

router.post(
  "/microsoft/callback",
  passport.authenticate("azuread-openidconnect", { session: false, failureRedirect: "/" }),
  async (req, res) => {
    try {
      const email = req.user._json.preferred_username;
      const name = req.user.displayName || email;

      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      let user;
      if (result.rows.length === 0) {
        const insert = await pool.query(
          "INSERT INTO users (name, email, role, provider_id) VALUES ($1, $2, 'employee', $3) RETURNING *",
          [name, email, req.user.oid]
        );
        user = insert.rows[0];
      } else {
        user = result.rows[0];
      }

      const token = signToken(user);
      setAuthCookie(res, token);
      res.redirect(getDashboardUrl(user.role));
    } catch (err) {
      console.error(err);
      res.redirect(`${FRONTEND}/page2.html?error=microsoft_login_failed`);
    }
  }
);

// ================== EMAIL TRANSPORT ==================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ================== FORGOT PASSWORD ==================
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.status(400).json({ error: "No user found with this email" });

    const user = result.rows[0];
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "15m" });

    const resetLink = `${FRONTEND}/reset-password.html?token=${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset your password",
      html: `<p>Hello ${user.name},</p>
             <p>You requested to reset your password. Click the link below to reset:</p>
             <a href="${resetLink}">${resetLink}</a>
             <p>If you did not request, ignore this email.</p>`,
    });

    res.json({ message: "Reset link sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error while sending reset email" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hash = await bcrypt.hash(password, 10);

    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      hash,
      decoded.id
    ]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset error:", err);
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
