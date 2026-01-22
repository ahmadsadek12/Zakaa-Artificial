-- Migration: Update Tables Table for Table Reservations Add-On
-- Adds business_id, owner_user_id, min_seats, max_seats, position fields
-- Migrates existing data and updates schema

USE zakaa_db;

-- ============================================================================
-- TABLES TABLE UPDATES
-- ============================================================================

-- Step 1: Add new columns (keeping old ones for migration)
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS business_id CHAR(36) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS owner_user_id CHAR(36) NULL AFTER business_id,
  ADD COLUMN IF NOT EXISTS table_number VARCHAR(50) NULL AFTER owner_user_id,
  ADD COLUMN IF NOT EXISTS min_seats INT NULL AFTER table_number,
  ADD COLUMN IF NOT EXISTS max_seats INT NULL AFTER min_seats,
  ADD COLUMN IF NOT EXISTS position_label VARCHAR(100) NULL AFTER max_seats,
  ADD COLUMN IF NOT EXISTS position_notes TEXT NULL AFTER position_label;

-- Step 2: Migrate existing data
-- Set owner_user_id = user_id (same value)
-- Set business_id from user's parent_user_id or user_id itself
-- Set table_number = number
-- Set min_seats = seats, max_seats = seats
UPDATE tables t
INNER JOIN users u ON t.user_id = u.id
SET 
  t.owner_user_id = t.user_id,
  t.business_id = COALESCE(u.parent_user_id, u.id),
  t.table_number = t.number,
  t.min_seats = t.seats,
  t.max_seats = t.seats
WHERE t.owner_user_id IS NULL;

-- Step 3: Make new columns NOT NULL after migration
ALTER TABLE tables
  MODIFY COLUMN business_id CHAR(36) NOT NULL,
  MODIFY COLUMN owner_user_id CHAR(36) NOT NULL,
  MODIFY COLUMN table_number VARCHAR(50) NOT NULL,
  MODIFY COLUMN min_seats INT NOT NULL,
  MODIFY COLUMN max_seats INT NOT NULL;

-- Step 4: Add foreign keys and constraints
ALTER TABLE tables
  ADD CONSTRAINT fk_tables_business FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tables_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD UNIQUE KEY unique_owner_table_number (owner_user_id, table_number);

-- Step 5: Add indexes
ALTER TABLE tables
  ADD INDEX idx_tables_business_id (business_id),
  ADD INDEX idx_tables_owner_user_id (owner_user_id),
  ADD INDEX idx_tables_active (is_active);

-- Step 6: Drop deprecated reserved column (optional - keep for now for backward compatibility)
-- ALTER TABLE tables DROP COLUMN reserved;

-- Note: user_id column is kept for backward compatibility but owner_user_id should be used going forward
