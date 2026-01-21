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

    // Check if subscriptions table already exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'subscriptions'
    `, [MYSQL_DATABASE || 'zakaa_db']);

    if (tables.length > 0) {
      console.log('⚠️  Subscriptions table already exists. Skipping creation.');
    } else {
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
    }

    // Check if user_subscriptions table already exists
    const [junctionTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_subscriptions'
    `, [MYSQL_DATABASE || 'zakaa_db']);

    if (junctionTables.length > 0) {
      console.log('⚠️  User subscriptions junction table already exists. Skipping creation.');
    } else {
      // Create user_subscriptions junction table (many-to-many)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_subscriptions (
          id CHAR(36) PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          subscription_id CHAR(36) NOT NULL,
          
          -- Subscription details
          status ENUM('active', 'past_due', 'canceled', 'expired') NOT NULL DEFAULT 'active',
          started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ends_at TIMESTAMP NULL,
          
          -- Pricing (snapshot at time of purchase, in case subscription price changes)
          price_paid DECIMAL(10,2) NOT NULL,
          sale_applied DECIMAL(5,2) NULL DEFAULT 0.00,
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
          
          INDEX idx_user_id (user_id),
          INDEX idx_subscription_id (subscription_id),
          INDEX idx_status (status),
          INDEX idx_started_at (started_at),
          INDEX idx_ends_at (ends_at),
          INDEX idx_deleted_at (deleted_at),
          
          -- Prevent duplicate active subscriptions for same user (only for non-deleted records)
          UNIQUE KEY unique_active_user_subscription (user_id, subscription_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);

      console.log('✅ User subscriptions junction table created successfully');
    }

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
