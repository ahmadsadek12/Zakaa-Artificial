-- Migration: Add Cancellation Policy Fields
-- Add support for customizable cancellation deadlines for scheduled orders
-- Date: 2026-01-26

-- Add cancellation deadline field to items table (item-level)
ALTER TABLE items ADD COLUMN cancelable_before_hours INT NULL 
  COMMENT 'Hours before scheduled time that item can be cancelled (item-level policy)';

-- Add default cancellation deadline field to users table (business-level)
ALTER TABLE users ADD COLUMN default_cancelable_before_hours INT DEFAULT 2 
  COMMENT 'Default hours before scheduled time that orders can be cancelled (business-level policy)';

-- Add index for performance when querying cancelable items
CREATE INDEX idx_items_cancelable ON items(cancelable_before_hours) WHERE cancelable_before_hours IS NOT NULL;

-- Update existing users to have the default value if NULL
UPDATE users SET default_cancelable_before_hours = 2 WHERE default_cancelable_before_hours IS NULL AND user_type = 'business';
