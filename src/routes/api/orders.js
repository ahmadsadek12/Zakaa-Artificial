// Order Routes
// Order management routes

const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const orderService = require('../../services/order/orderService');
const orderRepository = require('../../repositories/orderRepository');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS));
router.use(tenantIsolation);

/**
 * List orders with filters
 * GET /api/orders?status=&branchId=&startDate=&endDate=&limit=&offset=
 */
router.get('/', [
  query('status').optional().isIn(['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const filters = {
    businessId: req.businessId,
    branchId: req.query.branchId || null,
    status: req.query.status || null,
    startDate: req.query.startDate || null,
    endDate: req.query.endDate || null,
    limit: req.query.limit || 20,
    offset: req.query.offset || 0
  };
  
  const orders = await orderRepository.find(filters);
  
  // Get items for each order
  for (const order of orders) {
    order.items = await orderRepository.getOrderItems(order.id);
  }
  
  res.json({
    success: true,
    data: { orders },
    count: orders.length,
    filters
  });
}));

/**
 * Get order details
 * GET /api/orders/:id
 */
router.get('/:id', requireOwnership('orders'), asyncHandler(async (req, res) => {
  const order = await orderService.getOrderDetails(req.params.id, req.businessId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: 'Order not found' }
    });
  }
  
  res.json({
    success: true,
    data: { order }
  });
}));

/**
 * Update order status
 * PUT /api/orders/:id/status
 */
router.put('/:id/status', requireOwnership('orders'), [
  body('status').isIn(['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { status } = req.body;
  const changedBy = req.user.userType === 'admin' ? 'admin' : 'business';
  
  const order = await orderService.updateOrderStatus(req.params.id, req.businessId, status, changedBy);
  
  logger.info(`Order ${req.params.id} status updated to ${status} by ${req.user.id}`);
  
  res.json({
    success: true,
    data: { order }
  });
}));

/**
 * Cancel order
 * POST /api/orders/:id/cancel
 */
router.post('/:id/cancel', requireOwnership('orders'), asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.params.id, req.businessId, 'business');
  
  logger.info(`Order ${req.params.id} cancelled by ${req.user.id}`);
  
  res.json({
    success: true,
    data: { order },
    message: 'Order cancelled successfully'
  });
}));

/**
 * Get order statistics
 * GET /api/orders/stats?startDate=&endDate=
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const filters = {
    businessId: req.businessId,
    branchId: req.query.branchId || null,
    startDate: req.query.startDate || null,
    endDate: req.query.endDate || null
  };
  
  // Get all orders for stats
  const allOrders = await orderRepository.find({ ...filters, limit: 10000 });
  
  const stats = {
    total: allOrders.length,
    byStatus: {},
    totalRevenue: 0,
    averageOrderValue: 0
  };
  
  for (const order of allOrders) {
    // Count by status
    stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
    
    // Calculate revenue (completed orders only)
    if (order.status === 'completed') {
      stats.totalRevenue += parseFloat(order.total || 0);
    }
  }
  
  const completedOrders = stats.byStatus.completed || 0;
  stats.averageOrderValue = completedOrders > 0 ? stats.totalRevenue / completedOrders : 0;
  
  res.json({
    success: true,
    data: { stats }
  });
}));

module.exports = router;
