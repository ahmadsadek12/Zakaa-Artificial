// Migration script to add item_id field to reservations table
require('dotenv').config();
const mysql = require('mysql2/promise');

async function addItemIdToReservations() {
  let connection;
  
  try {
    // Connect to MySQL
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'zakaa_db'
    });
    
    console.log('Connected to MySQL database');
    
    // Check if column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'reservations' 
      AND COLUMN_NAME = 'item_id'
    `);
    
    if (columns.length > 0) {
      console.log('✅ item_id column already exists in reservations table');
      return;
    }
    
    // Add item_id column
    console.log('Adding item_id column to reservations table...');
    await connection.query(`
      ALTER TABLE reservations 
      ADD COLUMN item_id CHAR(36) NULL AFTER table_id,
      ADD FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
      ADD INDEX idx_item_id (item_id)
    `);
    
    console.log('✅ Successfully added item_id column to reservations table!');
    
  } catch (error) {
    console.error('❌ Error adding item_id column:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ item_id column already exists');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addItemIdToReservations()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
