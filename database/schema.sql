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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users Table (Single Table, Multi-Role)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  user_type ENUM('admin', 'business', 'customer') NOT NULL,
  
  -- Shared fields
  email VARCHAR(255) UNIQUE,
  contact_phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Business-only fields (nullable)
  business_name VARCHAR(255),
  business_type ENUM('restaurant', 'sports_court', 'salon', 'other'),
  whatsapp_phone_number VARCHAR(20),
  whatsapp_phone_number_id VARCHAR(255),
  whatsapp_access_token_encrypted TEXT,
  
  -- Customer-only fields (nullable)
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Subscription fields (for businesses)
  subscription_type ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
  subscription_price DECIMAL(10,2) DEFAULT 0,
  
  -- Location reference
  location_id CHAR(36),
  
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  INDEX idx_user_type (user_type),
  INDEX idx_email (email),
  INDEX idx_is_active (is_active),
  INDEX idx_subscription_type (subscription_type),
  INDEX idx_location_id (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Branches Table (Business → Many Branches)
CREATE TABLE IF NOT EXISTS branches (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  
  branch_name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  
  menu_image_url TEXT,
  
  contact_phone_number VARCHAR(20),
  whatsapp_phone_number VARCHAR(20),
  whatsapp_phone_number_id VARCHAR(255),
  whatsapp_access_token_encrypted TEXT,
  
  -- Opening hours (stored as JSON for flexibility)
  -- Format: {"monday": {"open": "09:00", "close": "17:00", "closed": false}, ...}
  opening_hours JSON,
  
  -- Policies and rules
  policies_and_rules TEXT,
  
  -- Location reference
  location_id CHAR(36),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  INDEX idx_business_id (business_id),
  INDEX idx_is_active (is_active),
  INDEX idx_location_id (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items Table (Belongs to Business + Optional Branch)
CREATE TABLE IF NOT EXISTS items (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  branch_id CHAR(36),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  
  preparation_time_minutes INT,
  
  availability ENUM('available', 'out_of_stock', 'hidden') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  INDEX idx_business_id (business_id),
  INDEX idx_branch_id (branch_id),
  INDEX idx_availability (availability)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Item Ingredients Table (Optional Normalization)
CREATE TABLE IF NOT EXISTS item_ingredients (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  ingredient_name VARCHAR(255) NOT NULL,
  
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders Table (Transactional, Short-Lived)
CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  business_id CHAR(36) NOT NULL,
  branch_id CHAR(36) NOT NULL,
  
  status ENUM(
    'pending',
    'accepted',
    'preparing',
    'completed',
    'cancelled'
  ) DEFAULT 'pending',
  
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  delivery_type ENUM('takeaway', 'delivery', 'on_site') NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  INDEX idx_customer_id (customer_id),
  INDEX idx_business_id (business_id),
  INDEX idx_branch_id (branch_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Items Table (Many-to-Many with Price Snapshots)
CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  
  quantity INT NOT NULL DEFAULT 1,
  price_at_time DECIMAL(10,2) NOT NULL,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  INDEX idx_order_id (order_id),
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

