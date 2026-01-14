const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addOrderSources() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check current enum values
    const [rows] = await connection.query(`
      SELECT COLUMN_TYPE FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'order_source'
    `);
    const currentEnum = rows[0].COLUMN_TYPE;
    logger.info(`Current order_source enum: ${currentEnum}`);

    if (!currentEnum.includes("'manual'")) {
      logger.info('Adding manual, telegram, and dashboard to order_source enum...');
      
      await connection.query(`
        ALTER TABLE orders
        MODIFY order_source ENUM('whatsapp', 'telegram', 'manual', 'dashboard') DEFAULT 'whatsapp'
      `);
      
      logger.info('✅ Successfully updated order_source enum!');
      logger.info('New values: whatsapp, telegram, manual, dashboard');
    } else {
      logger.info('✓ order_source enum already has manual value');
    }

    logger.info('\nDone!');
  } catch (error) {
    logger.error('Error adding order sources:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

addOrderSources();
