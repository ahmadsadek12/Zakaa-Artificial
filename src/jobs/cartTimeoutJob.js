// Cart Timeout Job
// Convert abandoned carts to rejected orders after 2 hours of inactivity

const cron = require('node-cron');
const { getMySQLConnection } = require('../config/database');
const logger = require('../utils/logger');

let job = null;

/**
 * Find and process timed-out carts
 */
async function processTimedOutCarts() {
  let connection;
  try {
    connection = await getMySQLConnection();
    
    // Find carts that haven't been updated in 2 hours
    // Timeout applies to ANY cart regardless of state
    // - notes = '__cart__' (is a cart)
    // - status = 'cart' (active cart)
    // - updated_at < NOW() - INTERVAL 120 MINUTE (2 hours)
    const [timedOutCarts] = await connection.query(`
      SELECT o.id, o.business_id, o.user_id, o.customer_phone_number, 
             o.delivery_type, o.notes, o.updated_at,
             COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.notes = '__cart__'
        AND o.status = 'cart'
        AND o.updated_at < NOW() - INTERVAL 120 MINUTE
      GROUP BY o.id
    `);
    
    if (timedOutCarts.length === 0) {
      logger.debug('No timed-out carts found');
      return;
    }
    
    logger.info(`Found ${timedOutCarts.length} timed-out cart(s)`);
    
    for (const cart of timedOutCarts) {
      try {
        await connection.beginTransaction();
        
        // Convert cart to rejected order
        await connection.query(`
          UPDATE orders 
          SET status = 'rejected',
              notes = 'Cart abandoned - no activity for 2 hours',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [cart.id]);
        
        // Add status history entry
        const { generateUUID } = require('../utils/uuid');
        await connection.query(`
          INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
          VALUES (?, ?, 'rejected', 'system', CURRENT_TIMESTAMP)
        `, [generateUUID(), cart.id]);
        
        await connection.commit();
        
        logger.info('Cart timed out and rejected', {
          orderId: cart.id,
          businessId: cart.business_id,
          customerPhoneNumber: cart.customer_phone_number,
          itemCount: cart.item_count,
          hoursSinceUpdate: Math.floor((Date.now() - new Date(cart.updated_at)) / 3600000)
        });
        
        // TODO: Notify restaurant (for now, just log)
        logger.info('Restaurant notification: Cart timeout', {
          businessId: cart.business_id,
          orderId: cart.id,
          customerPhoneNumber: cart.customer_phone_number
        });
        
      } catch (error) {
        await connection.rollback();
        logger.error('Error processing timed-out cart', {
          cartId: cart.id,
          error: error.message
        });
      }
    }
    
  } catch (error) {
    logger.error('Error in cart timeout job:', error);
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Start the cart timeout job
 * Runs every minute
 */
function start() {
  if (job) {
    logger.warn('Cart timeout job already running');
    return;
  }
  
  // Run every minute
  const cronExpression = '* * * * *';
  
  logger.info('Starting cart timeout job', { cron: cronExpression });
  
  job = cron.schedule(cronExpression, async () => {
    try {
      await processTimedOutCarts();
    } catch (error) {
      logger.error('Cart timeout job error:', error);
    }
  });
  
  logger.info('Cart timeout job scheduled successfully');
}

/**
 * Stop the cart timeout job
 */
function stop() {
  if (job) {
    job.stop();
    job = null;
    logger.info('Cart timeout job stopped');
  }
}

module.exports = {
  start,
  stop,
  processTimedOutCarts
};
