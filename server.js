// Server Entry Point
// Start the Express server

require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const { connectMongoDB, getMySQLPool } = require('./src/config/database');
const CONSTANTS = require('./src/config/constants');
const { startArchiveJob } = require('./src/jobs/archiveJob');

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
    
    // Test MongoDB connection
    logger.info('Testing MongoDB connection...');
    await connectMongoDB();
    logger.info('MongoDB connection ready');
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${CONSTANTS.NODE_ENV}`);
      logger.info(`API Base URL: ${CONSTANTS.API_BASE_URL}`);
      
      // Start archive job
      startArchiveJob();
      logger.info('Archive job started');
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
