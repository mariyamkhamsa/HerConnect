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
    phone VARCHAR(30) NULL,                          -- optional; shared only with consent
    profile_photo_path VARCHAR(500) NULL,
    business_intro TEXT NULL,                        -- display only (not used by AI matching)
    services_products VARCHAR(500) NULL,             -- comma-separated tags
    years_in_business INT NULL,
    collaboration_needs VARCHAR(500) NULL,           -- comma-separated tags (skills / workers sought)
    preferred_work_arrangements VARCHAR(255) NULL,   -- comma-separated tags
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
    profile_photo_path VARCHAR(500) NULL,
    phone VARCHAR(30) NULL,                          -- optional; shared only with consent
    show_email_publicly BOOLEAN NOT NULL DEFAULT FALSE,  -- opt-in: show account e-mail on public profile
    embedding LONGTEXT NULL,                         -- JSON-serialized SBERT vector
    services_offered VARCHAR(500) NULL,              -- display only (not used by AI matching): comma-separated tags
    professional_intro TEXT NULL,
    languages VARCHAR(255) NULL,                     -- comma-separated tags
    certifications_json TEXT NULL,                   -- JSON list of {title, issuer, year}
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS portfolio_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NULL,
    entrepreneur_id INT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    image_path VARCHAR(500) NULL,                    -- uploaded file path OR external https URL
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_portfolio_items_worker (worker_id),
    INDEX ix_portfolio_items_entrepreneur (entrepreneur_id),
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (entrepreneur_id) REFERENCES entrepreneur_profiles(id) ON DELETE CASCADE
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
    category VARCHAR(100) NULL,                       -- optional, admin-managed list (display/filter only)
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
    worker_share_contact BOOLEAN NOT NULL DEFAULT FALSE,         -- worker's contact-sharing consent
    entrepreneur_share_contact BOOLEAN NOT NULL DEFAULT FALSE,   -- entrepreneur's contact-sharing consent
    UNIQUE KEY uniq_job_worker (job_id, worker_id),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    worker_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    entrepreneur_share_contact BOOLEAN NOT NULL DEFAULT FALSE,
    worker_share_contact BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    UNIQUE KEY uniq_invitation_job_worker (job_id, worker_id),
    INDEX ix_invitations_worker_id (worker_id),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kind VARCHAR(50) NOT NULL,
    message VARCHAR(500) NOT NULL,
    link VARCHAR(255) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user_read (user_id, is_read),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,             -- SHA-256 of the emailed token (the token itself is never stored)
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prt_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (name) VALUES
    ('tailoring'), ('cooking'), ('tutoring'), ('crafts'),
    ('beauty & personal care'), ('baking'), ('catering');

-- Indexes for the structured Step-0 filters and browsing
CREATE INDEX idx_jobs_status_locality ON jobs (status, locality);
CREATE INDEX idx_jobs_category ON jobs (category);
CREATE INDEX idx_worker_locality ON worker_profiles (locality);
