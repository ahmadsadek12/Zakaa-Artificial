// Migration: Add Reservation Tracking Fields
// Run with: node database/add_reservation_tracking.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function addReservationTracking() {
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
        AND TABLE_NAME = 'reservations' 
        AND COLUMN_NAME IN ('no_show', 'checked_in_at')
    `, [MYSQL_DATABASE || 'zakaa_db']);

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    
    if (existingColumns.includes('no_show') && existingColumns.includes('checked_in_at')) {
      console.log('⚠️  Reservation tracking columns already exist. Skipping.');
      return;
    }

    // Add columns if they don't exist
    if (!existingColumns.includes('no_show')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN no_show BOOLEAN NOT NULL DEFAULT false AFTER status,
        ADD INDEX idx_no_show (no_show)
      `);
      console.log('✅ Added no_show column');
    }

    if (!existingColumns.includes('checked_in_at')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN checked_in_at TIMESTAMP NULL AFTER no_show,
        ADD INDEX idx_checked_in_at (checked_in_at)
      `);
      console.log('✅ Added checked_in_at column');
    }

    console.log('✅ Reservation tracking columns added successfully');

  } catch (error) {
    console.error('❌ Error adding reservation tracking:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run migration
addReservationTracking()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
