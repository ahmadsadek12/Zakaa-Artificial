const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addCartStatusBack() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check current enum
    let [rows] = await connection.query(`
      SELECT COLUMN_TYPE FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'status'
    `);
    const currentEnum = rows[0].COLUMN_TYPE;
    logger.info(`Current order status enum: ${currentEnum}`);

    if (!currentEnum.includes("'cart'")) {
      logger.info('Adding cart status back to orders table...');
      await connection.query(`
        ALTER TABLE orders
        MODIFY status ENUM('cart','accepted','delivering','completed','rejected') DEFAULT 'accepted'
      `);
      logger.info('✅ Added cart status back to orders table!');
      logger.info('Note: cart status is used for active shopping carts, not for status history');
    } else {
      logger.info('✓ cart status already exists in orders table');
    }

    logger.info('\n✅ Cart status restoration completed!');
    logger.info('\nFinal statuses:');
    logger.info('  Orders table: cart, accepted, delivering, completed, rejected');
    logger.info('  Status history: accepted, delivering, completed, rejected');
    logger.info('  (cart is excluded from history as it\'s not a real order status)');

  } catch (error) {
    logger.error('Error adding cart status:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

addCartStatusBack();
