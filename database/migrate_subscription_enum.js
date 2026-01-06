// Migration script to update subscription_type ENUM
// Run: node database/migrate_subscription_enum.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'zakaa_db',
  multipleStatements: true
};

async function migrateSubscriptionEnum() {
  let connection;
  
  try {
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL server');
    
    // Check current ENUM values
    const [columns] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_type'
    `, [MYSQL_CONFIG.database]);
    
    if (columns.length > 0) {
      console.log('Current subscription_type:', columns[0].COLUMN_TYPE);
    }
    
    // Update any existing 'free' or 'basic' values to 'standard'
    console.log('\nUpdating existing subscription values...');
    const [updateResult] = await connection.query(`
      UPDATE users 
      SET subscription_type = 'standard' 
      WHERE subscription_type IN ('free', 'basic')
    `);
    console.log(`✓ Updated ${updateResult.affectedRows} records from 'free'/'basic' to 'standard'`);
    
    // Update any existing 'enterprise' values to 'premium'
    const [updateEnterprise] = await connection.query(`
      UPDATE users 
      SET subscription_type = 'premium' 
      WHERE subscription_type = 'enterprise'
    `);
    console.log(`✓ Updated ${updateEnterprise.affectedRows} records from 'enterprise' to 'premium'`);
    
    // Alter the ENUM type
    console.log('\nAltering subscription_type ENUM...');
    await connection.query(`
      ALTER TABLE users 
      MODIFY COLUMN subscription_type ENUM('standard', 'premium') DEFAULT 'standard'
    `);
    console.log('✓ Updated subscription_type ENUM to (standard, premium)');
    
    // Verify the change
    const [newColumns] = await connection.query(`
      SELECT COLUMN_TYPE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_type'
    `, [MYSQL_CONFIG.database]);
    
    if (newColumns.length > 0) {
      console.log('\n=== Verification ===');
      console.log('New subscription_type:', newColumns[0].COLUMN_TYPE);
      console.log('Default value:', newColumns[0].COLUMN_DEFAULT);
    }
    
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
  migrateSubscriptionEnum()
    .then(() => {
      console.log('\n✅ Subscription ENUM migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateSubscriptionEnum };
