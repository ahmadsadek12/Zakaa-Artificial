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

  // Disable foreign key checks temporarily to avoid constraint errors
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  // Check and add users table columns (check if they exist first)
  const [columns] = await conn.query(\`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME IN 
    ('google_maps_link', 'carrier_phone_number', 'estimated_delivery_time_min', 
     'estimated_delivery_time_max', 'contract_file_url', 'contract_status', 
     'contract_approved_at', 'username', 'google_calendar_integration_json')
  \`, [process.env.MYSQL_DATABASE || 'zakaa_db']);
  
  const existingColumns = columns.map(c => c.COLUMN_NAME);
  
  if (!existingColumns.includes('google_maps_link')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN google_maps_link TEXT NULL
    \`).catch(e => console.log('google_maps_link:', e.message));
  }

  if (!existingColumns.includes('carrier_phone_number')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN carrier_phone_number VARCHAR(20) NULL
    \`).catch(e => console.log('carrier_phone_number:', e.message));
  }

  if (!existingColumns.includes('estimated_delivery_time_min')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN estimated_delivery_time_min INT NULL
    \`).catch(e => console.log('estimated_delivery_time_min:', e.message));
  }

  if (!existingColumns.includes('estimated_delivery_time_max')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN estimated_delivery_time_max INT NULL
    \`).catch(e => console.log('estimated_delivery_time_max:', e.message));
  }

  if (!existingColumns.includes('contract_file_url')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN contract_file_url TEXT NULL
    \`).catch(e => console.log('contract_file_url:', e.message));
  }

  if (!existingColumns.includes('contract_status')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN contract_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'
    \`).catch(e => console.log('contract_status:', e.message));
  }

  if (!existingColumns.includes('contract_approved_at')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN contract_approved_at TIMESTAMP NULL
    \`).catch(e => console.log('contract_approved_at:', e.message));
  }

  if (!existingColumns.includes('username')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN username VARCHAR(100) UNIQUE NULL
    \`).catch(e => console.log('username:', e.message));
  }

  if (!existingColumns.includes('google_calendar_integration_json')) {
    await conn.query(\`
      ALTER TABLE users 
      ADD COLUMN google_calendar_integration_json JSON NULL
    \`).catch(e => console.log('google_calendar_integration_json:', e.message));
  }

  // Add items table columns
  const [itemColumns] = await conn.query(\`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME IN 
    ('service_type', 'availability_status', 'stock_quantity', 'only_scheduled', 
     'reminder_minutes_before', 'category_id')
  \`, [process.env.MYSQL_DATABASE || 'zakaa_db']);
  
  const existingItemColumns = itemColumns.map(c => c.COLUMN_NAME);

  if (!existingItemColumns.includes('service_type')) {
    await conn.query(\`
      ALTER TABLE items 
      ADD COLUMN service_type ENUM('physical','time_based') NOT NULL DEFAULT 'physical'
    \`).catch(e => console.log('service_type:', e.message));
  }

  if (!existingItemColumns.includes('availability_status')) {
    await conn.query(\`
      ALTER TABLE items 
      ADD COLUMN availability_status ENUM('available','unavailable','hidden') NOT NULL DEFAULT 'available'
    \`).catch(e => console.log('availability_status:', e.message));
  }

  if (!existingItemColumns.includes('stock_quantity')) {
    await conn.query(\`
      ALTER TABLE items 
      ADD COLUMN stock_quantity INT NULL
    \`).catch(e => console.log('stock_quantity:', e.message));
  }

  if (!existingItemColumns.includes('only_scheduled')) {
    await conn.query(\`
      ALTER TABLE items 
      ADD COLUMN only_scheduled BOOLEAN NOT NULL DEFAULT false
    \`).catch(e => console.log('only_scheduled:', e.message));
  }

  if (!existingItemColumns.includes('reminder_minutes_before')) {
    await conn.query(\`
      ALTER TABLE items 
      ADD COLUMN reminder_minutes_before INT NULL
    \`).catch(e => console.log('reminder_minutes_before:', e.message));
  }

  if (!existingItemColumns.includes('category_id')) {
    await conn.query(\`
      ALTER TABLE items 
      ADD COLUMN category_id CHAR(36) NULL
    \`).catch(e => console.log('category_id:', e.message));
  }

  // Add menus table columns
  const [menuColumns] = await conn.query(\`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'menus' AND COLUMN_NAME IN 
    ('sort_order', 'menu_type')
  \`, [process.env.MYSQL_DATABASE || 'zakaa_db']);
  
  const existingMenuColumns = menuColumns.map(c => c.COLUMN_NAME);

  if (!existingMenuColumns.includes('sort_order')) {
    await conn.query(\`
      ALTER TABLE menus 
      ADD COLUMN sort_order INT NOT NULL DEFAULT 0
    \`).catch(e => console.log('menus.sort_order:', e.message));
  }

  if (!existingMenuColumns.includes('menu_type')) {
    await conn.query(\`
      ALTER TABLE menus 
      ADD COLUMN menu_type VARCHAR(50) NULL
    \`).catch(e => console.log('menus.menu_type:', e.message));
  }

  // Add tables table columns
  const [tableColumns] = await conn.query(\`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tables' AND COLUMN_NAME IN 
    ('is_active', 'label')
  \`, [process.env.MYSQL_DATABASE || 'zakaa_db']);
  
  const existingTableColumns = tableColumns.map(c => c.COLUMN_NAME);

  if (!existingTableColumns.includes('is_active')) {
    await conn.query(\`
      ALTER TABLE tables 
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true
    \`).catch(e => console.log('tables.is_active:', e.message));
  }

  if (!existingTableColumns.includes('label')) {
    await conn.query(\`
      ALTER TABLE tables 
      ADD COLUMN label VARCHAR(100) NULL
    \`).catch(e => console.log('tables.label:', e.message));
  }

  // Add reservations table columns
  const [reservationColumns] = await conn.query(\`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reservations' AND COLUMN_NAME IN 
    ('reservation_kind', 'start_at', 'source')
  \`, [process.env.MYSQL_DATABASE || 'zakaa_db']);
  
  const existingReservationColumns = reservationColumns.map(c => c.COLUMN_NAME);

  if (!existingReservationColumns.includes('reservation_kind')) {
    await conn.query(\`
      ALTER TABLE reservations 
      ADD COLUMN reservation_kind ENUM('table','appointment') NOT NULL DEFAULT 'table'
    \`).catch(e => console.log('reservations.reservation_kind:', e.message));
  }

  if (!existingReservationColumns.includes('start_at')) {
    await conn.query(\`
      ALTER TABLE reservations 
      ADD COLUMN start_at TIMESTAMP NULL
    \`).catch(e => console.log('reservations.start_at:', e.message));
  }

  if (!existingReservationColumns.includes('source')) {
    await conn.query(\`
      ALTER TABLE reservations 
      ADD COLUMN source ENUM('whatsapp','telegram','instagram','facebook','dashboard') NOT NULL DEFAULT 'whatsapp'
    \`).catch(e => console.log('reservations.source:', e.message));
  }

  // Re-enable foreign key checks
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

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
