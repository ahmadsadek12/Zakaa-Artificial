// Archive Service
// Archive completed orders from MySQL to MongoDB

const orderRepository = require('../../repositories/orderRepository');
const { getMongoCollection } = require('../../config/database');
const logger = require('../../utils/logger');
const { generateUUID } = require('../../utils/uuid');

/**
 * Archive order to MongoDB
 */
async function archiveOrder(orderId) {
  try {
    // Get order with full details
    const order = await orderRepository.findById(orderId);
    if (!order) {
      logger.warn(`Order ${orderId} not found for archiving`);
      return null;
    }
    
    // Get order items
    const items = await orderRepository.getOrderItems(orderId);
    
    // Get status history
    const statusHistory = await orderRepository.getStatusHistory(orderId);
    
    // Build status timeline
    const statusTimeline = statusHistory.map(sh => ({
      status: sh.status,
      at: sh.changed_at
    }));
    
    // Build order log document
    const orderLog = {
      _id: generateUUID(),
      order_id: order.id,
      business_id: order.business_id,
      branch_id: order.branch_id,
      customer_phone_number: order.customer_phone_number,
      whatsapp_user_id: order.whatsapp_user_id || null,
      delivery_type: order.delivery_type,
      final_status: order.status,
      items: items.map(item => ({
        item_id: item.item_id,
        name: item.name_at_time,
        quantity: item.quantity,
        price: parseFloat(item.price_at_time),
        cost_at_time: item.cost_at_time ? parseFloat(item.cost_at_time) : null,
        notes: item.notes || null,
        customizations: item.customizations ? (typeof item.customizations === 'string' ? JSON.parse(item.customizations) : item.customizations) : null,
        booking_date: item.booking_date || null,
        booking_start_time: item.booking_start_time || null,
        booking_end_time: item.booking_end_time || null,
        duration_tier_id: item.duration_tier_id || null
      })),
      subtotal: parseFloat(order.subtotal),
      delivery_price: parseFloat(order.delivery_price || 0),
      total: parseFloat(order.total),
      status_timeline: statusTimeline,
      language_used: order.language_used || null,
      notes: order.notes || null,
      order_source: order.order_source || 'whatsapp',
      payment_method: order.payment_method || null,
      payment_status: order.payment_status || null,
      customer_name: order.customer_name || null,
      request_type: order.request_type || 'order',
      scheduled_for: order.scheduled_for || null,
      first_response_at: order.first_response_at || null,
      source_message_id: order.source_message_id || null,
      location_address: order.location_address || null,
      created_at: order.created_at,
      completed_at: order.completed_at,
      cancelled_at: order.cancelled_at,
      archived_at: new Date()
    };
    
    // Insert into MongoDB
    const orderLogs = await getMongoCollection('order_logs');
    await orderLogs.insertOne(orderLog);
    
    logger.info(`Order ${orderId} archived to MongoDB`);
    
    // Delete from MySQL
    const { getMySQLConnection } = require('../../config/database');
    const connection = await getMySQLConnection();
    
    try {
      await connection.beginTransaction();
      
      // Delete status history
      await connection.query('DELETE FROM order_status_history WHERE order_id = ?', [orderId]);
      
      // Delete order items
      await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
      
      // Delete order
      await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);
      
      await connection.commit();
      
      logger.info(`Order ${orderId} deleted from MySQL`);
    } catch (error) {
      await connection.rollback();
      logger.error(`Error deleting order ${orderId} from MySQL:`, error);
      throw error;
    } finally {
      connection.release();
    }
    
    return orderLog;
  } catch (error) {
    logger.error(`Error archiving order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Archive multiple orders
 */
async function archiveOrders() {
  try {
    // Find orders to archive
    const ordersToArchive = await orderRepository.findOrdersToArchive();
    
    logger.info(`Found ${ordersToArchive.length} orders to archive`);
    
    const archived = [];
    const errors = [];
    
    for (const order of ordersToArchive) {
      try {
        const archivedOrder = await archiveOrder(order.id);
        if (archivedOrder) {
          archived.push(archivedOrder.order_id);
        }
      } catch (error) {
        logger.error(`Failed to archive order ${order.id}:`, error);
        errors.push({ orderId: order.id, error: error.message });
      }
    }
    
    logger.info(`Archived ${archived.length} orders, ${errors.length} errors`);
    
    return {
      archived,
      errors,
      total: ordersToArchive.length
    };
  } catch (error) {
    logger.error('Error in archiveOrders:', error);
    throw error;
  }
}

module.exports = {
  archiveOrder,
  archiveOrders
};
