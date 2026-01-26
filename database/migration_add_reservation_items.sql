-- Migration: Add reservation_items table to support multiple items per reservation
-- This allows customers to pre-order items when making a table reservation
-- Version 2: Matches the exact character set of the reservations table

-- Step 1: Create table without foreign keys first
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

-- Step 2: Get the actual character set from reservations.id and items.id
-- Then modify our columns to match exactly
SET @res_char_set = (
  SELECT CHARACTER_SET_NAME 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'reservations' 
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

SET @res_collation = (
  SELECT COLLATION_NAME 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'reservations' 
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

SET @item_char_set = (
  SELECT CHARACTER_SET_NAME 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'items' 
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

SET @item_collation = (
  SELECT COLLATION_NAME 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'items' 
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

-- Step 3: Modify columns to match the exact character set and collation
SET @sql1 = CONCAT('ALTER TABLE reservation_items MODIFY COLUMN reservation_id CHAR(36) CHARACTER SET ', 
  IFNULL(@res_char_set, 'utf8mb4'), ' COLLATE ', IFNULL(@res_collation, 'utf8mb4_0900_ai_ci'), ' NOT NULL');
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @sql2 = CONCAT('ALTER TABLE reservation_items MODIFY COLUMN item_id CHAR(36) CHARACTER SET ', 
  IFNULL(@item_char_set, 'utf8mb4'), ' COLLATE ', IFNULL(@item_collation, 'utf8mb4_0900_ai_ci'), ' NOT NULL');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Step 4: Add foreign keys (check if they exist first)
SET @fk1_exists = (
  SELECT COUNT(*) 
  FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'reservation_items' 
    AND CONSTRAINT_NAME = 'reservation_items_ibfk_1'
);

SET @sql3 = IF(@fk1_exists = 0,
  'ALTER TABLE reservation_items ADD CONSTRAINT reservation_items_ibfk_1 FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE',
  'SELECT "Foreign key reservation_items_ibfk_1 already exists" AS message'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @fk2_exists = (
  SELECT COUNT(*) 
  FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'reservation_items' 
    AND CONSTRAINT_NAME = 'reservation_items_ibfk_2'
);

SET @sql4 = IF(@fk2_exists = 0,
  'ALTER TABLE reservation_items ADD CONSTRAINT reservation_items_ibfk_2 FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT',
  'SELECT "Foreign key reservation_items_ibfk_2 already exists" AS message'
);
PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;
