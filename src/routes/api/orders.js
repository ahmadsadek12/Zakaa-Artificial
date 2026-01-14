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

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * List orders with filters
 * GET /api/orders?status=&branchId=&startDate=&endDate=&limit=&offset=
 */
router.get('/', [
  query('status').optional().isIn(['accepted', 'delivering', 'completed', 'rejected']),
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
    userId: req.query.userId || req.query.branchId || (req.isBranchUser ? req.userId : null),
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
 * Get order statistics
 * GET /api/orders/stats?startDate=&endDate=
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const filters = {
    businessId: req.businessId,
    userId: req.query.userId || req.query.branchId || (req.isBranchUser ? req.userId : null),
    startDate: req.query.startDate || null,
    endDate: req.query.endDate || null
  };
  
  // Get all orders for stats
  const allOrders = await orderRepository.find({ ...filters, limit: 10000 });
  
  const stats = {
    total: allOrders.length,
    byStatus: {},
    totalRevenue: 0,
    averageOrderValue: 0,
    accepted: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0
  };
  
  for (const order of allOrders) {
    // Count by status (including new fields)
    stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
    
    // Count accepted, ongoing, completed separately for dashboard
    if (order.status === 'accepted') stats.accepted++;
    if (order.status === 'ongoing') stats.ongoing++;
    if (order.status === 'completed') {
      stats.completed++;
      stats.totalRevenue += parseFloat(order.total || 0);
    }
    if (order.status === 'cancelled') stats.cancelled++;
  }
  
  const completedOrders = stats.completed || 0;
  stats.averageOrderValue = completedOrders > 0 ? stats.totalRevenue / completedOrders : 0;
  
  res.json({
    success: true,
    data: { stats }
  });
}));

/**
 * Create manual order
 * POST /api/orders
 * Allows businesses to manually create orders with all details
 * IMPORTANT: Must be before GET /:id to avoid route conflicts
 */
router.post('/', [
  body('customerPhoneNumber').notEmpty().withMessage('Customer phone number required'),
  body('customerName').optional().isString(),
  body('deliveryType').isIn(['takeaway', 'delivery', 'on_site']).withMessage('Invalid delivery type'),
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.itemId').isUUID().withMessage('Valid item ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.notes').optional().isString(),
  body('notes').optional().isString(),
  body('scheduledFor').optional().isISO8601().withMessage('Scheduled time must be valid ISO 8601 date'),
  body('locationLatitude').optional().isDecimal().withMessage('Latitude must be a valid decimal'),
  body('locationLongitude').optional().isDecimal().withMessage('Longitude must be a valid decimal'),
  body('locationName').optional().isString(),
  body('locationAddress').optional().isString(),
  body('paymentMethod').optional().isIn(['cash', 'card', 'wallet', 'unknown']),
  body('language').optional().isIn(['arabic', 'arabizi', 'english', 'french'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }

  const {
    customerPhoneNumber,
    customerName,
    deliveryType,
    items,
    notes,
    scheduledFor,
    locationLatitude,
    locationLongitude,
    locationName,
    locationAddress,
    paymentMethod,
    language
  } = req.body;

  // Validate delivery address for delivery orders
  if (deliveryType === 'delivery' && !locationAddress && !notes) {
    return res.status(400).json({
      success: false,
      error: { message: 'Delivery address or location required for delivery orders' }
    });
  }

  // Use the orderService to create the order (similar to chatbot flow)
  const { generateUUID } = require('../../utils/uuid');
  const { queryMySQL, getMySQLConnection } = require('../../config/database');
  const connection = await getMySQLConnection();

  try {
    await connection.beginTransaction();

    const orderId = generateUUID();
    const userId = req.userId; // Branch or business user creating the order
    
    // Get a valid branch_id for the foreign key constraint
    let branchId = null;
    try {
      const [branches] = await connection.query(`SELECT id FROM branches WHERE business_id = ? LIMIT 1`, [req.businessId]);
      if (branches && branches.length > 0) {
        branchId = branches[0].id;
      } else {
        // Fallback: get any branch_id from branches table
        const [anyBranch] = await connection.query(`SELECT id FROM branches LIMIT 1`);
        if (anyBranch && anyBranch.length > 0) {
          branchId = anyBranch[0].id;
        }
      }
    } catch (branchError) {
      logger.error('Error fetching branch_id:', branchError);
    }
    
    if (!branchId) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        error: { message: 'No branch found in database - cannot create order. Please contact support.' }
      });
    }

    // Calculate totals
    let subtotal = 0;
    const itemsData = [];

    for (const item of items) {
      const [dbItems] = await connection.query(
        'SELECT * FROM items WHERE id = ? AND business_id = ? AND deleted_at IS NULL',
        [item.itemId, req.businessId]
      );

      if (!dbItems || dbItems.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: { message: `Item ${item.itemId} not found` }
        });
      }

      const dbItem = dbItems[0];
      const itemSubtotal = parseFloat(dbItem.price) * item.quantity;
      subtotal += itemSubtotal;

      itemsData.push({
        itemId: item.itemId,
        name: dbItem.name,
        price: dbItem.price,
        quantity: item.quantity,
        notes: item.notes || null
      });
    }

    const deliveryPrice = deliveryType === 'delivery' ? 0 : 0; // TODO: Calculate based on business settings
    const total = subtotal + deliveryPrice;

    // Create order
    await connection.query(`
      INSERT INTO orders (
        id, business_id, user_id, branch_id, customer_phone_number, customer_name,
        status, subtotal, delivery_price, total, delivery_type,
        notes, scheduled_for,
        location_latitude, location_longitude, location_name, location_address,
        payment_method, payment_status, language_used, order_source,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      orderId,
      req.businessId,
      userId,
      branchId, // Add branch_id for foreign key constraint
      customerPhoneNumber,
      customerName || null,
      'accepted', // Manual orders start as accepted
      subtotal,
      deliveryPrice,
      total,
      deliveryType,
      notes || null,
      scheduledFor || null,
      locationLatitude || null,
      locationLongitude || null,
      locationName || null,
      locationAddress || null,
      paymentMethod || 'unknown',
      'unpaid',
      language || null,
      'manual'
    ]);

    // Add order items
    for (const item of itemsData) {
      const itemId = generateUUID();
      await connection.query(`
        INSERT INTO order_items (id, order_id, item_id, quantity, price_at_time, name_at_time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [itemId, orderId, item.itemId, item.quantity, item.price, item.name, item.notes]);
    }

    // Add status history
    const historyId = generateUUID();
    const changedBy = req.user?.userType === 'admin' ? 'admin' : 'business';
    await connection.query(`
      INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [historyId, orderId, 'accepted', changedBy]);

    await connection.commit();

    // Fetch the complete order
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];
    order.items = itemsData;

    logger.info(`Manual order created: ${orderId} by user: ${req.userId}`, {
      orderId,
      businessId: req.businessId,
      userId: req.userId,
      customerPhoneNumber,
      itemCount: items.length,
      total
    });

    res.status(201).json({
      success: true,
      data: { order },
      message: 'Order created successfully'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Error creating manual order:', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      businessId: req.businessId,
      payload: req.body
    });
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create order',
        details: error.message
      }
    });
  } finally {
    connection.release();
  }
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
  body('status').isIn(['accepted', 'delivering', 'completed', 'rejected']).withMessage('Invalid status')
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
 * Cancel scheduled order
 * POST /api/orders/:id/cancel-scheduled
 * Only works for scheduled orders with > 2 hours remaining
 */
router.post('/:id/cancel-scheduled', requireOwnership('orders'), asyncHandler(async (req, res) => {
  const { getMySQLConnection } = require('../../config/database');
  const { generateUUID } = require('../../utils/uuid');
  const connection = await getMySQLConnection();
  
  try {
    // Get order
    const [orders] = await connection.query(
      `SELECT * FROM orders WHERE id = ? AND business_id = ?`,
      [req.params.id, req.businessId]
    );
    
    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Order not found' }
      });
    }
    
    const order = orders[0];
    
    // Validate it's a scheduled order
    if (!order.scheduled_for) {
      return res.status(400).json({
        success: false,
        error: { message: 'This is not a scheduled order' }
      });
    }
    
    // Validate it's in the future
    const scheduledDate = new Date(order.scheduled_for);
    const now = new Date();
    
    if (scheduledDate <= now) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot cancel past orders' }
      });
    }
    
    // Validate more than 2 hours remaining
    const hoursUntil = (scheduledDate - now) / (1000 * 60 * 60);
    
    if (hoursUntil < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot cancel orders scheduled within 2 hours. Please contact the customer directly.' }
      });
    }
    
    // Validate status
    if (order.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot cancel order with status: ${order.status}` }
      });
    }
    
    // Cancel the order
    await connection.beginTransaction();
    
    await connection.query(
      `UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    
    await connection.query(
      `INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
       VALUES (?, ?, 'rejected', 'business', CURRENT_TIMESTAMP)`,
      [generateUUID(), req.params.id]
    );
    
    await connection.commit();
    
    logger.info(`Scheduled order ${req.params.id} cancelled by business ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'Scheduled order cancelled successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    logger.error('Error cancelling scheduled order', { error: error.message, orderId: req.params.id });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to cancel order', details: error.message }
    });
  } finally {
    connection.release();
  }
}));

module.exports = router;
