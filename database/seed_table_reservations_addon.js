// Seed Table Reservations Add-On
// Creates addon entry in addons table and subscription entry in subscriptions table
// Run with: node database/seed_table_reservations_addon.js

require('dotenv').config();
const mysql = require('mysql2/promise');
const { generateUUID } = require('../src/utils/uuid');

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function seedTableReservationsAddon() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: MYSQL_HOST || '127.0.0.1',
      port: MYSQL_PORT || 3306,
      user: MYSQL_USER || 'root',
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE || 'zakaa_db'
    });

    console.log('✅ Connected to MySQL database');

    // Step 1: Check if addon already exists
    const [existingAddons] = await connection.query(`
      SELECT id FROM addons WHERE addon_key = 'table_reservations'
    `);

    let addonId;
    if (existingAddons.length > 0) {
      addonId = existingAddons[0].id;
      console.log('⚠️  Addon "table_reservations" already exists. Skipping creation.');
    } else {
      // Create addon entry
      addonId = generateUUID();
      await connection.query(`
        INSERT INTO addons (id, addon_key, name, default_price, is_active)
        VALUES (?, ?, ?, ?, ?)
      `, [
        addonId,
        'table_reservations',
        'Table Reservations',
        15.00,
        true
      ]);
      console.log('✅ Created addon entry: table_reservations');
    }

    // Step 2: Check if subscription already exists
    const [existingSubscriptions] = await connection.query(`
      SELECT id FROM subscriptions WHERE name = 'Tables'
    `);

    if (existingSubscriptions.length > 0) {
      console.log('⚠️  Subscription "Tables" already exists. Skipping creation.');
    } else {
      // Create subscription entry for UI display
      const subscriptionId = generateUUID();
      await connection.query(`
        INSERT INTO subscriptions (id, name, price, description, sale)
        VALUES (?, ?, ?, ?, ?)
      `, [
        subscriptionId,
        'Tables',
        15.00,
        'You now have access to reserving tables, and the choice of having Zakaa automatically reserve them for you!',
        0.00
      ]);
      console.log('✅ Created subscription entry: Tables');
    }

    console.log('✅ Seeding completed successfully');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run seeding
seedTableReservationsAddon()
  .then(() => {
    console.log('✅ Seed script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed script failed:', error);
    process.exit(1);
  });
