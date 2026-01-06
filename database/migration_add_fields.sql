-- Migration: Add opening hours, location, policies, and subscription fields
-- Run this after the initial schema is created

USE zakaa_db;

-- Create locations table if it doesn't exist
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
