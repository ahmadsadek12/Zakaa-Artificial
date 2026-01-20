// Major System Update Migration Script
// Migrates data: WhatsApp to bot_integrations, seeds addons, sets contract status, etc.
// Run: node database/migrate_major_update.js

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { generateUUID } = require('../src/utils/uuid');
const { encryptToken } = require('../utils/encryption');
require('dotenv').config();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'zakaa_db',
  multipleStatements: true
};

async function columnExists(connection, tableName, columnName) {
  const [columns] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [MYSQL_CONFIG.database, tableName, columnName]
  );
  return columns[0].count > 0;
}

async function tableExists(connection, tableName) {
  const [tables] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [MYSQL_CONFIG.database, tableName]
  );
  return tables[0].count > 0;
}

async function runMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL server');
    
    // First, run the SQL migration file
    console.log('\n=== Running SQL Migration ===');
    const sqlFile = path.join(__dirname, 'migration_major_update.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('USE ')) {
        try {
          await connection.query(trimmed);
        } catch (error) {
          // Ignore "Duplicate column" and "already exists" errors
          if (error.message.includes('Duplicate column') || 
              error.message.includes('Duplicate key name') ||
              error.message.includes('already exists') ||
              error.message.includes('Duplicate entry')) {
            // Silently ignore - these are expected on re-runs
          } else {
            // Show actual errors that might prevent table creation
            console.error(`SQL Error executing statement: ${error.message}`);
            console.error(`Statement: ${trimmed.substring(0, 100)}...`);
            // Don't throw - continue with other statements
          }
        }
      }
    }
    console.log('✓ SQL migration completed');
    
    // Verify critical tables were created
    console.log('\n=== Verifying Tables ===');
    const botIntegrationsExists = await tableExists(connection, 'bot_integrations');
    if (!botIntegrationsExists) {
      throw new Error('bot_integrations table was not created. Please check the SQL migration file.');
    }
    console.log('✓ bot_integrations table exists');
    
    const addonsExists = await tableExists(connection, 'addons');
    if (!addonsExists) {
      throw new Error('addons table was not created. Please check the SQL migration file.');
    }
    console.log('✓ addons table exists');
    
    // ========================================================================
    // DATA MIGRATION
    // ========================================================================
    
    console.log('\n=== Data Migration ===');
    
    // 1. Migrate existing WhatsApp data from users to bot_integrations
    console.log('1. Migrating WhatsApp data to bot_integrations...');
    const [businesses] = await connection.query(
      `SELECT id, user_type, whatsapp_phone_number, whatsapp_phone_number_id, whatsapp_access_token_encrypted 
       FROM users 
       WHERE user_type IN ('business', 'branch') 
       AND (whatsapp_phone_number IS NOT NULL OR whatsapp_phone_number_id IS NOT NULL)`
    );
    
    let migrated = 0;
    for (const business of businesses) {
      // Check if integration already exists
      const [existing] = await connection.query(
        `SELECT id FROM bot_integrations 
         WHERE owner_type = ? AND owner_id = ? AND platform = 'whatsapp'`,
        [business.user_type === 'branch' ? 'branch' : 'business', business.id]
      );
      
      if (existing.length === 0 && (business.whatsapp_phone_number_id || business.whatsapp_phone_number)) {
        const integrationId = generateUUID();
        const configJson = JSON.stringify({
          migrated: true,
          migrated_at: new Date().toISOString()
        });
        
        await connection.query(
          `INSERT INTO bot_integrations 
           (id, owner_type, owner_id, platform, enabled, config_json, 
            access_token_encrypted, phone_number, phone_number_id) 
           VALUES (?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?)`,
          [
            integrationId,
            business.user_type === 'branch' ? 'branch' : 'business',
            business.id,
            business.whatsapp_phone_number_id ? true : false, // Enable if phone_number_id exists
            configJson,
            business.whatsapp_access_token_encrypted || null,
            business.whatsapp_phone_number || null,
            business.whatsapp_phone_number_id || null
          ]
        );
        migrated++;
      }
    }
    console.log(`✓ Migrated ${migrated} WhatsApp integrations`);
    
    // 2. Create default bot_integrations rows for all businesses (4 platforms, enabled=false)
    console.log('2. Creating default bot_integrations for all businesses...');
    const [allBusinesses] = await connection.query(
      `SELECT id FROM users WHERE user_type = 'business' AND deleted_at IS NULL`
    );
    
    const platforms = ['whatsapp', 'telegram', 'instagram', 'facebook'];
    let created = 0;
    
    for (const business of allBusinesses) {
      for (const platform of platforms) {
        // Check if exists
        const [existing] = await connection.query(
          `SELECT id FROM bot_integrations 
           WHERE owner_type = 'business' AND owner_id = ? AND platform = ?`,
          [business.id, platform]
        );
        
        if (existing.length === 0) {
          const integrationId = generateUUID();
          await connection.query(
            `INSERT INTO bot_integrations 
             (id, owner_type, owner_id, platform, enabled, config_json) 
             VALUES (?, 'business', ?, ?, false, '{}')`,
            [integrationId, business.id, platform]
          );
          created++;
        }
      }
    }
    console.log(`✓ Created ${created} default bot integrations`);
    
    // 3. Seed addons table
    console.log('3. Seeding addons table...');
    const requiredAddons = [
      { key: 'base_bot', name: 'Base Bot', price: 0 },
      { key: 'analytics_free', name: 'Free Analytics', price: 0 },
      { key: 'analytics_paid_loyal_customer', name: 'Loyal Customer Analytics', price: 0 },
      { key: 'analytics_paid_most_ordered', name: 'Most Ordered Analytics', price: 0 },
      { key: 'analytics_paid_most_rewarding', name: 'Most Rewarding Analytics', price: 0 },
      { key: 'analytics_paid_time_breakdown', name: 'Time Breakdown Analytics', price: 0 },
      { key: 'reservations', name: 'Reservations', price: 0 },
      { key: 'instagram_channel', name: 'Instagram Channel', price: 0 },
      { key: 'telegram_channel', name: 'Telegram Channel', price: 0 },
      { key: 'facebook_channel', name: 'Facebook Channel', price: 0 },
      { key: 'whatsapp_channel', name: 'WhatsApp Channel', price: 0 }
    ];
    
    let seeded = 0;
    for (const addon of requiredAddons) {
      const [existing] = await connection.query(
        `SELECT id FROM addons WHERE addon_key = ?`,
        [addon.key]
      );
      
      if (existing.length === 0) {
        const addonId = generateUUID();
        await connection.query(
          `INSERT INTO addons (id, addon_key, name, default_price, is_active) 
           VALUES (?, ?, ?, ?, true)`,
          [addonId, addon.key, addon.name, addon.price]
        );
        seeded++;
      }
    }
    console.log(`✓ Seeded ${seeded} addons`);
    
    // 4. Set all existing businesses to contract_status='approved' (grandfather clause)
    console.log('4. Setting existing businesses to approved...');
    const [updateResult] = await connection.query(
      `UPDATE users 
       SET contract_status = 'approved', 
           contract_approved_at = CURRENT_TIMESTAMP 
       WHERE user_type = 'business' 
       AND contract_status = 'pending'`
    );
    console.log(`✓ Approved ${updateResult.affectedRows} existing businesses`);
    
    // 5. Activate base_bot and analytics_free for all businesses
    console.log('5. Activating base addons for all businesses...');
    const [baseBotAddon] = await connection.query(
      `SELECT id FROM addons WHERE addon_key = 'base_bot' LIMIT 1`
    );
    const [analyticsFreeAddon] = await connection.query(
      `SELECT id FROM addons WHERE addon_key = 'analytics_free' LIMIT 1`
    );
    
    if (baseBotAddon.length > 0 && analyticsFreeAddon.length > 0) {
      let activated = 0;
      for (const business of allBusinesses) {
        // Activate base_bot
        const [existingBase] = await connection.query(
          `SELECT id FROM business_addons 
           WHERE business_id = ? AND addon_id = ?`,
          [business.id, baseBotAddon[0].id]
        );
        if (existingBase.length === 0) {
          await connection.query(
            `INSERT INTO business_addons (id, business_id, addon_id, status) 
             VALUES (?, ?, ?, 'active')`,
            [generateUUID(), business.id, baseBotAddon[0].id]
          );
        } else {
          await connection.query(
            `UPDATE business_addons SET status = 'active' 
             WHERE business_id = ? AND addon_id = ?`,
            [business.id, baseBotAddon[0].id]
          );
        }
        
        // Activate analytics_free
        const [existingAnalytics] = await connection.query(
          `SELECT id FROM business_addons 
           WHERE business_id = ? AND addon_id = ?`,
          [business.id, analyticsFreeAddon[0].id]
        );
        if (existingAnalytics.length === 0) {
          await connection.query(
            `INSERT INTO business_addons (id, business_id, addon_id, status) 
             VALUES (?, ?, ?, 'active')`,
            [generateUUID(), business.id, analyticsFreeAddon[0].id]
          );
        } else {
          await connection.query(
            `UPDATE business_addons SET status = 'active' 
             WHERE business_id = ? AND addon_id = ?`,
            [business.id, analyticsFreeAddon[0].id]
          );
        }
        activated++;
      }
      console.log(`✓ Activated base addons for ${activated} businesses`);
    }
    
    // 6. Migrate quantity → stock_quantity
    console.log('6. Migrating quantity to stock_quantity...');
    const [quantityUpdate] = await connection.query(
      `UPDATE items 
       SET stock_quantity = quantity 
       WHERE stock_quantity IS NULL AND quantity IS NOT NULL`
    );
    console.log(`✓ Migrated ${quantityUpdate.affectedRows} items`);
    
    // 7. Set default service_type based on is_rental flag
    console.log('7. Setting service_type based on is_rental...');
    const [serviceTypeUpdate] = await connection.query(
      `UPDATE items 
       SET service_type = CASE 
         WHEN is_rental = true THEN 'time_based'
         ELSE 'physical'
       END
       WHERE service_type = 'physical' AND is_rental IS NOT NULL`
    );
    console.log(`✓ Updated ${serviceTypeUpdate.affectedRows} items`);
    
    // 8. Set availability_status from availability
    console.log('8. Migrating availability to availability_status...');
    const [availabilityUpdate] = await connection.query(
      `UPDATE items 
       SET availability_status = CASE 
         WHEN availability = 'available' THEN 'available'
         WHEN availability = 'out_of_stock' THEN 'unavailable'
         WHEN availability = 'hidden' THEN 'hidden'
         ELSE 'available'
       END
       WHERE availability_status = 'available' AND availability IS NOT NULL`
    );
    console.log(`✓ Updated ${availabilityUpdate.affectedRows} items`);
    
    // 9. Set only_scheduled based on is_schedulable
    console.log('9. Setting only_scheduled from is_schedulable...');
    const [scheduledUpdate] = await connection.query(
      `UPDATE items 
       SET only_scheduled = CASE 
         WHEN is_schedulable = true THEN true
         ELSE false
       END
       WHERE only_scheduled = false AND is_schedulable IS NOT NULL`
    );
    console.log(`✓ Updated ${scheduledUpdate.affectedRows} items`);
    
    // 10. Update reservations to set start_at from reservation_date + reservation_time
    console.log('10. Setting start_at for reservations...');
    const [reservationUpdate] = await connection.query(
      `UPDATE reservations 
       SET start_at = CONCAT(reservation_date, ' ', reservation_time)
       WHERE start_at IS NULL AND reservation_date IS NOT NULL AND reservation_time IS NOT NULL`
    );
    console.log(`✓ Updated ${reservationUpdate.affectedRows} reservations`);
    
    // 11. Set request_type for orders with scheduled_for
    console.log('11. Setting request_type for scheduled orders...');
    const [requestTypeUpdate] = await connection.query(
      `UPDATE orders 
       SET request_type = 'scheduled_request'
       WHERE request_type = 'order' AND scheduled_for IS NOT NULL`
    );
    console.log(`✓ Updated ${requestTypeUpdate.affectedRows} orders`);
    
    console.log('\n=== Migration Summary ===');
    console.log(`✓ Migrated ${migrated} WhatsApp integrations`);
    console.log(`✓ Created ${created} default bot integrations`);
    console.log(`✓ Seeded ${seeded} addons`);
    console.log(`✓ Approved ${updateResult.affectedRows} businesses`);
    console.log(`✓ Migrated ${quantityUpdate.affectedRows} item quantities`);
    console.log(`✓ Updated ${serviceTypeUpdate.affectedRows} service types`);
    console.log(`✓ Updated ${availabilityUpdate.affectedRows} availability statuses`);
    console.log(`✓ Updated ${scheduledUpdate.affectedRows} scheduled flags`);
    console.log(`✓ Updated ${reservationUpdate.affectedRows} reservations`);
    console.log(`✓ Updated ${requestTypeUpdate.affectedRows} order request types`);
    
    await connection.end();
    
  } catch (error) {
    console.error('Migration error:', error);
    if (connection) {
      await connection.end();
    }
    throw error;
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
