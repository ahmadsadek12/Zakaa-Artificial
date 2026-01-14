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

/**
 * External services health check
 * GET /health/services
 */
router.get('/services', async (req, res) => {
  try {
    const services = {
      openai: null,
      whatsapp: null
    };
    
    // Check OpenAI API (basic check - just verify key is set)
    const CONSTANTS = require('../config/constants');
    if (CONSTANTS.OPENAI_API_KEY) {
      services.openai = 'configured';
    } else {
      services.openai = 'not_configured';
    }
    
    // Check WhatsApp configuration
    if (CONSTANTS.WHATSAPP_VERIFY_TOKEN && CONSTANTS.WHATSAPP_WEBHOOK_SECRET) {
      services.whatsapp = 'configured';
    } else {
      services.whatsapp = 'not_configured';
    }
    
    const allConfigured = services.openai === 'configured' && services.whatsapp === 'configured';
    const status = allConfigured ? 'ok' : 'partial';
    const statusCode = allConfigured ? 200 : 503;
    
    res.status(statusCode).json({
      status,
      services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Services health check error:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
