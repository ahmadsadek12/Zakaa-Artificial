// Cart Routes
// Active cart management routes

const express = require('express');
const router = express.Router();
const { validationResult, query } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const { queryMySQL, getMySQLConnection } = require('../../config/database');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');
const { generateUUID } = require('../../utils/uuid');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * List all active carts
 * GET /api/carts?limit=&offset=
 */
router.get('/', [
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
  
  const limit = parseInt(req.query.limit || 50);
  const offset = parseInt(req.query.offset || 0);
  
  // Get all active carts for this business
  const sql = `
    SELECT 
      o.id,
      o.customer_phone_number,
      o.customer_name,
      o.delivery_type,
      o.subtotal,
      o.total,
      o.created_at,
      o.updated_at,
      o.language_used,
      o.order_source,
      COUNT(oi.id) as items_count,
      TIMESTAMPDIFF(MINUTE, o.updated_at, NOW()) as minutes_since_update,
      120 - TIMESTAMPDIFF(MINUTE, o.updated_at, NOW()) as minutes_until_timeout
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.business_id = ?
      AND o.status = 'cart'
      AND o.notes = '__cart__'
    GROUP BY o.id
    ORDER BY o.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  const carts = await queryMySQL(sql, [req.businessId]);
  
  res.json({
    success: true,
    data: { carts },
    count: carts.length,
    limit,
    offset
  });
}));

/**
 * Get cart details
 * GET /api/carts/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const cartId = req.params.id;
  
  try {
    // Get cart details - try with location columns first, fallback if they don't exist
    let carts;
    try {
      carts = await queryMySQL(`
        SELECT 
          o.id,
          o.customer_phone_number,
          o.customer_name,
          o.delivery_type,
          o.subtotal,
          o.delivery_price,
          o.total,
          o.notes,
          o.scheduled_for,
          o.language_used,
          o.order_source,
          o.created_at,
          o.updated_at,
          o.location_latitude,
          o.location_longitude,
          o.location_name,
          o.location_address,
          u.business_name as branch_name,
          TIMESTAMPDIFF(MINUTE, o.updated_at, NOW()) as minutes_since_update,
          120 - TIMESTAMPDIFF(MINUTE, o.updated_at, NOW()) as minutes_until_timeout
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
          AND o.business_id = ?
          AND o.status = 'cart'
          AND o.notes = '__cart__'
      `, [cartId, req.businessId]);
    } catch (locationError) {
      // If location columns don't exist, retry without them
      if (locationError.code === 'ER_BAD_FIELD_ERROR' && locationError.message.includes('location_')) {
        logger.warn('Location columns not found, fetching cart without location data', { cartId });
        carts = await queryMySQL(`
          SELECT 
            o.id,
            o.customer_phone_number,
            o.customer_name,
            o.delivery_type,
            o.subtotal,
            o.delivery_price,
            o.total,
            o.notes,
            o.scheduled_for,
            o.language_used,
            o.order_source,
            o.created_at,
            o.updated_at,
            NULL as location_latitude,
            NULL as location_longitude,
            NULL as location_name,
            NULL as location_address,
            u.business_name as branch_name,
            TIMESTAMPDIFF(MINUTE, o.updated_at, NOW()) as minutes_since_update,
            120 - TIMESTAMPDIFF(MINUTE, o.updated_at, NOW()) as minutes_until_timeout
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          WHERE o.id = ?
            AND o.business_id = ?
            AND o.status = 'cart'
            AND o.notes = '__cart__'
        `, [cartId, req.businessId]);
      } else {
        throw locationError;
      }
    }
    
    if (!carts || carts.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Cart not found' }
      });
    }
    
    const cart = carts[0];
    
    // Get cart items
    try {
      cart.items = await queryMySQL(`
        SELECT 
          oi.id,
          oi.order_id,
          oi.item_id,
          oi.quantity,
          oi.price_at_time,
          oi.name_at_time,
          oi.notes,
          i.name,
          i.description,
          i.item_image_url
        FROM order_items oi
        LEFT JOIN items i ON oi.item_id = i.id
        WHERE oi.order_id = ?
        ORDER BY oi.id
      `, [cartId]);
    } catch (itemsError) {
      logger.error('Error fetching cart items:', {
        cartId,
        error: itemsError.message,
        stack: itemsError.stack
      });
      cart.items = []; // Set empty array if items query fails
    }
    
    res.json({
      success: true,
      data: { cart }
    });
  } catch (error) {
    logger.error('Error fetching cart details:', {
      cartId,
      businessId: req.businessId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}));

/**
 * Cancel cart
 * DELETE /api/carts/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const cartId = req.params.id;
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Verify cart exists and belongs to this business
    const [carts] = await connection.query(`
      SELECT id, customer_phone_number
      FROM orders
      WHERE id = ?
        AND business_id = ?
        AND status = 'cart'
        AND notes = '__cart__'
    `, [cartId, req.businessId]);
    
    if (!carts || carts.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: { message: 'Cart not found' }
      });
    }
    
    const cart = carts[0];
    
    // Update cart status to rejected
    await connection.query(`
      UPDATE orders
      SET status = 'rejected',
          notes = 'Cart cancelled by business',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [cartId]);
    
    // Add status history entry
    const historyId = generateUUID();
    await connection.query(`
      INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
      VALUES (?, ?, 'rejected', 'business', CURRENT_TIMESTAMP)
    `, [historyId, cartId]);
    
    await connection.commit();
    
    logger.info('Cart cancelled by business', {
      cartId,
      businessId: req.businessId,
      userId: req.userId,
      customerPhoneNumber: cart.customer_phone_number
    });
    
    res.json({
      success: true,
      message: 'Cart cancelled successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    logger.error('Error cancelling cart', {
      cartId,
      businessId: req.businessId,
      error: error.message
    });
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
