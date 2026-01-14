const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function verifyStatusEnum() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check the actual current enum in the database
    const [rows] = await connection.query(`
      SELECT COLUMN_TYPE FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'status'
    `);
    
    logger.info('Current order status enum in database:');
    logger.info(rows[0].COLUMN_TYPE);
    
    if (rows[0].COLUMN_TYPE.includes("'cart'")) {
      logger.info('✅ cart status EXISTS in the enum');
    } else {
      logger.error('❌ cart status MISSING from the enum!');
      logger.info('Attempting to add it now...');
      
      await connection.query(`
        ALTER TABLE orders
        MODIFY status ENUM('cart','accepted','delivering','completed','rejected') DEFAULT 'accepted'
      `);
      
      logger.info('✅ cart status added successfully!');
      
      // Verify again
      const [verifyRows] = await connection.query(`
        SELECT COLUMN_TYPE FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'status'
      `);
      logger.info('Updated enum:');
      logger.info(verifyRows[0].COLUMN_TYPE);
    }

  } catch (error) {
    logger.error('Error verifying status enum:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

verifyStatusEnum();
