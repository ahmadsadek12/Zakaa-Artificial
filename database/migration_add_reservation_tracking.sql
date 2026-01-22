-- Add Reservation Tracking Fields
-- Tracks no-shows and check-in times for reservations

USE zakaa_db;

-- ============================================================================
-- RESERVATIONS TABLE UPDATES
-- ============================================================================

ALTER TABLE reservations
  ADD COLUMN no_show BOOLEAN NOT NULL DEFAULT false AFTER status,
  ADD COLUMN checked_in_at TIMESTAMP NULL AFTER no_show,
  ADD INDEX idx_no_show (no_show),
  ADD INDEX idx_checked_in_at (checked_in_at);
