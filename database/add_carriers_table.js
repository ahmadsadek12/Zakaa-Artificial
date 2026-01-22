// Migration: Add Carriers Table
// Run with: node database/add_carriers_table.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function addCarriersTable() {
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

    // Check if carriers table already exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'carriers'
    `, [MYSQL_DATABASE || 'zakaa_db']);

    if (tables.length > 0) {
      console.log('⚠️  Carriers table already exists. Skipping creation.');
    } else {
      // Create carriers table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS carriers (
          id CHAR(36) PRIMARY KEY,
          user_id CHAR(36) NOT NULL COMMENT 'FK to users (business or branch)',
          business_id CHAR(36) NOT NULL COMMENT 'FK to users (business owner)',
          branch_id CHAR(36) NULL COMMENT 'FK to users (branch, nullable for business-level carriers)',
          name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(20) NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (branch_id) REFERENCES users(id) ON DELETE CASCADE,
          
          INDEX idx_user_id (user_id),
          INDEX idx_business_id (business_id),
          INDEX idx_branch_id (branch_id),
          INDEX idx_is_active (is_active),
          INDEX idx_deleted_at (deleted_at),
          
          -- One carrier per business/branch
          UNIQUE KEY unique_carrier_per_user (user_id, deleted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);

      console.log('✅ Carriers table created successfully');
    }

  } catch (error) {
    console.error('❌ Error creating carriers table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run migration
addCarriersTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
