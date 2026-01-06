// Migration script to add new fields to existing database
// Run: node database/migrate.js

const fs = require('fs');
const path = require('path');
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

async function columnExists(connection, tableName, columnName) {
  const [columns] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [MYSQL_CONFIG.database, tableName, columnName]
  );
  return columns[0].count > 0;
}

async function tableExists(connection, tableName) {
  const [tables] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [MYSQL_CONFIG.database, tableName]
  );
  return tables[0].count > 0;
}

async function foreignKeyExists(connection, tableName, constraintName) {
  const [constraints] = await connection.query(
    `SELECT COUNT(*) as count FROM information_schema.TABLE_CONSTRAINTS 
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [MYSQL_CONFIG.database, tableName, constraintName]
  );
  return constraints[0].count > 0;
}

async function runMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL server');
    
    // Create locations table if it doesn't exist
    const locationsExists = await tableExists(connection, 'locations');
    if (!locationsExists) {
      console.log('Creating locations table...');
      const createLocations = `
        CREATE TABLE locations (
          id CHAR(36) PRIMARY KEY,
          city VARCHAR(100) NOT NULL,
          street VARCHAR(255) NOT NULL,
          building VARCHAR(100),
          floor VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_city (city)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      await connection.query(createLocations);
      console.log('✓ Locations table created');
    } else {
      console.log('✓ Locations table already exists');
    }
    
    // Add subscription fields to users table
    console.log('\nUpdating users table...');
    
    if (!(await columnExists(connection, 'users', 'subscription_type'))) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN subscription_type ENUM('standard', 'premium') DEFAULT 'standard' AFTER last_name
      `);
      console.log('✓ Added subscription_type to users');
    }
    
    if (!(await columnExists(connection, 'users', 'subscription_price'))) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN subscription_price DECIMAL(10,2) DEFAULT 0 AFTER subscription_type
      `);
      console.log('✓ Added subscription_price to users');
    }
    
    if (!(await columnExists(connection, 'users', 'location_id'))) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN location_id CHAR(36) AFTER subscription_price
      `);
      console.log('✓ Added location_id to users');
    }
    
    // Add foreign key for location_id in users
    if (!(await foreignKeyExists(connection, 'users', 'users_ibfk_location'))) {
      await connection.query(`
        ALTER TABLE users 
        ADD CONSTRAINT users_ibfk_location 
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
      `);
      console.log('✓ Added foreign key for users.location_id');
    }
    
    // Add indexes
    try {
      await connection.query('CREATE INDEX idx_subscription_type ON users(subscription_type)');
      console.log('✓ Added index on subscription_type');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    
    try {
      await connection.query('CREATE INDEX idx_users_location_id ON users(location_id)');
      console.log('✓ Added index on users.location_id');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    
    // Add fields to branches table
    console.log('\nUpdating branches table...');
    
    if (!(await columnExists(connection, 'branches', 'opening_hours'))) {
      await connection.query(`
        ALTER TABLE branches 
        ADD COLUMN opening_hours JSON AFTER whatsapp_access_token_encrypted
      `);
      console.log('✓ Added opening_hours to branches');
    }
    
    if (!(await columnExists(connection, 'branches', 'policies_and_rules'))) {
      await connection.query(`
        ALTER TABLE branches 
        ADD COLUMN policies_and_rules TEXT AFTER opening_hours
      `);
      console.log('✓ Added policies_and_rules to branches');
    }
    
    if (!(await columnExists(connection, 'branches', 'location_id'))) {
      await connection.query(`
        ALTER TABLE branches 
        ADD COLUMN location_id CHAR(36) AFTER policies_and_rules
      `);
      console.log('✓ Added location_id to branches');
    }
    
    // Add foreign key for location_id in branches
    if (!(await foreignKeyExists(connection, 'branches', 'branches_ibfk_location'))) {
      await connection.query(`
        ALTER TABLE branches 
        ADD CONSTRAINT branches_ibfk_location 
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
      `);
      console.log('✓ Added foreign key for branches.location_id');
    }
    
    // Add index for location_id in branches
    try {
      await connection.query('CREATE INDEX idx_branches_location_id ON branches(location_id)');
      console.log('✓ Added index on branches.location_id');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    
    // Verify changes
    console.log('\n=== Verification ===');
    const [usersColumns] = await connection.query('DESCRIBE users');
    const [branchesColumns] = await connection.query('DESCRIBE branches');
    const locationsTableExists = await tableExists(connection, 'locations');
    
    console.log('✓ Locations table exists:', locationsTableExists);
    console.log('✓ Users has subscription_type:', 
      usersColumns.some(c => c.Field === 'subscription_type'));
    console.log('✓ Users has location_id:', 
      usersColumns.some(c => c.Field === 'location_id'));
    console.log('✓ Branches has opening_hours:', 
      branchesColumns.some(c => c.Field === 'opening_hours'));
    console.log('✓ Branches has policies_and_rules:', 
      branchesColumns.some(c => c.Field === 'policies_and_rules'));
    console.log('✓ Branches has location_id:', 
      branchesColumns.some(c => c.Field === 'location_id'));
    
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
  runMigration()
    .then(() => {
      console.log('\n✅ Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
