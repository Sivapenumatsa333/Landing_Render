// src/db.js
const { Pool } = require("pg");
require("dotenv").config();

// ✅ PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Render provides this
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ✅ Initialize schema if not exists
async function init() {
  try {
    console.log('🔄 Initializing database tables...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        role VARCHAR(50) NOT NULL DEFAULT 'employee',
        phone VARCHAR(20),
        work_status VARCHAR(50),
        company_name VARCHAR(255),
        website VARCHAR(255),
        gst_number VARCHAR(100),
        agency_name VARCHAR(255),
        specialization VARCHAR(255),
        years_experience INT,
        provider_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        headline VARCHAR(255),
        location VARCHAR(255),
        about TEXT,
        avatar_url VARCHAR(500),
        cover_url VARCHAR(500),
        website VARCHAR(255),
        phone VARCHAR(20),
        linkedin_url VARCHAR(255),
        birthday DATE,
        gender VARCHAR(20),
        languages TEXT,
        interests TEXT,
        marital_status VARCHAR(50),
        nationality VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `);

    // Create experiences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS experiences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        employment_type VARCHAR(20) DEFAULT 'FULL_TIME',
        location VARCHAR(255),
        start_date DATE NOT NULL,
        end_date DATE,
        current BOOLEAN DEFAULT FALSE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create educations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS educations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        school VARCHAR(255) NOT NULL,
        degree VARCHAR(255),
        field_of_study VARCHAR(255),
        start_date DATE,
        end_date DATE,
        grade VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create skills table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        endorsements INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    // Create certifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS certifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        issuing_organization VARCHAR(255),
        issue_date DATE,
        expiration_date DATE,
        credential_id VARCHAR(255),
        credential_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ All PostgreSQL tables created successfully");
    
  } catch (err) {
    console.error("❌ DB init error", err);
  }
}

module.exports = { pool, init };
