// Migration: Add Subscriptions Table
// Run with: node database/add_subscriptions_table.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function addSubscriptionsTable() {
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

    // Check if table already exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'subscriptions'
    `, [MYSQL_DATABASE || 'zakaa_db']);

    if (tables.length > 0) {
      console.log('⚠️  Subscriptions table already exists. Skipping creation.');
      return;
    }

    // Create subscriptions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT NULL,
        sale DECIMAL(5,2) NULL DEFAULT 0.00 COMMENT 'Sale percentage (e.g., 10.00 for 10%)',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        
        INDEX idx_name (name),
        INDEX idx_price (price),
        INDEX idx_deleted_at (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    console.log('✅ Subscriptions table created successfully');

  } catch (error) {
    console.error('❌ Error creating subscriptions table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run migration
addSubscriptionsTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
