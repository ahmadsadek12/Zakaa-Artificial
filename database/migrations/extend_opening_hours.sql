-- Migration: Extend Opening Hours for Bot Validation
-- Adds buffer_minutes, last_order_time, and slot_interval_minutes

USE zakaa_db;

-- Step 1: Add new columns
ALTER TABLE opening_hours
  ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 0 AFTER close_time,
  ADD COLUMN IF NOT EXISTS last_order_time TIME NULL AFTER buffer_minutes,
  ADD COLUMN IF NOT EXISTS slot_interval_minutes INT DEFAULT 15 AFTER last_order_time;

-- Step 2: Set defaults for existing rows
-- buffer_minutes already has DEFAULT 0
-- slot_interval_minutes already has DEFAULT 15
-- last_order_time will remain NULL (calculated from close_time - buffer_minutes in code)

-- Step 3: Add index for last_order_time (for queries)
ALTER TABLE opening_hours
  ADD INDEX IF NOT EXISTS idx_last_order_time (last_order_time);
