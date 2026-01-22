// Availability Checker Service
// Check rental item availability based on date, time, and quantity

const { queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Check if an item is available at a specific date/time
 * @param {string} itemId - UUID of the item
 * @param {string} bookingDate - Date in YYYY-MM-DD format
 * @param {string} startTime - Time in HH:MM:SS format
 * @param {number} durationMinutes - Duration of the rental
 * @returns {Object} - { available: boolean, reason: string, conflictingBookings: number }
 */
async function checkAvailability(itemId, bookingDate, startTime, durationMinutes) {
  try {
    // Get item details
    const items = await queryMySQL(
      'SELECT quantity, track_quantity, is_rental, item_type, is_reusable, business_id, user_id FROM items WHERE id = ? AND deleted_at IS NULL',
      [itemId]
    );
    
    if (!items || items.length === 0) {
      return {
        available: false,
        reason: 'Item not found'
      };
    }
    
    const item = items[0];
    
    // For services with quantity limits, check active bookings
    if (item.item_type === 'service' && item.is_reusable && item.quantity !== null && item.quantity !== undefined) {
      // Count active bookings (accepted or ongoing) for the same item at the same date/time
      // For services, we check bookings at the exact same scheduled time
      const [activeBookings] = await queryMySQL(`
        SELECT COUNT(*) as active_count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.item_id = ?
        AND o.status IN ('accepted', 'ongoing')
        AND o.scheduled_for IS NOT NULL
        AND DATE(o.scheduled_for) = ?
        AND TIME(o.scheduled_for) = ?
      `, [itemId, bookingDate, startTime]);
      
      const activeCount = activeBookings[0]?.active_count || 0;
      
      if (activeCount >= item.quantity) {
        return {
          available: false,
          reason: `All ${item.quantity} service slot(s) are currently in use. Please choose a different time.`,
          conflictingBookings: activeCount,
          totalQuantity: item.quantity
        };
      }
      
      return {
        available: true,
        reason: `${item.quantity - activeCount} of ${item.quantity} service slot(s) available`,
        availableQuantity: item.quantity - activeCount,
        totalQuantity: item.quantity
      };
    }
    
    // If not a rental item, always available
    if (!item.is_rental) {
      return {
        available: true,
        reason: 'Not a rental item - no time slot restrictions'
      };
    }
    
    // If quantity tracking is disabled, always available
    if (!item.track_quantity || item.quantity === null) {
      // Still need to check opening hours
      const withinHours = await isWithinOpeningHours(
        item.business_id,
        item.user_id,
        bookingDate,
        startTime,
        durationMinutes
      );
      
      if (!withinHours.isWithin) {
        return {
          available: false,
          reason: withinHours.reason
        };
      }
      
      return {
        available: true,
        reason: 'Unlimited quantity'
      };
    }
    
    // Calculate end time
    const endTime = addMinutesToTime(startTime, durationMinutes);
    
    // Check opening hours first
    const withinHours = await isWithinOpeningHours(
      item.business_id,
      item.user_id,
      bookingDate,
      startTime,
      durationMinutes
    );
    
    if (!withinHours.isWithin) {
      return {
        available: false,
        reason: withinHours.reason
      };
    }
    
    // Query overlapping bookings for the same item on the same date
    const overlappingBookings = await queryMySQL(`
      SELECT COUNT(*) as booking_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.item_id = ?
        AND oi.booking_date = ?
        AND o.status NOT IN ('rejected', 'cancelled')
        AND (
          (oi.booking_start_time < ? AND oi.booking_end_time > ?)
          OR (oi.booking_start_time < ? AND oi.booking_end_time > ?)
          OR (oi.booking_start_time >= ? AND oi.booking_end_time <= ?)
        )
    `, [
      itemId,
      bookingDate,
      endTime, startTime,  // Check if existing booking starts before our end and ends after our start
      endTime, startTime,  // Check if existing booking starts before our end and ends after our start (duplicate for clarity)
      startTime, endTime   // Check if existing booking is completely within our time slot
    ]);
    
    const conflictingCount = overlappingBookings[0].booking_count;
    const availableQuantity = item.quantity - conflictingCount;
    
    if (availableQuantity <= 0) {
      return {
        available: false,
        reason: `All ${item.quantity} unit(s) are booked for this time slot`,
        conflictingBookings: conflictingCount,
        totalQuantity: item.quantity
      };
    }
    
    return {
      available: true,
      reason: `${availableQuantity} of ${item.quantity} unit(s) available`,
      availableQuantity,
      totalQuantity: item.quantity
    };
    
  } catch (error) {
    logger.error('Error checking availability:', error);
    throw error;
  }
}

/**
 * Get available time slots for a given date
 * @param {string} itemId - UUID of the item
 * @param {string} bookingDate - Date in YYYY-MM-DD format
 * @param {number} durationMinutes - Duration of the rental
 * @param {number} slotIntervalMinutes - Interval between slots (default: 30 minutes)
 * @returns {Array} - Array of available time slots
 */
async function getAvailableSlots(itemId, bookingDate, durationMinutes, slotIntervalMinutes = 30) {
  try {
    // Get item details
    const items = await queryMySQL(
      'SELECT quantity, track_quantity, is_rental, business_id, user_id FROM items WHERE id = ? AND deleted_at IS NULL',
      [itemId]
    );
    
    if (!items || items.length === 0) {
      return [];
    }
    
    const item = items[0];
    
    // If not a rental item, return empty (no time slots needed)
    if (!item.is_rental) {
      return [];
    }
    
    // Get opening hours for the day
    const dayOfWeek = getDayOfWeek(bookingDate);
    const ownerId = item.user_id || item.business_id;
    const ownerType = item.user_id ? 'branch' : 'business';
    
    const openingHours = await queryMySQL(`
      SELECT open_time, close_time, is_closed
      FROM opening_hours
      WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
    `, [ownerType, ownerId, dayOfWeek]);
    
    if (!openingHours || openingHours.length === 0 || openingHours[0].is_closed) {
      return []; // Closed on this day
    }
    
    const { open_time, close_time } = openingHours[0];
    
    // Generate time slots
    const slots = [];
    let currentTime = open_time;
    
    while (timeToMinutes(currentTime) + durationMinutes <= timeToMinutes(close_time)) {
      const endTime = addMinutesToTime(currentTime, durationMinutes);
      
      // Check if this slot is available
      const availability = await checkAvailability(itemId, bookingDate, currentTime, durationMinutes);
      
      slots.push({
        startTime: currentTime,
        endTime: endTime,
        available: availability.available,
        availableQuantity: availability.availableQuantity || 0,
        reason: availability.reason
      });
      
      // Move to next slot
      currentTime = addMinutesToTime(currentTime, slotIntervalMinutes);
    }
    
    return slots;
    
  } catch (error) {
    logger.error('Error getting available slots:', error);
    throw error;
  }
}

/**
 * Check if a time slot is within opening hours
 * @param {string} businessId - Business UUID
 * @param {string} branchId - Branch UUID (optional)
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} startTime - Time in HH:MM:SS format
 * @param {number} durationMinutes - Duration in minutes
 * @returns {Object} - { isWithin: boolean, reason: string }
 */
async function isWithinOpeningHours(businessId, branchId, date, startTime, durationMinutes) {
  try {
    const dayOfWeek = getDayOfWeek(date);
    const endTime = addMinutesToTime(startTime, durationMinutes);
    
    // Check branch opening hours first, then fall back to business
    const ownerId = branchId || businessId;
    const ownerType = branchId ? 'branch' : 'business';
    
    const openingHours = await queryMySQL(`
      SELECT open_time, close_time, is_closed
      FROM opening_hours
      WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
    `, [ownerType, ownerId, dayOfWeek]);
    
    if (!openingHours || openingHours.length === 0) {
      // If branch has no hours, try business
      if (branchId) {
        const businessHours = await queryMySQL(`
          SELECT open_time, close_time, is_closed
          FROM opening_hours
          WHERE owner_type = 'business' AND owner_id = ? AND day_of_week = ?
        `, [businessId, dayOfWeek]);
        
        if (!businessHours || businessHours.length === 0) {
          return {
            isWithin: false,
            reason: 'No opening hours configured'
          };
        }
        
        openingHours[0] = businessHours[0];
      } else {
        return {
          isWithin: false,
          reason: 'No opening hours configured'
        };
      }
    }
    
    const { open_time, close_time, is_closed } = openingHours[0];
    
    if (is_closed) {
      return {
        isWithin: false,
        reason: `Closed on ${dayOfWeek}`
      };
    }
    
    // Convert times to minutes for comparison
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const openMinutes = timeToMinutes(open_time);
    const closeMinutes = timeToMinutes(close_time);
    
    if (startMinutes < openMinutes) {
      return {
        isWithin: false,
        reason: `Booking starts before opening time (${open_time})`
      };
    }
    
    if (endMinutes > closeMinutes) {
      return {
        isWithin: false,
        reason: `Booking ends after closing time (${close_time})`
      };
    }
    
    return {
      isWithin: true,
      reason: 'Within opening hours'
    };
    
  } catch (error) {
    logger.error('Error checking opening hours:', error);
    throw error;
  }
}

// Helper functions

/**
 * Get day of week from date string
 */
function getDayOfWeek(dateString) {
  const date = new Date(dateString + 'T00:00:00Z'); // Add time to avoid timezone issues
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getUTCDay()];
}

/**
 * Convert time string to minutes
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Add minutes to a time string
 */
function addMinutesToTime(timeString, minutesToAdd) {
  const totalMinutes = timeToMinutes(timeString) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

module.exports = {
  checkAvailability,
  getAvailableSlots,
  isWithinOpeningHours
};
