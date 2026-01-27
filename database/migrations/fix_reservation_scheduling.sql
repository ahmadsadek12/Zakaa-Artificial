-- Migration: Fix Reservation Scheduling
-- Adds party_size, start_time, end_time and prevents double-booking

USE zakaa_db;

-- Step 1: Add new columns
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS party_size INT NOT NULL DEFAULT 1 AFTER number_of_guests,
  ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL AFTER reservation_time,
  ADD COLUMN IF NOT EXISTS end_time TIME NOT NULL AFTER start_time;

-- Step 2: Migrate existing data
-- Set party_size from number_of_guests (or default to 1)
UPDATE reservations
SET party_size = COALESCE(number_of_guests, 1)
WHERE party_size = 0 OR party_size IS NULL;

-- Set start_time from reservation_time
UPDATE reservations
SET start_time = reservation_time
WHERE start_time = '00:00:00' OR start_time IS NULL;

-- Calculate end_time from start_time (default 2 hours duration)
-- For existing reservations, use reservation_time + 2 hours
UPDATE reservations
SET end_time = ADDTIME(reservation_time, '02:00:00')
WHERE end_time = '00:00:00' OR end_time IS NULL;

-- Step 3: Remove default values now that data is migrated
ALTER TABLE reservations
  MODIFY COLUMN party_size INT NOT NULL,
  MODIFY COLUMN start_time TIME NOT NULL,
  MODIFY COLUMN end_time TIME NOT NULL;

-- Step 4: Add unique constraint to prevent double-booking
-- Note: MySQL doesn't support partial unique indexes easily, so we'll use a regular unique index
-- Application code should check status != 'cancelled' before enforcing
CREATE UNIQUE INDEX IF NOT EXISTS uniq_table_time 
  ON reservations (table_id, reservation_date, start_time, end_time);

-- Step 5: Add indexes for performance
ALTER TABLE reservations
  ADD INDEX IF NOT EXISTS idx_party_size (party_size),
  ADD INDEX IF NOT EXISTS idx_start_time (start_time),
  ADD INDEX IF NOT EXISTS idx_end_time (end_time),
  ADD INDEX IF NOT EXISTS idx_table_date_time (table_id, reservation_date, start_time);
