-- Migration: Create Support Tickets System
-- Production-grade ticketing system for customer support and employee handover

USE zakaa_db;

-- Support Tickets Table
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
  
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (related_order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (related_reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_employee_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_business_id (business_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_assigned_employee_id (assigned_employee_id),
  INDEX idx_created_at (created_at),
  INDEX idx_business_status (business_id, status),
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
