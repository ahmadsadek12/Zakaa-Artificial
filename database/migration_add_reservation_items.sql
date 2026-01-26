-- Migration: Add reservation_items table to support multiple items per reservation
-- This allows customers to pre-order items when making a table reservation

CREATE TABLE IF NOT EXISTS reservation_items (
  id CHAR(36) PRIMARY KEY,
  reservation_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  
  quantity INT NOT NULL DEFAULT 1,
  price_at_time DECIMAL(10,2) NOT NULL,
  name_at_time VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  INDEX idx_reservation_id (reservation_id),
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
