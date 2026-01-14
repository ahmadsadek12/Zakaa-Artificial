const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function updateOrderStatuses() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    await connection.beginTransaction();

    // Step 1: Add new statuses to enum (keep old ones temporarily)
    logger.info('Step 1: Expanding order status enum...');
    await connection.query(`
      ALTER TABLE orders
      MODIFY status ENUM('cart','pending','accepted','ongoing','ready','completed','cancelled','incomplete','delivering','rejected') DEFAULT 'accepted'
    `);
    logger.info('✅ Orders table enum expanded');

    await connection.query(`
      ALTER TABLE order_status_history
      MODIFY status ENUM('pending','accepted','ongoing','ready','completed','cancelled','incomplete','delivering','rejected') NOT NULL
    `);
    logger.info('✅ Order status history table enum expanded');

    // Step 2: Migrate existing data
    logger.info('\nStep 2: Migrating existing statuses...');
    
    // Migrate pending → accepted
    const [pendingResult] = await connection.query(`UPDATE orders SET status = 'accepted' WHERE status = 'pending'`);
    logger.info(`  - Migrated ${pendingResult.affectedRows} orders: pending → accepted`);
    
    const [pendingHistResult] = await connection.query(`UPDATE order_status_history SET status = 'accepted' WHERE status = 'pending'`);
    logger.info(`  - Migrated ${pendingHistResult.affectedRows} history records: pending → accepted`);

    // Migrate ongoing/ready → delivering
    const [ongoingResult] = await connection.query(`UPDATE orders SET status = 'delivering' WHERE status IN ('ongoing', 'ready')`);
    logger.info(`  - Migrated ${ongoingResult.affectedRows} orders: ongoing/ready → delivering`);
    
    const [ongoingHistResult] = await connection.query(`UPDATE order_status_history SET status = 'delivering' WHERE status IN ('ongoing', 'ready')`);
    logger.info(`  - Migrated ${ongoingHistResult.affectedRows} history records: ongoing/ready → delivering`);

    // Migrate cancelled/incomplete → rejected
    const [cancelledResult] = await connection.query(`UPDATE orders SET status = 'rejected' WHERE status IN ('cancelled', 'incomplete')`);
    logger.info(`  - Migrated ${cancelledResult.affectedRows} orders: cancelled/incomplete → rejected`);
    
    const [cancelledHistResult] = await connection.query(`UPDATE order_status_history SET status = 'rejected' WHERE status IN ('cancelled', 'incomplete')`);
    logger.info(`  - Migrated ${cancelledHistResult.affectedRows} history records: cancelled/incomplete → rejected`);

    // Migrate cart → accepted (or you might want to delete these)
    const [cartResult] = await connection.query(`UPDATE orders SET status = 'accepted' WHERE status = 'cart'`);
    logger.info(`  - Migrated ${cartResult.affectedRows} orders: cart → accepted`);

    // Step 3: Remove old statuses from enum
    logger.info('\nStep 3: Removing old statuses from enum...');
    await connection.query(`
      ALTER TABLE orders
      MODIFY status ENUM('accepted','delivering','completed','rejected') DEFAULT 'accepted'
    `);
    logger.info('✅ Orders table enum finalized');

    await connection.query(`
      ALTER TABLE order_status_history
      MODIFY status ENUM('accepted','delivering','completed','rejected') NOT NULL
    `);
    logger.info('✅ Order status history table enum finalized');

    await connection.commit();

    logger.info('\n✅ Order status migration completed successfully!');
    logger.info('\nNew statuses:');
    logger.info('  - accepted   (order is accepted by business)');
    logger.info('  - delivering (order is being delivered/prepared)');
    logger.info('  - completed  (order is finished)');
    logger.info('  - rejected   (order was cancelled/rejected)');

  } catch (error) {
    if (connection) await connection.rollback();
    logger.error('Error updating order statuses:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

updateOrderStatuses();
