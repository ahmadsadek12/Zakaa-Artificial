-- Migration: Update Reservations Table for Table Reservations Add-On
-- Adds snapshot fields, platform, timestamps, and updates status enum

USE zakaa_db;

-- ============================================================================
-- RESERVATIONS TABLE UPDATES
-- ============================================================================

-- Step 1: Add new columns
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reservation_type ENUM('table','appointment','other') DEFAULT 'table' AFTER status,
  ADD COLUMN IF NOT EXISTS owner_user_id CHAR(36) NULL AFTER business_user_id,
  ADD COLUMN IF NOT EXISTS min_seats_snapshot INT NULL AFTER table_id,
  ADD COLUMN IF NOT EXISTS max_seats_snapshot INT NULL AFTER min_seats_snapshot,
  ADD COLUMN IF NOT EXISTS position_snapshot VARCHAR(100) NULL AFTER max_seats_snapshot,
  ADD COLUMN IF NOT EXISTS platform ENUM('whatsapp','telegram','instagram','facebook','dashboard') DEFAULT 'whatsapp' AFTER source,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL AFTER status,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL AFTER completed_at;

-- Step 2: Migrate existing data
-- Set reservation_type from reservation_kind if it exists
-- Set owner_user_id from user_id
-- Set platform from source (map source values to platform)
UPDATE reservations
SET 
  reservation_type = COALESCE(
    CASE 
      WHEN reservation_kind = 'table' THEN 'table'
      WHEN reservation_kind = 'appointment' THEN 'appointment'
      ELSE 'other'
    END,
    'table'
  ),
  owner_user_id = COALESCE(user_id, business_user_id),
  platform = CASE 
    WHEN source = 'whatsapp' THEN 'whatsapp'
    WHEN source = 'telegram' THEN 'telegram'
    WHEN source = 'instagram' THEN 'instagram'
    WHEN source = 'facebook' THEN 'facebook'
    WHEN source = 'dashboard' THEN 'dashboard'
    ELSE 'whatsapp'
  END
WHERE reservation_type IS NULL OR owner_user_id IS NULL OR platform IS NULL;

-- Step 3: Update status ENUM to include 'no_show'
-- Note: MySQL doesn't support ALTER ENUM easily, so we'll handle this in code
-- For now, we'll use the existing status values and add 'no_show' handling in application code

-- Step 4: Add foreign key for owner_user_id
ALTER TABLE reservations
  ADD CONSTRAINT fk_reservations_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 5: Add indexes
ALTER TABLE reservations
  ADD INDEX IF NOT EXISTS idx_res_datetime (reservation_date, reservation_time),
  ADD INDEX IF NOT EXISTS idx_res_table (table_id),
  ADD INDEX IF NOT EXISTS idx_res_status (status),
  ADD INDEX IF NOT EXISTS idx_res_owner_user_id (owner_user_id),
  ADD INDEX IF NOT EXISTS idx_res_type (reservation_type);
