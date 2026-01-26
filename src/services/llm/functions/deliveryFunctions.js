// Delivery Functions
// Functions for delivery type, address, scheduling, and location management

const cartManager = require('../cartManager');
const logger = require('../../../utils/logger');
const { queryMySQL } = require('../../../config/database');
const dateTimeParser = require('../dateTimeParser');

/**
 * Get delivery function definitions for OpenAI
 */
function getDeliveryFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'update_delivery_type',
        description: 'Change the delivery type for the ongoing order. Use when customer changes their mind about delivery method (e.g., "actually, I want takeaway" or "change to delivery"). Previous address is kept if switching away from delivery (customer might change back).',
        parameters: {
          type: 'object',
          properties: {
            deliveryType: {
              type: 'string',
              enum: ['takeaway', 'delivery', 'on_site'],
              description: 'takeaway = pickup, delivery = home delivery, on_site = dine-in'
            }
          },
          required: ['deliveryType']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_delivery_address',
        description: 'Set the delivery address. Call this IMMEDIATELY when customer provides ANY location information. ⚠️ CRITICAL: When customer provides an address, ONLY call this function - DO NOT call add_service_to_cart(). Addresses are NOT item names. Lebanese addresses are often given in one sentence with commas or natural speech. Examples: "Salim Salam, Abraj Beirut, Block B2, 21, 7ad LIU" or "michel abi chahla street, abraj beirut building, block b2 21st floor, beirut". Extract the COMPLETE text exactly as customer says it. If customer already has items in cart and provides address, ONLY update address - DO NOT add items again.',
        parameters: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'COMPLETE address text EXACTLY as customer provided it. Include ALL parts: street name, building name, block/apartment, floor number, landmarks (7ad/next to), area/city. Do NOT parse, clean, or translate - capture everything they said about their location in one string.'
            }
          },
          required: ['address']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_google_maps_link',
        description: 'Set Google Maps link for delivery location. Call this when customer provides a Google Maps link or URL.',
        parameters: {
          type: 'object',
          properties: {
            googleMapsLink: {
              type: 'string',
              description: 'Google Maps link or URL (e.g., "https://maps.google.com/...")'
            }
          },
          required: ['googleMapsLink']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_carrier_phone_number',
        description: 'Set carrier phone number for delivery tracking. Call this when customer provides a phone number for the delivery carrier.',
        parameters: {
          type: 'object',
          properties: {
            carrierPhoneNumber: {
              type: 'string',
              description: 'Phone number for delivery carrier'
            }
          },
          required: ['carrierPhoneNumber']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_scheduled_time',
        description: 'Set scheduled time for order delivery/pickup. Use when customer wants to schedule order for future time. ⚠️ CRITICAL: When customer provides a time/schedule, ONLY call this function - DO NOT call add_service_to_cart(). Times are NOT item names. Parse natural language like "tomorrow at 7pm", "Friday 6:30pm", "in 2 hours", "12pm tomorrow". For restaurants that are closed, this is required. If customer already has items in cart and provides time, ONLY update scheduled time - DO NOT add items again.',
        parameters: {
          type: 'object',
          properties: {
            scheduledTimeText: {
              type: 'string',
              description: 'Natural language time expression from customer (e.g., "tomorrow 7pm", "Friday evening", "in 3 hours")'
            }
          },
          required: ['scheduledTimeText']
        }
      }
    }
  ];
}

/**
 * Execute delivery function
 */
async function executeDeliveryFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  const branchId = branch?.id || business.id;
  
  switch (functionName) {
    case 'update_delivery_type': {
      const { deliveryType } = args;
      
      // Get current cart to check existing data
      const currentCart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      
      const updateData = { delivery_type: deliveryType };
      
      // Set/clear delivery price based on type
      if (deliveryType === 'delivery' && business.delivery_price) {
        updateData.delivery_price = parseFloat(business.delivery_price);
      } else {
        updateData.delivery_price = 0;
      }
      
      // Keep address saved (don't clear when switching types - customer might change back)
      
      const cart = await cartManager.updateCart(
        business.id,
        branchId,
        customerPhoneNumber,
        updateData
      );
      
      logger.info('Delivery type updated via function call', { 
        deliveryType, 
        cartId: cart.id, 
        deliveryPrice: updateData.delivery_price,
        addressKept: !!currentCart.location_address 
      });
      
      const typeName = deliveryType === 'delivery' ? 'Delivery' : 
                       deliveryType === 'takeaway' ? 'Takeaway' : 'On-site (Dine-in)';
      
      let message = `Delivery type updated to: ${typeName}.`;
      
      // Add helpful next steps based on delivery type
      if (deliveryType === 'delivery' && !cart.location_address) {
        message += ` Please provide your delivery address.`;
      } else if (deliveryType === 'on_site') {
        message += ` Please provide your preferred date and time for dining in.`;
      } else if (deliveryType === 'takeaway') {
        message += ` Please provide your preferred pickup time.`;
      }
      
      return {
        success: true,
        message,
        cart: cart
      };
    }
    
    case 'set_delivery_address': {
      const { address } = args;
      
      // Get cart before update to log its state
      const cartBefore = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      logger.info('Cart BEFORE address update', { 
        cartId: cartBefore?.id, 
        itemCount: cartBefore?.items?.length || 0,
        hasItems: cartBefore?.items && cartBefore.items.length > 0,
        currentDeliveryType: cartBefore?.delivery_type
      });
      
      // Automatically set delivery_type to 'delivery' when address is provided
      const updateData = { 
        location_address: address,
        delivery_type: 'delivery' // Automatically set to delivery when address is provided
      };
      
      // Set delivery price if business has one configured
      if (business.delivery_price) {
        updateData.delivery_price = parseFloat(business.delivery_price);
      }
      
      const cart = await cartManager.updateCart(
        business.id,
        branchId,
        customerPhoneNumber,
        updateData
      );
      
      logger.info('Cart AFTER address update', { 
        cartId: cart?.id,
        itemCount: cart?.items?.length || 0,
        hasItems: cart?.items && cart.items.length > 0,
        address: cart?.location_address,
        deliveryType: cart?.delivery_type,
        deliveryPrice: cart?.delivery_price
      });
      
      logger.info('Delivery address set via function call', { address, deliveryType: 'delivery' });
      
      return {
        success: true,
        message: `Delivery address saved: ${address}. Delivery type set to delivery.`,
        cart: cart
      };
    }
    
    case 'set_google_maps_link': {
      const { googleMapsLink } = args;
      
      if (!googleMapsLink || typeof googleMapsLink !== 'string') {
        return {
          success: false,
          error: 'Please provide a valid Google Maps link.'
        };
      }
      
      // Update business or order with Google Maps link
      const userRepository = require('../../../repositories/userRepository');
      await userRepository.update(business.id, { googleMapsLink });
      
      return {
        success: true,
        message: 'Google Maps link saved successfully.'
      };
    }
    
    case 'set_carrier_phone_number': {
      const { carrierPhoneNumber } = args;
      
      if (!carrierPhoneNumber || typeof carrierPhoneNumber !== 'string') {
        return {
          success: false,
          error: 'Please provide a valid phone number.'
        };
      }
      
      // Update business with carrier phone number
      const userRepository = require('../../../repositories/userRepository');
      await userRepository.update(business.id, { carrierPhoneNumber });
      
      return {
        success: true,
        message: 'Carrier phone number saved successfully.'
      };
    }
    
    case 'set_scheduled_time': {
      const { scheduledTimeText } = args;
      
      // Get cart to check items
      const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      
      // Check if cart has items that require scheduling
      let maxMinScheduleHours = 0;
      let schedulableItemsCount = 0;
      
      if (cart.items && cart.items.length > 0) {
        for (const cartItem of cart.items) {
          // Fetch full item details to get scheduling info
          const [items] = await queryMySQL(
            'SELECT * FROM items WHERE id = ?',
            [cartItem.item_id]
          );
          
          if (items && items.length > 0) {
            const item = items[0];
            if (item.is_schedulable) {
              schedulableItemsCount++;
              if (item.min_schedule_hours > maxMinScheduleHours) {
                maxMinScheduleHours = item.min_schedule_hours;
              }
            }
          }
        }
      }
      
      // Get opening hours for validation - fetch all days first for date parsing
      const allOpeningHours = await queryMySQL(`
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
      
      // Parse the date/time
      const parsedDate = dateTimeParser.parseDateTime(
        scheduledTimeText,
        business.timezone || 'Asia/Beirut',
        allOpeningHours
      );
      
      if (!parsedDate) {
        return {
          success: false,
          error: `Sorry, I couldn't understand "${scheduledTimeText}" or it's outside our opening hours. Please provide a time when we're open.`
        };
      }
      
      // Get opening hours for the SPECIFIC day being scheduled
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][parsedDate.getDay()];
      
      // Check branch hours first if branchId is different from businessId
      let dayOpeningHours = [];
      if (branchId && branchId !== business.id) {
        dayOpeningHours = await queryMySQL(`
          SELECT * FROM opening_hours 
          WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
        `, ['branch', branchId, dayOfWeek]);
      }
      
      // If no branch hours, check business-level hours
      if (dayOpeningHours.length === 0) {
        dayOpeningHours = await queryMySQL(`
          SELECT * FROM opening_hours 
          WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
        `, ['business', business.id, dayOfWeek]);
      }
      
      // Validate that the scheduled day is open
      if (dayOpeningHours.length === 0 || dayOpeningHours[0].is_closed) {
        return {
          success: false,
          error: `Sorry, we're closed on ${dayOfWeek}. Please choose a day when we're open.`
        };
      }
      
      const dayHours = dayOpeningHours[0];
      if (!dayHours.open_time || !dayHours.close_time) {
        // No specific hours set, allow scheduling
      } else {
        // Validate scheduled time is within opening hours
        const scheduledTime = parsedDate.toTimeString().substring(0, 5); // HH:MM
        const openTime = dayHours.open_time.substring(0, 5);
        const closeTime = dayHours.close_time.substring(0, 5);
        
        // Convert to minutes for comparison
        const timeToMinutes = (timeStr) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };
        
        const scheduledMinutes = timeToMinutes(scheduledTime);
        const openMinutes = timeToMinutes(openTime);
        const closeMinutes = timeToMinutes(closeTime);
        
        // Get last order before closing from users table
        const ownerIdForDay = (branchId && branchId !== business.id) ? branchId : business.id;
        const [ownerUsers] = await queryMySQL(
          'SELECT last_order_before_closing_minutes FROM users WHERE id = ?',
          [ownerIdForDay]
        );
        const lastOrderBeforeClosing = ownerUsers?.[0]?.last_order_before_closing_minutes || 0;
        const effectiveCloseMinutes = closeMinutes - lastOrderBeforeClosing;
        
        if (scheduledMinutes < openMinutes || scheduledMinutes > effectiveCloseMinutes) {
          return {
            success: false,
            error: `Sorry, we're open from ${openTime} to ${closeTime} on ${dayOfWeek}. Please choose a time within our opening hours.`
          };
        }
      }
      
      // Get all "only scheduled" items in cart for validation
      const onlyScheduledItems = [];
      if (cart.items && cart.items.length > 0) {
        for (const cartItem of cart.items) {
          const [items] = await queryMySQL(
            'SELECT * FROM items WHERE id = ?',
            [cartItem.item_id]
          );
          
          if (items && items.length > 0) {
            const item = items[0];
            if (item.is_schedulable) {
              onlyScheduledItems.push({
                itemId: item.id,
                itemName: item.name,
                durationMinutes: item.duration_minutes || 60,
                minScheduleHours: item.min_schedule_hours || 0,
                availableFrom: item.available_from,
                availableTo: item.available_to,
                daysAvailable: item.days_available,
                quantity: item.quantity // null = infinite, number = limited instances
              });
            }
          }
        }
      }
      
      // Validation order:
      // 1. Check minimum schedule hours
      // 2. Check if within available hours (item's available_from/available_to)
      // 3. Check quantity limits (how many reservations exist vs item quantity)
      
      // Step 1: Validate minimum schedule time for each item
      for (const scheduledItem of onlyScheduledItems) {
        if (scheduledItem.minScheduleHours > 0) {
          const validation = dateTimeParser.validateMinScheduleTime(parsedDate, scheduledItem.minScheduleHours);
          
          if (!validation.valid) {
            return {
              success: false,
              error: `${validation.message}. Please choose a time at least ${scheduledItem.minScheduleHours} hours from now.`
            };
          }
        }
      }
      
      // Step 2: Check if scheduled time is within item's available hours
      for (const scheduledItem of onlyScheduledItems) {
        if (scheduledItem.availableFrom && scheduledItem.availableTo) {
          const scheduledTime = parsedDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
          const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);
          const scheduledTimeMinutes = scheduledHour * 60 + scheduledMinute;
          
          const [availableFromHour, availableFromMinute] = scheduledItem.availableFrom.split(':').map(Number);
          const [availableToHour, availableToMinute] = scheduledItem.availableTo.split(':').map(Number);
          const availableFromMinutes = availableFromHour * 60 + availableFromMinute;
          const availableToMinutes = availableToHour * 60 + availableToMinute;
          
          if (scheduledTimeMinutes < availableFromMinutes || scheduledTimeMinutes > availableToMinutes) {
            return {
              success: false,
              error: `Sorry, "${scheduledItem.itemName}" is only available between ${scheduledItem.availableFrom.substring(0, 5)} and ${scheduledItem.availableTo.substring(0, 5)}. Please choose a time within these hours.`
            };
          }
        }
        
        // Check days_available constraint
        if (scheduledItem.daysAvailable) {
          let daysArray = [];
          try {
            daysArray = typeof scheduledItem.daysAvailable === 'string' 
              ? JSON.parse(scheduledItem.daysAvailable) 
              : scheduledItem.daysAvailable;
          } catch (e) {
            daysArray = [];
          }
          
          if (Array.isArray(daysArray) && daysArray.length > 0) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const scheduledDay = dayNames[parsedDate.getDay()];
            
            if (!daysArray.includes(scheduledDay)) {
              return {
                success: false,
                error: `Sorry, "${scheduledItem.itemName}" is not available on ${scheduledDay}. Available days: ${daysArray.join(', ')}.`
              };
            }
          }
        }
      }
      
      // Step 3: Check quantity limits (how many reservations exist vs item quantity)
      for (const scheduledItem of onlyScheduledItems) {
        // Calculate time window (start and end time considering item duration)
        const scheduledStart = new Date(parsedDate);
        const scheduledEnd = new Date(scheduledStart.getTime() + scheduledItem.durationMinutes * 60 * 1000);
        
        // Format dates for MySQL (YYYY-MM-DD HH:MM:SS)
        const scheduledStartStr = scheduledStart.toISOString().slice(0, 19).replace('T', ' ');
        const scheduledEndStr = scheduledEnd.toISOString().slice(0, 19).replace('T', ' ');
        
        // Check for existing orders with this item at overlapping times
        // Exclude rejected and cancelled orders
        const [existingOrders] = await queryMySQL(
          `SELECT o.id, o.scheduled_for, o.status, oi.item_id, oi.quantity, i.duration_minutes
           FROM orders o
           INNER JOIN order_items oi ON o.id = oi.order_id
           INNER JOIN items i ON oi.item_id = i.id
           WHERE o.business_id = ?
             AND oi.item_id = ?
             AND o.scheduled_for IS NOT NULL
             AND o.status NOT IN ('rejected', 'canceled', 'cancelled')
             AND o.scheduled_for < ?
             AND DATE_ADD(o.scheduled_for, INTERVAL COALESCE(i.duration_minutes, 60) MINUTE) > ?
           ORDER BY o.scheduled_for ASC`,
          [
            business.id,
            scheduledItem.itemId,
            scheduledEndStr,
            scheduledStartStr
          ]
        );
        
        // item.quantity: null = infinite, number = limited instances
        // If quantity is null, allow unlimited bookings (no conflict check needed)
        if (scheduledItem.quantity !== null && scheduledItem.quantity !== undefined) {
          // Item has limited quantity - check if we can fit this booking
          let totalBookedQuantity = 0;
          if (existingOrders && existingOrders.length > 0) {
            for (const order of existingOrders) {
              totalBookedQuantity += parseInt(order.quantity || 1);
            }
          }
          
          // Count quantity in current cart
          const cartItem = cart.items.find(ci => ci.item_id === scheduledItem.itemId);
          const cartQuantity = parseInt(cartItem?.quantity || 1);
          
          // Check if adding this would exceed available quantity
          if (totalBookedQuantity + cartQuantity > scheduledItem.quantity) {
            const formattedTime = dateTimeParser.formatDate(parsedDate, context.language || 'english');
            return {
              success: false,
              error: `Sorry, "${scheduledItem.itemName}" is already fully booked at ${formattedTime}. Only ${scheduledItem.quantity} instance(s) available, and ${totalBookedQuantity} are already scheduled. Please choose a different time.`
            };
          }
        } else {
          // Quantity is null = infinite, but for "only scheduled" items, we still check for single instance conflicts
          // (unless quantity is explicitly set to a number > 1)
          if (existingOrders && existingOrders.length > 0) {
            // Check if there's a conflict (for single-instance items, even if quantity is null)
            // This prevents double-booking when quantity is not set (defaults to single instance for "only scheduled")
            const conflictingOrder = existingOrders[0];
            const conflictingTime = new Date(conflictingOrder.scheduled_for);
            const formattedConflictingTime = dateTimeParser.formatDate(conflictingTime, context.language || 'english');
            
            return {
              success: false,
              error: `Sorry, "${scheduledItem.itemName}" is already scheduled at ${formattedConflictingTime}. This item can only be scheduled once at a time. Please choose a different time.`
            };
          }
        }
      }
      
      // Update cart with scheduled time
      const updatedCart = await cartManager.updateCart(
        business.id,
        branchId,
        customerPhoneNumber,
        { scheduled_for: parsedDate }
      );
      
      // Use detected language from context instead of cart language
      const language = context.language || 'english';
      const formattedDate = dateTimeParser.formatDate(parsedDate, language);
      
      logger.info('Scheduled time set via function call', { 
        scheduledTimeText, 
        parsedDate,
        formattedDate,
        maxMinScheduleHours,
        schedulableItemsCount
      });
      
      return {
        success: true,
        message: `Order scheduled for: ${formattedDate}`,
        cart: updatedCart
      };
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getDeliveryFunctionDefinitions,
  executeDeliveryFunction
};
