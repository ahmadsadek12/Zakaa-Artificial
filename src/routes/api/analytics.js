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

// All routes require authentication, business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

// Import addonGuard for paid metrics
const { addonGuard } = require('../../middleware/addonGuard');

/**
 * Get FREE metrics (no premium required)
 * GET /api/analytics/free?startDate=&endDate=
 */
router.get('/free', [
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
  
  const freeMetrics = await analyticsService.getFreeMetrics(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { freeMetrics }
  });
}));

/**
 * Get overview analytics (premium required)
 * GET /api/analytics/overview?startDate=&endDate=
 */
router.get('/overview', requirePremium, [
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
 * Get revenue analytics (premium required)
 * GET /api/analytics/revenue?period=daily&startDate=&endDate=
 */
router.get('/revenue', requirePremium, [
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
 * Get order analytics (premium required)
 * GET /api/analytics/orders?startDate=&endDate=
 */
router.get('/orders', requirePremium, [
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
 * Get top items analytics (premium required)
 * GET /api/analytics/items?limit=10&startDate=&endDate=
 */
router.get('/items', requirePremium, [
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
 * Get customer analytics (premium required)
 * GET /api/analytics/customers?startDate=&endDate=
 */
router.get('/customers', requirePremium, [
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
 * Get branch comparison analytics (premium required)
 * GET /api/analytics/branches?startDate=&endDate=
 */
router.get('/branches', requirePremium, [
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
 * Get top paying customers (most total spent) (premium required)
 * GET /api/analytics/customers/top?limit=10&startDate=&endDate=
 */
router.get('/customers/top', requirePremium, [
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
 * Get most recurring customers (most orders) (premium required)
 * GET /api/analytics/customers/recurring?limit=10&startDate=&endDate=
 */
router.get('/customers/recurring', requirePremium, [
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
 * Get customer lifetime value analysis (premium required)
 * GET /api/analytics/customers/lifetime-value?startDate=&endDate=
 */
router.get('/customers/lifetime-value', requirePremium, [
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
 * Get popular items (most ordered - using times_ordered from items table) (premium required)
 * GET /api/analytics/items/popular?limit=10
 */
router.get('/items/popular', requirePremium, [
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
 * Get most delivered items (most completed - using times_delivered from items table) (premium required)
 * GET /api/analytics/items/delivered?limit=10
 */
router.get('/items/delivered', requirePremium, [
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

/**
 * Get loyal customer (PAID ADDON: analytics_paid_loyal_customer)
 * GET /api/analytics/loyal-customer?startDate=&endDate=
 */
router.get('/loyal-customer', addonGuard('analytics_paid_loyal_customer'), [
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
  
  const loyalCustomer = await analyticsService.getLoyalCustomer(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { loyalCustomer }
  });
}));

/**
 * Get most ordered service (PAID ADDON: analytics_paid_most_ordered)
 * GET /api/analytics/most-ordered?startDate=&endDate=
 */
router.get('/most-ordered', addonGuard('analytics_paid_most_ordered'), [
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
  
  const mostOrdered = await analyticsService.getMostOrdered(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { mostOrdered }
  });
}));

/**
 * Get most rewarding service (PAID ADDON: analytics_paid_most_rewarding)
 * GET /api/analytics/most-rewarding?startDate=&endDate=
 */
router.get('/most-rewarding', addonGuard('analytics_paid_most_rewarding'), [
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
  
  const mostRewarding = await analyticsService.getMostRewarding(req.businessId, startDate, endDate);
  
  res.json({
    success: true,
    data: { mostRewarding }
  });
}));

/**
 * Get time breakdown (PAID ADDON: analytics_paid_time_breakdown)
 * GET /api/analytics/time-breakdown?period=hour|day|month&startDate=&endDate=
 */
router.get('/time-breakdown', addonGuard('analytics_paid_time_breakdown'), [
  query('period').optional().isIn(['hour', 'day', 'month']),
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
  
  const { period = 'day', startDate, endDate } = req.query;
  
  const timeBreakdown = await analyticsService.getTimeBreakdown(req.businessId, period, startDate, endDate);
  
  res.json({
    success: true,
    data: { timeBreakdown }
  });
}));

module.exports = router;
