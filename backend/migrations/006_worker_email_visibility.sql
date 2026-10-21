-- Adds the worker's "Show my email publicly" opt-in (default OFF).
-- Run ONCE against an EXISTING herconnect database (fresh installs: use schema.sql instead).
--   mysql -u root -p herconnect < migrations/006_worker_email_visibility.sql
-- Existing workers get FALSE, i.e. their e-mail stays private until they switch it on.
-- (MySQL has no "ADD COLUMN IF NOT EXISTS": running this twice fails with "Duplicate column name".)
USE herconnect;

ALTER TABLE worker_profiles
    ADD COLUMN show_email_publicly BOOLEAN NOT NULL DEFAULT FALSE AFTER phone;
