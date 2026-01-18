// Order Repository
// Data access layer for orders

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find order by ID
 */
async function findById(orderId, businessId = null) {
  let sql = `
    SELECT o.*, 
           u.business_name as branch_name, 
           l.city, l.street, l.building, l.floor as branch_location
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN locations l ON u.location_id = l.id
    WHERE o.id = ?
  `;
  const params = [orderId];
  
  if (businessId) {
    sql += ' AND o.business_id = ?';
    params.push(businessId);
  }
  
  const orders = await queryMySQL(sql, params);
  return orders[0] || null;
}

/**
 * Find orders with filters
 */
async function find(filters = {}) {
  let sql = `
    SELECT o.*, 
           u.business_name as branch_name,
           l.city, l.street, l.building, l.floor as branch_location
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN locations l ON u.location_id = l.id
    WHERE 1=1
      AND o.status != 'cart'
  `;
  const params = [];
  
  if (filters.businessId) {
    sql += ' AND o.business_id = ?';
    params.push(filters.businessId);
  }
  
  if (filters.userId || filters.branchId) {
    sql += ' AND o.user_id = ?';
    params.push(filters.userId || filters.branchId);
  }
  
  if (filters.customerPhoneNumber) {
    sql += ' AND o.customer_phone_number = ?';
    params.push(filters.customerPhoneNumber);
  }
  
  if (filters.status) {
    sql += ' AND o.status = ?';
    params.push(filters.status);
  }
  
  if (filters.startDate) {
    sql += ' AND o.created_at >= ?';
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    sql += ' AND o.created_at <= ?';
    params.push(filters.endDate);
  }
  
  sql += ' ORDER BY o.created_at DESC';
  
  // LIMIT and OFFSET cannot be parameters in prepared statements, must use string interpolation
  if (filters.limit) {
    const limit = parseInt(filters.limit);
    sql += ` LIMIT ${limit}`;
  }
  
  if (filters.offset) {
    const offset = parseInt(filters.offset);
    sql += ` OFFSET ${offset}`;
  }
  
  return await queryMySQL(sql, params);
}

/**
 * Get order items
 */
async function getOrderItems(orderId) {
  return await queryMySQL(`
    SELECT oi.*, i.name, i.description
    FROM order_items oi
    LEFT JOIN items i ON oi.item_id = i.id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `, [orderId]);
}

/**
 * Get order status history
 */
async function getStatusHistory(orderId) {
  return await queryMySQL(`
    SELECT * FROM order_status_history
    WHERE order_id = ?
    ORDER BY changed_at ASC
  `, [orderId]);
}

/**
 * Create order
 */
async function create(orderData) {
  const orderId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Determine initial status: accepted by default, or ongoing if scheduled and ready
    let initialStatus = 'accepted';
    if (orderData.scheduledFor) {
      const scheduledDate = new Date(orderData.scheduledFor);
      const now = new Date();
      // If scheduled time is in the past or very close, set to ongoing
      if (scheduledDate <= now || (scheduledDate - now) < 5 * 60 * 1000) { // Within 5 minutes
        initialStatus = 'ongoing';
      }
    }
    const finalStatus = orderData.status || initialStatus;
    
    // Use user_id (which can be branch or business) instead of branch_id
    const userId = orderData.userId || orderData.branchId || orderData.businessId;
    
    // Create order
    await connection.query(`
      INSERT INTO orders (
        id, business_id, user_id, customer_phone_number, whatsapp_user_id,
        language_used, order_source, delivery_type, status,
        subtotal, delivery_price, total, notes, scheduled_for,
        payment_method, payment_status, delivery_address_location_id, customer_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId,
      orderData.businessId,
      userId,
      orderData.customerPhoneNumber,
      orderData.whatsappUserId || null,
      orderData.languageUsed || null,
      orderData.orderSource || 'whatsapp',
      orderData.deliveryType,
      finalStatus,
      orderData.subtotal,
      orderData.deliveryPrice || 0,
      orderData.total,
      orderData.notes || null,
      orderData.scheduledFor || null,
      orderData.paymentMethod || 'unknown',
      orderData.paymentStatus || 'unpaid',
      orderData.deliveryAddressLocationId || null,
      orderData.customerName || null
    ]);
    
    // Create order items and increment times_ordered
    for (const item of orderData.items) {
      const orderItemId = generateUUID();
      await connection.query(`
        INSERT INTO order_items (
          id, order_id, item_id, quantity, price_at_time, name_at_time, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        orderItemId,
        orderId,
        item.itemId,
        item.quantity,
        item.price,
        item.name,
        item.notes || null
      ]);
      
      // Increment times_ordered for this item
      await connection.query(`
        UPDATE items SET times_ordered = times_ordered + ? WHERE id = ?
      `, [item.quantity, item.itemId]);
    }
    
    // Create initial status history
    await connection.query(`
      INSERT INTO order_status_history (id, order_id, status, changed_by)
      VALUES (?, ?, ?, ?)
    `, [
      generateUUID(),
      orderId,
      finalStatus,
      'system'
    ]);
    
    await connection.commit();
    
    return await findById(orderId, orderData.businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update order status
 */
async function updateStatus(orderId, businessId, status, changedBy = 'system') {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get current order with items
    const [orders] = await connection.query(
      'SELECT status, scheduled_for FROM orders WHERE id = ? AND business_id = ?',
      [orderId, businessId]
    );
    if (!orders || orders.length === 0) {
      throw new Error('Order not found');
    }
    
    const currentOrder = orders[0];
    const currentStatus = currentOrder.status;
    
    // Validate status transition
    // Non-scheduled: accepted → completed
    // Scheduled: accepted → ongoing → completed
    if (currentStatus === 'accepted' && status === 'ongoing' && !currentOrder.scheduled_for) {
      throw new Error('Cannot set status to ongoing for non-scheduled order');
    }
    
    // Update order
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status, orderId, businessId];
    
    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
      
      // Increment times_delivered for all order items
      const [orderItems] = await connection.query(`
        SELECT item_id, quantity FROM order_items WHERE order_id = ?
      `, [orderId]);
      
      for (const orderItem of orderItems) {
        await connection.query(`
          UPDATE items SET times_delivered = times_delivered + ? WHERE id = ?
        `, [orderItem.quantity, orderItem.item_id]);
      }
    }
    
    if (status === 'cancelled') {
      updates.push('cancelled_at = CURRENT_TIMESTAMP');
    }
    
    await connection.query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
      values
    );
    
    // Add status history if status changed
    if (currentStatus !== status) {
      await connection.query(`
        INSERT INTO order_status_history (id, order_id, status, changed_by)
        VALUES (?, ?, ?, ?)
      `, [
        generateUUID(),
        orderId,
        status,
        changedBy
      ]);
    }
    
    await connection.commit();
    
    return await findById(orderId, businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update delivery price and recalculate total
 */
async function updateDeliveryPrice(orderId, businessId, deliveryPrice) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get current order
    const order = await findById(orderId, businessId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Validate order is accepted and delivery type
    if (order.status !== 'accepted') {
      throw new Error('Can only update delivery price for accepted orders');
    }
    
    if (order.delivery_type !== 'delivery') {
      throw new Error('Can only set delivery price for delivery orders');
    }
    
    // Calculate new total
    const newDeliveryPrice = parseFloat(deliveryPrice) || 0;
    const newTotal = parseFloat(order.subtotal) + newDeliveryPrice;
    
    // Update order
    await connection.query(`
      UPDATE orders 
      SET delivery_price = ?, total = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND business_id = ?
    `, [newDeliveryPrice, newTotal, orderId, businessId]);
    
    await connection.commit();
    
    return await findById(orderId, businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get orders to archive (completed > 24h ago)
 */
async function findOrdersToArchive() {
  const archiveAgeHours = parseInt(process.env.ARCHIVE_ORDER_AGE_HOURS || '24');
  
  return await queryMySQL(`
    SELECT * FROM orders
    WHERE status IN ('completed', 'cancelled')
    AND (
      (status = 'completed' AND completed_at IS NOT NULL AND completed_at < DATE_SUB(NOW(), INTERVAL ? HOUR))
      OR
      (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_at < DATE_SUB(NOW(), INTERVAL ? HOUR))
    )
    ORDER BY completed_at ASC, cancelled_at ASC
    LIMIT 100
  `, [archiveAgeHours, archiveAgeHours]);
}

module.exports = {
  findById,
  find,
  getOrderItems,
  getStatusHistory,
  create,
  updateStatus,
  updateDeliveryPrice,
  findOrdersToArchive
};
