-- Forgot-password support: single-use, expiring reset tokens.
-- Run ONCE against an EXISTING herconnect database (fresh installs: use schema.sql instead).
--   mysql -u root -p herconnect < migrations/007_password_reset.sql
-- Only ONE new table is added; no existing table or row is touched. (The backend would also
-- auto-create it on startup, but running this first keeps the schema under your control.)
-- Re-running is safe (CREATE TABLE IF NOT EXISTS).
-- Change e-mail and change password need NO schema change.
USE herconnect;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,   -- SHA-256 of the emailed token; the token itself is never stored
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prt_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
