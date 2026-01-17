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
    // Get business timezone
    const [businesses] = await queryMySQL(
      'SELECT timezone FROM users WHERE id = ?',
      [businessId]
    );
    const businessTimezone = businesses[0]?.timezone || 'Asia/Beirut';
    
    // Get current time in business timezone
    const now = new Date();
    const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: businessTimezone }));
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][nowInTimezone.getDay()];
    const currentTime = nowInTimezone.toTimeString().substring(0, 5); // HH:MM format in business timezone
    
    logger.info('Checking opening hours', {
      businessId,
      branchId,
      businessTimezone,
      utcTime: now.toISOString(),
      localTime: currentTime,
      dayOfWeek
    });
    
    // Check branch hours first if branchId is different from businessId
    let hours = [];
    if (branchId && branchId !== businessId) {
      hours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
      `, ['branch', branchId, dayOfWeek]);
    }
    
    // If no branch hours, check business-level hours
    if (hours.length === 0) {
      hours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
      `, ['business', businessId, dayOfWeek]);
    }
    
    if (hours.length === 0) {
      logger.warn('No opening hours found', { businessId, branchId, dayOfWeek });
      return { isOpen: false, reason: 'No opening hours configured' };
    }
    
    const hour = hours[0];
    if (hour.is_closed) {
      logger.info('Business is closed today', { dayOfWeek, is_closed: hour.is_closed });
      return { isOpen: false, reason: 'Closed today' };
    }
    
    if (!hour.open_time || !hour.close_time) {
      logger.info('No specific hours set, assuming open', { dayOfWeek });
      return { isOpen: true }; // Assume open if no specific hours
    }
    
    // Convert times to minutes for accurate comparison
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.substring(0, 5).split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const currentMinutes = timeToMinutes(currentTime);
    const openMinutes = timeToMinutes(hour.open_time);
    const closeMinutes = timeToMinutes(hour.close_time);
    
    // Check last order before closing
    const lastOrderBeforeClosing = hour.last_order_before_closing_minutes || 0;
    const effectiveCloseMinutes = closeMinutes - lastOrderBeforeClosing;
    
    const isOpen = currentMinutes >= openMinutes && currentMinutes <= effectiveCloseMinutes;
    
    logger.info('Opening hours check result', {
      dayOfWeek,
      currentTime,
      openTime: hour.open_time.substring(0, 5),
      closeTime: hour.close_time.substring(0, 5),
      lastOrderBeforeClosing,
      effectiveCloseMinutes,
      isOpen,
      currentMinutes,
      openMinutes,
      closeMinutes,
      reason: isOpen ? 'Open' : `Closed. Hours: ${hour.open_time.substring(0, 5)} - ${hour.close_time.substring(0, 5)} (last order before ${Math.floor(effectiveCloseMinutes / 60)}:${String(effectiveCloseMinutes % 60).padStart(2, '0')})`
    });
    
    return {
      isOpen,
      reason: isOpen ? 'Open' : `Closed. Hours: ${hour.open_time.substring(0, 5)} - ${hour.close_time.substring(0, 5)}${lastOrderBeforeClosing > 0 ? ` (last order ${lastOrderBeforeClosing} minutes before closing)` : ''}`
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
            language || 'english',
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
