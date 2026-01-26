-- Migration: Add reservation_items table to support multiple items per reservation
-- This allows customers to pre-order items when making a table reservation

-- First, check if table exists, if not create it
CREATE TABLE IF NOT EXISTS reservation_items (
  id CHAR(36) PRIMARY KEY,
  reservation_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  
  quantity INT NOT NULL DEFAULT 1,
  price_at_time DECIMAL(10,2) NOT NULL,
  name_at_time VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_reservation_id (reservation_id),
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add foreign keys separately to avoid character set issues
-- First, ensure the columns match the referenced table's character set
ALTER TABLE reservation_items 
  MODIFY COLUMN reservation_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  MODIFY COLUMN item_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;

-- Add foreign keys (will fail if they already exist, which is fine)
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'reservation_items' 
    AND CONSTRAINT_NAME = 'reservation_items_ibfk_1'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE reservation_items ADD CONSTRAINT reservation_items_ibfk_1 FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE',
  'SELECT "Foreign key reservation_items_ibfk_1 already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists2 = (
  SELECT COUNT(*) 
  FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'reservation_items' 
    AND CONSTRAINT_NAME = 'reservation_items_ibfk_2'
);

SET @sql2 = IF(@fk_exists2 = 0,
  'ALTER TABLE reservation_items ADD CONSTRAINT reservation_items_ibfk_2 FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT',
  'SELECT "Foreign key reservation_items_ibfk_2 already exists"'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
