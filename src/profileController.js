const { pool } = require("./db");
const { requireAuth } = require("./middleware.auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

function normalizeDate(input) {
  if (!input) return null;
  // If only year-month is provided, add day "01"
  if (/^\d{4}-\d{2}$/.test(input)) {
    return input + "-01";
  }
  return input;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get user profile
async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    
    // Get basic profile info
    const profileResult = await pool.query(
      `SELECT p.*, u.name, u.email 
       FROM profiles p 
       RIGHT JOIN users u ON p.user_id = u.id 
       WHERE u.id = $1`,
      [userId]
    );

    let profile = profileResult.rows[0] || { user_id: userId };
    
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

    res.json({
      profile: {
        id: profile.id,
        user_id: profile.user_id,
        name: profile.name,
        email: profile.email,
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
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Server error while fetching profile" });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { headline, location, about, website, phone, linkedin_url } = req.body;

    // Build update query dynamically
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (headline !== undefined) {
      fields.push(`headline = $${paramCount}`);
      values.push(headline);
      paramCount++;
    }
    if (location !== undefined) {
      fields.push(`location = $${paramCount}`);
      values.push(location);
      paramCount++;
    }
    if (about !== undefined) {
      fields.push(`about = $${paramCount}`);
      values.push(about);
      paramCount++;
    }
    if (website !== undefined) {
      fields.push(`website = $${paramCount}`);
      values.push(website);
      paramCount++;
    }
    if (phone !== undefined) {
      fields.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }
    if (linkedin_url !== undefined) {
      fields.push(`linkedin_url = $${paramCount}`);
      values.push(linkedin_url);
      paramCount++;
    }

    if (fields.length === 0) {
      return res.json({ message: "No fields to update" });
    }

    values.push(userId);

    // Check if profile exists
    const existingResult = await pool.query(
      `SELECT id FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      // Update
      await pool.query(
        `UPDATE profiles SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${paramCount}`,
        values
      );
    } else {
      // Insert new
      const fieldNames = fields.map(f => f.split(" = ")[0].replace('$', ''));
      const valuePlaceholders = fields.map((_, index) => `$${index + 2}`).join(", ");
      
      await pool.query(
        `INSERT INTO profiles (user_id, ${fieldNames.join(", ")})
         VALUES ($1, ${valuePlaceholders})`,
        [userId, ...values.slice(0, -1)]
      );
    }

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Server error while updating profile" });
  }
}

// Personal details
async function updatePersonalDetails(req, res) {
  try {
    const userId = req.user.id;
    const { birthday, gender, languages, interests } = req.body;

    console.log("Incoming personal details:", req.body, "for user", userId);

    const fields = [];
    const values = [];
    let paramCount = 1;

    if (birthday && birthday.trim() !== "") {
      fields.push(`birthday = $${paramCount}`);
      values.push(birthday);
      paramCount++;
    }
    if (gender && gender.trim() !== "") {
      fields.push(`gender = $${paramCount}`);
      values.push(gender);
      paramCount++;
    }
    if (languages && languages.trim() !== "") {
      fields.push(`languages = $${paramCount}`);
      values.push(languages);
      paramCount++;
    }
    if (interests && interests.trim() !== "") {
      fields.push(`interests = $${paramCount}`);
      values.push(interests);
      paramCount++;
    }

    if (fields.length === 0) {
      return res.json({ message: "No personal details to update" });
    }

    values.push(userId);

    const existingResult = await pool.query("SELECT id FROM profiles WHERE user_id = $1", [userId]);

    if (existingResult.rows.length > 0) {
      const result = await pool.query(
        `UPDATE profiles SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${paramCount}`,
        values
      );
      console.log("Update result:", result);
    } else {
      const fieldNames = fields.map(f => f.split(" = ")[0].replace('$', ''));
      const valuePlaceholders = fields.map((_, index) => `$${index + 2}`).join(", ");
      
      const result = await pool.query(
        `INSERT INTO profiles (user_id, ${fieldNames.join(", ")})
         VALUES ($1, ${valuePlaceholders})`,
        [userId, ...values.slice(0, -1)]
      );
      console.log("Insert result:", result);
    }

    res.json({ message: "Personal details updated successfully" });
  } catch (err) {
    console.error("Error updating personal details:", err);
    res.status(500).json({ error: "Server error while updating personal details" });
  }
}

// Upload avatar
async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user.id;
    const avatarUrl = `/uploads/${req.file.filename}`;

    // Update profile with avatar URL
    const existingResult = await pool.query(
      `SELECT id FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      await pool.query(
        `UPDATE profiles SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [avatarUrl, userId]
      );
    } else {
      await pool.query(
        `INSERT INTO profiles (user_id, avatar_url) VALUES ($1, $2)`,
        [userId, avatarUrl]
      );
    }

    res.json({ 
      message: "Avatar uploaded successfully", 
      avatar_url: avatarUrl 
    });
  } catch (err) {
    console.error("Error uploading avatar:", err);
    res.status(500).json({ error: "Server error while uploading avatar" });
  }
}

// Upload cover photo
async function uploadCover(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user.id;
    const coverUrl = `/uploads/${req.file.filename}`;

    // Update profile with cover URL
    const existingResult = await pool.query(
      `SELECT id FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      await pool.query(
        `UPDATE profiles SET cover_url = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [coverUrl, userId]
      );
    } else {
      await pool.query(
        `INSERT INTO profiles (user_id, cover_url) VALUES ($1, $2)`,
        [userId, coverUrl]
      );
    }

    res.json({ 
      message: "Cover photo uploaded successfully", 
      cover_url: coverUrl 
    });
  } catch (err) {
    console.error("Error uploading cover photo:", err);
    res.status(500).json({ error: "Server error while uploading cover photo" });
  }
}

async function addExperience(req, res) {
  try {
    const userId = req.user.id;
    let { title, company, employment_type, location, start_date, end_date, current, description } = req.body;

    start_date = normalizeDate(start_date);
    end_date = normalizeDate(end_date);

    const currentValue = current ? true : false;

    // Convert undefined → null
    employment_type = employment_type || null;
    location = location || null;
    end_date = end_date || null;
    description = description || null;

    await pool.query(
      `INSERT INTO experiences (user_id, title, company, employment_type, location, start_date, end_date, current, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, title, company, employment_type, location, start_date, end_date, currentValue, description]
    );

    res.json({ message: "Experience added successfully" });
  } catch (err) {
    console.error("Error adding experience:", err);
    res.status(500).json({ error: "Server error while adding experience" });
  }
}

// Add education
async function addEducation(req, res) {
  try {
    const userId = req.user.id;
    let { school, degree, field_of_study, start_date, end_date, grade, description } = req.body;
    
    start_date = normalizeDate(start_date);
    end_date = normalizeDate(end_date);

    await pool.query(
      `INSERT INTO educations (user_id, school, degree, field_of_study, start_date, end_date, grade, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, school, degree, field_of_study, start_date, end_date, grade, description]
    );

    res.json({ message: "Education added successfully" });
  } catch (err) {
    console.error("Error adding education:", err);
    res.status(500).json({ error: "Server error while adding education" });
  }
}

// Add skill
async function addSkill(req, res) {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    // PostgreSQL version of ON DUPLICATE KEY UPDATE
    await pool.query(
      `INSERT INTO skills (user_id, name, endorsements) 
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, name) 
       DO UPDATE SET endorsements = skills.endorsements + 1`,
      [userId, name]
    );

    res.json({ message: "Skill added successfully" });
  } catch (err) {
    console.error("Error adding skill:", err);
    res.status(500).json({ error: "Server error while adding skill" });
  }
}

// Add certification
async function addCertification(req, res) {
  try {
    const userId = req.user.id;
    let { name, issuing_organization, issue_date, expiration_date, credential_id, credential_url } = req.body;
    
    issue_date = normalizeDate(issue_date);
    expiration_date = normalizeDate(expiration_date);

    await pool.query(
      `INSERT INTO certifications (user_id, name, issuing_organization, issue_date, expiration_date, credential_id, credential_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, name, issuing_organization, issue_date, expiration_date, credential_id, credential_url]
    );

    res.json({ message: "Certification added successfully" });
  } catch (err) {
    console.error("Error adding certification:", err);
    res.status(500).json({ error: "Server error while adding certification" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updatePersonalDetails,
  uploadAvatar: [upload.single('avatar'), uploadAvatar],
  uploadCover: [upload.single('cover'), uploadCover],
  addExperience,
  addEducation,
  addSkill,
  addCertification
};
