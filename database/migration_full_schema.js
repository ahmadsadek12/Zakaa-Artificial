// Full Schema Migration
// Adds all missing tables and fields according to architecture.md
// Run: node database/migration_full_schema.js

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

async function runFullSchemaMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL server');
    
    // Update locations table - add latitude and longitude
    const locationsHasLat = await columnExists(connection, 'locations', 'latitude');
    if (!locationsHasLat) {
      await connection.query(`
        ALTER TABLE locations 
        ADD COLUMN latitude DECIMAL(10,8) NULL AFTER notes,
        ADD COLUMN longitude DECIMAL(11,8) NULL AFTER latitude
      `);
      console.log('✓ Added latitude/longitude to locations');
    }
    
    // Update users table - add missing fields
    console.log('\nUpdating users table...');
    
    const usersFields = [
      { name: 'default_language', type: "ENUM('arabic','arabizi','english','french') NULL", after: 'business_type' },
      { name: 'timezone', type: "VARCHAR(50) DEFAULT 'Asia/Beirut'", after: 'default_language' },
      { name: 'subscription_started_at', type: 'TIMESTAMP NULL', after: 'subscription_price' },
      { name: 'subscription_ends_at', type: 'TIMESTAMP NULL', after: 'subscription_started_at' },
      { name: 'subscription_status', type: "ENUM('active','past_due','canceled') DEFAULT 'active'", after: 'subscription_ends_at' },
      { name: 'allow_scheduled_orders', type: 'BOOLEAN DEFAULT true', after: 'subscription_status' },
      { name: 'allow_delivery', type: 'BOOLEAN DEFAULT true', after: 'allow_scheduled_orders' },
      { name: 'allow_takeaway', type: 'BOOLEAN DEFAULT true', after: 'allow_delivery' },
      { name: 'allow_on_site', type: 'BOOLEAN DEFAULT true', after: 'allow_takeaway' },
      { name: 'deleted_at', type: 'TIMESTAMP NULL', after: 'updated_at' }
    ];
    
    for (const field of usersFields) {
      if (!(await columnExists(connection, 'users', field.name))) {
        await connection.query(`
          ALTER TABLE users 
          ADD COLUMN ${field.name} ${field.type} AFTER ${field.after}
        `);
        console.log(`✓ Added ${field.name} to users`);
      }
    }
    
    // Update branches table - add missing fields
    console.log('\nUpdating branches table...');
    
    const branchesFields = [
      { name: 'min_order_value', type: 'DECIMAL(10,2) NULL', after: 'whatsapp_access_token_encrypted' },
      { name: 'avg_preparation_time_minutes', type: 'INT NULL', after: 'min_order_value' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', after: 'created_at' },
      { name: 'deleted_at', type: 'TIMESTAMP NULL', after: 'updated_at' }
    ];
    
    for (const field of branchesFields) {
      if (!(await columnExists(connection, 'branches', field.name))) {
        await connection.query(`
          ALTER TABLE branches 
          ADD COLUMN ${field.name} ${field.type} AFTER ${field.after}
        `);
        console.log(`✓ Added ${field.name} to branches`);
      }
    }
    
    // Remove old JSON opening_hours and policies_and_rules from branches (if they exist)
    // We'll use separate tables instead
    
    // Create opening_hours table
    const openingHoursExists = await tableExists(connection, 'opening_hours');
    if (!openingHoursExists) {
      console.log('\nCreating opening_hours table...');
      await connection.query(`
        CREATE TABLE opening_hours (
          id CHAR(36) PRIMARY KEY,
          owner_type ENUM('business','branch') NOT NULL,
          owner_id CHAR(36) NOT NULL,
          day_of_week ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
          open_time TIME NULL,
          close_time TIME NULL,
          is_closed BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_owner (owner_type, owner_id),
          INDEX idx_day (day_of_week),
          UNIQUE KEY unique_owner_day (owner_type, owner_id, day_of_week)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created opening_hours table');
    }
    
    // Create policies table
    const policiesExists = await tableExists(connection, 'policies');
    if (!policiesExists) {
      console.log('\nCreating policies table...');
      await connection.query(`
        CREATE TABLE policies (
          id CHAR(36) PRIMARY KEY,
          owner_type ENUM('business','branch') NOT NULL,
          owner_id CHAR(36) NOT NULL,
          policy_type ENUM('delivery','refund','cancellation','custom') NOT NULL,
          title VARCHAR(255) NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_owner (owner_type, owner_id),
          INDEX idx_policy_type (policy_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created policies table');
    }
    
    // Create menus table
    const menusExists = await tableExists(connection, 'menus');
    if (!menusExists) {
      console.log('\nCreating menus table...');
      await connection.query(`
        CREATE TABLE menus (
          id CHAR(36) PRIMARY KEY,
          business_id CHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT NULL,
          is_shared BOOLEAN DEFAULT false,
          menu_image_url TEXT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_business_id (business_id),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created menus table');
    }
    
    // Create branch_menus table
    const branchMenusExists = await tableExists(connection, 'branch_menus');
    if (!branchMenusExists) {
      console.log('\nCreating branch_menus table...');
      await connection.query(`
        CREATE TABLE branch_menus (
          id CHAR(36) PRIMARY KEY,
          branch_id CHAR(36) NOT NULL,
          menu_id CHAR(36) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
          FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
          UNIQUE KEY unique_branch_menu (branch_id, menu_id),
          INDEX idx_branch_id (branch_id),
          INDEX idx_menu_id (menu_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created branch_menus table');
    }
    
    // Update items table - add missing fields
    console.log('\nUpdating items table...');
    
    const itemsFields = [
      { name: 'menu_id', type: 'CHAR(36) NULL', after: 'business_id' },
      { name: 'item_image_url', type: 'TEXT NULL', after: 'availability' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', after: 'created_at' },
      { name: 'deleted_at', type: 'TIMESTAMP NULL', after: 'updated_at' }
    ];
    
    for (const field of itemsFields) {
      if (!(await columnExists(connection, 'items', field.name))) {
        await connection.query(`
          ALTER TABLE items 
          ADD COLUMN ${field.name} ${field.type} AFTER ${field.after}
        `);
        console.log(`✓ Added ${field.name} to items`);
      }
    }
    
    // Add foreign key for menu_id if it doesn't exist
    if (await columnExists(connection, 'items', 'menu_id') && !(await foreignKeyExists(connection, 'items', 'items_ibfk_menu'))) {
      await connection.query(`
        ALTER TABLE items 
        ADD CONSTRAINT items_ibfk_menu 
        FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE SET NULL
      `);
      console.log('✓ Added foreign key for items.menu_id');
    }
    
    // Add index for menu_id
    try {
      await connection.query('CREATE INDEX idx_menu_id ON items(menu_id)');
      console.log('✓ Added index on items.menu_id');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    
    // Update orders table - add missing fields and change status enum
    console.log('\nUpdating orders table...');
    
    const ordersFields = [
      { name: 'customer_phone_number', type: 'VARCHAR(20) NOT NULL', after: 'branch_id' },
      { name: 'whatsapp_user_id', type: 'VARCHAR(255) NULL', after: 'customer_phone_number' },
      { name: 'language_used', type: "ENUM('arabic','arabizi','english','french') NULL", after: 'whatsapp_user_id' },
      { name: 'order_source', type: "ENUM('whatsapp') DEFAULT 'whatsapp'", after: 'language_used' },
      { name: 'notes', type: 'TEXT NULL', after: 'total' },
      { name: 'scheduled_for', type: 'TIMESTAMP NULL', after: 'notes' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', after: 'created_at' },
      { name: 'cancelled_at', type: 'TIMESTAMP NULL', after: 'completed_at' },
      { name: 'payment_method', type: "ENUM('cash','card','wallet','unknown') DEFAULT 'unknown'", after: 'cancelled_at' },
      { name: 'payment_status', type: "ENUM('unpaid','paid','refunded') DEFAULT 'unpaid'", after: 'payment_method' },
      { name: 'delivery_address_location_id', type: 'CHAR(36) NULL', after: 'payment_status' },
      { name: 'customer_name', type: 'VARCHAR(255) NULL', after: 'delivery_address_location_id' }
    ];
    
    for (const field of ordersFields) {
      if (!(await columnExists(connection, 'orders', field.name))) {
        await connection.query(`
          ALTER TABLE orders 
          ADD COLUMN ${field.name} ${field.type} AFTER ${field.after}
        `);
        console.log(`✓ Added ${field.name} to orders`);
      }
    }
    
    // Update orders status enum to include 'ready'
    // We need to check if 'ready' exists in the enum
    const [statusEnum] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status'
    `, [MYSQL_CONFIG.database]);
    
    if (statusEnum.length > 0 && !statusEnum[0].COLUMN_TYPE.includes('ready')) {
      await connection.query(`
        ALTER TABLE orders 
        MODIFY COLUMN status ENUM('pending','accepted','preparing','ready','completed','cancelled') DEFAULT 'pending'
      `);
      console.log('✓ Updated orders.status enum to include ready');
    }
    
    // Remove customer_id from orders (we use customer_phone_number instead)
    // But keep it for backward compatibility, just make it nullable
    const hasCustomerId = await columnExists(connection, 'orders', 'customer_id');
    if (hasCustomerId) {
      try {
        await connection.query(`
          ALTER TABLE orders 
          MODIFY COLUMN customer_id CHAR(36) NULL
        `);
        console.log('✓ Made customer_id nullable in orders');
      } catch (e) {
        // Ignore if foreign key exists
      }
    }
    
    // Update order_items table - add missing fields
    console.log('\nUpdating order_items table...');
    
    const orderItemsFields = [
      { name: 'name_at_time', type: 'VARCHAR(255) NOT NULL', after: 'price_at_time' },
      { name: 'notes', type: 'TEXT NULL', after: 'name_at_time' }
    ];
    
    for (const field of orderItemsFields) {
      if (!(await columnExists(connection, 'order_items', field.name))) {
        await connection.query(`
          ALTER TABLE order_items 
          ADD COLUMN ${field.name} ${field.type} AFTER ${field.after}
        `);
        console.log(`✓ Added ${field.name} to order_items`);
      }
    }
    
    // Create order_status_history table
    const orderStatusHistoryExists = await tableExists(connection, 'order_status_history');
    if (!orderStatusHistoryExists) {
      console.log('\nCreating order_status_history table...');
      await connection.query(`
        CREATE TABLE order_status_history (
          id CHAR(36) PRIMARY KEY,
          order_id CHAR(36) NOT NULL,
          status ENUM('pending','accepted','preparing','ready','completed','cancelled') NOT NULL,
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          changed_by ENUM('system','business','customer') DEFAULT 'system',
          
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          INDEX idx_order_id (order_id),
          INDEX idx_changed_at (changed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created order_status_history table');
    }
    
    // Add additional indexes
    console.log('\nAdding additional indexes...');
    
    const indexes = [
      { table: 'orders', columns: '(business_id, created_at)', name: 'idx_orders_business_created' },
      { table: 'orders', columns: '(branch_id, created_at)', name: 'idx_orders_branch_created' },
      { table: 'orders', columns: '(customer_phone_number, created_at)', name: 'idx_orders_customer_created' },
      { table: 'orders', columns: '(status, completed_at)', name: 'idx_orders_status_completed' }
    ];
    
    for (const idx of indexes) {
      try {
        await connection.query(`CREATE INDEX ${idx.name} ON ${idx.table} ${idx.columns}`);
        console.log(`✓ Added index ${idx.name}`);
      } catch (e) {
        if (!e.message.includes('Duplicate key name')) throw e;
      }
    }
    
    // Add unique constraint for whatsapp_phone_number_id
    try {
      await connection.query(`
        ALTER TABLE users 
        ADD UNIQUE KEY unique_whatsapp_phone_id (whatsapp_phone_number_id)
      `);
      console.log('✓ Added unique constraint on users.whatsapp_phone_number_id');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    
    try {
      await connection.query(`
        ALTER TABLE branches 
        ADD UNIQUE KEY unique_whatsapp_phone_id (whatsapp_phone_number_id)
      `);
      console.log('✓ Added unique constraint on branches.whatsapp_phone_number_id');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    
    console.log('\n=== Migration completed successfully ===');
    
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
  runFullSchemaMigration()
    .then(() => {
      console.log('\n✅ Full schema migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runFullSchemaMigration };
