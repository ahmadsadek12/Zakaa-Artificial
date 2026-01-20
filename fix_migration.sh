#!/bin/bash
# Quick fix for missing tables
cd ~/zakaa

echo "=== Creating missing tables ==="
node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'zakaa_db',
    multipleStatements: true
  });

  // Create bot_integrations table
  await conn.query(\`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  \`).catch(e => console.log('bot_integrations:', e.message));

  // Add request_type to orders
  await conn.query(\`
    ALTER TABLE orders 
    ADD COLUMN request_type ENUM('order','scheduled_request') NOT NULL DEFAULT 'order' AFTER scheduled_for
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('request_type:', e.message);
  });

  await conn.query(\`
    ALTER TABLE orders 
    ADD COLUMN first_response_at TIMESTAMP NULL AFTER request_type
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('first_response_at:', e.message);
  });

  await conn.query(\`
    ALTER TABLE orders 
    ADD COLUMN source_message_id VARCHAR(255) NULL AFTER first_response_at
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('source_message_id:', e.message);
  });

  // Create addons table
  await conn.query(\`
    CREATE TABLE IF NOT EXISTS addons (
      id CHAR(36) PRIMARY KEY,
      addon_key VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_addon_key (addon_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  \`).catch(e => console.log('addons:', e.message));

  // Create business_addons table
  await conn.query(\`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  \`).catch(e => console.log('business_addons:', e.message));

  // Create service_categories table
  await conn.query(\`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  \`).catch(e => console.log('service_categories:', e.message));

  // Create service_customizations table
  await conn.query(\`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  \`).catch(e => console.log('service_customizations:', e.message));

  // Add users table columns
  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN google_maps_link TEXT NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('google_maps_link:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN carrier_phone_number VARCHAR(20) NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('carrier_phone_number:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN estimated_delivery_time_min INT NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('estimated_delivery_time_min:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN estimated_delivery_time_max INT NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('estimated_delivery_time_max:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN contract_file_url TEXT NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('contract_file_url:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN contract_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('contract_status:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN contract_approved_at TIMESTAMP NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('contract_approved_at:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN username VARCHAR(100) UNIQUE NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('username:', e.message);
  });

  await conn.query(\`
    ALTER TABLE users 
    ADD COLUMN google_calendar_integration_json JSON NULL
  \`).catch(e => {
    if (!e.message.includes('Duplicate column')) console.log('google_calendar_integration_json:', e.message);
  });

  await conn.end();
  console.log('✓ Tables created/updated');
})();
"

echo ""
echo "=== Running data migration ==="
node database/migrate_major_update.js

echo ""
echo "=== Restarting PM2 ==="
pm2 restart zakaa
