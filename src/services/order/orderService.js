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
    // Validate branch
    const branch = await branchRepository.findById(orderData.branchId, orderData.businessId);
    if (!branch) {
      throw new Error('Branch not found');
    }
    
    if (!branch.is_active) {
      throw new Error('Branch is not active');
    }
    
    // Validate items and calculate totals
    let subtotal = 0;
    const validatedItems = [];
    
    for (const cartItem of orderData.items) {
      const item = await itemRepository.findById(cartItem.itemId, orderData.businessId);
      if (!item) {
        throw new Error(`Item ${cartItem.itemId} not found`);
      }
      
      if (item.availability !== 'available') {
        throw new Error(`Item ${item.name} is not available`);
      }
      
      if (item.branch_id && item.branch_id !== orderData.branchId) {
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
    
    // Check minimum order value
    if (branch.min_order_value && subtotal < parseFloat(branch.min_order_value)) {
      throw new Error(`Minimum order value is ${branch.min_order_value}`);
    }
    
    // Calculate delivery price (can be enhanced with delivery rules)
    const deliveryPrice = orderData.deliveryType === 'delivery' ? parseFloat(orderData.deliveryPrice || 0) : 0;
    const total = subtotal + deliveryPrice;
    
    // Create order
    const order = await orderRepository.create({
      ...orderData,
      items: validatedItems,
      subtotal,
      deliveryPrice,
      total
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
 */
async function updateOrderStatus(orderId, businessId, status, changedBy = 'system') {
  try {
    const order = await orderRepository.findById(orderId, businessId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    const updatedOrder = await orderRepository.updateStatus(orderId, businessId, status, changedBy);
    
    logger.info(`Order status updated: ${orderId} to ${status}`);
    
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
