// Business Hours Functions
// Functions for checking opening hours, closing times, and business status

const logger = require('../../../utils/logger');
const { queryMySQL } = require('../../../config/database');
const conversationManager = require('../conversationManager');

/**
 * Get business hours function definitions for OpenAI
 */
function getBusinessHoursFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'get_opening_hours',
        description: 'Get opening hours for the business. Use this when customer asks about opening hours, when you\'re open, what time you open/close, or business hours.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_closing_time',
        description: 'Check if restaurant is currently open or closed, and get closing time. Use this IMMEDIATELY when customer asks "are you open?", "are you closed?", "when do you close?", "what time do you close?", or any question about current status. This is the PRIMARY way to check open/closed status.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_next_opening_time',
        description: 'Get the next time the business will be open. Use this when customer asks "when are you open next?", "when do you open next?", "next opening time", or if currently closed and customer wants to know when they can order.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'is_open_now',
        description: 'Check if the business is currently open or closed. Use this when customer asks "are you open?", "are you closed?", or wants to know current status.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }
  ];
}

/**
 * Execute business hours function
 */
async function executeBusinessHoursFunction(functionName, args, context) {
  const { business, branch } = context;
  const branchId = branch?.id || business.id;
  
  switch (functionName) {
    case 'get_opening_hours': {
      // Get all opening hours
      const allHours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? 
        ORDER BY 
          CASE day_of_week
            WHEN 'monday' THEN 1
            WHEN 'tuesday' THEN 2
            WHEN 'wednesday' THEN 3
            WHEN 'thursday' THEN 4
            WHEN 'friday' THEN 5
            WHEN 'saturday' THEN 6
            WHEN 'sunday' THEN 7
          END
      `, ['business', business.id]);
      
      // Check branch hours if different
      let branchHours = [];
      if (branchId && branchId !== business.id) {
        branchHours = await queryMySQL(`
          SELECT * FROM opening_hours 
          WHERE owner_type = ? AND owner_id = ? 
          ORDER BY 
            CASE day_of_week
              WHEN 'monday' THEN 1
              WHEN 'tuesday' THEN 2
              WHEN 'wednesday' THEN 3
              WHEN 'thursday' THEN 4
              WHEN 'friday' THEN 5
              WHEN 'saturday' THEN 6
              WHEN 'sunday' THEN 7
            END
        `, ['branch', branchId]);
      }
      
      const hours = branchHours.length > 0 ? branchHours : allHours;
      
      if (hours.length === 0) {
        return {
          success: false,
          error: 'Opening hours are not configured yet.'
        };
      }
      
      let hoursText = '📅 **Opening Hours:**\n\n';
      hours.forEach(h => {
        if (h.is_closed) {
          hoursText += `**${h.day_of_week.charAt(0).toUpperCase() + h.day_of_week.slice(1)}**: Closed\n`;
        } else if (h.open_time && h.close_time) {
          hoursText += `**${h.day_of_week.charAt(0).toUpperCase() + h.day_of_week.slice(1)}**: ${h.open_time.substring(0, 5)} - ${h.close_time.substring(0, 5)}`;
          if (h.last_order_before_closing_minutes && h.last_order_before_closing_minutes > 0) {
            const closeTime = h.close_time.substring(0, 5);
            const [closeHour, closeMin] = closeTime.split(':').map(Number);
            const lastOrderMinutes = closeHour * 60 + closeMin - h.last_order_before_closing_minutes;
            const lastOrderHour = Math.floor(lastOrderMinutes / 60);
            const lastOrderMin = lastOrderMinutes % 60;
            hoursText += ` (last order: ${String(lastOrderHour).padStart(2, '0')}:${String(lastOrderMin).padStart(2, '0')})`;
          }
          hoursText += '\n';
        } else {
          hoursText += `**${h.day_of_week.charAt(0).toUpperCase() + h.day_of_week.slice(1)}**: Open\n`;
        }
      });
      
      return {
        success: true,
        message: hoursText
      };
    }
    
    case 'get_closing_time': {
      // Get business timezone
      const businessTimezone = business.timezone || 'Asia/Beirut';
      const now = new Date();
      const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: businessTimezone }));
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][nowInTimezone.getDay()];
      
      // Check branch hours first
      let hours = [];
      if (branchId && branchId !== business.id) {
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
        `, ['business', business.id, dayOfWeek]);
      }
      
      if (hours.length === 0 || hours[0].is_closed) {
        return {
          success: false,
          error: `We're closed today (${dayOfWeek}).`
        };
      }
      
      const hour = hours[0];
      if (!hour.close_time) {
        return {
          success: false,
          error: 'Closing time is not set for today.'
        };
      }
      
      let message = `We close at **${hour.close_time.substring(0, 5)}** today (${dayOfWeek}).`;
      
      // Get last order before closing from users table
      const ownerIdForClosing = (branchId && branchId !== business.id) ? branchId : business.id;
      const [ownerUsersClosing] = await queryMySQL(
        'SELECT last_order_before_closing_minutes FROM users WHERE id = ?',
        [ownerIdForClosing]
      );
      const lastOrderBeforeClosing = ownerUsersClosing?.[0]?.last_order_before_closing_minutes || 0;
      
      if (lastOrderBeforeClosing && lastOrderBeforeClosing > 0) {
        const closeTime = hour.close_time.substring(0, 5);
        const [closeHour, closeMin] = closeTime.split(':').map(Number);
        const lastOrderMinutes = closeHour * 60 + closeMin - lastOrderBeforeClosing;
        const lastOrderHour = Math.floor(lastOrderMinutes / 60);
        const lastOrderMin = lastOrderMinutes % 60;
        message += ` Last order accepted at **${String(lastOrderHour).padStart(2, '0')}:${String(lastOrderMin).padStart(2, '0')}**.`;
      }
      
      return {
        success: true,
        message: message
      };
    }
    
    case 'get_next_opening_time': {
      // Get business timezone
      const businessTimezone = business.timezone || 'Asia/Beirut';
      const now = new Date();
      const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: businessTimezone }));
      const currentDayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][nowInTimezone.getDay()];
      const currentTime = nowInTimezone.toTimeString().substring(0, 5);
      
      // Get all opening hours
      const allHours = await queryMySQL(`
        SELECT * FROM opening_hours 
        WHERE owner_type = ? AND owner_id = ? 
        ORDER BY 
          CASE day_of_week
            WHEN 'monday' THEN 1
            WHEN 'tuesday' THEN 2
            WHEN 'wednesday' THEN 3
            WHEN 'thursday' THEN 4
            WHEN 'friday' THEN 5
            WHEN 'saturday' THEN 6
            WHEN 'sunday' THEN 7
          END
      `, ['business', business.id]);
      
      // Check branch hours if different
      let branchHours = [];
      if (branchId && branchId !== business.id) {
        branchHours = await queryMySQL(`
          SELECT * FROM opening_hours 
          WHERE owner_type = ? AND owner_id = ? 
          ORDER BY 
            CASE day_of_week
              WHEN 'monday' THEN 1
              WHEN 'tuesday' THEN 2
              WHEN 'wednesday' THEN 3
              WHEN 'thursday' THEN 4
              WHEN 'friday' THEN 5
              WHEN 'saturday' THEN 6
              WHEN 'sunday' THEN 7
            END
        `, ['branch', branchId]);
      }
      
      const hours = branchHours.length > 0 ? branchHours : allHours;
      
      if (hours.length === 0) {
        return {
          success: false,
          error: 'Opening hours are not configured yet.'
        };
      }
      
      // Find next opening time
      const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayIndex = dayOrder.indexOf(currentDayOfWeek);
      
      // Check today first
      const todayHours = hours.find(h => h.day_of_week === currentDayOfWeek);
      if (todayHours && !todayHours.is_closed && todayHours.open_time) {
        const openTime = todayHours.open_time.substring(0, 5);
        const [openHour, openMin] = openTime.split(':').map(Number);
        const openMinutes = openHour * 60 + openMin;
        const [currentHour, currentMin] = currentTime.split(':').map(Number);
        const currentMinutes = currentHour * 60 + currentMin;
        
        // If we haven't reached opening time today
        if (currentMinutes < openMinutes) {
          return {
            success: true,
            message: `We open today at **${openTime}**.`
          };
        }
      }
      
      // Check next 7 days
      for (let i = 1; i <= 7; i++) {
        const nextDayIndex = (currentDayIndex + i) % 7;
        const nextDay = dayOrder[nextDayIndex];
        const nextDayHours = hours.find(h => h.day_of_week === nextDay);
        
        if (nextDayHours && !nextDayHours.is_closed && nextDayHours.open_time) {
          const openTime = nextDayHours.open_time.substring(0, 5);
          const dayName = nextDay.charAt(0).toUpperCase() + nextDay.slice(1);
          
          if (i === 1) {
            return {
              success: true,
              message: `We open tomorrow (${dayName}) at **${openTime}**.`
            };
          } else {
            return {
              success: true,
              message: `We open on **${dayName}** at **${openTime}**.`
            };
          }
        }
      }
      
      return {
        success: false,
        error: 'No upcoming opening hours found.'
      };
    }
    
    case 'is_open_now': {
      const isOpen = await conversationManager.isOpenNow(business.id, branchId);
      
      return {
        success: true,
        isOpen: isOpen.isOpen,
        message: isOpen.message || (isOpen.isOpen ? 'We are currently open.' : 'We are currently closed.')
      };
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getBusinessHoursFunctionDefinitions,
  executeBusinessHoursFunction
};
