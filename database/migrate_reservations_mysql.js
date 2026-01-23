const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ? 
     AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ? 
     AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows[0].count > 0;
}

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || 'zakaa_db',
      multipleStatements: true
    });

    console.log('Connected to MySQL database');

    // Add columns to reservations table
    const columnsToAdd = [
      {
        name: 'reservation_type',
        definition: "ENUM('table','appointment','other') DEFAULT 'table'",
        after: 'status'
      },
      {
        name: 'owner_user_id',
        definition: 'CHAR(36) NULL',
        after: 'business_user_id'
      },
      {
        name: 'min_seats_snapshot',
        definition: 'INT NULL',
        after: 'table_id'
      },
      {
        name: 'max_seats_snapshot',
        definition: 'INT NULL',
        after: 'min_seats_snapshot'
      },
      {
        name: 'position_snapshot',
        definition: 'VARCHAR(100) NULL',
        after: 'max_seats_snapshot'
      },
      {
        name: 'platform',
        definition: "ENUM('whatsapp','telegram','instagram','facebook','dashboard') DEFAULT 'whatsapp'",
        after: 'source'
      },
      {
        name: 'completed_at',
        definition: 'TIMESTAMP NULL',
        after: 'status'
      },
      {
        name: 'cancelled_at',
        definition: 'TIMESTAMP NULL',
        after: 'completed_at'
      }
    ];

    for (const column of columnsToAdd) {
      const exists = await columnExists(connection, 'reservations', column.name);
      if (!exists) {
        console.log(`Adding column: ${column.name}`);
        await connection.query(
          `ALTER TABLE reservations ADD COLUMN ${column.name} ${column.definition} AFTER ${column.after}`
        );
      } else {
        console.log(`Column ${column.name} already exists, skipping`);
      }
    }

    // Migrate existing data
    console.log('Migrating existing data...');
    await connection.query(`
      UPDATE reservations
      SET 
        reservation_type = COALESCE(
          CASE 
            WHEN reservation_kind = 'table' THEN 'table'
            WHEN reservation_kind = 'appointment' THEN 'appointment'
            ELSE 'other'
          END,
          'table'
        ),
        owner_user_id = COALESCE(user_id, business_user_id),
        platform = CASE 
          WHEN source = 'whatsapp' THEN 'whatsapp'
          WHEN source = 'telegram' THEN 'telegram'
          WHEN source = 'instagram' THEN 'instagram'
          WHEN source = 'facebook' THEN 'facebook'
          WHEN source = 'dashboard' THEN 'dashboard'
          ELSE 'whatsapp'
        END
      WHERE reservation_type IS NULL OR owner_user_id IS NULL OR platform IS NULL
    `);

    // Add indexes
    const indexes = [
      { name: 'idx_res_datetime', columns: '(reservation_date, reservation_time)' },
      { name: 'idx_res_table', columns: '(table_id)' },
      { name: 'idx_res_status', columns: '(status)' },
      { name: 'idx_res_owner_user_id', columns: '(owner_user_id)' },
      { name: 'idx_res_type', columns: '(reservation_type)' }
    ];

    for (const index of indexes) {
      const exists = await indexExists(connection, 'reservations', index.name);
      if (!exists) {
        console.log(`Adding index: ${index.name}`);
        await connection.query(
          `CREATE INDEX ${index.name} ON reservations ${index.columns}`
        );
      } else {
        console.log(`Index ${index.name} already exists, skipping`);
      }
    }

    // Try to add foreign key (ignore if it fails)
    try {
      await connection.query(`
        ALTER TABLE reservations 
        ADD CONSTRAINT fk_reservations_owner 
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('Foreign key added');
    } catch (err) {
      if (err.code === 'ER_DUP_KEY' || err.code === 'ER_DUP_KEYNAME') {
        console.log('Foreign key already exists, skipping');
      } else {
        console.log('Could not add foreign key (may already exist):', err.message);
      }
    }

    console.log('✅ Reservation migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
