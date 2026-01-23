// Analytics Routes (Premium Only)
// Premium analytics endpoints

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { requirePremium } = require('../../middleware/premium');
const { requireDataAnalyticsSubscription } = require('../../middleware/subscriptionGuard');
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
 * Get basic overview (no premium required) - calculates from orders table
 * GET /api/analytics/basic-overview?startDate=&endDate=
 */
router.get('/basic-overview', [
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
  const { queryMySQL } = require('../../config/database');
  
  // Build date filter
  let dateFilter = '';
  const params = [req.businessId];
  if (startDate) {
    dateFilter += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND created_at <= ?';
    params.push(endDate + ' 23:59:59');
  }
  
  // Get basic stats from orders table
  const [stats] = await queryMySQL(`
    SELECT 
      COUNT(*) as totalOrders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledOrders,
      SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as totalRevenue,
      AVG(CASE WHEN status = 'completed' THEN total ELSE NULL END) as averageOrderValue
    FROM orders
    WHERE business_id = ? ${dateFilter}
  `, params);
  
  const overview = {
    totalOrders: parseInt(stats[0]?.totalOrders || 0),
    completedOrders: parseInt(stats[0]?.completedOrders || 0),
    cancelledOrders: parseInt(stats[0]?.cancelledOrders || 0),
    totalRevenue: parseFloat(stats[0]?.totalRevenue || 0),
    averageOrderValue: parseFloat(stats[0]?.averageOrderValue || 0)
  };
  
  res.json({
    success: true,
    data: { overview }
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

// ============================================================================
// DATA AND ANALYTICS SUBSCRIPTION ROUTES
// All routes below require "Data and Analytics" subscription
// ============================================================================

/**
 * Helper function to build filters from query params
 */
function buildFiltersFromQuery(query) {
  const filters = {};
  if (query.startDate) filters.startDate = query.startDate;
  if (query.endDate) filters.endDate = query.endDate;
  if (query.branchId) filters.branchId = query.branchId;
  if (query.deliveryType) filters.deliveryType = query.deliveryType;
  if (query.platform) filters.platform = query.platform;
  if (query.categoryId) filters.categoryId = query.categoryId;
  if (query.menuId) filters.menuId = query.menuId;
  return filters;
}

// ============================================================================
// CUSTOMER ANALYTICS
// ============================================================================

/**
 * Get most loyal customer
 * GET /api/analytics/data/customers/most-loyal
 */
router.get('/data/customers/most-loyal', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getMostLoyalCustomer(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get top spenders
 * GET /api/analytics/data/customers/top-spenders?limit=10
 */
router.get('/data/customers/top-spenders', requireDataAnalyticsSubscription, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const limit = parseInt(req.query.limit) || 10;
  const result = await analyticsService.getTopSpenders(req.businessId, limit, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get highest profit customers
 * GET /api/analytics/data/customers/highest-profit?limit=10
 */
router.get('/data/customers/highest-profit', requireDataAnalyticsSubscription, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const limit = parseInt(req.query.limit) || 10;
  const result = await analyticsService.getHighestProfitCustomers(req.businessId, limit, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get most frequent customers
 * GET /api/analytics/data/customers/most-frequent?limit=10
 */
router.get('/data/customers/most-frequent', requireDataAnalyticsSubscription, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const limit = parseInt(req.query.limit) || 10;
  const result = await analyticsService.getMostFrequentCustomers(req.businessId, limit, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get new vs returning customers
 * GET /api/analytics/data/customers/new-vs-returning
 */
router.get('/data/customers/new-vs-returning', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getNewVsReturningCustomers(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get cancelled orders count
 * GET /api/analytics/data/customers/cancelled-count
 */
router.get('/data/customers/cancelled-count', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getCancelledOrdersCount(req.businessId, filters);
  res.json({ success: true, data: { count: result } });
}));

/**
 * Get customer retention
 * GET /api/analytics/data/customers/retention
 */
router.get('/data/customers/retention', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getCustomerRetention(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get churned customers
 * GET /api/analytics/data/customers/churned
 */
router.get('/data/customers/churned', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getChurnedCustomers(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get avg order value per customer
 * GET /api/analytics/data/customers/avg-order-value
 */
router.get('/data/customers/avg-order-value', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getAvgOrderValuePerCustomer(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get customer response behavior
 * GET /api/analytics/data/customers/response-behavior
 */
router.get('/data/customers/response-behavior', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getCustomerResponseBehavior(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get customer location clusters
 * GET /api/analytics/data/customers/location-clusters
 */
router.get('/data/customers/location-clusters', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getCustomerLocationClusters(req.businessId, filters);
  res.json({ success: true, data: result });
}));

// ============================================================================
// SERVICE ANALYTICS
// ============================================================================

/**
 * Get least ordered service
 * GET /api/analytics/data/services/least-ordered
 */
router.get('/data/services/least-ordered', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getLeastOrderedService(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get revenue per service
 * GET /api/analytics/data/services/revenue
 */
router.get('/data/services/revenue', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getRevenuePerService(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get profit per service
 * GET /api/analytics/data/services/profit
 */
router.get('/data/services/profit', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getProfitPerService(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get profit margin per service
 * GET /api/analytics/data/services/profit-margin
 */
router.get('/data/services/profit-margin', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getProfitMarginPerService(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get service popularity trend
 * GET /api/analytics/data/services/popularity-trend
 */
router.get('/data/services/popularity-trend', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getServicePopularityTrend(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get top services by time of day
 * GET /api/analytics/data/services/by-time-of-day
 */
router.get('/data/services/by-time-of-day', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getTopServicesByTimeOfDay(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get frequently bought together
 * GET /api/analytics/data/services/frequently-bought-together?limit=10
 */
router.get('/data/services/frequently-bought-together', requireDataAnalyticsSubscription, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const limit = parseInt(req.query.limit) || 10;
  const result = await analyticsService.getFrequentlyBoughtTogether(req.businessId, limit, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get customization usage
 * GET /api/analytics/data/services/customization-usage?limit=20
 */
router.get('/data/services/customization-usage', requireDataAnalyticsSubscription, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const limit = parseInt(req.query.limit) || 20;
  const result = await analyticsService.getCustomizationUsage(req.businessId, limit, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get out-of-stock impact
 * GET /api/analytics/data/services/out-of-stock-impact
 */
router.get('/data/services/out-of-stock-impact', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getOutOfStockImpact(req.businessId, filters);
  res.json({ success: true, data: result });
}));

// ============================================================================
// ORDER / SALES ANALYTICS
// ============================================================================

/**
 * Get total orders
 * GET /api/analytics/data/orders/total?period=day|week|month|hour
 */
router.get('/data/orders/total', requireDataAnalyticsSubscription, [
  query('period').optional().isIn(['hour', 'day', 'week', 'month']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const period = req.query.period || 'day';
  const result = await analyticsService.getTotalOrders(req.businessId, period, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get total revenue
 * GET /api/analytics/data/orders/revenue?period=day|week|month|hour
 */
router.get('/data/orders/revenue', requireDataAnalyticsSubscription, [
  query('period').optional().isIn(['hour', 'day', 'week', 'month']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const period = req.query.period || 'day';
  const result = await analyticsService.getTotalRevenue(req.businessId, period, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get total profit
 * GET /api/analytics/data/orders/profit?period=day|week|month|hour
 */
router.get('/data/orders/profit', requireDataAnalyticsSubscription, [
  query('period').optional().isIn(['hour', 'day', 'week', 'month']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const period = req.query.period || 'day';
  const result = await analyticsService.getTotalProfit(req.businessId, period, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get average order value
 * GET /api/analytics/data/orders/avg-order-value
 */
router.get('/data/orders/avg-order-value', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getAverageOrderValue(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get order status breakdown
 * GET /api/analytics/data/orders/status-breakdown
 */
router.get('/data/orders/status-breakdown', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getOrderStatusBreakdown(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get cancellation rate
 * GET /api/analytics/data/orders/cancellation-rate
 */
router.get('/data/orders/cancellation-rate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getCancellationRate(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get rejection rate
 * GET /api/analytics/data/orders/rejection-rate
 */
router.get('/data/orders/rejection-rate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getRejectionRate(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get scheduled vs immediate requests
 * GET /api/analytics/data/orders/scheduled-vs-immediate
 */
router.get('/data/orders/scheduled-vs-immediate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getScheduledVsImmediateRequests(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get delivery type split
 * GET /api/analytics/data/orders/delivery-type-split
 */
router.get('/data/orders/delivery-type-split', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getDeliveryTypeSplit(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get peak ordering hours
 * GET /api/analytics/data/orders/peak-hours
 */
router.get('/data/orders/peak-hours', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getPeakOrderingHours(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get peak ordering days
 * GET /api/analytics/data/orders/peak-days
 */
router.get('/data/orders/peak-days', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getPeakOrderingDays(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get time to complete
 * GET /api/analytics/data/orders/time-to-complete
 */
router.get('/data/orders/time-to-complete', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getTimeToComplete(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get sales heatmap
 * GET /api/analytics/data/orders/heatmap
 */
router.get('/data/orders/heatmap', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getSalesHeatmap(req.businessId, filters);
  res.json({ success: true, data: result });
}));

// ============================================================================
// CHATBOT + OPS ANALYTICS
// ============================================================================

/**
 * Get requests handled
 * GET /api/analytics/data/chatbot/requests-handled
 */
router.get('/data/chatbot/requests-handled', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getRequestsHandled(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get conversations count
 * GET /api/analytics/data/chatbot/conversations
 */
router.get('/data/chatbot/conversations', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getConversationsCount(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get average response time
 * GET /api/analytics/data/chatbot/response-time
 */
router.get('/data/chatbot/response-time', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getAverageResponseTime(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get resolution rate
 * GET /api/analytics/data/chatbot/resolution-rate
 */
router.get('/data/chatbot/resolution-rate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getResolutionRate(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get conversion rate
 * GET /api/analytics/data/chatbot/conversion-rate
 */
router.get('/data/chatbot/conversion-rate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getConversionRate(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get drop-off points
 * GET /api/analytics/data/chatbot/drop-off-points
 */
router.get('/data/chatbot/drop-off-points', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getDropOffPoints(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get most asked questions
 * GET /api/analytics/data/chatbot/most-asked-questions?limit=20
 */
router.get('/data/chatbot/most-asked-questions', requireDataAnalyticsSubscription, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const limit = parseInt(req.query.limit) || 20;
  const result = await analyticsService.getMostAskedQuestions(req.businessId, limit, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get fallback rate
 * GET /api/analytics/data/chatbot/fallback-rate
 */
router.get('/data/chatbot/fallback-rate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getFallbackRate(req.businessId, filters);
  res.json({ success: true, data: result });
}));

// ============================================================================
// DELIVERY / LOGISTICS ANALYTICS
// ============================================================================

/**
 * Get carrier usage (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/delivery/carrier-usage
 */
router.get('/data/delivery/carrier-usage', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getCarrierUsage(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get avg delivery time range (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/delivery/avg-time-range
 */
router.get('/data/delivery/avg-time-range', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getAvgDeliveryTimeRange(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get busy delivery slots
 * GET /api/analytics/data/delivery/busy-slots
 */
router.get('/data/delivery/busy-slots', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getBusyDeliverySlots(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get common delivery areas
 * GET /api/analytics/data/delivery/common-areas
 */
router.get('/data/delivery/common-areas', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getCommonDeliveryAreas(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get delivery fee revenue
 * GET /api/analytics/data/delivery/fee-revenue
 */
router.get('/data/delivery/fee-revenue', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getDeliveryFeeRevenue(req.businessId, filters);
  res.json({ success: true, data: result });
}));

// ============================================================================
// RESERVATIONS ANALYTICS (PLACEHOLDERS)
// ============================================================================

/**
 * Get total reservations (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/reservations/total
 */
router.get('/data/reservations/total', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getTotalReservations(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get reservation completion rate (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/reservations/completion-rate
 */
router.get('/data/reservations/completion-rate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getReservationCompletionRate(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get no-show rate (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/reservations/no-show-rate
 */
router.get('/data/reservations/no-show-rate', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getNoShowRate(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get peak reservation hours (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/reservations/peak-hours
 */
router.get('/data/reservations/peak-hours', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getPeakReservationHours(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get peak reservation days (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/reservations/peak-days
 */
router.get('/data/reservations/peak-days', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getPeakReservationDays(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get table utilization (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/reservations/table-utilization
 */
router.get('/data/reservations/table-utilization', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getTableUtilization(req.businessId, filters);
  res.json({ success: true, data: result });
}));

/**
 * Get avg guests per reservation (FRONTEND ONLY - placeholder)
 * GET /api/analytics/data/reservations/avg-guests
 */
router.get('/data/reservations/avg-guests', requireDataAnalyticsSubscription, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const result = await analyticsService.getAvgGuestsPerReservation(req.businessId, filters);
  res.json({ success: true, data: result });
}));

// ============================================================================
// FINANCIAL SUMMARIES
// ============================================================================

/**
 * Get daily sales report
 * GET /api/analytics/data/financial/daily-report?date=YYYY-MM-DD
 */
router.get('/data/financial/daily-report', requireDataAnalyticsSubscription, [
  query('date').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const date = req.query.date || null;
  const result = await analyticsService.getDailySalesReport(req.businessId, date);
  res.json({ success: true, data: result });
}));

/**
 * Get weekly summary
 * GET /api/analytics/data/financial/weekly-summary?weekStartDate=YYYY-MM-DD
 */
router.get('/data/financial/weekly-summary', requireDataAnalyticsSubscription, [
  query('weekStartDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const weekStartDate = req.query.weekStartDate || null;
  const result = await analyticsService.getWeeklySummary(req.businessId, weekStartDate);
  res.json({ success: true, data: result });
}));

/**
 * Get monthly performance
 * GET /api/analytics/data/financial/monthly-performance?year=YYYY&month=MM
 */
router.get('/data/financial/monthly-performance', requireDataAnalyticsSubscription, [
  query('year').optional().isInt({ min: 2000, max: 2100 }),
  query('month').optional().isInt({ min: 1, max: 12 })
], asyncHandler(async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  const month = req.query.month ? parseInt(req.query.month) : null;
  const result = await analyticsService.getMonthlyPerformance(req.businessId, year, month);
  res.json({ success: true, data: result });
}));

/**
 * Get month-over-month growth
 * GET /api/analytics/data/financial/month-over-month-growth
 */
router.get('/data/financial/month-over-month-growth', requireDataAnalyticsSubscription, asyncHandler(async (req, res) => {
  const result = await analyticsService.getMonthOverMonthGrowth(req.businessId);
  res.json({ success: true, data: result });
}));

/**
 * Get best day this month
 * GET /api/analytics/data/financial/best-day-this-month
 */
router.get('/data/financial/best-day-this-month', requireDataAnalyticsSubscription, asyncHandler(async (req, res) => {
  const result = await analyticsService.getBestDayThisMonth(req.businessId);
  res.json({ success: true, data: result });
}));

/**
 * Get best hour this month
 * GET /api/analytics/data/financial/best-hour-this-month
 */
router.get('/data/financial/best-hour-this-month', requireDataAnalyticsSubscription, asyncHandler(async (req, res) => {
  const result = await analyticsService.getBestHourThisMonth(req.businessId);
  res.json({ success: true, data: result });
}));

module.exports = router;
