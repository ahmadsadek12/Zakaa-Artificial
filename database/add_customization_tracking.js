// Migration: Add Customization Tracking Table
// Run with: node database/add_customization_tracking.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

async function addCustomizationTracking() {
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
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_item_customizations'
    `, [MYSQL_DATABASE || 'zakaa_db']);

    if (tables.length > 0) {
      console.log('⚠️  Order item customizations table already exists. Skipping creation.');
      return;
    }

    // Check if service_customizations table exists
    const [customizationTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'service_customizations'
    `, [MYSQL_DATABASE || 'zakaa_db']);

    // Create order_item_customizations table
    let sql = `
      CREATE TABLE IF NOT EXISTS order_item_customizations (
        id CHAR(36) PRIMARY KEY,
        order_item_id CHAR(36) NOT NULL,
        customization_name VARCHAR(255) NOT NULL COMMENT 'Name of customization/addon',
        price_adjustment DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Price change from base item',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
        
        INDEX idx_order_item_id (order_item_id),
        INDEX idx_customization_name (customization_name)
    `;

    if (customizationTables.length > 0) {
      sql += `,
        customization_id CHAR(36) NULL COMMENT 'FK to service_customizations (if exists)',
        FOREIGN KEY (customization_id) REFERENCES service_customizations(id) ON DELETE SET NULL,
        INDEX idx_customization_id (customization_id)
      `;
    }

    sql += `
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `;

    await connection.query(sql);

    console.log('✅ Order item customizations table created successfully');

  } catch (error) {
    console.error('❌ Error creating customization tracking table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run migration
addCustomizationTracking()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
