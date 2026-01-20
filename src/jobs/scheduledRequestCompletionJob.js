// Scheduled Request Completion Job
// Automatically complete scheduled requests when scheduled_for time passes

const cron = require('node-cron');
const { queryMySQL, getMySQLConnection } = require('../config/database');
const logger = require('../utils/logger');
const orderRepository = require('../repositories/orderRepository');

let scheduledRequestJob = null;

/**
 * Start scheduled request completion job
 */
function startScheduledRequestCompletionJob() {
  if (scheduledRequestJob) {
    logger.warn('Scheduled request completion job already running');
    return;
  }
  
  // Run every minute
  const cronExpression = '* * * * *';
  
  logger.info(`Starting scheduled request completion job with cron: ${cronExpression}`);
  
  scheduledRequestJob = cron.schedule(cronExpression, async () => {
    logger.debug('Scheduled request completion job started');
    
    try {
      const connection = await getMySQLConnection();
      
      try {
        // Find scheduled requests where scheduled_for has passed and status is 'accepted'
        const [orders] = await connection.query(
          `SELECT id, business_id, scheduled_for, status 
           FROM orders 
           WHERE request_type = 'scheduled_request' 
           AND status = 'accepted'
           AND scheduled_for <= NOW()
           AND scheduled_for IS NOT NULL
           LIMIT 100`,
          []
        );
        
        if (orders.length > 0) {
          logger.info(`Found ${orders.length} scheduled requests to complete`);
          
          for (const order of orders) {
            try {
              // Update status to completed
              await orderRepository.updateStatus(
                order.id,
                order.business_id,
                'completed',
                'system',
                { completedAt: new Date() }
              );
              
              logger.info(`Scheduled request ${order.id} auto-completed`, {
                orderId: order.id,
                businessId: order.business_id,
                scheduledFor: order.scheduled_for
              });
            } catch (error) {
              logger.error(`Failed to complete scheduled request ${order.id}:`, error);
            }
          }
        }
        
        connection.release();
      } catch (error) {
        connection.release();
        throw error;
      }
    } catch (error) {
      logger.error('Scheduled request completion job failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Beirut'
  });
  
  logger.info('Scheduled request completion job scheduled successfully');
}

/**
 * Stop scheduled request completion job
 */
function stopScheduledRequestCompletionJob() {
  if (scheduledRequestJob) {
    scheduledRequestJob.stop();
    scheduledRequestJob = null;
    logger.info('Scheduled request completion job stopped');
  }
}

/**
 * Run scheduled request completion job manually (for testing)
 */
async function runScheduledRequestCompletionJob() {
  logger.info('Running scheduled request completion job manually');
  
  try {
    const connection = await getMySQLConnection();
    
    try {
      const [orders] = await connection.query(
        `SELECT id, business_id, scheduled_for, status 
         FROM orders 
         WHERE request_type = 'scheduled_request' 
         AND status = 'accepted'
         AND scheduled_for <= NOW()
         AND scheduled_for IS NOT NULL
         LIMIT 100`,
        []
      );
      
      let completed = 0;
      
      for (const order of orders) {
        try {
          await orderRepository.updateStatus(
            order.id,
            order.business_id,
            'completed',
            'system',
            { completedAt: new Date() }
          );
          completed++;
        } catch (error) {
          logger.error(`Failed to complete scheduled request ${order.id}:`, error);
        }
      }
      
      connection.release();
      
      logger.info(`Scheduled request completion job completed: ${completed} requests completed`);
      
      return { completed, total: orders.length };
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('Scheduled request completion job failed:', error);
    throw error;
  }
}

module.exports = {
  startScheduledRequestCompletionJob,
  stopScheduledRequestCompletionJob,
  runScheduledRequestCompletionJob
};
