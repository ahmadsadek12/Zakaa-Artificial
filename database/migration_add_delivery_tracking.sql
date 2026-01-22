-- Add Delivery Time Tracking to Orders Table
-- Tracks delivery start and completion times, and carrier assignment

USE zakaa_db;

-- ============================================================================
-- ORDERS TABLE UPDATES
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN delivery_started_at TIMESTAMP NULL AFTER completed_at,
  ADD COLUMN delivery_completed_at TIMESTAMP NULL AFTER delivery_started_at,
  ADD COLUMN carrier_id CHAR(36) NULL AFTER delivery_completed_at,
  ADD INDEX idx_delivery_started_at (delivery_started_at),
  ADD INDEX idx_delivery_completed_at (delivery_completed_at),
  ADD INDEX idx_carrier_id (carrier_id),
  ADD CONSTRAINT fk_order_carrier FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL;
