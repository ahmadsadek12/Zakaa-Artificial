-- Migration: Create Chat Sessions Table
-- Persistent session layer for chatbot state management

USE zakaa_db;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NULL,
  platform ENUM('whatsapp','telegram','instagram','facebook','web') NOT NULL,
  mode ENUM('delivery','takeaway','dine_in','support') NOT NULL,
  step VARCHAR(50) NOT NULL,
  draft_payload JSON NOT NULL,
  locked BOOLEAN DEFAULT FALSE,
  assigned_employee_id CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_employee_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_business_id (business_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_platform (platform),
  INDEX idx_assigned_employee_id (assigned_employee_id),
  INDEX idx_business_customer_platform (business_id, customer_id, platform),
  INDEX idx_locked (locked),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
