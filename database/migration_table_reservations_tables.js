// Migration Script: Update Tables Table for Table Reservations
// Run with: node database/migration_table_reservations_tables.js

require('dotenv').config();
const mysql = require('mysql2/promise');
const { generateUUID } = require('../src/utils/uuid');

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function migrateTablesTable() {
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
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tables' AND COLUMN_NAME IN ('business_id', 'owner_user_id', 'table_number', 'min_seats', 'max_seats', 'position_label', 'position_notes')
    `, [MYSQL_DATABASE || 'zakaa_db']);

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    
    // Step 1: Add new columns if they don't exist
    if (!existingColumns.includes('business_id')) {
      await connection.query(`
        ALTER TABLE tables
        ADD COLUMN business_id CHAR(36) NULL AFTER id
      `);
      console.log('✅ Added business_id column');
    }

    if (!existingColumns.includes('owner_user_id')) {
      await connection.query(`
        ALTER TABLE tables
        ADD COLUMN owner_user_id CHAR(36) NULL AFTER business_id
      `);
      console.log('✅ Added owner_user_id column');
    }

    if (!existingColumns.includes('table_number')) {
      await connection.query(`
        ALTER TABLE tables
        ADD COLUMN table_number VARCHAR(50) NULL AFTER owner_user_id
      `);
      console.log('✅ Added table_number column');
    }

    if (!existingColumns.includes('min_seats')) {
      await connection.query(`
        ALTER TABLE tables
        ADD COLUMN min_seats INT NULL AFTER table_number
      `);
      console.log('✅ Added min_seats column');
    }

    if (!existingColumns.includes('max_seats')) {
      await connection.query(`
        ALTER TABLE tables
        ADD COLUMN max_seats INT NULL AFTER min_seats
      `);
      console.log('✅ Added max_seats column');
    }

    if (!existingColumns.includes('position_label')) {
      await connection.query(`
        ALTER TABLE tables
        ADD COLUMN position_label VARCHAR(100) NULL AFTER max_seats
      `);
      console.log('✅ Added position_label column');
    }

    if (!existingColumns.includes('position_notes')) {
      await connection.query(`
        ALTER TABLE tables
        ADD COLUMN position_notes TEXT NULL AFTER position_label
      `);
      console.log('✅ Added position_notes column');
    }

    // Step 2: Migrate existing data
    const [tablesToMigrate] = await connection.query(`
      SELECT t.id, t.user_id, t.number, t.seats, u.parent_user_id
      FROM tables t
      INNER JOIN users u ON t.user_id = u.id
      WHERE t.owner_user_id IS NULL OR t.business_id IS NULL OR t.table_number IS NULL
    `);

    if (tablesToMigrate.length > 0) {
      console.log(`📦 Migrating ${tablesToMigrate.length} existing tables...`);
      
      for (const table of tablesToMigrate) {
        const businessId = table.parent_user_id || table.user_id;
        
        await connection.query(`
          UPDATE tables
          SET 
            owner_user_id = ?,
            business_id = ?,
            table_number = ?,
            min_seats = ?,
            max_seats = ?
          WHERE id = ?
        `, [
          table.user_id,
          businessId,
          table.number,
          table.seats,
          table.seats,
          table.id
        ]);
      }
      
      console.log('✅ Migrated existing table data');
    }

    // Step 3: Make columns NOT NULL after migration
    try {
      await connection.query(`
        ALTER TABLE tables
        MODIFY COLUMN business_id CHAR(36) NOT NULL,
        MODIFY COLUMN owner_user_id CHAR(36) NOT NULL,
        MODIFY COLUMN table_number VARCHAR(50) NOT NULL,
        MODIFY COLUMN min_seats INT NOT NULL,
        MODIFY COLUMN max_seats INT NOT NULL
      `);
      console.log('✅ Set columns to NOT NULL');
    } catch (error) {
      if (!error.message.includes('Duplicate')) {
        console.log('⚠️  Could not set columns to NOT NULL (may already be set):', error.message);
      }
    }

    // Step 4: Add foreign keys and constraints (if they don't exist)
    try {
      // Check if constraint exists
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'tables' 
          AND CONSTRAINT_NAME = 'fk_tables_business'
      `, [MYSQL_DATABASE || 'zakaa_db']);

      if (constraints.length === 0) {
        await connection.query(`
          ALTER TABLE tables
          ADD CONSTRAINT fk_tables_business FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log('✅ Added business_id foreign key');
      }
    } catch (error) {
      if (!error.message.includes('Duplicate')) {
        console.log('⚠️  Could not add business_id foreign key:', error.message);
      }
    }

    try {
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'tables' 
          AND CONSTRAINT_NAME = 'fk_tables_owner'
      `, [MYSQL_DATABASE || 'zakaa_db']);

      if (constraints.length === 0) {
        await connection.query(`
          ALTER TABLE tables
          ADD CONSTRAINT fk_tables_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log('✅ Added owner_user_id foreign key');
      }
    } catch (error) {
      if (!error.message.includes('Duplicate')) {
        console.log('⚠️  Could not add owner_user_id foreign key:', error.message);
      }
    }

    try {
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'tables' 
          AND CONSTRAINT_NAME = 'unique_owner_table_number'
      `, [MYSQL_DATABASE || 'zakaa_db']);

      if (constraints.length === 0) {
        await connection.query(`
          ALTER TABLE tables
          ADD UNIQUE KEY unique_owner_table_number (owner_user_id, table_number)
        `);
        console.log('✅ Added unique constraint on owner_user_id + table_number');
      }
    } catch (error) {
      if (!error.message.includes('Duplicate')) {
        console.log('⚠️  Could not add unique constraint:', error.message);
      }
    }

    // Step 5: Add indexes (if they don't exist)
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tables' AND INDEX_NAME IN ('idx_tables_business_id', 'idx_tables_owner_user_id', 'idx_tables_active')
    `, [MYSQL_DATABASE || 'zakaa_db']);

    const existingIndexes = indexes.map(i => i.INDEX_NAME);

    if (!existingIndexes.includes('idx_tables_business_id')) {
      await connection.query(`ALTER TABLE tables ADD INDEX idx_tables_business_id (business_id)`);
      console.log('✅ Added idx_tables_business_id index');
    }

    if (!existingIndexes.includes('idx_tables_owner_user_id')) {
      await connection.query(`ALTER TABLE tables ADD INDEX idx_tables_owner_user_id (owner_user_id)`);
      console.log('✅ Added idx_tables_owner_user_id index');
    }

    if (!existingIndexes.includes('idx_tables_active')) {
      await connection.query(`ALTER TABLE tables ADD INDEX idx_tables_active (is_active)`);
      console.log('✅ Added idx_tables_active index');
    }

    console.log('✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run migration
migrateTablesTable()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
