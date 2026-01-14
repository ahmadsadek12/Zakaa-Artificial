const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addIncompleteStatus() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check current enum values
    const [columns] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'status'
    `);

    const currentEnum = columns[0]?.COLUMN_TYPE;
    logger.info(`Current status enum: ${currentEnum}`);

    if (currentEnum && currentEnum.includes('incomplete')) {
      logger.info('✓ incomplete status already exists in orders table');
    } else {
      logger.info('Adding incomplete status to orders table...');
      
      // Step 1: Add new values to enum (keep preparing for now)
      await connection.query(`
        ALTER TABLE orders 
        MODIFY status ENUM('pending','accepted','preparing','ongoing','ready','completed','cancelled','incomplete') 
        DEFAULT 'pending'
      `);
      logger.info('  - Added ongoing and incomplete to enum');
      
      // Step 2: Update any 'preparing' status to 'ongoing'
      const [result] = await connection.query(`
        UPDATE orders SET status = 'ongoing' WHERE status = 'preparing'
      `);
      logger.info(`  - Updated ${result.affectedRows} orders from preparing to ongoing`);
      
      // Step 3: Remove 'preparing' from enum
      await connection.query(`
        ALTER TABLE orders 
        MODIFY status ENUM('pending','accepted','ongoing','ready','completed','cancelled','incomplete') 
        DEFAULT 'pending'
      `);
      logger.info('  - Removed preparing from enum');
      
      logger.info('✅ Successfully added incomplete status to orders table!');
    }

    // Also update order_status_history enum
    const [historyColumns] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'order_status_history' 
      AND COLUMN_NAME = 'status'
    `);

    const historyEnum = historyColumns[0]?.COLUMN_TYPE;
    logger.info(`Current order_status_history enum: ${historyEnum}`);

    if (historyEnum && historyEnum.includes('incomplete')) {
      logger.info('✓ incomplete status already exists in order_status_history table');
    } else {
      logger.info('Adding incomplete status to order_status_history table...');
      
      // Step 1: Add new values to enum (keep preparing for now)
      await connection.query(`
        ALTER TABLE order_status_history 
        MODIFY status ENUM('pending','accepted','preparing','ongoing','ready','completed','cancelled','incomplete') 
        NOT NULL
      `);
      logger.info('  - Added ongoing and incomplete to enum');
      
      // Step 2: Update any 'preparing' status to 'ongoing'
      const [historyResult] = await connection.query(`
        UPDATE order_status_history SET status = 'ongoing' WHERE status = 'preparing'
      `);
      logger.info(`  - Updated ${historyResult.affectedRows} history records from preparing to ongoing`);
      
      // Step 3: Remove 'preparing' from enum
      await connection.query(`
        ALTER TABLE order_status_history 
        MODIFY status ENUM('pending','accepted','ongoing','ready','completed','cancelled','incomplete') 
        NOT NULL
      `);
      logger.info('  - Removed preparing from enum');
      
      logger.info('✅ Successfully added incomplete status to order_status_history table!');
    }

    logger.info('\nDone!');
  } catch (error) {
    logger.error('Error adding incomplete status:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

addIncompleteStatus();
