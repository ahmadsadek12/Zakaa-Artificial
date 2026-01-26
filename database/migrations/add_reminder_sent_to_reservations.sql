-- Migration: Add reminder_sent field to reservations table
-- This tracks whether a reminder has been sent for the reservation
-- Date: 2026-01-26

-- Add reminder_sent column
ALTER TABLE reservations 
ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE
COMMENT 'Whether a reminder message has been sent for this reservation';

-- Add index for querying reservations that need reminders
CREATE INDEX idx_reservations_reminder 
ON reservations(reservation_date, status, reminder_sent);

-- Set existing reservations as reminder_sent = false
UPDATE reservations 
SET reminder_sent = FALSE 
WHERE reminder_sent IS NULL;
