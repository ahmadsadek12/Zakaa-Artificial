// Migration: Add Delivery Time Tracking to Orders
// Run with: node database/add_delivery_tracking.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function addDeliveryTracking() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: MYSQL_HOST || '127.0.0.1',
      port: MYSQL_PORT || 3306,
      user: MYSQL_USER || 'root',
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE || 'zakaa_db',
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL database');

    // Check if columns already exist
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME IN ('delivery_started_at', 'delivery_completed_at', 'carrier_id')
    `, [MYSQL_DATABASE || 'zakaa_db']);

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    
    if (existingColumns.includes('delivery_started_at') && 
        existingColumns.includes('delivery_completed_at') && 
        existingColumns.includes('carrier_id')) {
      console.log('⚠️  Delivery tracking columns already exist. Skipping.');
      return;
    }

    // Add columns if they don't exist
    if (!existingColumns.includes('delivery_started_at')) {
      await connection.query(`
        ALTER TABLE orders
        ADD COLUMN delivery_started_at TIMESTAMP NULL AFTER completed_at
      `);
      console.log('✅ Added delivery_started_at column');
    }

    if (!existingColumns.includes('delivery_completed_at')) {
      await connection.query(`
        ALTER TABLE orders
        ADD COLUMN delivery_completed_at TIMESTAMP NULL AFTER delivery_started_at
      `);
      console.log('✅ Added delivery_completed_at column');
    }

    if (!existingColumns.includes('carrier_id')) {
      // First check if carriers table exists
      const [carrierTables] = await connection.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'carriers'
      `, [MYSQL_DATABASE || 'zakaa_db']);

      if (carrierTables.length > 0) {
        await connection.query(`
          ALTER TABLE orders
          ADD COLUMN carrier_id CHAR(36) NULL AFTER delivery_completed_at,
          ADD INDEX idx_carrier_id (carrier_id),
          ADD CONSTRAINT fk_order_carrier FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL
        `);
        console.log('✅ Added carrier_id column with foreign key');
      } else {
        // Add column without FK if carriers table doesn't exist yet
        await connection.query(`
          ALTER TABLE orders
          ADD COLUMN carrier_id CHAR(36) NULL AFTER delivery_completed_at,
          ADD INDEX idx_carrier_id (carrier_id)
        `);
        console.log('✅ Added carrier_id column (FK will be added when carriers table is created)');
      }
    }

    // Add indexes
    if (!existingColumns.includes('delivery_started_at')) {
      await connection.query(`ALTER TABLE orders ADD INDEX idx_delivery_started_at (delivery_started_at)`);
    }
    if (!existingColumns.includes('delivery_completed_at')) {
      await connection.query(`ALTER TABLE orders ADD INDEX idx_delivery_completed_at (delivery_completed_at)`);
    }

    console.log('✅ Delivery tracking columns added successfully');

  } catch (error) {
    console.error('❌ Error adding delivery tracking:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run migration
addDeliveryTracking()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
