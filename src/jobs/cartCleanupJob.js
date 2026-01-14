// Cart Cleanup Job
// Cron job to clean up abandoned carts (carts not converted to orders after X hours)

const cron = require('node-cron');
const { queryMySQL, getMySQLConnection } = require('../config/database');
const logger = require('../utils/logger');
const CONSTANTS = require('../config/constants');

let cleanupJob = null;

/**
 * Clean up abandoned carts
 * Removes orders with status='cart' that are older than specified hours
 */
async function cleanupAbandonedCarts() {
  try {
    // Default to 24 hours, but can be configured via environment variable
    const cartAgeHours = parseInt(process.env.CART_CLEANUP_AGE_HOURS || '24');
    
    logger.info(`Starting cart cleanup job - removing carts older than ${cartAgeHours} hours`);
    
    const connection = await getMySQLConnection();
    
    try {
      await connection.beginTransaction();
      
      // Find abandoned carts
      const [carts] = await connection.query(`
        SELECT id, business_id, customer_phone_number, created_at
        FROM orders
        WHERE status = 'cart'
        AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
        ORDER BY created_at ASC
        LIMIT 100
      `, [cartAgeHours]);
      
      if (carts.length === 0) {
        logger.info('No abandoned carts to clean up');
        await connection.commit();
        return { deleted: 0, errors: [] };
      }
      
      logger.info(`Found ${carts.length} abandoned carts to delete`);
      
      const cartIds = carts.map(cart => cart.id);
      const deletedCount = cartIds.length;
      
      // Delete order items first (cascade should handle this, but being explicit)
      // Note: MySQL IN clause requires special handling for arrays
      const placeholders = cartIds.map(() => '?').join(',');
      await connection.query(`
        DELETE FROM order_items
        WHERE order_id IN (${placeholders})
      `, cartIds);
      
      // Delete abandoned carts
      await connection.query(`
        DELETE FROM orders
        WHERE id IN (${placeholders})
      `, cartIds);
      
      await connection.commit();
      
      logger.info(`Successfully cleaned up ${deletedCount} abandoned carts`);
      
      return { deleted: deletedCount, errors: [] };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error in cart cleanup job:', error);
    return { deleted: 0, errors: [error.message] };
  }
}

/**
 * Start cart cleanup job
 */
function startCartCleanupJob() {
  if (cleanupJob) {
    logger.warn('Cart cleanup job already running');
    return;
  }
  
  // Run every 6 hours by default (can be configured via CART_CLEANUP_CRON env var)
  const cronExpression = process.env.CART_CLEANUP_CRON || '0 */6 * * *'; // Every 6 hours
  
  logger.info(`Starting cart cleanup job with cron: ${cronExpression}`);
  
  cleanupJob = cron.schedule(cronExpression, async () => {
    logger.info('Cart cleanup job started');
    
    try {
      const result = await cleanupAbandonedCarts();
      
      logger.info('Cart cleanup job completed', {
        deleted: result.deleted,
        errors: result.errors.length
      });
      
      if (result.errors.length > 0) {
        logger.error('Cart cleanup job errors:', result.errors);
      }
    } catch (error) {
      logger.error('Cart cleanup job failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Beirut'
  });
  
  logger.info('Cart cleanup job scheduled successfully');
}

/**
 * Stop cart cleanup job
 */
function stopCartCleanupJob() {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    logger.info('Cart cleanup job stopped');
  }
}

/**
 * Run cart cleanup job manually (for testing)
 */
async function runCartCleanupJob() {
  logger.info('Running cart cleanup job manually');
  
  try {
    const result = await cleanupAbandonedCarts();
    
    logger.info('Cart cleanup job completed', {
      deleted: result.deleted,
      errors: result.errors.length
    });
    
    return result;
  } catch (error) {
    logger.error('Cart cleanup job failed:', error);
    throw error;
  }
}

module.exports = {
  startCartCleanupJob,
  stopCartCleanupJob,
  runCartCleanupJob,
  cleanupAbandonedCarts
};
