// Migration: Add Rental Items Support
// Adds is_rental, track_quantity columns to items table
// Creates item_duration_tiers table
// Adds booking fields to order_items table

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'zakaa_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function runMigration() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database');
    
    // Start transaction
    await connection.beginTransaction();
    console.log('Starting migration...');
    
    // 1. Add is_rental and track_quantity to items table
    console.log('1. Adding is_rental and track_quantity columns to items table...');
    try {
      await connection.execute(`
        ALTER TABLE items 
        ADD COLUMN is_rental BOOLEAN DEFAULT false COMMENT 'Items that require time slot booking',
        ADD COLUMN track_quantity BOOLEAN DEFAULT false COMMENT 'Whether to enforce quantity limits (NULL quantity = unlimited)'
      `);
      console.log('✓ Added is_rental and track_quantity columns');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠ Columns already exist, skipping...');
      } else {
        throw error;
      }
    }
    
    // 2. Create item_duration_tiers table
    console.log('2. Creating item_duration_tiers table...');
    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created item_duration_tiers table');
    
    // 3. Add booking fields to order_items table
    console.log('3. Adding booking fields to order_items table...');
    try {
      await connection.execute(`
        ALTER TABLE order_items
        ADD COLUMN booking_date DATE NULL COMMENT 'Date of the rental booking',
        ADD COLUMN booking_start_time TIME NULL COMMENT 'Start time of the rental',
        ADD COLUMN booking_end_time TIME NULL COMMENT 'End time (calculated from start + duration)',
        ADD COLUMN duration_tier_id CHAR(36) NULL COMMENT 'Reference to duration tier used',
        ADD FOREIGN KEY (duration_tier_id) REFERENCES item_duration_tiers(id) ON DELETE SET NULL,
        ADD INDEX idx_booking_date (booking_date),
        ADD INDEX idx_booking_times (booking_start_time, booking_end_time)
      `);
      console.log('✓ Added booking fields to order_items');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠ Booking columns already exist, skipping...');
      } else {
        throw error;
      }
    }
    
    // Commit transaction
    await connection.commit();
    console.log('\n✅ Migration completed successfully!');
    console.log('\nSummary:');
    console.log('- Added is_rental, track_quantity to items table');
    console.log('- Created item_duration_tiers table');
    console.log('- Added booking_date, booking_start_time, booking_end_time, duration_tier_id to order_items');
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.error('❌ Migration failed, rolled back changes');
    }
    console.error('Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
