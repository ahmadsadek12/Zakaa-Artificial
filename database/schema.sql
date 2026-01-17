-- Zakaa Database Schema
-- MySQL Database Schema for Users, Branches, Items, and Orders

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS zakaa_db;
USE zakaa_db;

-- Locations Table (Shared by Users and Branches)
CREATE TABLE IF NOT EXISTS locations (
  id CHAR(36) PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  street VARCHAR(255) NOT NULL,
  building VARCHAR(100),
  floor VARCHAR(50),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Users Table (Single Table, Multi-Role - Now includes branches)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  user_type ENUM('admin', 'business', 'branch', 'customer') NOT NULL,
  user_role ENUM('business', 'branch') NULL,
  parent_user_id CHAR(36) NULL,
  
  -- Shared fields
  email VARCHAR(255) UNIQUE,
  contact_phone_number VARCHAR(20),
  password_hash VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Business/Branch-only fields (nullable)
  business_name VARCHAR(255),
  business_type ENUM('food and beverage', 'entertainment', 'sports', 'salons', 'clinics', 'rentals', 'other'),
  business_description TEXT,
  whatsapp_phone_number VARCHAR(20),
  whatsapp_phone_number_id VARCHAR(255),
  whatsapp_access_token_encrypted TEXT,
  default_language ENUM('arabic', 'arabizi', 'english', 'french') DEFAULT 'arabic',
  timezone VARCHAR(50) DEFAULT 'Asia/Beirut',
  allow_scheduled_orders BOOLEAN DEFAULT true,
  allow_delivery BOOLEAN DEFAULT true,
  allow_takeaway BOOLEAN DEFAULT true,
  allow_on_site BOOLEAN DEFAULT true,
  chatbot_enabled BOOLEAN DEFAULT true,
  
  -- Customer-only fields (nullable)
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Subscription fields (for businesses)
  subscription_type ENUM('standard', 'premium') DEFAULT 'standard',
  subscription_price DECIMAL(10,2) DEFAULT 0,
  subscription_status ENUM('active', 'past_due', 'canceled') DEFAULT 'active',
  subscription_started_at TIMESTAMP NULL,
  subscription_ends_at TIMESTAMP NULL,
  
  -- Location reference
  location_id CHAR(36),
  location_latitude DECIMAL(10,8),
  location_longitude DECIMAL(11,8),
  delivery_radius_km DECIMAL(6,2) DEFAULT 10.00,
  
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type (user_type),
  INDEX idx_user_role (user_role),
  INDEX idx_parent_user_id (parent_user_id),
  INDEX idx_email (email),
  INDEX idx_is_active (is_active),
  INDEX idx_subscription_type (subscription_type),
  INDEX idx_location_id (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Branches Table REMOVED - Branches are now stored in users table with user_type='branch'

-- Items Table (Belongs to Business + Optional Branch/User)
CREATE TABLE IF NOT EXISTS items (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  branch_id CHAR(36) NULL,  -- Deprecated, kept for backward compatibility during migration
  menu_id CHAR(36) NULL,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  ingredients TEXT,
  
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  
  preparation_time_minutes INT NULL,  -- For food and beverage businesses
  duration_minutes INT NULL,  -- For other business types (entertainment, sports, etc.)
  quantity INT NULL,  -- Number of instances available (NULL = unlimited, 1 = single instance, >1 = multiple instances)
  is_reusable BOOLEAN DEFAULT true,  -- true = reusable/reservable (like football fields), false = consumable (like toys)
  is_rental BOOLEAN DEFAULT false,  -- Items that require time slot booking
  track_quantity BOOLEAN DEFAULT false,  -- Whether to enforce quantity limits (NULL quantity = unlimited)
  
  available_from TIME NULL,
  available_to TIME NULL,
  days_available JSON NULL,  -- Array of day names: ["monday", "wednesday", "friday"]
  
  availability ENUM('available', 'out_of_stock', 'hidden') DEFAULT 'available',
  item_image_url TEXT NULL,
  
  times_ordered INT DEFAULT 0,
  times_delivered INT DEFAULT 0,
  
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,  -- Deprecated, remove after migration
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE SET NULL,
  INDEX idx_business_id (business_id),
  INDEX idx_user_id (user_id),
  INDEX idx_branch_id (branch_id),
  INDEX idx_menu_id (menu_id),
  INDEX idx_availability (availability)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4_unicode_ci;

-- Item Ingredients Table (Optional Normalization)
CREATE TABLE IF NOT EXISTS item_ingredients (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  ingredient_name VARCHAR(255) NOT NULL,
  
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Item Duration Tiers Table (For rental items with time-based pricing)
CREATE TABLE IF NOT EXISTS item_duration_tiers (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  duration_minutes INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  INDEX idx_item_id (item_id),
  INDEX idx_duration (duration_minutes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Orders Table (Transactional, Short-Lived)
CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NULL,
  business_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,  -- Points to branch user or business user
  branch_id CHAR(36) NULL,  -- Deprecated, kept for backward compatibility during migration
  
  -- Customer information (for WhatsApp orders, customer_id may be null)
  customer_phone_number VARCHAR(20) NOT NULL,
  whatsapp_user_id VARCHAR(255) NULL,
  language_used ENUM('arabic','arabizi','english','french') NULL,
  order_source ENUM('whatsapp', 'telegram', 'manual', 'dashboard') DEFAULT 'whatsapp',
  customer_name VARCHAR(255) NULL,
  
  status ENUM(
    'cart',         -- Active shopping cart (not a real order yet)
    'accepted',     -- Order accepted by business
    'delivering',   -- Order is being prepared/delivered
    'completed',    -- Order finished successfully
    'rejected'      -- Order was cancelled/rejected
  ) DEFAULT 'accepted',
  
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  delivery_type ENUM('takeaway', 'delivery', 'on_site') NOT NULL,
  
  -- Additional order details
  notes TEXT NULL,
  scheduled_for TIMESTAMP NULL,
  
  -- Payment information
  payment_method ENUM('cash','card','wallet','unknown') DEFAULT 'unknown',
  payment_status ENUM('unpaid','paid','refunded') DEFAULT 'unpaid',
  
  -- Delivery address (optional, for delivery orders)
  delivery_address_location_id CHAR(36) NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,  -- Deprecated, remove after migration
  FOREIGN KEY (delivery_address_location_id) REFERENCES locations(id) ON DELETE SET NULL,
  INDEX idx_customer_id (customer_id),
  INDEX idx_business_id (business_id),
  INDEX idx_user_id (user_id),
  INDEX idx_branch_id (branch_id),
  INDEX idx_customer_phone_number (customer_phone_number),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_completed_at (completed_at),
  INDEX idx_customer_created (customer_phone_number, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Order Items Table (Many-to-Many with Price Snapshots)
CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  
  quantity INT NOT NULL DEFAULT 1,
  price_at_time DECIMAL(10,2) NOT NULL,
  name_at_time VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  
  -- Rental booking fields
  booking_date DATE NULL COMMENT 'Date of the rental booking',
  booking_start_time TIME NULL COMMENT 'Start time of the rental',
  booking_end_time TIME NULL COMMENT 'End time (calculated from start + duration)',
  duration_tier_id CHAR(36) NULL COMMENT 'Reference to duration tier used',
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (duration_tier_id) REFERENCES item_duration_tiers(id) ON DELETE SET NULL,
  INDEX idx_order_id (order_id),
  INDEX idx_item_id (item_id),
  INDEX idx_booking_date (booking_date),
  INDEX idx_booking_times (booking_start_time, booking_end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Order Status History Table (Track order status changes)
CREATE TABLE IF NOT EXISTS order_status_history (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  status ENUM('accepted','delivering','completed','rejected') NOT NULL,
  changed_by ENUM('system','business','customer') DEFAULT 'system',
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tables Table (For F&B businesses - physical tables)
CREATE TABLE IF NOT EXISTS tables (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  seats INT NOT NULL,
  number VARCHAR(50) NOT NULL,
  reserved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_reserved (reserved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Reservations Table (For all business types)
CREATE TABLE IF NOT EXISTS reservations (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  business_user_id CHAR(36) NOT NULL,
  table_id CHAR(36) NULL,
  customer_phone_number VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  number_of_guests INT,
  notes TEXT,
  status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (business_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
  INDEX idx_business_user_id (business_user_id),
  INDEX idx_reservation_date (reservation_date),
  INDEX idx_table_id (table_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Menus Table
CREATE TABLE IF NOT EXISTS menus (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_shared BOOLEAN DEFAULT false,
  menu_image_url TEXT NULL,  -- Deprecated, kept for backward compatibility
  menu_pdf_url TEXT NULL,  -- PDF file URL
  menu_image_urls JSON NULL,  -- Array of image URLs
  menu_link TEXT NULL,  -- External link URL
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_business_id (business_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Branch Menus Table REMOVED - Menus belong to business, all branches share them

-- Opening Hours Table (Business or Branch level)
CREATE TABLE IF NOT EXISTS opening_hours (
  id CHAR(36) PRIMARY KEY,
  owner_type ENUM('business','branch') NOT NULL,
  owner_id CHAR(36) NOT NULL,  -- References users.id (business or branch)
  day_of_week ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
  open_time TIME NULL,
  close_time TIME NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_owner (owner_type, owner_id),
  INDEX idx_day (day_of_week),
  UNIQUE KEY unique_owner_day (owner_type, owner_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Policies Table (Business or Branch level)
CREATE TABLE IF NOT EXISTS policies (
  id CHAR(36) PRIMARY KEY,
  owner_type ENUM('business','branch') NOT NULL,
  owner_id CHAR(36) NOT NULL,  -- References users.id (business or branch)
  policy_type ENUM('delivery','refund','cancellation','custom') NOT NULL,
  title VARCHAR(255) NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_owner (owner_type, owner_id),
  INDEX idx_policy_type (policy_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Branches Table REMOVED - Branches are now stored in users table with user_type='branch'
