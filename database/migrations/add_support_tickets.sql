-- Migration: Create Support Tickets System
-- Production-grade ticketing system for customer support and employee handover

USE zakaa_db;

-- Support Tickets Table
-- Create table without foreign key constraints (add them separately to avoid errors)
CREATE TABLE IF NOT EXISTS support_tickets (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NULL,
  related_order_id CHAR(36) NULL,
  related_reservation_id CHAR(36) NULL,
  session_id CHAR(36) NULL,
  subject VARCHAR(255),
  status ENUM('open','in_progress','waiting_customer','resolved','closed') DEFAULT 'open',
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  created_via ENUM('bot','employee','dashboard') DEFAULT 'bot',
  assigned_employee_id CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_business_id (business_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_assigned_employee_id (assigned_employee_id),
  INDEX idx_created_at (created_at),
  INDEX idx_business_status (business_id, status),
  INDEX idx_session_id (session_id),
  INDEX idx_related_reservation_id (related_reservation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add foreign key constraints (skip if they already exist or cause errors)
-- Note: related_reservation_id foreign key is commented out due to potential type mismatch
-- The application will work fine without this constraint

-- Drop existing constraints if they exist (ignore errors)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = 'zakaa_db' 
   AND TABLE_NAME = 'support_tickets' 
   AND CONSTRAINT_NAME = 'support_tickets_ibfk_1') > 0,
  'SELECT "Constraint already exists"',
  'ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_ibfk_1 FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = 'zakaa_db' 
   AND TABLE_NAME = 'support_tickets' 
   AND CONSTRAINT_NAME = 'support_tickets_ibfk_2') > 0,
  'SELECT "Constraint already exists"',
  'ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_ibfk_2 FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = 'zakaa_db' 
   AND TABLE_NAME = 'support_tickets' 
   AND CONSTRAINT_NAME = 'support_tickets_ibfk_3') > 0,
  'SELECT "Constraint already exists"',
  'ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_ibfk_3 FOREIGN KEY (related_order_id) REFERENCES orders(id) ON DELETE SET NULL'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Skip related_reservation_id foreign key due to potential type mismatch
-- You can add it manually later if needed:
-- ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_ibfk_4 FOREIGN KEY (related_reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = 'zakaa_db' 
   AND TABLE_NAME = 'support_tickets' 
   AND CONSTRAINT_NAME = 'support_tickets_ibfk_6') > 0,
  'SELECT "Constraint already exists"',
  'ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_ibfk_6 FOREIGN KEY (assigned_employee_id) REFERENCES users(id) ON DELETE SET NULL'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Support Ticket Messages Table
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  sender_type ENUM('customer','employee','system','bot') NOT NULL,
  sender_id CHAR(36) NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_sender_type (sender_type),
  INDEX idx_created_at (created_at),
  INDEX idx_ticket_created (ticket_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
