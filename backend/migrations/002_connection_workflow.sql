-- Run ONCE against an EXISTING herconnect database (fresh installs: use schema.sql instead).
--   mysql -u root -p herconnect < migrations/002_connection_workflow.sql
-- Existing rows and data are kept. Every new column is nullable or defaults to FALSE
-- (= "contact details not shared"), so nothing becomes visible that wasn't before.
-- Run it BEFORE starting the updated backend (the backend would otherwise auto-create the two
-- new tables without the new columns on the existing tables). Steps 3-4 are safe to re-run;
-- the ALTER TABLE statements in steps 1-2 must only run once.
-- Back up first if the data matters:  mysqldump -u root -p herconnect > backup.sql
USE herconnect;

-- 1. Optional phone number on both profile types (shared only with consent)
ALTER TABLE entrepreneur_profiles ADD COLUMN phone VARCHAR(30) NULL AFTER locality;
ALTER TABLE worker_profiles       ADD COLUMN phone VARCHAR(30) NULL AFTER portfolio_file_path;

-- 2. Contact-sharing consent on applications (one flag per side)
ALTER TABLE applications
    ADD COLUMN worker_share_contact BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN entrepreneur_share_contact BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Entrepreneur -> worker invitations (one per job/worker pair)
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

-- 4. In-website notifications
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
