const { getMySQLConnection, getMongoCollection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function resetAllChats() {
  let connection;
  try {
    // Reset MySQL carts
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Delete all cart orders (orders with notes='__cart__')
    const [cartResult] = await connection.query(`
      DELETE FROM orders 
      WHERE notes = '__cart__'
    `);
    logger.info(`✅ Deleted ${cartResult.affectedRows} cart(s) from MySQL`);

    // Reset MongoDB conversation history
    try {
      const messageLogs = await getMongoCollection('message_logs');
      if (messageLogs) {
        const mongoResult = await messageLogs.deleteMany({});
        logger.info(`✅ Deleted ${mongoResult.deletedCount} message(s) from MongoDB`);
      } else {
        logger.warn('MongoDB not available, skipping message logs cleanup');
      }
    } catch (mongoError) {
      logger.warn('Could not clear MongoDB message logs:', mongoError.message);
    }

    logger.info('✅ All chats have been reset!');
    logger.info('Next customer messages will start fresh conversations with language selection.');
    
  } catch (error) {
    logger.error('Error resetting chats:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

resetAllChats();
