-- schema.sql (MySQL)

CREATE DATABASE IF NOT EXISTS `career_portal` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `career_portal`;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('employee','employer','recruiter','admin') NOT NULL DEFAULT 'employee',
  phone VARCHAR(50),
  work_status VARCHAR(50),
  company_name VARCHAR(255),
  website VARCHAR(255),
  gst_number VARCHAR(100),
  agency_name VARCHAR(255),
  specialization VARCHAR(255),
  years_experience INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN reset_token_expires BIGINT;


-- Seed admin (email: admin@local.test, password: admin123)
INSERT IGNORE INTO users (id, name, email, password_hash, role)
VALUES (1, 'Admin', 'admin@local.test', '$2a$10$O6bRqlkOONZ7V4mWDxTj4OLoCMgB0vZtJb6vCKlPqVgmpZ8JYgSCa', 'admin');
