// Conversation Manager
// Manages conversation flow and state

const cartManager = require('./cartManager');
const orderService = require('../order/orderService');
const { queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { generateUUID } = require('../../utils/uuid');

/**
 * Check if business/branch is open now
 */
async function isOpenNow(businessId, branchId) {
  try {
    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    
    // Check opening hours
    const hours = await queryMySQL(`
      SELECT * FROM opening_hours 
      WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
    `, ['branch', branchId, dayOfWeek]);
    
    if (hours.length === 0) {
      // Check business-level hours
      const businessHours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
      `, ['business', businessId, dayOfWeek]);
      
      if (businessHours.length === 0) {
        return { isOpen: false, reason: 'No opening hours configured' };
      }
      
      const hour = businessHours[0];
      if (hour.is_closed) {
        return { isOpen: false, reason: 'Closed today' };
      }
      
      if (!hour.open_time || !hour.close_time) {
        return { isOpen: true }; // Assume open if no specific hours
      }
      
      const isOpen = currentTime >= hour.open_time.substring(0, 5) && currentTime <= hour.close_time.substring(0, 5);
      return {
        isOpen,
        reason: isOpen ? 'Open' : `Closed. Hours: ${hour.open_time.substring(0, 5)} - ${hour.close_time.substring(0, 5)}`
      };
    }
    
    const hour = hours[0];
    if (hour.is_closed) {
      return { isOpen: false, reason: 'Closed today' };
    }
    
    if (!hour.open_time || !hour.close_time) {
      return { isOpen: true };
    }
    
    const isOpen = currentTime >= hour.open_time.substring(0, 5) && currentTime <= hour.close_time.substring(0, 5);
    return {
      isOpen,
      reason: isOpen ? 'Open' : `Closed. Hours: ${hour.open_time.substring(0, 5)} - ${hour.close_time.substring(0, 5)}`
    };
  } catch (error) {
    logger.error('Error checking opening hours:', error);
    return { isOpen: true, reason: 'Unable to check hours' }; // Default to open
  }
}

/**
 * Check available time slots for scheduling
 */
async function getAvailableTimeSlots(businessId, branchId, date) {
  try {
    // Check if business allows scheduled orders
    const [business] = await queryMySQL(
      'SELECT allow_scheduled_orders FROM users WHERE id = ?',
      [businessId]
    );
    
    if (!business || !business.allow_scheduled_orders) {
      return { available: false, reason: 'Scheduled orders not available' };
    }
    
    // Get opening hours for that day
    const targetDate = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][targetDate.getDay()];
    
    const hours = await queryMySQL(`
      SELECT * FROM opening_hours 
      WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
    `, ['branch', branchId, dayOfWeek]);
    
    if (hours.length === 0) {
      // Check business-level
      const businessHours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
      `, ['business', businessId, dayOfWeek]);
      
      if (businessHours.length === 0 || businessHours[0].is_closed) {
        return { available: false, reason: 'Closed on this day' };
      }
      
      const hour = businessHours[0];
      if (!hour.open_time || !hour.close_time) {
        return { available: true, slots: generateTimeSlots('09:00', '17:00') };
      }
      
      return { available: true, slots: generateTimeSlots(hour.open_time.substring(0, 5), hour.close_time.substring(0, 5)) };
    }
    
    const hour = hours[0];
    if (hour.is_closed) {
      return { available: false, reason: 'Closed on this day' };
    }
    
    if (!hour.open_time || !hour.close_time) {
      return { available: true, slots: generateTimeSlots('09:00', '17:00') };
    }
    
    return { available: true, slots: generateTimeSlots(hour.open_time.substring(0, 5), hour.close_time.substring(0, 5)) };
  } catch (error) {
    logger.error('Error getting available slots:', error);
    return { available: false, reason: 'Error checking availability' };
  }
}

/**
 * Generate time slots (30-minute intervals)
 */
function generateTimeSlots(startTime, endTime) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin = 0;
      currentHour++;
    }
  }
  
  return slots;
}

/**
 * Process chatbot response and create order if needed
 */
async function processChatbotResponse({
  business,
  branch,
  customerPhoneNumber,
  message,
  response,
  cart,
  language
}) {
  try {
    // Check if response indicates order completion
    const lowerResponse = response.text.toLowerCase();
    const orderKeywords = ['order confirmed', 'order placed', 'order created', 'thank you for your order'];
    
    if (orderKeywords.some(keyword => lowerResponse.includes(keyword))) {
      // Create order from cart
      if (cart && cart.items && cart.items.length > 0) {
        const order = await orderService.createOrder({
          businessId: business.id,
          branchId: branch?.id || business.id,
          customerPhoneNumber,
          whatsappUserId: customerPhoneNumber,
          languageUsed: language || 'arabic',
          orderSource: 'whatsapp',
          deliveryType: cart.delivery_type || 'takeaway',
          items: cart.items.map(item => ({
            itemId: item.item_id,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
            notes: item.notes
          })),
          subtotal: cart.subtotal,
          deliveryPrice: cart.delivery_price || 0,
          total: cart.total,
          notes: cart.notes,
          scheduledFor: cart.scheduled_for ? new Date(cart.scheduled_for) : null,
          customerName: cart.customer_name
        });
        
        // Mark cart as completed
        await cartManager.completeCart(business.id, branch?.id || business.id, customerPhoneNumber);
        
        logger.info(`Order created from chatbot: ${order.id}`);
        
        return {
          orderCreated: true,
          orderId: order.id,
          orderNumber: order.id.substring(0, 8).toUpperCase()
        };
      }
    }
    
    return { orderCreated: false };
  } catch (error) {
    logger.error('Error processing chatbot response:', error);
    return { orderCreated: false, error: error.message };
  }
}

module.exports = {
  isOpenNow,
  getAvailableTimeSlots,
  processChatbotResponse
};
