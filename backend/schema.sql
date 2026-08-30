-- HerConnect MySQL schema
-- Run this once against an empty database to create all tables.
-- Example: mysql -u root -p herconnect < schema.sql

CREATE DATABASE IF NOT EXISTS herconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE herconnect;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('entrepreneur', 'worker', 'admin') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entrepreneur_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    business_name VARCHAR(255) NOT NULL,
    description TEXT,
    locality VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS worker_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    structured_skills VARCHAR(500) NOT NULL,        -- comma-separated skill tags
    about_description TEXT NOT NULL,                -- free-text, feeds the AI pipeline
    experience_years FLOAT NOT NULL DEFAULT 0,
    locality VARCHAR(255) NOT NULL,
    availability VARCHAR(255) NOT NULL,              -- comma-separated tags e.g. "weekdays,mornings"
    work_type VARCHAR(100) NOT NULL,                 -- e.g. "part-time", "seasonal", "short-term"
    portfolio_file_path VARCHAR(500) NULL,           -- optional, single file, stored as-is
    embedding LONGTEXT NULL,                         -- JSON-serialized SBERT vector
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entrepreneur_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    required_skills_text VARCHAR(500) NOT NULL,      -- comma-separated skill tags
    experience_required FLOAT NOT NULL DEFAULT 0,
    locality VARCHAR(255) NOT NULL,
    availability VARCHAR(255) NOT NULL,               -- comma-separated tags
    work_type VARCHAR(100) NOT NULL,
    status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    embedding LONGTEXT NULL,                          -- JSON-serialized SBERT vector
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (entrepreneur_id) REFERENCES entrepreneur_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    worker_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_job_worker (job_id, worker_id),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (name) VALUES
    ('tailoring'), ('cooking'), ('tutoring'), ('crafts'),
    ('beauty & personal care'), ('baking'), ('catering');
