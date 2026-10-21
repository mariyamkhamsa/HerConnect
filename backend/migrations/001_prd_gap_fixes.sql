-- Run ONCE against an EXISTING herconnect database (fresh installs: use schema.sql instead).
-- mysql -u root -p herconnect < migrations/001_prd_gap_fixes.sql
USE herconnect;

ALTER TABLE jobs ADD COLUMN category VARCHAR(100) NULL AFTER work_type;

CREATE INDEX idx_jobs_status_locality ON jobs (status, locality);
CREATE INDEX idx_jobs_category ON jobs (category);
CREATE INDEX idx_worker_locality ON worker_profiles (locality);
