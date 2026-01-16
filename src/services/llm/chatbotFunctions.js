// Chatbot Functions
// Functions that OpenAI can call directly to modify the database

const cartManager = require('./cartManager');
const logger = require('../../utils/logger');
const { queryMySQL } = require('../../config/database');
const cache = require('../../utils/cache');

/**
 * Get available functions/tools for OpenAI
 */
function getAvailableFunctions() {
  return [
    {
      type: 'function',
      function: {
        name: 'add_item_to_cart',
        description: 'Add an item to the customer\'s cart. Use this when customer wants to order something (e.g., "I want pizza", "baddi pizza", "give me burger"). Match the item name from available menu items.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to add (match exactly from menu items, or use closest match)'
            },
            quantity: {
              type: 'number',
              description: 'Quantity to add (default: 1)',
              default: 1
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'remove_item_from_cart',
        description: 'Remove an item from the customer\'s cart. Use this when customer wants to remove something from their order.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to remove from cart'
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_item_quantity',
        description: 'Update the quantity of an item in the cart.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to update'
            },
            quantity: {
              type: 'number',
              description: 'New quantity (must be > 0, use remove_item_from_cart to remove)'
            }
          },
          required: ['itemName', 'quantity']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_cart',
        description: 'Get the current cart contents. Use this when customer asks to see their cart, order summary, or what they ordered.',
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
        name: 'update_delivery_type',
        description: 'Set the delivery type for the order. Use this when customer chooses takeaway, delivery, or on-site/dine-in.',
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
        description: 'Set the delivery address. Call this IMMEDIATELY when customer provides ANY location information. Lebanese addresses are often given in one sentence with commas or natural speech. Examples: "Salim Salam, Abraj Beirut, Block B2, 21, 7ad LIU" or "michel abi chahla street, abraj beirut building, block b2 21st floor, beirut". Extract the COMPLETE text exactly as customer says it.',
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
        name: 'set_location',
        description: 'Set GPS location coordinates for delivery. Call this when customer shares their location with GPS coordinates (latitude/longitude). This is used for accurate delivery tracking.',
        parameters: {
          type: 'object',
          properties: {
            latitude: {
              type: 'number',
              description: 'Latitude coordinate (e.g., 33.8938)'
            },
            longitude: {
              type: 'number',
              description: 'Longitude coordinate (e.g., 35.5018)'
            },
            name: {
              type: 'string',
              description: 'Optional location name (e.g., "Home", "Office")'
            },
            address: {
              type: 'string',
              description: 'Optional address text'
            }
          },
          required: ['latitude', 'longitude']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_scheduled_time',
        description: 'Set scheduled time for order delivery/pickup. Use when customer wants to schedule order for future time. Parse natural language like "tomorrow at 7pm", "Friday 6:30pm", "in 2 hours". For restaurants that are closed, this is required.',
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
    },
    {
      type: 'function',
      function: {
        name: 'confirm_order',
        description: 'Confirm and place the order. Only use this when cart has items, delivery type is set, and if delivery then address is provided. Customer must explicitly confirm.',
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
        name: 'get_menu_items',
        description: 'Get all available menu items. Use this when customer asks to see the menu, available items, or what\'s available.',
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
 * Execute a function call
 */
async function executeFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  const branchId = branch?.id || business.id;
  
  try {
    switch (functionName) {
      case 'add_item_to_cart': {
        const { itemName, quantity = 1 } = args;
        
        // Check cache for menu items first to reduce DB queries
        const cacheKey = `menu_items_${business.id}`;
        let cachedItems = cache.get(cacheKey);
        
        let item = null;
        
        // If we have cached items, try to find item in cache first
        if (cachedItems && cachedItems.items) {
          const itemNameLower = itemName.toLowerCase();
          item = cachedItems.items.find(i => 
            i.name.toLowerCase() === itemNameLower ||
            i.name.toLowerCase().includes(itemNameLower) ||
            itemNameLower.includes(i.name.toLowerCase())
          );
        }
        
        // If not found in cache or no cache, query database
        if (!item) {
          const items = await queryMySQL(
            `SELECT * FROM items 
             WHERE business_id = ? AND availability = 'available' AND deleted_at IS NULL
             AND (LOWER(name) LIKE ? OR LOWER(name) LIKE ? OR LOWER(name) = ?)
             ORDER BY CASE WHEN LOWER(name) = ? THEN 1 WHEN LOWER(name) LIKE ? THEN 2 ELSE 3 END
             LIMIT 1`,
            [
              business.id,
              `%${itemName.toLowerCase()}%`,
              `${itemName.toLowerCase().split(' ')[0]}%`,
              itemName.toLowerCase(),
              itemName.toLowerCase(),
              `${itemName.toLowerCase()}%`
            ]
          );
          
          if (items.length === 0) {
            return {
              success: false,
              error: `Item "${itemName}" not found. Please check the menu for available items.`
            };
          }
          
          item = items[0];
        }
        
        // Check if item is "only scheduled" (is_schedulable = true means ONLY scheduled, not direct order)
        if (item.is_schedulable) {
          // Item can only be scheduled, inform customer
          return {
            success: true,
            message: `Added ${quantity}x ${item.name} to your cart. Note: This item can only be scheduled for a future time. Please use the scheduling function to set a date and time.`,
            cart: await cartManager.getCart(business.id, branchId, customerPhoneNumber),
            requiresScheduling: true
          };
        }
        
        const cart = await cartManager.addItemToCart(
          business.id,
          branchId,
          customerPhoneNumber,
          {
            itemId: item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: parseInt(quantity)
          }
        );
        
        // Invalidate menu cache when cart changes (items might be out of stock)
        cache.delete(cacheKey);
        
        logger.info('Item added to cart via function call', { 
          itemName: item.name, 
          quantity,
          cartId: cart.id 
        });
        
        return {
          success: true,
          message: `Added ${quantity}x ${item.name} to your cart`,
          cart: cart
        };
      }
      
      case 'remove_item_from_cart': {
        const { itemName } = args;
        const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
        
        const cartItem = cart.items?.find(item => 
          item.name.toLowerCase().includes(itemName.toLowerCase()) ||
          itemName.toLowerCase().includes(item.name.toLowerCase())
        );
        
        if (!cartItem) {
          return {
            success: false,
            error: `Item "${itemName}" not found in cart.`
          };
        }
        
        const updatedCart = await cartManager.removeItemFromCart(
          business.id,
          branchId,
          customerPhoneNumber,
          cartItem.item_id
        );
        
        logger.info('Item removed from cart via function call', { itemName: cartItem.name });
        
        return {
          success: true,
          message: `Removed ${cartItem.name} from your cart`,
          cart: updatedCart
        };
      }
      
      case 'update_item_quantity': {
        const { itemName, quantity } = args;
        const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
        
        const cartItem = cart.items?.find(item => 
          item.name.toLowerCase().includes(itemName.toLowerCase()) ||
          itemName.toLowerCase().includes(item.name.toLowerCase())
        );
        
        if (!cartItem) {
          return {
            success: false,
            error: `Item "${itemName}" not found in cart.`
          };
        }
        
        if (quantity <= 0) {
          // Use remove instead
          const updatedCart = await cartManager.removeItemFromCart(
            business.id,
            branchId,
            customerPhoneNumber,
            cartItem.item_id
          );
          return {
            success: true,
            message: `Removed ${cartItem.name} from your cart`,
            cart: updatedCart
          };
        }
        
        const updatedCart = await cartManager.updateItemQuantity(
          business.id,
          branchId,
          customerPhoneNumber,
          cartItem.item_id,
          parseInt(quantity)
        );
        
        return {
          success: true,
          message: `Updated ${cartItem.name} quantity to ${quantity}`,
          cart: updatedCart
        };
      }
      
      case 'get_cart': {
        const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
        const summary = cartManager.getCartSummary(cart);
        
        return {
          success: true,
          message: summary,
          cart: cart
        };
      }
      
      case 'update_delivery_type': {
        const { deliveryType } = args;
        const updateData = { delivery_type: deliveryType };
        
        // Set delivery price if delivery
        if (deliveryType === 'delivery') {
          updateData.delivery_price = 5.00; // Default, can be configurable
        } else {
          updateData.delivery_price = 0;
        }
        
        const cart = await cartManager.updateCart(
          business.id,
          branchId,
          customerPhoneNumber,
          updateData
        );
        
        logger.info('Delivery type updated via function call', { deliveryType, cartId: cart.id });
        
        const typeName = deliveryType === 'delivery' ? 'Delivery' : 
                         deliveryType === 'takeaway' ? 'Takeaway' : 'On-site';
        
        return {
          success: true,
          message: `Delivery type set to: ${typeName}${deliveryType === 'delivery' ? '. Please provide your delivery address.' : ''}`,
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
          hasItems: cartBefore?.items && cartBefore.items.length > 0
        });
        
        const cart = await cartManager.updateCart(
          business.id,
          branchId,
          customerPhoneNumber,
          { 
            location_address: address
            // Don't update notes - it must stay as '__cart__' to identify the cart
          }
        );
        
        logger.info('Cart AFTER address update', { 
          cartId: cart?.id,
          itemCount: cart?.items?.length || 0,
          hasItems: cart?.items && cart.items.length > 0,
          address: cart?.location_address
        });
        
        logger.info('Delivery address set via function call', { address });
        
        return {
          success: true,
          message: `Delivery address saved: ${address}`,
          cart: cart
        };
      }
      
      case 'set_location': {
        const { latitude, longitude, name, address } = args;
        const geoUtils = require('../../utils/geoUtils');
        
        // Validate coordinates
        if (!geoUtils.validateCoordinates(latitude, longitude)) {
          return {
            success: false,
            error: 'Invalid GPS coordinates provided.'
          };
        }
        
        // Optional: Check delivery radius if business has location set
        // For now, we'll skip this but log the distance calculation capability
        // In production: get business coordinates from database and validate
        let distanceInfo = null;
        if (business.location_latitude && business.location_longitude) {
          distanceInfo = geoUtils.isWithinDeliveryRadius(
            latitude,
            longitude,
            business.location_latitude,
            business.location_longitude,
            business.delivery_radius_km || 10 // Default 10km
          );
          
          if (!distanceInfo.withinRadius) {
            logger.warn('Customer location outside delivery radius', {
              distance: distanceInfo.distance,
              maxRadius: business.delivery_radius_km || 10,
              customerLat: latitude,
              customerLon: longitude
            });
            
            return {
              success: false,
              error: `Sorry, we cannot deliver to your location. You are ${distanceInfo.distance}km away, but our maximum delivery radius is ${business.delivery_radius_km || 10}km.`
            };
          }
        }
        
        const updateData = {
          location_latitude: latitude,
          location_longitude: longitude,
          location_name: name || null,
          location_address: address || null
        };
        
        // Don't update notes - must stay as '__cart__' to identify the cart
        // Location info is now stored in dedicated location_* fields
        
        const cart = await cartManager.updateCart(
          business.id,
          branchId,
          customerPhoneNumber,
          updateData
        );
        
        logger.info('Location set via function call', { 
          latitude, 
          longitude, 
          name, 
          address,
          distance: distanceInfo?.distance 
        });
        
        let responseMessage = `Location saved${name ? ': ' + name : ''}. ${address || 'GPS coordinates recorded.'}`;
        if (distanceInfo) {
          responseMessage += ` You are approximately ${distanceInfo.distance}km away from us.`;
        }
        
        return {
          success: true,
          message: responseMessage,
          cart: cart
        };
      }
      
      case 'set_scheduled_time': {
        const { scheduledTimeText } = args;
        const dateTimeParser = require('./dateTimeParser');
        
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
        
        // Get opening hours for validation
        const openingHours = await queryMySQL(`
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
          openingHours
        );
        
        if (!parsedDate) {
          return {
            success: false,
            error: `Sorry, I couldn't understand "${scheduledTimeText}" or it's outside our opening hours. Please provide a time when we're open.`
          };
        }
        
        // Validate minimum schedule time if cart has items with min_schedule_hours
        if (maxMinScheduleHours > 0) {
          const validation = dateTimeParser.validateMinScheduleTime(parsedDate, maxMinScheduleHours);
          
          if (!validation.valid) {
            return {
              success: false,
              error: `${validation.message}. Please choose a time at least ${maxMinScheduleHours} hours from now.`
            };
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
      
      case 'confirm_order': {
        const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
        
        // Validate cart
        if (!cart.items || cart.items.length === 0) {
          return {
            success: false,
            error: 'Cannot confirm order: Cart is empty. Please add items first.'
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
        
        // Check if cart has items that are "only scheduled" (is_schedulable = true)
        // These items MUST have a scheduled_for time before confirming
        let hasOnlyScheduledItems = false;
        let onlyScheduledItemNames = [];
        
        if (cart.items && cart.items.length > 0) {
          for (const cartItem of cart.items) {
            const [items] = await queryMySQL(
              'SELECT * FROM items WHERE id = ?',
              [cartItem.item_id]
            );
            
            if (items && items.length > 0) {
              const item = items[0];
              if (item.is_schedulable) {
                hasOnlyScheduledItems = true;
                onlyScheduledItemNames.push(item.name);
              }
            }
          }
        }
        
        // If cart has "only scheduled" items, require scheduled_for time
        if (hasOnlyScheduledItems && !cart.scheduled_for) {
          return {
            success: false,
            error: `Cannot confirm order: The following items can only be scheduled: ${onlyScheduledItemNames.join(', ')}. Please use the scheduling function to set a date and time first.`,
            requiresScheduling: true
          };
        }
        
        // Confirm order (this will be handled by conversationManager)
        // For now, return success and let the main handler process it
        return {
          success: true,
          message: 'Order validated. Confirming order...',
          cart: cart,
          readyToConfirm: true
        };
      }
      
      case 'cancel_scheduled_order': {
        const { orderId } = args;
        const { generateUUID } = require('../../utils/uuid');
        const { getMySQLConnection } = require('../../config/database');
        
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
      
      case 'get_menu_items': {
        // Check cache first (menu items don't change often)
        const cacheKey = `menu_items_${business.id}`;
        const cached = cache.get(cacheKey);
        
        if (cached) {
          logger.debug('Menu items served from cache', { businessId: business.id });
          return cached;
        }
        
        // Get all available items from database
        const items = await queryMySQL(
          `SELECT i.*, m.name as menu_name FROM items i
           LEFT JOIN menus m ON i.menu_id = m.id
           WHERE i.business_id = ? AND i.availability = 'available' AND i.deleted_at IS NULL
           ORDER BY m.name, i.name`,
          [business.id]
        );
        
        if (items.length === 0) {
          const result = {
            success: true,
            message: 'No items available at the moment.',
            items: []
          };
          cache.set(cacheKey, result, 2 * 60 * 1000); // Cache empty results for 2 minutes
          return result;
        }
        
        // Format items by menu
        const itemsByMenu = {};
        for (const item of items) {
          const menuName = item.menu_name || 'All Items';
          if (!itemsByMenu[menuName]) {
            itemsByMenu[menuName] = [];
          }
          itemsByMenu[menuName].push({
            name: item.name,
            price: parseFloat(item.price),
            description: item.description
          });
        }
        
        let menuText = '📋 **Available Menu:**\n\n';
        for (const [menuName, menuItems] of Object.entries(itemsByMenu)) {
          menuText += `**${menuName}:**\n`;
          for (const item of menuItems) {
            menuText += `  • ${item.name} - $${item.price.toFixed(2)}`;
            if (item.description) {
              menuText += `\n    ${item.description}`;
            }
            menuText += '\n';
          }
          menuText += '\n';
        }
        
        const result = {
          success: true,
          message: menuText,
          items: items
        };
        
        // Cache for 5 minutes (menu items don't change often)
        cache.set(cacheKey, result, 5 * 60 * 1000);
        
        return result;
      }
      
      default:
        return {
          success: false,
          error: `Unknown function: ${functionName}`
        };
    }
  } catch (error) {
    logger.error(`Error executing function ${functionName}:`, error);
    return {
      success: false,
      error: `Error: ${error.message}`
    };
  }
}

module.exports = {
  getAvailableFunctions,
  executeFunction
};
