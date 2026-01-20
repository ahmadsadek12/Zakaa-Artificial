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
