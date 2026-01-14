// Analytics Routes (Premium Only)
// Premium analytics endpoints

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { requirePremium } = require('../../middleware/premium');
const { asyncHandler } = require('../../middleware/errorHandler');
const analyticsService = require('../../services/analytics/analyticsService');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication, business/admin/branch access, and premium subscription
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);
router.use(requirePremium);

/**
 * Get overview analytics
 * GET /api/analytics/overview?startDate=&endDate=
 */
router.get('/overview', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { startDate, endDate } = req.query;
  
  const overview = await analyticsService.getOverview(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { overview }
  });
}));

/**
 * Get revenue analytics
 * GET /api/analytics/revenue?period=daily&startDate=&endDate=
 */
router.get('/revenue', [
  query('period').optional().isIn(['daily', 'weekly', 'monthly']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { period = 'daily', startDate, endDate } = req.query;
  
  const revenue = await analyticsService.getRevenue(req.businessId, period, startDate, endDate);
  
  res.json({
    success: true,
    data: { revenue }
  });
}));

/**
 * Get order analytics
 * GET /api/analytics/orders?startDate=&endDate=
 */
router.get('/orders', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { startDate, endDate } = req.query;
  
  const overview = await analyticsService.getOverview(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { orders: overview }
  });
}));

/**
 * Get top items analytics
 * GET /api/analytics/items?limit=10&startDate=&endDate=
 */
router.get('/items', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { limit = 10, startDate, endDate } = req.query;
  
  const topItems = await analyticsService.getTopItems(req.businessId, parseInt(limit), startDate, endDate);
  
  res.json({
    success: true,
    data: { topItems },
    count: topItems.length
  });
}));

/**
 * Get customer analytics
 * GET /api/analytics/customers?startDate=&endDate=
 */
router.get('/customers', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { startDate, endDate } = req.query;
  
  const customers = await analyticsService.getCustomerAnalytics(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { customers },
    count: customers.length
  });
}));

/**
 * Get branch comparison analytics
 * GET /api/analytics/branches?startDate=&endDate=
 */
router.get('/branches', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { startDate, endDate } = req.query;
  
  const branches = await analyticsService.getBranchComparison(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { branches },
    count: branches.length
  });
}));

/**
 * Get top paying customers (most total spent)
 * GET /api/analytics/customers/top?limit=10&startDate=&endDate=
 */
router.get('/customers/top', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { limit = 10, startDate, endDate } = req.query;
  
  const customers = await analyticsService.getTopCustomers(req.businessId, parseInt(limit), startDate, endDate);
  
  res.json({
    success: true,
    data: { customers },
    count: customers.length
  });
}));

/**
 * Get most recurring customers (most orders)
 * GET /api/analytics/customers/recurring?limit=10&startDate=&endDate=
 */
router.get('/customers/recurring', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { limit = 10, startDate, endDate } = req.query;
  
  const customers = await analyticsService.getRecurringCustomers(req.businessId, parseInt(limit), startDate, endDate);
  
  res.json({
    success: true,
    data: { customers },
    count: customers.length
  });
}));

/**
 * Get customer lifetime value analysis
 * GET /api/analytics/customers/lifetime-value?startDate=&endDate=
 */
router.get('/customers/lifetime-value', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { startDate, endDate } = req.query;
  
  const analysis = await analyticsService.getCustomerLifetimeValue(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: analysis
  });
}));

/**
 * Get popular items (most ordered - using times_ordered from items table)
 * GET /api/analytics/items/popular?limit=10
 */
router.get('/items/popular', [
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { limit = 10 } = req.query;
  
  const items = await analyticsService.getPopularItems(req.businessId, parseInt(limit));
  
  res.json({
    success: true,
    data: { items },
    count: items.length
  });
}));

/**
 * Get most delivered items (most completed - using times_delivered from items table)
 * GET /api/analytics/items/delivered?limit=10
 */
router.get('/items/delivered', [
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { limit = 10 } = req.query;
  
  const items = await analyticsService.getMostDeliveredItems(req.businessId, parseInt(limit));
  
  res.json({
    success: true,
    data: { items },
    count: items.length
  });
}));

module.exports = router;
