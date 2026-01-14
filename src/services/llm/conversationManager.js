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
 * Process chatbot response and confirm order if needed
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
      // Confirm cart (remove cart marker, set status to 'accepted')
      // Cart is already an order in the orders table with status='cart' and notes='__cart__'
      if (cart && cart.items && cart.items.length > 0) {
        // Verify delivery type is set
        if (!cart.delivery_type) {
          logger.warn('Order confirmation attempted without delivery type', { cartId: cart.id });
          return { 
            orderCreated: false, 
            error: 'Delivery type must be set before confirming order' 
          };
        }
        
        // Verify delivery address if delivery type is 'delivery'
        if (cart.delivery_type === 'delivery' && !cart.location_address && !cart.notes?.includes('Delivery Address:')) {
          logger.warn('Delivery order confirmation attempted without address', { cartId: cart.id });
          return { 
            orderCreated: false, 
            error: 'Delivery address must be provided for delivery orders' 
          };
        }
        
        // Update order with all required fields and remove cart marker
        const { getMySQLConnection } = require('../../config/database');
        const connection = await getMySQLConnection();
        
        try {
          await connection.beginTransaction();
          
          // Determine order source (check if customerPhoneNumber is telegram: format)
          const orderSource = customerPhoneNumber.startsWith('telegram:') ? 'telegram' : 'whatsapp';
          
          // Update order: remove cart marker (notes='__cart__'), set status='accepted'
          // Set all customer info and delivery details
          await connection.query(`
            UPDATE orders 
            SET 
              status = 'accepted',
              whatsapp_user_id = COALESCE(?, whatsapp_user_id),
              language_used = COALESCE(?, language_used),
              order_source = ?,
              customer_name = COALESCE(?, customer_name),
              notes = CASE 
                WHEN notes = '__cart__' THEN NULL 
                ELSE COALESCE(?, notes) 
              END,
              scheduled_for = COALESCE(?, scheduled_for),
              delivery_type = COALESCE(?, delivery_type),
              delivery_price = COALESCE(?, delivery_price),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'cart' AND notes = '__cart__'
          `, [
            customerPhoneNumber,
            language || 'arabic',
            orderSource,
            cart.customer_name,
            cart.notes && cart.notes !== '__cart__' ? cart.notes : null,
            cart.scheduled_for ? new Date(cart.scheduled_for) : null,
            cart.delivery_type || 'takeaway',
            cart.delivery_price || 0,
            cart.id
          ]);
          
          // Create initial status history entry (order is now accepted)
          const { generateUUID } = require('../../utils/uuid');
          await connection.query(`
            INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
            VALUES (?, ?, 'accepted', 'customer', CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE changed_at = CURRENT_TIMESTAMP
          `, [generateUUID(), cart.id]);
          
          await connection.commit();
          
          logger.info(`Cart confirmed as order`, { 
            orderId: cart.id, 
            deliveryType: cart.delivery_type,
            deliveryPrice: cart.delivery_price 
          });
          
          return {
            orderCreated: true,
            orderId: cart.id,
            orderNumber: cart.id.substring(0, 8).toUpperCase()
          };
        } catch (error) {
          await connection.rollback();
          logger.error('Error confirming order:', error);
          throw error;
        } finally {
          connection.release();
        }
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
