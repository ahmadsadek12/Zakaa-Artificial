// Archive Job
// Cron job to archive completed orders

const cron = require('node-cron');
const archiveService = require('../services/archive/archiveService');
const logger = require('../utils/logger');
const CONSTANTS = require('../config/constants');

let archiveJob = null;

/**
 * Start archive job
 */
function startArchiveJob() {
  if (archiveJob) {
    logger.warn('Archive job already running');
    return;
  }
  
  const cronExpression = CONSTANTS.ARCHIVE_JOB_CRON || '0 2 * * *'; // Daily at 2 AM
  
  logger.info(`Starting archive job with cron: ${cronExpression}`);
  
  archiveJob = cron.schedule(cronExpression, async () => {
    logger.info('Archive job started');
    
    try {
      const result = await archiveService.archiveOrders();
      
      logger.info('Archive job completed', {
        archived: result.archived.length,
        errors: result.errors.length,
        total: result.total
      });
      
      if (result.errors.length > 0) {
        logger.error('Archive job errors:', result.errors);
        // In production, you might want to send notifications here
      }
    } catch (error) {
      logger.error('Archive job failed:', error);
      // In production, you might want to send alert notifications here
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Beirut'
  });
  
  logger.info('Archive job scheduled successfully');
}

/**
 * Stop archive job
 */
function stopArchiveJob() {
  if (archiveJob) {
    archiveJob.stop();
    archiveJob = null;
    logger.info('Archive job stopped');
  }
}

/**
 * Run archive job manually (for testing)
 */
async function runArchiveJob() {
  logger.info('Running archive job manually');
  
  try {
    const result = await archiveService.archiveOrders();
    
    logger.info('Archive job completed', {
      archived: result.archived.length,
      errors: result.errors.length,
      total: result.total
    });
    
    return result;
  } catch (error) {
    logger.error('Archive job failed:', error);
    throw error;
  }
}

module.exports = {
  startArchiveJob,
  stopArchiveJob,
  runArchiveJob
};
