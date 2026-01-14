// Migration script to add is_reusable field to items table
require('dotenv').config();
const mysql = require('mysql2/promise');

async function addIsReusableToItems() {
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
      AND COLUMN_NAME = 'is_reusable'
    `);
    
    if (columns.length > 0) {
      console.log('✅ is_reusable column already exists in items table');
      return;
    }
    
    // Add is_reusable column
    console.log('Adding is_reusable column to items table...');
    await connection.query(`
      ALTER TABLE items 
      ADD COLUMN is_reusable BOOLEAN DEFAULT true AFTER quantity
    `);
    
    console.log('✅ Successfully added is_reusable column to items table!');
    console.log('Note: true = reusable/reservable (like football fields), false = consumable (like toys)');
    console.log('All existing items default to true (reusable)');
    
  } catch (error) {
    console.error('❌ Error adding is_reusable column:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ is_reusable column already exists');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addIsReusableToItems()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
