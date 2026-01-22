-- Add Customization Tracking Table
-- Tracks which customizations/addons were selected for each order item

USE zakaa_db;

-- ============================================================================
-- ORDER_ITEM_CUSTOMIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_item_customizations (
  id CHAR(36) PRIMARY KEY,
  order_item_id CHAR(36) NOT NULL,
  customization_id CHAR(36) NULL COMMENT 'FK to service_customizations (if exists)',
  customization_name VARCHAR(255) NOT NULL COMMENT 'Name of customization/addon',
  price_adjustment DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Price change from base item',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (customization_id) REFERENCES service_customizations(id) ON DELETE SET NULL,
  
  INDEX idx_order_item_id (order_item_id),
  INDEX idx_customization_id (customization_id),
  INDEX idx_customization_name (customization_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
