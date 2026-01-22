// Migration Script: Update Reservations Table for Table Reservations
// Run with: node database/migration_table_reservations_reservations.js

require('dotenv').config();
const mysql = require('mysql2/promise');

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function migrateReservationsTable() {
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
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reservations' 
      AND COLUMN_NAME IN ('reservation_type', 'owner_user_id', 'min_seats_snapshot', 'max_seats_snapshot', 'position_snapshot', 'platform', 'completed_at', 'cancelled_at')
    `, [MYSQL_DATABASE || 'zakaa_db']);

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    
    // Step 1: Add new columns if they don't exist
    if (!existingColumns.includes('reservation_type')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN reservation_type ENUM('table','appointment','other') DEFAULT 'table' AFTER status
      `);
      console.log('✅ Added reservation_type column');
    }

    if (!existingColumns.includes('owner_user_id')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN owner_user_id CHAR(36) NULL AFTER business_user_id
      `);
      console.log('✅ Added owner_user_id column');
    }

    if (!existingColumns.includes('min_seats_snapshot')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN min_seats_snapshot INT NULL AFTER table_id
      `);
      console.log('✅ Added min_seats_snapshot column');
    }

    if (!existingColumns.includes('max_seats_snapshot')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN max_seats_snapshot INT NULL AFTER min_seats_snapshot
      `);
      console.log('✅ Added max_seats_snapshot column');
    }

    if (!existingColumns.includes('position_snapshot')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN position_snapshot VARCHAR(100) NULL AFTER max_seats_snapshot
      `);
      console.log('✅ Added position_snapshot column');
    }

    if (!existingColumns.includes('platform')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN platform ENUM('whatsapp','telegram','instagram','facebook','dashboard') DEFAULT 'whatsapp' AFTER source
      `);
      console.log('✅ Added platform column');
    }

    if (!existingColumns.includes('completed_at')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN completed_at TIMESTAMP NULL AFTER status
      `);
      console.log('✅ Added completed_at column');
    }

    if (!existingColumns.includes('cancelled_at')) {
      await connection.query(`
        ALTER TABLE reservations
        ADD COLUMN cancelled_at TIMESTAMP NULL AFTER completed_at
      `);
      console.log('✅ Added cancelled_at column');
    }

    // Step 2: Migrate existing data
    const [reservationsToMigrate] = await connection.query(`
      SELECT id, user_id, business_user_id, reservation_kind, source
      FROM reservations
      WHERE reservation_type IS NULL OR owner_user_id IS NULL OR platform IS NULL
    `);

    if (reservationsToMigrate.length > 0) {
      console.log(`📦 Migrating ${reservationsToMigrate.length} existing reservations...`);
      
      for (const res of reservationsToMigrate) {
        const reservationType = res.reservation_kind === 'appointment' ? 'appointment' : 
                                res.reservation_kind === 'table' ? 'table' : 'other';
        const ownerUserId = res.user_id || res.business_user_id;
        const platform = res.source || 'whatsapp';
        
        await connection.query(`
          UPDATE reservations
          SET 
            reservation_type = ?,
            owner_user_id = ?,
            platform = ?
          WHERE id = ?
        `, [reservationType, ownerUserId, platform, res.id]);
      }
      
      console.log('✅ Migrated existing reservation data');
    }

    // Step 3: Update status ENUM to include 'no_show' (MySQL doesn't support easy ALTER ENUM)
    // We'll handle 'no_show' in application code by checking status='confirmed' AND no_show=true
    // Or we can try to alter the enum if MySQL version supports it
    try {
      // Check current enum values
      const [enumInfo] = await connection.query(`
        SELECT COLUMN_TYPE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'reservations' 
          AND COLUMN_NAME = 'status'
      `, [MYSQL_DATABASE || 'zakaa_db']);

      if (enumInfo.length > 0 && !enumInfo[0].COLUMN_TYPE.includes('no_show')) {
        // Try to modify enum (this may fail on some MySQL versions)
        await connection.query(`
          ALTER TABLE reservations
          MODIFY COLUMN status ENUM('confirmed', 'cancelled', 'completed', 'no_show') DEFAULT 'confirmed'
        `);
        console.log('✅ Updated status ENUM to include no_show');
      } else {
        console.log('✅ Status ENUM already includes no_show or using no_show field');
      }
    } catch (error) {
      console.log('⚠️  Could not update status ENUM (may need manual update or use no_show field):', error.message);
    }

    // Step 4: Add foreign key for owner_user_id (if it doesn't exist)
    try {
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'reservations' 
          AND CONSTRAINT_NAME = 'fk_reservations_owner'
      `, [MYSQL_DATABASE || 'zakaa_db']);

      if (constraints.length === 0) {
        await connection.query(`
          ALTER TABLE reservations
          ADD CONSTRAINT fk_reservations_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('✅ Added owner_user_id foreign key');
      }
    } catch (error) {
      if (!error.message.includes('Duplicate')) {
        console.log('⚠️  Could not add owner_user_id foreign key:', error.message);
      }
    }

    // Step 5: Add indexes (if they don't exist)
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reservations' 
      AND INDEX_NAME IN ('idx_res_datetime', 'idx_res_table', 'idx_res_status', 'idx_res_owner_user_id', 'idx_res_type')
    `, [MYSQL_DATABASE || 'zakaa_db']);

    const existingIndexes = indexes.map(i => i.INDEX_NAME);

    if (!existingIndexes.includes('idx_res_datetime')) {
      await connection.query(`ALTER TABLE reservations ADD INDEX idx_res_datetime (reservation_date, reservation_time)`);
      console.log('✅ Added idx_res_datetime index');
    }

    if (!existingIndexes.includes('idx_res_table')) {
      await connection.query(`ALTER TABLE reservations ADD INDEX idx_res_table (table_id)`);
      console.log('✅ Added idx_res_table index');
    }

    if (!existingIndexes.includes('idx_res_status')) {
      await connection.query(`ALTER TABLE reservations ADD INDEX idx_res_status (status)`);
      console.log('✅ Added idx_res_status index');
    }

    if (!existingIndexes.includes('idx_res_owner_user_id')) {
      await connection.query(`ALTER TABLE reservations ADD INDEX idx_res_owner_user_id (owner_user_id)`);
      console.log('✅ Added idx_res_owner_user_id index');
    }

    if (!existingIndexes.includes('idx_res_type')) {
      await connection.query(`ALTER TABLE reservations ADD INDEX idx_res_type (reservation_type)`);
      console.log('✅ Added idx_res_type index');
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
migrateReservationsTable()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
