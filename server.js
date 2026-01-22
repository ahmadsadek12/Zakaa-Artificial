// Server Entry Point
// Start the Express server

require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const { connectMongoDB, getMySQLPool } = require('./src/config/database');
const CONSTANTS = require('./src/config/constants');
const { startArchiveJob } = require('./src/jobs/archiveJob');
const { startCartCleanupJob } = require('./src/jobs/cartCleanupJob');
const cartTimeoutJob = require('./src/jobs/cartTimeoutJob');
const { startScheduledRequestCompletionJob } = require('./src/jobs/scheduledRequestCompletionJob');
const { startReservationAutoCompleteJob } = require('./src/jobs/reservationAutoCompleteJob');

const PORT = CONSTANTS.PORT;

// Initialize database connections
async function startServer() {
  try {
    // Test MySQL connection
    logger.info('Testing MySQL connection...');
    const mysqlPool = getMySQLPool();
    if (!mysqlPool) {
      throw new Error('MySQL pool not initialized');
    }
    logger.info('MySQL connection pool ready');
    
    // MongoDB disabled - skipping connection
    logger.info('MongoDB disabled - message logging and conversation history will be skipped');
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${CONSTANTS.NODE_ENV}`);
      logger.info(`API Base URL: ${CONSTANTS.API_BASE_URL}`);
      
      // Start archive job
      startArchiveJob();
      logger.info('Archive job started');
      
      // Start cart cleanup job
      startCartCleanupJob();
      logger.info('Cart cleanup job started');
      
      // Start cart timeout job
      cartTimeoutJob.start();
      logger.info('Cart timeout job started');
      
      // Start scheduled request completion job
      startScheduledRequestCompletionJob();
      logger.info('Scheduled request completion job started');
      
      // Start reservation auto-complete job
      startReservationAutoCompleteJob();
      logger.info('Reservation auto-complete job started');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  const { closeConnections } = require('./src/config/database');
  await closeConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  const { closeConnections } = require('./src/config/database');
  await closeConnections();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
