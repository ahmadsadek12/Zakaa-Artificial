-- Add Carriers Table
-- One-to-one relationship with business/branch for delivery tracking

USE zakaa_db;

-- ============================================================================
-- CARRIERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS carriers (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL COMMENT 'FK to users (business or branch)',
  business_id CHAR(36) NOT NULL COMMENT 'FK to users (business owner)',
  branch_id CHAR(36) NULL COMMENT 'FK to users (branch, nullable for business-level carriers)',
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_user_id (user_id),
  INDEX idx_business_id (business_id),
  INDEX idx_branch_id (branch_id),
  INDEX idx_is_active (is_active),
  INDEX idx_deleted_at (deleted_at),
  
  -- One carrier per business/branch
  UNIQUE KEY unique_carrier_per_user (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
