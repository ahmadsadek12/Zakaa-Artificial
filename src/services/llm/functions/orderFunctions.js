// Order Functions
// Functions for order confirmation, cancellation, and retrieval

const cartManager = require('../cartManager');
const logger = require('../../../utils/logger');
const { queryMySQL, getMySQLConnection } = require('../../../config/database');
const { generateUUID } = require('../../../utils/uuid');

/**
 * Get order function definitions for OpenAI
 */
function getOrderFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'confirm_order',
        description: '⚠️ CRITICAL: Confirm and place the order. This function MUST ONLY be called when the customer EXPLICITLY says "CONFIRM" or "confirm" in their message. NEVER call this function automatically - you must ALWAYS wait for the customer to explicitly confirm. After showing order summary, ask the customer to type "CONFIRM" to place the order, and ONLY THEN call this function when they say "CONFIRM". This function checks CURRENT business status from database. It will check if business is currently open (from database, not conversation history). Only use this when ongoing order has items, delivery type is set, and if delivery then address is provided.',
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
        name: 'cancel_scheduled_order',
        description: 'Cancel a scheduled order. Only works for orders scheduled more than 2 hours in the future. Use when customer wants to cancel their scheduled order.',
        parameters: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Order ID to cancel (optional - if not provided, will list customer\'s scheduled orders)'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_my_orders',
        description: 'Get customer\'s accepted orders. Use this when customer asks to see their orders, "my orders", "show my orders", "what orders do I have", or wants to check their order status.',
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
        name: 'cancel_accepted_order',
        description: 'Cancel an accepted order. Only works for scheduled orders (orders with scheduled_for time) that are scheduled more than 2 hours in the future. Use when customer wants to cancel an accepted order. If no orderId provided, will list their accepted scheduled orders.',
        parameters: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Order ID to cancel (optional - if not provided, will list customer\'s accepted scheduled orders)'
            }
          }
        }
      }
    }
  ];
}

/**
 * Execute order function
 */
async function executeOrderFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  const branchId = branch?.id || business.id;
  
  switch (functionName) {
    case 'confirm_order': {
      const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      
      // Validate cart
      if (!cart.items || cart.items.length === 0) {
        return {
          success: false,
          error: 'Cannot confirm order: Your ongoing order is empty. Please add items first.'
        };
      }
      
      if (!cart.delivery_type) {
        return {
          success: false,
          error: 'Cannot confirm order: Please select delivery type (takeaway, delivery, or on-site).'
        };
      }
      
      if (cart.delivery_type === 'delivery' && !cart.location_address && !cart.notes?.includes('Delivery Address:')) {
        return {
          success: false,
          error: 'Cannot confirm order: Please provide your delivery address first.'
        };
      }
      
      // Check if business is currently open
      const conversationManager = require('../conversationManager');
      const openStatus = await conversationManager.isOpenNow(business.id, branchId);
      
      // Get closing time for error messages
      const businessTimezone = business.timezone || 'Asia/Beirut';
      const now = new Date();
      const nowInTimezone = new Date(now.toLocaleString('en-US', { timeZone: businessTimezone }));
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][nowInTimezone.getDay()];
      
      let closingTime = 'closing';
      let hours = [];
      if (branchId && branchId !== business.id) {
        hours = await queryMySQL(`
          SELECT close_time FROM opening_hours 
          WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
        `, ['branch', branchId, dayOfWeek]);
      }
      if (hours.length === 0) {
        hours = await queryMySQL(`
          SELECT close_time FROM opening_hours 
          WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
        `, ['business', business.id, dayOfWeek]);
      }
      if (hours.length > 0 && hours[0].close_time) {
        closingTime = hours[0].close_time.substring(0, 5);
      }
      
      logger.info('confirm_order: Checking order confirmation', {
        businessId: business.id,
        branchId,
        isOpen: openStatus.isOpen,
        reason: openStatus.reason,
        hasScheduledTime: !!cart.scheduled_for,
        scheduledFor: cart.scheduled_for,
        deliveryType: cart.delivery_type
      });
      
      // Check if cart has items that are "only scheduled" (is_schedulable = true)
      let hasOnlyScheduledItems = false;
      let onlyScheduledItemNames = [];
      let requiresScheduling = false;
      
      if (cart.items && cart.items.length > 0) {
        for (const cartItem of cart.items) {
          const [items] = await queryMySQL(
            'SELECT * FROM items WHERE id = ?',
            [cartItem.item_id]
          );
          
          if (items && items.length > 0) {
            const item = items[0];
            // Explicitly check for is_schedulable = true (handles both boolean true and numeric 1 from MySQL)
            const isSchedulable = item.is_schedulable === true 
              || item.is_schedulable === 1 
              || item.is_schedulable === '1' 
              || item.is_schedulable === 'true';
            
            if (isSchedulable) {
              hasOnlyScheduledItems = true;
              onlyScheduledItemNames.push(item.name);
              
              // "Only scheduled" items MUST have a scheduled_for time ONLY if business is closed
              // If business is open, allow immediate orders for schedulable items
              if (!cart.scheduled_for && !openStatus.isOpen) {
                requiresScheduling = true;
              }
            }
          }
        }
      }
      
      // If cart has "only scheduled" items without scheduled time AND business is closed, require scheduling
      if (requiresScheduling) {
        logger.warn('confirm_order: Requires scheduling but business is closed', {
          isOpen: openStatus.isOpen,
          onlyScheduledItemNames
        });
        return {
          success: false,
          error: `We're currently closed. The following items need to be scheduled: ${onlyScheduledItemNames.join(', ')}. Please use the scheduling function to set a date and time when we're open.`,
          requiresScheduling: true
        };
      }
      
      // If order is scheduled, validate opening hours for that day
      if (cart.scheduled_for) {
        const scheduledDate = new Date(cart.scheduled_for);
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][scheduledDate.getDay()];
        
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
        
        if (dayOpeningHours.length === 0 || dayOpeningHours[0].is_closed) {
          return {
            success: false,
            error: `Cannot confirm order: We're closed on ${dayOfWeek}. Please reschedule for a day when we're open.`
          };
        }
        
        const dayHours = dayOpeningHours[0];
        if (dayHours.open_time && dayHours.close_time) {
          const scheduledTime = scheduledDate.toTimeString().substring(0, 5); // HH:MM
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
          const ownerIdForScheduled = (branchId && branchId !== business.id) ? branchId : business.id;
          const [ownerUsersScheduled] = await queryMySQL(
            'SELECT last_order_before_closing_minutes FROM users WHERE id = ?',
            [ownerIdForScheduled]
          );
          const lastOrderBeforeClosing = ownerUsersScheduled?.[0]?.last_order_before_closing_minutes || 0;
          const effectiveCloseMinutes = closeMinutes - lastOrderBeforeClosing;
          
          if (scheduledMinutes < openMinutes || scheduledMinutes > effectiveCloseMinutes) {
            return {
              success: false,
              error: `Cannot confirm order: Scheduled time ${scheduledTime} is outside our opening hours (${openTime} - ${closeTime}) on ${dayOfWeek}. Please reschedule.`
            };
          }
        }
      }
      
      // Check if business is closed for immediate (non-scheduled) orders
      if (!cart.scheduled_for) {
        // For immediate orders, check if last order time has passed
        if (openStatus.lastOrderTimePassed && openStatus.isWithinOpeningHours) {
          // Past last order time but still within opening hours - require scheduling
          logger.warn('confirm_order: Attempting immediate order after last order time', {
            lastOrderTime: openStatus.lastOrderTime,
            reason: openStatus.reason,
            isWithinOpeningHours: openStatus.isWithinOpeningHours
          });
          return {
            success: false,
            error: `We're past our last order time (${openStatus.lastOrderTime}). We're still open until ${closingTime}, but you'll need to schedule your order for a future time. Please use the scheduling function to set a date and time.`,
            requiresScheduling: true
          };
        } else if (!openStatus.isOpen) {
          // Business is closed (before opening hours or after closing)
          logger.warn('confirm_order: Attempting to confirm unscheduled order while closed', {
            isOpen: openStatus.isOpen,
            isWithinOpeningHours: openStatus.isWithinOpeningHours,
            reason: openStatus.reason,
            hasScheduledTime: !!cart.scheduled_for
          });
          return {
            success: false,
            error: `We're currently closed (${openStatus.reason}). Please schedule your order for when we're open.`,
            requiresScheduling: true
          };
        }
      }
      
      // Business is open for orders OR order is scheduled - allow order
      // If approaching last order time, add warning
      let warningMessage = '';
      if (!cart.scheduled_for && openStatus.minutesUntilLastOrder !== null && openStatus.minutesUntilLastOrder <= 30) {
        warningMessage = `\n⚠️ Note: Last order time is in ${openStatus.minutesUntilLastOrder} minutes (${openStatus.lastOrderTime}). Please confirm quickly!`;
      }
      
      logger.info('confirm_order: Business is open, allowing immediate order confirmation', {
        isOpen: openStatus.isOpen,
        lastOrderTimePassed: openStatus.lastOrderTimePassed,
        minutesUntilLastOrder: openStatus.minutesUntilLastOrder,
        hasScheduledTime: !!cart.scheduled_for,
        itemCount: cart.items?.length || 0
      });
      
      // Show cart summary during checkout/confirmation
      const cartSummary = cartManager.getCartSummary(cart);
      
      // Confirm order (this will be handled by conversationManager)
      // For now, return success and let the main handler process it
      return {
        success: true,
        message: `${cartSummary}${warningMessage}\n\nOrder validated. Confirming order...`,
        cart: cart,
        readyToConfirm: true
      };
    }
    
    case 'cancel_scheduled_order': {
      const { orderId } = args;
      
      // Get customer's scheduled orders
      const [scheduledOrders] = await queryMySQL(
        `SELECT id, scheduled_for, subtotal, total, delivery_type, status
         FROM orders
         WHERE customer_phone_number = ?
           AND business_id = ?
           AND scheduled_for IS NOT NULL
           AND scheduled_for > NOW()
           AND status = 'accepted'
         ORDER BY scheduled_for ASC`,
        [customerPhoneNumber, business.id]
      );
      
      if (scheduledOrders.length === 0) {
        return {
          success: false,
          error: 'You have no scheduled orders to cancel.'
        };
      }
      
      // If no orderId provided, list their orders
      if (!orderId) {
        let ordersList = '📅 Your scheduled orders:\n\n';
        for (const order of scheduledOrders) {
          const orderDate = new Date(order.scheduled_for);
          const hoursUntil = (orderDate - new Date()) / (1000 * 60 * 60);
          ordersList += `Order ${order.id.substring(0, 8)}...\n`;
          ordersList += `  Date: ${orderDate.toLocaleString()}\n`;
          ordersList += `  Total: $${parseFloat(order.total).toFixed(2)}\n`;
          ordersList += `  Type: ${order.delivery_type}\n`;
          if (hoursUntil < 2) {
            ordersList += `  ⚠️ Cannot cancel (less than 2 hours remaining)\n`;
          }
          ordersList += '\n';
        }
        ordersList += 'To cancel, provide the order ID.';
        
        return {
          success: true,
          message: ordersList,
          orders: scheduledOrders
        };
      }
      
      // Find the order
      const order = scheduledOrders.find(o => o.id === orderId || o.id.startsWith(orderId));
      
      if (!order) {
        return {
          success: false,
          error: `Order not found. Please check the order ID.`
        };
      }
      
      // Check if more than 2 hours remaining
      const hoursUntil = (new Date(order.scheduled_for) - new Date()) / (1000 * 60 * 60);
      
      if (hoursUntil < 2) {
        return {
          success: false,
          error: `Cannot cancel this order. It's scheduled in less than 2 hours. Please contact us directly if you need to cancel.`
        };
      }
      
      // Cancel the order
      const connection = await getMySQLConnection();
      
      try {
        await connection.beginTransaction();
        
        // Update order status
        await connection.query(
          `UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [order.id]
        );
        
        // Add status history
        await connection.query(
          `INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
           VALUES (?, ?, 'rejected', 'customer', CURRENT_TIMESTAMP)`,
          [generateUUID(), order.id]
        );
        
        await connection.commit();
        
        logger.info('Scheduled order cancelled by customer', {
          orderId: order.id,
          customerPhoneNumber,
          businessId: business.id,
          scheduledFor: order.scheduled_for
        });
        
        return {
          success: true,
          message: `✅ Your scheduled order has been cancelled successfully. You will not be charged.`
        };
        
      } catch (error) {
        await connection.rollback();
        logger.error('Error cancelling scheduled order', { error: error.message, orderId: order.id });
        return {
          success: false,
          error: 'Sorry, there was an error cancelling your order. Please try again or contact us.'
        };
      } finally {
        connection.release();
      }
    }
    
    case 'get_my_orders': {
      try {
        // Get customer's accepted orders
        const acceptedOrders = await queryMySQL(
          `SELECT 
            o.id,
            o.subtotal,
            o.delivery_price,
            o.total,
            o.delivery_type,
            o.scheduled_for,
            o.created_at,
            o.updated_at,
            o.notes,
            o.status
          FROM orders o
          WHERE o.customer_phone_number = ?
            AND o.business_id = ?
            AND o.status = 'accepted'
          ORDER BY o.created_at DESC
          LIMIT 20`,
          [customerPhoneNumber, business.id]
        );
        
        if (!acceptedOrders || acceptedOrders.length === 0) {
          return {
            success: true,
            message: 'You have no accepted orders at the moment.',
            orders: []
          };
        }
        
        // Get order items for each order
        let ordersList = '📦 **Your Accepted Orders:**\n\n';
        for (const order of acceptedOrders) {
          try {
            const orderItems = await queryMySQL(
              `SELECT oi.*, i.name as item_name
               FROM order_items oi
               LEFT JOIN items i ON oi.item_id = i.id
               WHERE oi.order_id = ?
               ORDER BY oi.created_at ASC`,
              [order.id]
            );
            
            const orderDate = new Date(order.created_at);
            const orderNumber = order.id.substring(0, 8).toUpperCase();
            
            ordersList += `**Order #${orderNumber}**\n`;
            ordersList += `  Status: ${order.status}\n`;
            ordersList += `  Date: ${orderDate.toLocaleString()}\n`;
            
            if (order.scheduled_for) {
              const scheduledDate = new Date(order.scheduled_for);
              ordersList += `  Scheduled for: ${scheduledDate.toLocaleString()}\n`;
            }
            
            ordersList += `  Type: ${order.delivery_type}\n`;
            
            if (orderItems && orderItems.length > 0) {
              ordersList += `  Items:\n`;
              for (const item of orderItems) {
                ordersList += `    • ${item.quantity}x ${item.name_at_time || item.item_name || 'Item'}\n`;
              }
            }
            
            ordersList += `  Total: $${parseFloat(order.total).toFixed(2)}\n`;
            
            if (order.notes && !order.notes.startsWith('__cart__')) {
              // Extract customer notes (remove cart marker if present)
              const customerNotes = order.notes.replace(/^__cart__\s*\n?\s*NOTES:\s*/i, '').trim();
              if (customerNotes) {
                ordersList += `  Notes: ${customerNotes}\n`;
              }
            }
            
            ordersList += '\n';
          } catch (itemError) {
            logger.error('Error fetching order items', { 
              orderId: order.id, 
              error: itemError.message 
            });
            // Continue with other orders even if one fails
          }
        }
        
        return {
          success: true,
          message: ordersList,
          orders: acceptedOrders
        };
      } catch (error) {
        logger.error('Error in get_my_orders', { 
          error: error.message, 
          stack: error.stack,
          customerPhoneNumber,
          businessId: business.id
        });
        return {
          success: false,
          error: 'Sorry, there was an issue retrieving your orders. Please try again later.'
        };
      }
    }
    
    case 'cancel_accepted_order': {
      const { orderId } = args;
      
      // Get customer's accepted scheduled orders (only scheduled orders can be cancelled)
      const acceptedScheduledOrders = await queryMySQL(
        `SELECT id, scheduled_for, subtotal, total, delivery_type, status
         FROM orders
         WHERE customer_phone_number = ?
           AND business_id = ?
           AND status = 'accepted'
           AND scheduled_for IS NOT NULL
           AND scheduled_for > NOW()
         ORDER BY scheduled_for ASC`,
        [customerPhoneNumber, business.id]
      );
      
      if (acceptedScheduledOrders.length === 0) {
        return {
          success: false,
          error: 'You have no accepted scheduled orders that can be cancelled.'
        };
      }
      
      // If no orderId provided, list their orders
      if (!orderId) {
        let ordersList = '📅 **Your Accepted Scheduled Orders:**\n\n';
        for (const order of acceptedScheduledOrders) {
          const orderDate = new Date(order.scheduled_for);
          const hoursUntil = (orderDate - new Date()) / (1000 * 60 * 60);
          const orderNumber = order.id.substring(0, 8).toUpperCase();
          
          ordersList += `**Order #${orderNumber}**\n`;
          ordersList += `  Scheduled for: ${orderDate.toLocaleString()}\n`;
          ordersList += `  Total: $${parseFloat(order.total).toFixed(2)}\n`;
          ordersList += `  Type: ${order.delivery_type}\n`;
          if (hoursUntil < 2) {
            ordersList += `  ⚠️ Cannot cancel (less than 2 hours remaining)\n`;
          } else {
            ordersList += `  ✅ Can be cancelled\n`;
          }
          ordersList += '\n';
        }
        ordersList += 'To cancel, provide the order ID or order number.';
        
        return {
          success: true,
          message: ordersList,
          orders: acceptedScheduledOrders
        };
      }
      
      // Find the order (match by full ID or first 8 characters)
      const order = acceptedScheduledOrders.find(o => 
        o.id === orderId || 
        o.id.startsWith(orderId) ||
        o.id.substring(0, 8).toUpperCase() === orderId.toUpperCase()
      );
      
      if (!order) {
        return {
          success: false,
          error: `Order not found. Please check the order ID. Use get_my_orders() to see your orders.`
        };
      }
      
      // Check if more than 2 hours remaining
      const hoursUntil = (new Date(order.scheduled_for) - new Date()) / (1000 * 60 * 60);
      
      if (hoursUntil < 2) {
        return {
          success: false,
          error: `Cannot cancel this order. It's scheduled in less than 2 hours. Please contact us directly if you need to cancel.`
        };
      }
      
      // Cancel the order
      const connection = await getMySQLConnection();
      
      try {
        await connection.beginTransaction();
        
        // Update order status to rejected
        await connection.query(
          `UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [order.id]
        );
        
        // Add status history
        await connection.query(
          `INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
           VALUES (?, ?, 'rejected', 'customer', CURRENT_TIMESTAMP)`,
          [generateUUID(), order.id]
        );
        
        await connection.commit();
        
        logger.info('Accepted scheduled order cancelled by customer', {
          orderId: order.id,
          customerPhoneNumber,
          businessId: business.id,
          scheduledFor: order.scheduled_for
        });
        
        const orderNumber = order.id.substring(0, 8).toUpperCase();
        return {
          success: true,
          message: `✅ Your order #${orderNumber} has been cancelled successfully. You will not be charged.`
        };
        
      } catch (error) {
        await connection.rollback();
        logger.error('Error cancelling accepted order', { error: error.message, orderId: order.id });
        return {
          success: false,
          error: 'Sorry, there was an error cancelling your order. Please try again or contact us.'
        };
      } finally {
        connection.release();
      }
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getOrderFunctionDefinitions,
  executeOrderFunction
};
