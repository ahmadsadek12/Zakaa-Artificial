-- Migration: Add mode_switched to bot_actions action_type enum
-- Extends bot audit logging to track mode switching

USE zakaa_db;

-- Add mode_switched to the action_type enum
ALTER TABLE bot_actions 
MODIFY COLUMN action_type ENUM(
  'intent_detected',
  'mode_switched',
  'function_called',
  'validation_failed',
  'handover_to_employee'
) NOT NULL;
