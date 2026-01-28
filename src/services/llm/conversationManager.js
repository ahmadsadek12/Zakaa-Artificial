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
    
    // Get current time in business timezone using Intl.DateTimeFormat
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: businessTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long'
    });
    
    const parts = formatter.formatToParts(now);
    const currentHour = parts.find(p => p.type === 'hour').value;
    const currentMinute = parts.find(p => p.type === 'minute').value;
    const weekday = parts.find(p => p.type === 'weekday').value.toLowerCase();
    
    const currentTime = `${currentHour}:${currentMinute}`;
    const dayOfWeek = weekday;
    
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
    
    // Get last order before closing from users table (business or branch)
    const ownerId = branchId && branchId !== businessId ? branchId : businessId;
    const [ownerUsers] = await queryMySQL(
      'SELECT last_order_before_closing_minutes FROM users WHERE id = ?',
      [ownerId]
    );
    const lastOrderBeforeClosing = ownerUsers?.[0]?.last_order_before_closing_minutes || 0;
    const lastOrderMinutes = lastOrderBeforeClosing > 0 ? closeMinutes - lastOrderBeforeClosing : closeMinutes;
    
    // Business is "open" for general purposes if within opening hours
    const isWithinOpeningHours = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    
    // Business can accept immediate orders only if before last order time
    const isOpenForOrders = currentMinutes >= openMinutes && currentMinutes <= lastOrderMinutes;
    
    // Check if last order time has passed
    const lastOrderTimePassed = lastOrderBeforeClosing > 0 && currentMinutes > lastOrderMinutes;
    
    // Calculate minutes until last order time
    const minutesUntilLastOrder = lastOrderBeforeClosing > 0 && currentMinutes < lastOrderMinutes 
      ? lastOrderMinutes - currentMinutes 
      : null;
    
    // Format last order time as HH:MM
    const lastOrderTime = lastOrderBeforeClosing > 0 
      ? `${Math.floor(lastOrderMinutes / 60)}:${String(lastOrderMinutes % 60).padStart(2, '0')}`
      : null;
    
    // Determine reason message
    let reason;
    if (currentMinutes < openMinutes) {
      reason = `Closed. We open at ${hour.open_time.substring(0, 5)}`;
    } else if (lastOrderTimePassed && isWithinOpeningHours) {
      reason = `We're still open but past last order time (${lastOrderTime}). Please schedule your order.`;
    } else if (!isWithinOpeningHours) {
      reason = `Closed. Hours: ${hour.open_time.substring(0, 5)} - ${hour.close_time.substring(0, 5)}`;
    } else {
      reason = 'Open';
      if (minutesUntilLastOrder !== null && minutesUntilLastOrder <= 30) {
        reason += ` (Last order in ${minutesUntilLastOrder} minutes at ${lastOrderTime})`;
      }
    }
    
    logger.info('Opening hours check result', {
      dayOfWeek,
      currentTime,
      openTime: hour.open_time.substring(0, 5),
      closeTime: hour.close_time.substring(0, 5),
      lastOrderBeforeClosing,
      lastOrderTime,
      isOpenForOrders,
      lastOrderTimePassed,
      minutesUntilLastOrder,
      isWithinOpeningHours,
      currentMinutes,
      openMinutes,
      closeMinutes,
      lastOrderMinutes,
      reason
    });
    
    return {
      isOpen: isOpenForOrders, // Only true if before last order time
      isWithinOpeningHours, // True if between open and close (even if past last order)
      lastOrderTimePassed, // True if past last order time but before close
      minutesUntilLastOrder, // Minutes until last order (null if past or no limit)
      lastOrderTime, // HH:MM format of last order time
      reason
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
 * Helper to convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(timeString) {
  if (!timeString) return -1;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get opening hours for a specific day
 */
async function getOpeningHoursForDay(businessId, branchId, dayOfWeek) {
  let hours = [];
  if (branchId && branchId !== businessId) {
    hours = await queryMySQL(`
      SELECT * FROM opening_hours 
      WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
    `, ['branch', branchId, dayOfWeek]);
  }
  if (hours.length === 0) {
    hours = await queryMySQL(`
      SELECT * FROM opening_hours 
      WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
    `, ['business', businessId, dayOfWeek]);
  }
  return hours.length > 0 ? hours[0] : null;
}

/**
 * Get all opening hours for the week
 */
async function getAllOpeningHours(businessId, branchId) {
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const allHours = [];
  for (const day of daysOfWeek) {
    const dayHours = await getOpeningHoursForDay(businessId, branchId, day);
    if (dayHours) {
      allHours.push(dayHours);
    } else {
      // If no specific hours, assume closed or default
      allHours.push({ day_of_week: day, is_closed: true, open_time: null, close_time: null, last_order_before_closing_minutes: 0 });
    }
  }
  return allHours;
}

/**
 * Find the next time the business will be open
 */
async function getNextOpeningTime(businessId, branchId) {
  // Get business timezone
  const [businesses] = await queryMySQL(
    'SELECT timezone FROM users WHERE id = ?',
    [businessId]
  );
  const businessTimezone = businesses[0]?.timezone || 'Asia/Beirut';
  
  // Get current time in business timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: businessTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'long'
  });
  
  const parts = formatter.formatToParts(now);
  const currentHour = parts.find(p => p.type === 'hour').value;
  const currentMinute = parts.find(p => p.type === 'minute').value;
  const weekday = parts.find(p => p.type === 'weekday').value.toLowerCase();
  
  const currentTime = `${currentHour}:${currentMinute}`;
  const currentDayOfWeek = weekday;
  
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayIndex = daysOfWeek.indexOf(currentDayOfWeek);
  
  // Check today first
  const todayHours = await getOpeningHoursForDay(businessId, branchId, currentDayOfWeek);
  if (todayHours && !todayHours.is_closed && todayHours.open_time) {
    const openMinutes = timeToMinutes(todayHours.open_time);
    const currentMinutes = timeToMinutes(currentTime);
    if (currentMinutes < openMinutes) {
      return { day_of_week: currentDayOfWeek, open_time: todayHours.open_time };
    }
  }
  
  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDay = daysOfWeek[nextDayIndex];
    const nextDayHours = await getOpeningHoursForDay(businessId, branchId, nextDay);
    if (nextDayHours && !nextDayHours.is_closed && nextDayHours.open_time) {
      return { day_of_week: nextDay, open_time: nextDayHours.open_time };
    }
  }
  return null; // No upcoming opening hours found
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
        
        // SIMPLE: Just update status from 'cart' to 'accepted'
        const { getMySQLConnection } = require('../../config/database');
        const connection = await getMySQLConnection();
        
        try {
          await connection.beginTransaction();
          
          // Determine order source
          const orderSource = customerPhoneNumber.startsWith('telegram:') ? 'telegram' : 'whatsapp';
          
          // SIMPLE UPDATE: Just change status from 'cart' to 'accepted'
          const updateResult = await connection.query(`
            UPDATE orders 
            SET 
              status = 'accepted',
              whatsapp_user_id = COALESCE(?, whatsapp_user_id),
              language_used = COALESCE(?, language_used),
              order_source = COALESCE(?, order_source),
              customer_name = COALESCE(?, customer_name),
              notes = CASE 
                WHEN notes = '__cart__' THEN NULL 
                WHEN notes LIKE '__cart__\nNOTES: %' THEN SUBSTRING(notes FROM LENGTH('__cart__\nNOTES: ') + 1)
                WHEN notes LIKE '__cart__\r\nNOTES: %' THEN SUBSTRING(notes FROM LENGTH('__cart__\r\nNOTES: ') + 1)
                ELSE notes 
              END,
              scheduled_for = COALESCE(?, scheduled_for),
              delivery_type = COALESCE(?, delivery_type),
              delivery_price = COALESCE(?, delivery_price),
              location_address = COALESCE(?, location_address),
              location_latitude = COALESCE(?, location_latitude),
              location_longitude = COALESCE(?, location_longitude),
              created_via = COALESCE(?, created_via),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            customerPhoneNumber,
            language || 'english',
            orderSource,
            cart.customer_name || null,
            cart.scheduled_for ? new Date(cart.scheduled_for) : null,
            cart.delivery_type || null,
            cart.delivery_price || null,
            cart.location_address || null,
            cart.location_latitude || null,
            cart.location_longitude || null,
            'bot',
            cart.id
          ]);
          
          if (updateResult[0].affectedRows === 0) {
            await connection.rollback();
            logger.error('Order confirmation failed: No rows updated', {
              orderId: cart.id,
              customerPhoneNumber
            });
            return {
              orderCreated: false,
              error: 'Order could not be confirmed. Please try again.'
            };
          }
          
          // Create status history entry
          await connection.query(`
            INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
            VALUES (?, ?, 'accepted', 'customer', CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE changed_at = CURRENT_TIMESTAMP
          `, [generateUUID(), cart.id]);
          
          await connection.commit();
          
          logger.info('Order confirmed successfully', { 
            orderId: cart.id
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
  processChatbotResponse,
  timeToMinutes,
  getOpeningHoursForDay,
  getAllOpeningHours,
  getNextOpeningTime
};
