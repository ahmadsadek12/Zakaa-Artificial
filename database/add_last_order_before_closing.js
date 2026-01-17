// Migration script to add last_order_before_closing_minutes column to users table
require('dotenv').config();
const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addLastOrderBeforeClosing() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check if column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'last_order_before_closing_minutes'
    `);
    
    if (columns.length > 0) {
      logger.info('✅ last_order_before_closing_minutes column already exists in users table');
      return;
    }
    
    // Add column
    logger.info('Adding last_order_before_closing_minutes column to users table...');
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN last_order_before_closing_minutes INT NULL DEFAULT 30 AFTER delivery_price
    `);
    
    logger.info('✅ Successfully added last_order_before_closing_minutes column to users table!');
    
    // Set default value of 30 minutes for existing users
    await connection.query(`
      UPDATE users 
      SET last_order_before_closing_minutes = 30
      WHERE last_order_before_closing_minutes IS NULL AND user_type IN ('business', 'branch');
    `);
    logger.info('✅ Set default last_order_before_closing_minutes of 30 for all existing businesses/branches');
    
    logger.info('Done!');
  } catch (error) {
    logger.error('Error adding last_order_before_closing_minutes to users table:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

addLastOrderBeforeClosing();
