// Order Service
// Order business logic

const orderRepository = require('../../repositories/orderRepository');
const itemRepository = require('../../repositories/itemRepository');
const branchRepository = require('../../repositories/branchRepository');
const logger = require('../../utils/logger');

/**
 * Create order from cart
 */
async function createOrder(orderData) {
  try {
    // Validate branch/user (user_id can be branch or business)
    const userId = orderData.userId || orderData.branchId || orderData.businessId;
    const branch = await branchRepository.findById(userId, orderData.businessId);
    
    // If branch not found, check if it's the business itself
    let targetUser = branch;
    if (!targetUser) {
      const userRepository = require('../../repositories/userRepository');
      targetUser = await userRepository.findById(userId);
      if (!targetUser || targetUser.business_id !== orderData.businessId) {
        throw new Error('Branch/user not found');
      }
    }
    
    if (!targetUser.is_active) {
      throw new Error('Branch/user is not active');
    }
    
    // Validate items and calculate totals
    let subtotal = 0;
    const validatedItems = [];
    
    for (const cartItem of orderData.items) {
      const item = await itemRepository.findById(cartItem.itemId, orderData.businessId);
      if (!item) {
        throw new Error(`Item ${cartItem.itemId} not found`);
      }
      
      // Check availability_status (new field) or fallback to availability (old field)
      const isAvailable = (item.availability_status === 'available' || item.availability === 'available') 
        && item.availability_status !== 'unavailable' && item.availability_status !== 'hidden';
      
      if (!isAvailable) {
        throw new Error(`Item ${item.name} is not available`);
      }
      
      if (item.user_id && item.user_id !== userId) {
        throw new Error(`Item ${item.name} is not available at this branch`);
      }
      
      const itemTotal = parseFloat(item.price) * parseInt(cartItem.quantity);
      subtotal += itemTotal;
      
      validatedItems.push({
        itemId: item.id,
        quantity: parseInt(cartItem.quantity),
        price: parseFloat(item.price),
        name: item.name,
        notes: cartItem.notes || null
      });
    }
    
    // Calculate delivery price (can be enhanced with delivery rules)
    const deliveryPrice = orderData.deliveryType === 'delivery' ? parseFloat(orderData.deliveryPrice || 0) : 0;
    const total = subtotal + deliveryPrice;
    
    // Determine initial status based on scheduled_for
    let initialStatus = 'accepted'; // Default for non-scheduled orders
    if (orderData.scheduledFor) {
      const scheduledDate = new Date(orderData.scheduledFor);
      const now = new Date();
      // If scheduled time is in the past or very close (within 5 minutes), set to ongoing
      if (scheduledDate <= now || (scheduledDate - now) < 5 * 60 * 1000) {
        initialStatus = 'ongoing';
      }
      // Otherwise, status remains 'accepted' for future scheduled orders
    }
    
    // Determine request_type: 'scheduled_request' if scheduled_for exists, else 'order'
    const requestType = orderData.scheduledFor ? 'scheduled_request' : 'order';
    
    // Create order
    const order = await orderRepository.create({
      ...orderData,
      userId: userId, // Use user_id instead of branch_id
      items: validatedItems,
      subtotal,
      deliveryPrice,
      total,
      status: initialStatus, // Use determined status
      requestType: requestType,
      firstResponseAt: orderData.firstResponseAt || null // Set when order created from message
    });
    
    logger.info(`Order created: ${order.id} for business: ${orderData.businessId}`);
    
    return order;
  } catch (error) {
    logger.error('Error creating order:', error);
    throw error;
  }
}

/**
 * Update order status
 * Handles status transitions: accepted → completed (non-scheduled) or accepted → ongoing → completed (scheduled)
 */
async function updateOrderStatus(orderId, businessId, status, changedBy = 'system') {
  try {
    const order = await orderRepository.findById(orderId, businessId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Validate status transition
    // Allowed transitions:
    // - cart → pending (customer confirms) or accepted (if auto-accept)
    // - pending → accepted (business accepts) or cancelled
    // - accepted → ongoing (if scheduled) or ready/completed or cancelled
    // - ongoing → completed or cancelled
    // - ready → completed or cancelled
    // - Any status → cancelled
    
    // Cannot go back to cart
    if (status === 'cart') {
      throw new Error('Cannot set status back to cart');
    }
    
    // (pending status removed - orders go from cart → accepted)
    
    // Non-scheduled orders: accepted → ready/completed (ongoing not allowed)
    if (order.status === 'accepted' && status === 'ongoing' && !order.scheduled_for) {
      throw new Error('Cannot set status to ongoing for non-scheduled order');
    }
    
    // Ongoing can only go to completed or cancelled
    if (order.status === 'ongoing' && status !== 'completed' && status !== 'cancelled') {
      throw new Error('Cannot transition from ongoing to ' + status);
    }
    
    // Ready can only go to completed or cancelled
    if (order.status === 'ready' && status !== 'completed' && status !== 'cancelled') {
      throw new Error('Cannot transition from ready to ' + status);
    }
    
    // Completed and cancelled are terminal states
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error(`Cannot change status from ${order.status} to ${status}`);
    }
    
    // Note: times_delivered increment is handled in orderRepository.updateStatus
    // Set completed_at when status becomes 'completed'
    const updateData = {};
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const updatedOrder = await orderRepository.updateStatus(orderId, businessId, status, changedBy, updateData);
    
    logger.info(`Order status updated: ${orderId} from ${order.status} to ${status}`);
    
    return updatedOrder;
  } catch (error) {
    logger.error('Error updating order status:', error);
    throw error;
  }
}

/**
 * Cancel order
 */
async function cancelOrder(orderId, businessId, cancelledBy = 'system') {
  return await updateOrderStatus(orderId, businessId, 'cancelled', cancelledBy);
}

/**
 * Get order with full details
 */
async function getOrderDetails(orderId, businessId) {
  const order = await orderRepository.findById(orderId, businessId);
  if (!order) {
    return null;
  }
  
  const items = await orderRepository.getOrderItems(orderId);
  const statusHistory = await orderRepository.getStatusHistory(orderId);
  
  return {
    ...order,
    items,
    statusHistory
  };
}

module.exports = {
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderDetails
};
