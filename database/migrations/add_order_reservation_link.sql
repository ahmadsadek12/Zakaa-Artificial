-- Migration: Add Order ↔ Reservation Link
-- Links orders to reservations and adds bot confidence tracking

USE zakaa_db;

-- Step 1: Add linked_reservation_id to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS linked_reservation_id CHAR(36) NULL AFTER customer_name,
  ADD COLUMN IF NOT EXISTS created_via ENUM('bot','dashboard','api') DEFAULT 'bot' AFTER linked_reservation_id,
  ADD COLUMN IF NOT EXISTS bot_confidence_score DECIMAL(3,2) NULL AFTER created_via,
  ADD COLUMN IF NOT EXISTS requires_human_review BOOLEAN DEFAULT FALSE AFTER bot_confidence_score;

-- Step 2: Add foreign key for linked_reservation_id
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_linked_reservation 
    FOREIGN KEY (linked_reservation_id) 
    REFERENCES reservations(id) 
    ON DELETE SET NULL;

-- Step 3: Add index for linked_reservation_id
ALTER TABLE orders
  ADD INDEX IF NOT EXISTS idx_linked_reservation_id (linked_reservation_id);

-- Step 4: Add same fields to reservations table
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS created_via ENUM('bot','dashboard','api') DEFAULT 'bot' AFTER platform,
  ADD COLUMN IF NOT EXISTS bot_confidence_score DECIMAL(3,2) NULL AFTER created_via,
  ADD COLUMN IF NOT EXISTS requires_human_review BOOLEAN DEFAULT FALSE AFTER bot_confidence_score;

-- Step 5: Add indexes for new fields
ALTER TABLE reservations
  ADD INDEX IF NOT EXISTS idx_created_via (created_via),
  ADD INDEX IF NOT EXISTS idx_requires_human_review (requires_human_review);
