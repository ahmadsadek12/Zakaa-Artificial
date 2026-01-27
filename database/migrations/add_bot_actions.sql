-- Migration: Create Bot Actions Audit Table
-- Tracks bot decisions and actions for debugging and analytics

USE zakaa_db;

CREATE TABLE IF NOT EXISTS bot_actions (
  id CHAR(36) PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  action_type ENUM(
    'intent_detected',
    'function_called',
    'validation_failed',
    'handover_to_employee'
  ) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  INDEX idx_session_id (session_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  INDEX idx_session_action (session_id, action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
