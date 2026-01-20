-- Create missing tables manually
USE zakaa_db;

-- Create bot_integrations table
CREATE TABLE IF NOT EXISTS bot_integrations (
  id CHAR(36) PRIMARY KEY,
  owner_type ENUM('business','branch') NOT NULL,
  owner_id CHAR(36) NOT NULL,
  platform ENUM('whatsapp','instagram','telegram','facebook') NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config_json JSON NOT NULL,
  access_token_encrypted TEXT NULL,
  phone_number VARCHAR(30) NULL,
  phone_number_id VARCHAR(255) NULL,
  page_id VARCHAR(255) NULL,
  app_id VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner_platform (owner_type, owner_id, platform),
  INDEX idx_owner (owner_type, owner_id),
  CONSTRAINT fk_bot_integrations_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add request_type to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS request_type ENUM('order','scheduled_request') NOT NULL DEFAULT 'order' AFTER scheduled_for,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP NULL AFTER request_type,
  ADD COLUMN IF NOT EXISTS source_message_id VARCHAR(255) NULL AFTER first_response_at;

-- Add indexes for orders
ALTER TABLE orders
  ADD INDEX IF NOT EXISTS idx_request_type (request_type),
  ADD INDEX IF NOT EXISTS idx_scheduled_for (scheduled_for);
