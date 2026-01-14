// Migration script to add quantity field to items table
require('dotenv').config();
const mysql = require('mysql2/promise');

async function addQuantityToItems() {
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
      AND TABLE_NAME = 'items' 
      AND COLUMN_NAME = 'quantity'
    `);
    
    if (columns.length > 0) {
      console.log('✅ quantity column already exists in items table');
      return;
    }
    
    // Add quantity column
    console.log('Adding quantity column to items table...');
    await connection.query(`
      ALTER TABLE items 
      ADD COLUMN quantity INT NULL AFTER duration_minutes
    `);
    
    console.log('✅ Successfully added quantity column to items table!');
    console.log('Note: NULL means unlimited availability, 1 means single instance, >1 means multiple instances');
    
  } catch (error) {
    console.error('❌ Error adding quantity column:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ quantity column already exists');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addQuantityToItems()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
