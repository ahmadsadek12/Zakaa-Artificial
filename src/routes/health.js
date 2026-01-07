// Health Check Routes
// Health and database status endpoints

const express = require('express');
const router = express.Router();
const { testMySQL, testMongoDB } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Basic health check
 * GET /health
 */
router.get('/', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Database health check
 * GET /health/db
 */
router.get('/db', async (req, res) => {
  try {
    const mysqlStatus = await testMySQL();
    const mongodbStatus = await testMongoDB();
    
    const status = mysqlStatus && mongodbStatus ? 'ok' : 'degraded';
    const statusCode = status === 'ok' ? 200 : 503;
    
    res.status(statusCode).json({
      status,
      databases: {
        mysql: mysqlStatus ? 'connected' : 'disconnected',
        mongodb: mongodbStatus ? 'connected' : 'disconnected'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
