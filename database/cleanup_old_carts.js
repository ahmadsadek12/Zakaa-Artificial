const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function cleanupOldCarts() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Delete all existing carts (they have notes='__cart__' or status would be 'cart')
    const [result] = await connection.query(`
      DELETE FROM orders WHERE notes = '__cart__'
    `);
    
    logger.info(`✅ Deleted ${result.affectedRows} old cart(s) from database`);
    logger.info('Fresh carts will be created with the new status enum');

  } catch (error) {
    logger.error('Error cleaning up old carts:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

cleanupOldCarts();
