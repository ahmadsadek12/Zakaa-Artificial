-- Zakaa Major System Update Migration
-- Implements: Contract approval, Addons system, Service model, Bot integrations, Analytics refactoring

USE zakaa_db;

-- ============================================================================
-- 1. USERS TABLE UPDATES
-- ============================================================================

-- Add new business fields
ALTER TABLE users 
  ADD COLUMN google_maps_link TEXT NULL AFTER delivery_price,
  ADD COLUMN carrier_phone_number VARCHAR(20) NULL AFTER google_maps_link,
  ADD COLUMN estimated_delivery_time_min INT NULL AFTER carrier_phone_number,
  ADD COLUMN estimated_delivery_time_max INT NULL AFTER estimated_delivery_time_min;

-- Add contract approval fields (CRITICAL - blocks bot if not approved)
ALTER TABLE users
  ADD COLUMN contract_file_url TEXT NULL AFTER estimated_delivery_time_max,
  ADD COLUMN contract_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER contract_file_url,
  ADD COLUMN contract_approved_at TIMESTAMP NULL AFTER contract_status;

-- Add username for branch login
ALTER TABLE users
  ADD COLUMN username VARCHAR(100) UNIQUE NULL AFTER email;

-- Add Google Calendar integration
ALTER TABLE users
  ADD COLUMN google_calendar_integration_json JSON NULL AFTER contract_approved_at;

-- Add indexes for new fields
ALTER TABLE users
  ADD INDEX idx_contract_status (contract_status),
  ADD INDEX idx_username (username);

-- Note: location_latitude, location_longitude, delivery_radius_km are DEPRECATED
-- Keep columns but do not use in code

-- ============================================================================
-- 2. ORDERS TABLE UPDATES
-- ============================================================================

-- Add request type (order vs scheduled_request)
ALTER TABLE orders
  ADD COLUMN request_type ENUM('order','scheduled_request') NOT NULL DEFAULT 'order' AFTER scheduled_for;

-- Add analytics fields
ALTER TABLE orders
  ADD COLUMN first_response_at TIMESTAMP NULL AFTER request_type,
  ADD COLUMN source_message_id VARCHAR(255) NULL AFTER first_response_at;

-- Add indexes
ALTER TABLE orders
  ADD INDEX idx_request_type (request_type),
  ADD INDEX idx_scheduled_for (scheduled_for);

-- Note: location_latitude, location_longitude are DEPRECATED
-- Keep columns but do not use in code

-- ============================================================================
-- 3. ITEMS TABLE UPDATES (Service Model)
-- ============================================================================

-- Add service model fields
ALTER TABLE items
  ADD COLUMN service_type ENUM('physical','time_based') NOT NULL DEFAULT 'physical' AFTER duration_minutes,
  ADD COLUMN availability_status ENUM('available','unavailable','hidden') NOT NULL DEFAULT 'available' AFTER service_type,
  ADD COLUMN stock_quantity INT NULL AFTER availability_status,
  ADD COLUMN only_scheduled BOOLEAN NOT NULL DEFAULT false AFTER stock_quantity,
  ADD COLUMN reminder_minutes_before INT NULL AFTER only_scheduled,
  ADD COLUMN category_id CHAR(36) NULL AFTER reminder_minutes_before;

-- Add indexes
ALTER TABLE items
  ADD INDEX idx_category_id (category_id),
  ADD INDEX idx_service_type (service_type),
  ADD INDEX idx_availability_status (availability_status);

-- Note: is_reusable, is_rental, track_quantity, quantity are DEPRECATED
-- Keep columns but do not use in code
-- stock_quantity replaces quantity semantics

-- ============================================================================
-- 4. MENUS TABLE UPDATES
-- ============================================================================

ALTER TABLE menus
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER is_shared,
  ADD COLUMN menu_type VARCHAR(50) NULL AFTER sort_order;

-- ============================================================================
-- 5. TABLES TABLE UPDATES
-- ============================================================================

ALTER TABLE tables
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true AFTER number,
  ADD COLUMN label VARCHAR(100) NULL AFTER is_active;

-- Note: reserved is DEPRECATED - do not rely on this
-- Reserved status is derived from reservations/calendar events

-- ============================================================================
-- 6. RESERVATIONS TABLE UPDATES
-- ============================================================================

ALTER TABLE reservations
  ADD COLUMN reservation_kind ENUM('table','appointment') NOT NULL DEFAULT 'table' AFTER status,
  ADD COLUMN start_at TIMESTAMP NULL AFTER reservation_kind,
  ADD COLUMN source ENUM('whatsapp','telegram','instagram','facebook','dashboard') NOT NULL DEFAULT 'whatsapp' AFTER start_at;

-- Add indexes
ALTER TABLE reservations
  ADD INDEX idx_start_at (start_at),
  ADD INDEX idx_reservation_kind (reservation_kind);

-- ============================================================================
-- 7. NEW TABLES: BOT INTEGRATIONS
-- ============================================================================

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

-- ============================================================================
-- 8. NEW TABLES: SERVICE CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_categories (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_business (business_id),
  CONSTRAINT fk_cat_business FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add foreign key for items.category_id
ALTER TABLE items
  ADD CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL;

-- ============================================================================
-- 9. NEW TABLES: SERVICE CUSTOMIZATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_customizations (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_item (item_id),
  CONSTRAINT fk_custom_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 10. NEW TABLES: ADDONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS addons (
  id CHAR(36) PRIMARY KEY,
  addon_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addon_key (addon_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- 11. NEW TABLES: BUSINESS ADDONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_addons (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  addon_id CHAR(36) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'inactive',
  price_override DECIMAL(10,2) NULL,
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_business_addon (business_id, addon_id),
  INDEX idx_business (business_id),
  CONSTRAINT fk_ba_business FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ba_addon FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
