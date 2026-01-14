// Migration Script: User-Branch Merge and Schema Updates
// This script performs the major system restructure:
// 1. Merges branches into users table
// 2. Updates order statuses (remove pending, preparing; add ongoing)
// 3. Updates business types
// 4. Adds new tables (tables, reservations)
// 5. Updates items table with new fields

require('dotenv').config();
const mysql = require('mysql2/promise');
const { generateUUID } = require('../src/utils/uuid');
const bcrypt = require('bcryptjs');

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'zakaa_db',
  multipleStatements: true
};

async function columnExists(connection, tableName, columnName) {
  const [columns] = await connection.query(`
    SELECT COUNT(*) as count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `, [MYSQL_CONFIG.database, tableName, columnName]);
  return columns[0].count > 0;
}

async function tableExists(connection, tableName) {
  const [tables] = await connection.query(`
    SELECT COUNT(*) as count
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
  `, [MYSQL_CONFIG.database, tableName]);
  return tables[0].count > 0;
}

async function foreignKeyExists(connection, tableName, constraintName) {
  const [constraints] = await connection.query(`
    SELECT COUNT(*) as count
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  `, [MYSQL_CONFIG.database, tableName, constraintName]);
  return constraints[0].count > 0;
}

async function runMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL server');
    
    await connection.beginTransaction();
    
    console.log('\n=== Starting Migration ===\n');
    
    // Step 1: Add parent_user_id and user_role to users table
    console.log('Step 1: Adding parent_user_id and user_role to users table...');
    
    if (!(await columnExists(connection, 'users', 'parent_user_id'))) {
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN parent_user_id CHAR(36) NULL AFTER user_type,
        ADD COLUMN user_role ENUM('business', 'branch') NULL AFTER parent_user_id
      `);
      console.log('✓ Added parent_user_id and user_role columns');
    } else {
      console.log('✓ parent_user_id and user_role columns already exist');
    }
    
    // Add foreign key for parent_user_id
    if (!(await foreignKeyExists(connection, 'users', 'users_ibfk_parent'))) {
      try {
        await connection.query(`
          ALTER TABLE users
          ADD CONSTRAINT users_ibfk_parent
          FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log('✓ Added foreign key for parent_user_id');
      } catch (e) {
        if (!e.message.includes('Duplicate key name')) throw e;
      }
    }
    
    // Add index
    try {
      await connection.query('CREATE INDEX idx_parent_user_id ON users(parent_user_id)');
      console.log('✓ Added index on parent_user_id');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    
    // Step 2: Update business_type enum
    console.log('\nStep 2: Updating business_type enum...');
    
    try {
      await connection.query(`
        ALTER TABLE users
        MODIFY COLUMN business_type ENUM('food and beverage', 'entertainment', 'sports', 'salons', 'clinics', 'rentals', 'other') NULL
      `);
      console.log('✓ Updated business_type enum');
    } catch (e) {
      console.log('⚠️  business_type enum update (may already be updated):', e.message);
    }
    
    // Step 3: Update user_type enum to include 'branch'
    console.log('\nStep 3: Updating user_type enum to include branch...');
    
    try {
      await connection.query(`
        ALTER TABLE users
        MODIFY COLUMN user_type ENUM('admin', 'business', 'branch', 'customer') NOT NULL
      `);
      console.log('✓ Updated user_type enum');
    } catch (e) {
      console.log('⚠️  user_type enum update:', e.message);
    }
    
    // Step 4: Migrate existing branches to users
    console.log('\nStep 4: Migrating existing branches to users...');
    
    // Create temporary mapping table
    await connection.query(`
      CREATE TEMPORARY TABLE IF NOT EXISTS branch_user_mapping (
        old_branch_id CHAR(36) PRIMARY KEY,
        new_user_id CHAR(36) NOT NULL,
        business_id CHAR(36) NOT NULL
      )
    `);
    
    const [existingBranches] = await connection.query(`
      SELECT * FROM branches WHERE is_active = true
    `);
    
    if (existingBranches.length > 0) {
      console.log(`Found ${existingBranches.length} branches to migrate`);
      
      for (const branch of existingBranches) {
        // Check if branch user already exists
        const [existingUser] = await connection.query(`
          SELECT id FROM users WHERE email = ? OR business_name = ?
        `, [`branch_${branch.id}@migrated.local`, branch.branch_name]);
        
        if (existingUser.length > 0) {
          console.log(`  ⚠️  Branch ${branch.branch_name} already migrated, skipping`);
          continue;
        }
        
        // Get parent business type
        const [parentBusiness] = await connection.query(`
          SELECT business_type FROM users WHERE id = ?
        `, [branch.business_id]);
        
        // Create user record for branch
        const branchUserId = generateUUID();
        const defaultPassword = await bcrypt.hash('password123', 10);
        
        await connection.query(`
          INSERT INTO users (
            id, user_type, user_role, parent_user_id, email, business_name,
            business_type, contact_phone_number, whatsapp_phone_number,
            whatsapp_phone_number_id, whatsapp_access_token_encrypted,
            location_id, subscription_type, password_hash, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          branchUserId,
          'branch',
          'branch',
          branch.business_id,
          `branch_${branch.id}@migrated.local`,
          branch.branch_name,
          parentBusiness[0]?.business_type || null,
          branch.contact_phone_number || null,
          branch.whatsapp_phone_number || null,
          branch.whatsapp_phone_number_id || null,
          branch.whatsapp_access_token_encrypted || null,
          branch.location_id || null,
          'standard',
          defaultPassword,
          branch.is_active !== undefined ? branch.is_active : true,
          branch.created_at || new Date()
        ]);
        
        // Store mapping
        await connection.query(`
          INSERT INTO branch_user_mapping (old_branch_id, new_user_id, business_id)
          VALUES (?, ?, ?)
        `, [branch.id, branchUserId, branch.business_id]);
        
        console.log(`  ✓ Migrated branch: ${branch.branch_name} → ${branchUserId}`);
      }
    } else {
      console.log('  ℹ️  No existing branches to migrate (fresh start)');
    }
    
    // Step 5: Update orders table - change status enum and branch_id
    console.log('\nStep 5: Updating orders table...');
    
    // Update status enum
    try {
      await connection.query(`
        ALTER TABLE orders
        MODIFY COLUMN status ENUM('cart', 'accepted', 'ongoing', 'ready', 'completed', 'cancelled') DEFAULT 'cart'
      `);
      console.log('✓ Updated orders.status enum');
    } catch (e) {
      console.log('⚠️  orders.status enum update:', e.message);
    }
    
    // Migrate existing orders: update pending → accepted, preparing → ongoing
    await connection.query(`
      UPDATE orders SET status = 'accepted' WHERE status = 'pending'
    `);
    await connection.query(`
      UPDATE orders SET status = 'ongoing' WHERE status = 'preparing'
    `);
    console.log('✓ Migrated existing order statuses');
    
    // Add user_id column to orders (pointing to branch user or business)
    if (!(await columnExists(connection, 'orders', 'user_id'))) {
      await connection.query(`
        ALTER TABLE orders
        ADD COLUMN user_id CHAR(36) NULL AFTER branch_id
      `);
      console.log('✓ Added user_id column to orders');
    }
    
    // Migrate branch_id to user_id for orders using mapping table
    await connection.query(`
      UPDATE orders o
      INNER JOIN branch_user_mapping m ON o.branch_id = m.old_branch_id
      SET o.user_id = m.new_user_id
      WHERE o.user_id IS NULL
    `);
    console.log('✓ Updated orders.user_id from branch mapping');
    
    // For orders where branch wasn't found in mapping (or no branch_id), use business_id
    await connection.query(`
      UPDATE orders SET user_id = business_id WHERE user_id IS NULL
    `);
    
    // Make user_id NOT NULL and add foreign key
    try {
      await connection.query(`
        ALTER TABLE orders
        MODIFY COLUMN user_id CHAR(36) NOT NULL
      `);
      await connection.query(`
        ALTER TABLE orders
        ADD CONSTRAINT orders_ibfk_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
      `);
      await connection.query('CREATE INDEX idx_orders_user_id ON orders(user_id)');
      console.log('✓ Made user_id NOT NULL and added foreign key');
    } catch (e) {
      if (!e.message.includes('Duplicate key name') && !e.message.includes('Duplicate foreign key')) {
        console.log('⚠️  user_id constraint:', e.message);
      }
    }
    
    // Step 6: Update items table
    console.log('\nStep 6: Updating items table...');
    
    const itemsColumns = [
      { name: 'user_id', type: 'CHAR(36) NULL', after: 'branch_id' },
      { name: 'duration_minutes', type: 'INT NULL', after: 'preparation_time_minutes' },
      { name: 'available_from', type: 'TIME NULL', after: 'availability' },
      { name: 'available_to', type: 'TIME NULL', after: 'available_from' },
      { name: 'days_available', type: 'JSON NULL', after: 'available_to' },
      { name: 'times_ordered', type: 'INT DEFAULT 0', after: 'days_available' },
      { name: 'times_delivered', type: 'INT DEFAULT 0', after: 'times_ordered' },
      { name: 'ingredients', type: 'TEXT NULL', after: 'description' },
      { name: 'item_image_url', type: 'TEXT NULL', after: 'times_delivered' }
    ];
    
    for (const col of itemsColumns) {
      if (!(await columnExists(connection, 'items', col.name))) {
        await connection.query(`
          ALTER TABLE items
          ADD COLUMN ${col.name} ${col.type} ${col.after ? `AFTER ${col.after}` : ''}
        `);
        console.log(`✓ Added ${col.name} to items`);
      }
    }
    
    // Migrate branch_id to user_id in items using mapping table
    await connection.query(`
      UPDATE items i
      INNER JOIN branch_user_mapping m ON i.branch_id = m.old_branch_id
      SET i.user_id = m.new_user_id
      WHERE i.branch_id IS NOT NULL AND i.user_id IS NULL
    `);
    await connection.query(`
      UPDATE items SET user_id = business_id WHERE user_id IS NULL
    `);
    console.log('✓ Updated items.user_id from branch mapping');
    
    // Add foreign key for user_id
    if (!(await foreignKeyExists(connection, 'items', 'items_ibfk_user'))) {
      try {
        await connection.query(`
          ALTER TABLE items
          ADD CONSTRAINT items_ibfk_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        `);
        await connection.query('CREATE INDEX idx_items_user_id ON items(user_id)');
        console.log('✓ Added foreign key and index for items.user_id');
      } catch (e) {
        if (!e.message.includes('Duplicate')) throw e;
      }
    }
    
    // Step 7: Update order_status_history enum
    console.log('\nStep 7: Updating order_status_history...');
    
    try {
      await connection.query(`
        ALTER TABLE order_status_history
        MODIFY COLUMN status ENUM('accepted', 'ongoing', 'ready', 'completed', 'cancelled') NOT NULL
      `);
      
      // Migrate existing statuses
      await connection.query(`
        UPDATE order_status_history SET status = 'accepted' WHERE status = 'pending'
      `);
      await connection.query(`
        UPDATE order_status_history SET status = 'ongoing' WHERE status = 'preparing'
      `);
      
      console.log('✓ Updated order_status_history enum and migrated data');
    } catch (e) {
      console.log('⚠️  order_status_history update:', e.message);
    }
    
    // Step 8: Create tables table
    console.log('\nStep 8: Creating tables table...');
    
    if (!(await tableExists(connection, 'tables'))) {
      await connection.query(`
        CREATE TABLE tables (
          id CHAR(36) PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          seats INT NOT NULL,
          number VARCHAR(50) NOT NULL,
          reserved BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_reserved (reserved)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created tables table');
    } else {
      console.log('✓ tables table already exists');
    }
    
    // Step 9: Create reservations table
    console.log('\nStep 9: Creating reservations table...');
    
    if (!(await tableExists(connection, 'reservations'))) {
      await connection.query(`
        CREATE TABLE reservations (
          id CHAR(36) PRIMARY KEY,
          user_id CHAR(36) NULL,
          business_user_id CHAR(36) NOT NULL,
          table_id CHAR(36) NULL,
          customer_phone_number VARCHAR(20) NOT NULL,
          customer_name VARCHAR(255) NOT NULL,
          reservation_date DATE NOT NULL,
          reservation_time TIME NOT NULL,
          number_of_guests INT,
          notes TEXT,
          status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (business_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
          INDEX idx_business_user_id (business_user_id),
          INDEX idx_reservation_date (reservation_date),
          INDEX idx_table_id (table_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created reservations table');
    } else {
      console.log('✓ reservations table already exists');
    }
    
    // Step 10: Update existing businesses to set user_role = 'business'
    console.log('\nStep 10: Setting user_role for existing businesses...');
    
    await connection.query(`
      UPDATE users
      SET user_role = 'business', parent_user_id = NULL
      WHERE user_type = 'business' AND user_role IS NULL
    `);
    console.log('✓ Updated existing businesses with user_role');
    
    // Step 11: Clean up - Drop branches and branch_menus tables (only after successful migration)
    console.log('\nStep 11: Dropping old tables...');
    
    // Note: We'll keep branches table for now to ensure no data loss
    // Can be dropped manually after verification
    // if (await tableExists(connection, 'branch_menus')) {
    //   await connection.query('DROP TABLE branch_menus');
    //   console.log('✓ Dropped branch_menus table');
    // }
    
    console.log('⚠️  Keeping branches table for safety. Drop manually after verification.');
    
    await connection.commit();
    
    console.log('\n=== Migration completed successfully ===\n');
    console.log('Next steps:');
    console.log('1. Verify all data migrated correctly');
    console.log('2. Test the application');
    console.log('3. Drop branches and branch_menus tables manually if everything works');
    
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Migration error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Migration complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
