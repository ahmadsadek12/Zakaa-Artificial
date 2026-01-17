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
 * Debug opening hours check
 * GET /health/opening-hours?businessId=xxx&branchId=xxx
 */
router.get('/opening-hours', async (req, res) => {
  try {
    const { businessId, branchId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({
        status: 'error',
        error: 'businessId query parameter is required'
      });
    }
    
    const conversationManager = require('../services/llm/conversationManager');
    const { queryMySQL } = require('../config/database');
    
    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentTime = now.toTimeString().substring(0, 5);
    
    // Get opening hours from database
    let hours = [];
    const targetBranchId = branchId || businessId;
    
    if (branchId && branchId !== businessId) {
      hours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
      `, ['branch', branchId, dayOfWeek]);
    }
    
    if (hours.length === 0) {
      hours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
      `, ['business', businessId, dayOfWeek]);
    }
    
    // Check status using the function
    const openStatus = await conversationManager.isOpenNow(businessId, targetBranchId);
    
    res.json({
      status: 'ok',
      currentTime: {
        date: now.toISOString(),
        dayOfWeek,
        time: currentTime
      },
      businessId,
      branchId: targetBranchId,
      openingHours: hours.length > 0 ? {
        day: hours[0].day_of_week,
        isClosed: hours[0].is_closed,
        openTime: hours[0].open_time,
        closeTime: hours[0].close_time,
        lastOrderBeforeClosingMinutes: hours[0].last_order_before_closing_minutes
      } : null,
      openStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Opening hours debug error:', error);
    res.status(500).json({
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
