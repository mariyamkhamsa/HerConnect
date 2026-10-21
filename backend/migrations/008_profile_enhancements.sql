-- Profile enrichment for workers and entrepreneurs (display + editing only).
-- Run ONCE against an EXISTING herconnect database (fresh installs: use schema.sql instead).
--   mysql -u root -p herconnect < migrations/008_profile_enhancements.sql
--
-- * Only adds NULL-able columns and one new table: no existing row, ID, credential, photo or
--   privacy setting is changed, and existing accounts simply start with empty new fields.
-- * Nothing here is read by the AI pipeline (embeddings / SBERT / Cross-Encoder are untouched).
-- * Run it BEFORE starting the updated backend (the API selects these columns).
-- * MySQL has no "ADD COLUMN IF NOT EXISTS": running this twice fails with "Duplicate column name".
--   The CREATE TABLE at the end is safe to re-run.
USE herconnect;

ALTER TABLE worker_profiles
    ADD COLUMN services_offered VARCHAR(500) NULL,          -- comma-separated tags
    ADD COLUMN professional_intro TEXT NULL,
    ADD COLUMN languages VARCHAR(255) NULL,                 -- comma-separated tags
    ADD COLUMN certifications_json TEXT NULL;               -- JSON list of {title, issuer, year}

ALTER TABLE entrepreneur_profiles
    ADD COLUMN business_intro TEXT NULL,
    ADD COLUMN services_products VARCHAR(500) NULL,         -- comma-separated tags
    ADD COLUMN years_in_business INT NULL,
    ADD COLUMN collaboration_needs VARCHAR(500) NULL,       -- comma-separated tags (skills / workers sought)
    ADD COLUMN preferred_work_arrangements VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS portfolio_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NULL,
    entrepreneur_id INT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    image_path VARCHAR(500) NULL,                           -- uploaded file path OR external https URL
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_portfolio_items_worker (worker_id),
    INDEX ix_portfolio_items_entrepreneur (entrepreneur_id),
    FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (entrepreneur_id) REFERENCES entrepreneur_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;
