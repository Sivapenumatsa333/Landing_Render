-- schema-postgres.sql (PostgreSQL)
-- Create the database (you might need to do this manually in Render)
-- CREATE DATABASE career_portal;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','employer','recruiter','admin')),
    phone VARCHAR(50),
    work_status VARCHAR(50),
    company_name VARCHAR(255),
    website VARCHAR(255),
    gst_number VARCHAR(100),
    agency_name VARCHAR(255),
    specialization VARCHAR(255),
    years_experience INTEGER DEFAULT 0,
    provider_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
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
    connections_count INT DEFAULT 0, -- Moved inside CREATE TABLE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id)
);

-- Experiences table
CREATE TABLE IF NOT EXISTS experiences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    employment_type VARCHAR(20) DEFAULT 'FULL_TIME' CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE')),
    location VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE,
    current BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Educations table
CREATE TABLE IF NOT EXISTS educations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    school VARCHAR(255) NOT NULL,
    degree VARCHAR(255),
    field_of_study VARCHAR(255),
    start_date DATE,
    end_date DATE,
    grade VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    endorsements INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
);

-- Certifications table
CREATE TABLE IF NOT EXISTS certifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    issuing_organization VARCHAR(255),
    issue_date DATE,
    expiration_date DATE,
    credential_id VARCHAR(255),
    credential_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_experiences_user_id ON experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_educations_user_id ON educations(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user_id ON certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- Connections table
CREATE TABLE IF NOT EXISTS connections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'blocked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_connection (user1_id, user2_id),
    CHECK (user1_id < user2_id) -- Prevents duplicate connections in both directions
);

-- Connection requests table (for tracking pending requests)
CREATE TABLE IF NOT EXISTS connection_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    message TEXT,
    status ENUM('pending', 'accepted', 'rejected', 'withdrawn') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_request (from_user_id, to_user_id, status)
);

-- ==========================================
-- MESSAGES TABLE (for user-to-user chat)
-- ==========================================
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed admin (email: admin@local.test, password: admin123)
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@local.test', '$2a$10$O6bRqlkOONZ7V4mWDxTj4OLoCMgB0vZtJb6vCKlPqVgmpZ8JYgSCa', 'admin')
ON CONFLICT (email) DO NOTHING;
