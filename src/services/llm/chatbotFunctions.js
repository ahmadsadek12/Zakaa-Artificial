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
        name: 'clear_cart',
        description: 'Clear/empty the entire cart. Remove all items and reset all prices to zero. Use this when customer wants to empty their cart, start over, or clear everything.',
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
          description: 'Confirm and place the order. This function checks CURRENT business status from database. Use this when customer wants to confirm/place their order. It will check if business is currently open (from database, not conversation history). Only use this when cart has items, delivery type is set, and if delivery then address is provided.',
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
    },
    {
      type: 'function',
      function: {
        name: 'send_item_image',
        description: 'Send an item image to the customer. Use this when customer asks to see a picture of an item, wants to see what an item looks like, or requests a photo/image of a specific item.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to send the image for'
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_menu_pdf',
        description: 'Send a menu PDF to the customer. Use this when customer asks for the menu in PDF format, wants to download the menu PDF, requests the menu as a PDF file, or asks to see the menu PDF.',
        parameters: {
          type: 'object',
          properties: {
            menuName: {
              type: 'string',
              description: 'The name of the menu to send the PDF for. If not specified or "all", send the first available menu PDF.'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_menu_image',
        description: 'Send menu images to the customer. Use this when customer asks to see menu images, wants to see pictures of the menu, requests menu photos, or asks "can I see the menu?" (when they want visual menu).',
        parameters: {
          type: 'object',
          properties: {
            menuName: {
              type: 'string',
              description: 'The name of the menu to send images for. If not specified or "all", send images from the first available menu.'
            }
          },
          required: []
        }
      }
    },
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
        description: 'Get the closing time for today or a specific day. Use this when customer asks "when do you close?", "what time do you close?", or "closing time".',
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
        name: 'set_order_notes',
        description: 'CRITICAL: Add or update special instructions/notes for the order. Call this IMMEDIATELY when customer mentions ANY special requests, modifications, or notes (e.g., "no tomato", "no garlic", "extra spicy", "please make it mild", "without onions", "remove pickles", "make it less spicy", "add cheese"). This is how you save customer\'s special instructions - ALWAYS call this function when they mention changes to their order.',
        parameters: {
          type: 'object',
          properties: {
            notes: {
              type: 'string',
              description: 'Order notes or special instructions from the customer (e.g., "no tomato, no garlic", "extra spicy", "please make it mild", "no onions")'
            }
          },
          required: ['notes']
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
        
        // Add item to cart first
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
          cartId: cart.id,
          isOnlyScheduled: item.is_schedulable
        });
        
        // Check if item is "only scheduled" (is_schedulable = true means ONLY scheduled, not direct order)
        if (item.is_schedulable) {
          // Item can only be scheduled, inform customer
          return {
            success: true,
            message: `Added ${quantity}x ${item.name} to your cart. Note: This item can only be scheduled for a future time. Please use the scheduling function to set a date and time before confirming your order.`,
            cart: cart,
            requiresScheduling: true
          };
        }
        
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
      
      case 'clear_cart': {
        try {
          // Get cart first to check if it exists
          const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
          
          if (!cart || !cart.id) {
            return {
              success: true,
              message: 'Your cart is already empty.',
              cart: { items: [], subtotal: 0, total: 0 }
            };
          }
          
          // Clear cart items and totals
          await cartManager.clearCart(business.id, branchId, customerPhoneNumber);
          
          // Also clear delivery-related fields
          const { getMySQLConnection } = require('../../config/database');
          const connection = await getMySQLConnection();
          
          try {
            await connection.query(`
              UPDATE orders 
              SET delivery_type = NULL, 
                  location_address = NULL,
                  location_latitude = NULL,
                  location_longitude = NULL,
                  location_name = NULL,
                  scheduled_for = NULL,
                  notes = '__cart__',
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [cart.id]);
          } finally {
            connection.release();
          }
          
          const clearedCart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
          
          return {
            success: true,
            message: 'Your cart has been cleared. It\'s now empty and ready for new items.',
            cart: clearedCart
          };
        } catch (error) {
          logger.error('Error clearing cart:', error);
          return {
            success: false,
            error: `Failed to clear cart: ${error.message}`
          };
        }
      }
      
      case 'update_delivery_type': {
        const { deliveryType } = args;
        const updateData = { delivery_type: deliveryType };
        
        // Set delivery price if delivery - use business delivery_price if available, otherwise 0
        if (deliveryType === 'delivery') {
          updateData.delivery_price = parseFloat(business.delivery_price || 0);
        } else {
          updateData.delivery_price = 0;
        }
        
        const cart = await cartManager.updateCart(
          business.id,
          branchId,
          customerPhoneNumber,
          updateData
        );
        
        logger.info('Delivery type updated via function call', { deliveryType, cartId: cart.id, deliveryPrice: updateData.delivery_price });
        
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
      
      case 'set_order_notes': {
        const { notes } = args;
        
        if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
          return {
            success: false,
            error: 'Please provide valid notes for your order.'
          };
        }
        
        // Update cart with notes
        // Store notes as: '__cart__\nNOTES: {notes}' to preserve cart marker
        const connection = await getMySQLConnection();
        try {
          await connection.beginTransaction();
          
          // Get current cart to check if it exists
          const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
          
          if (!cart || !cart.id) {
            await connection.rollback();
            return {
              success: false,
              error: 'Cannot add notes: Your cart is empty. Please add items first.'
            };
          }
          
          // Update notes: keep '__cart__' marker and add customer notes
          const notesWithMarker = `__cart__\nNOTES: ${notes.trim()}`;
          
          await connection.query(`
            UPDATE orders 
            SET notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND (notes = '__cart__' OR notes LIKE '__cart__%')
          `, [notesWithMarker, cart.id]);
          
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          logger.error('Error setting order notes:', error);
          throw error;
        } finally {
          connection.release();
        }
        
        // Get updated cart
        const updatedCart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
        
        logger.info('Order notes set via function call', { 
          cartId: updatedCart.id,
          notes: notes.trim()
        });
        
        return {
          success: true,
          message: `Order notes saved: "${notes.trim()}"`,
          cart: updatedCart
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
          
          // Check last order before closing
          const lastOrderBeforeClosing = dayHours.last_order_before_closing_minutes || 0;
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
        
        // Check if business is currently open
        const conversationManager = require('./conversationManager');
        const openStatus = await conversationManager.isOpenNow(business.id, branchId);
        
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
            
            // Check last order before closing
            const lastOrderBeforeClosing = dayHours.last_order_before_closing_minutes || 0;
            const effectiveCloseMinutes = closeMinutes - lastOrderBeforeClosing;
            
            if (scheduledMinutes < openMinutes || scheduledMinutes > effectiveCloseMinutes) {
              return {
                success: false,
                error: `Cannot confirm order: Scheduled time ${scheduledTime} is outside our opening hours (${openTime} - ${closeTime}) on ${dayOfWeek}. Please reschedule.`
              };
            }
          }
        } else if (!openStatus.isOpen) {
          // Order is not scheduled and business is closed
          logger.warn('confirm_order: Attempting to confirm unscheduled order while closed', {
            isOpen: openStatus.isOpen,
            reason: openStatus.reason,
            hasScheduledTime: !!cart.scheduled_for
          });
          return {
            success: false,
            error: `We're currently closed (${openStatus.reason}). Please schedule your order for when we're open.`,
            requiresScheduling: true
          };
        }
        
        // Business is open and order is not scheduled - allow immediate order
        logger.info('confirm_order: Business is open, allowing immediate order confirmation', {
          isOpen: openStatus.isOpen,
          hasScheduledTime: !!cart.scheduled_for,
          itemCount: cart.items?.length || 0
        });
        
        // Show cart summary during checkout/confirmation
        const cartSummary = cartManager.getCartSummary(cart);
        
        // Confirm order (this will be handled by conversationManager)
        // For now, return success and let the main handler process it
        return {
          success: true,
          message: `${cartSummary}\n\nOrder validated. Confirming order...`,
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
      
      case 'send_item_image': {
        const { itemName } = args;
        
        // Find the item
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
            error: `Item "${itemName}" not found. Please check the menu for available items.`,
            imageUrl: null
          };
        }
        
        const item = items[0];
        
        if (!item.item_image_url) {
          return {
            success: false,
            error: `Sorry, there's no image available for "${item.name}" at the moment.`,
            imageUrl: null
          };
        }
        
        // Return the image URL - the chatbot will send it
        return {
          success: true,
          message: `Here's the image for ${item.name}:`,
          imageUrl: item.item_image_url,
          itemName: item.name,
          shouldSendImage: true
        };
      }
      
      case 'send_menu_pdf': {
        const { menuName } = args;
        
        // Find menus with PDFs
        let menus;
        if (menuName) {
          menus = await queryMySQL(
            `SELECT * FROM menus 
             WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
             AND menu_pdf_url IS NOT NULL
             AND (LOWER(name) LIKE ? OR LOWER(name) = ?)
             ORDER BY CASE WHEN LOWER(name) = ? THEN 1 ELSE 2 END
             LIMIT 1`,
            [
              business.id,
              `%${menuName.toLowerCase()}%`,
              menuName.toLowerCase(),
              menuName.toLowerCase()
            ]
          );
        } else {
          // Get first menu with PDF
          menus = await queryMySQL(
            `SELECT * FROM menus 
             WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
             AND menu_pdf_url IS NOT NULL
             ORDER BY name
             LIMIT 1`,
            [business.id]
          );
        }
        
        if (menus.length === 0) {
          return {
            success: false,
            error: menuName 
              ? `Sorry, there's no PDF available for menu "${menuName}" at the moment.`
              : `Sorry, there's no menu PDF available at the moment.`,
            pdfUrl: null
          };
        }
        
        const menu = menus[0];
        
        // Return the PDF URL - the chatbot will send it
        return {
          success: true,
          message: `Here's the PDF menu for ${menu.name}:`,
          pdfUrl: menu.menu_pdf_url,
          menuName: menu.name,
          shouldSendPdf: true
        };
      }
      
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
        if (hour.last_order_before_closing_minutes && hour.last_order_before_closing_minutes > 0) {
          const closeTime = hour.close_time.substring(0, 5);
          const [closeHour, closeMin] = closeTime.split(':').map(Number);
          const lastOrderMinutes = closeHour * 60 + closeMin - hour.last_order_before_closing_minutes;
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
      
      case 'send_menu_image': {
        const { menuName } = args;
        
        // Find menus with images
        let menus;
        if (menuName) {
          menus = await queryMySQL(
            `SELECT * FROM menus 
             WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
             AND menu_image_urls IS NOT NULL
             AND (LOWER(name) LIKE ? OR LOWER(name) = ?)
             ORDER BY CASE WHEN LOWER(name) = ? THEN 1 ELSE 2 END
             LIMIT 1`,
            [
              business.id,
              `%${menuName.toLowerCase()}%`,
              menuName.toLowerCase(),
              menuName.toLowerCase()
            ]
          );
        } else {
          // Get first menu with images
          menus = await queryMySQL(
            `SELECT * FROM menus 
             WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
             AND menu_image_urls IS NOT NULL
             ORDER BY name
             LIMIT 1`,
            [business.id]
          );
        }
        
        if (menus.length === 0) {
          return {
            success: false,
            error: menuName 
              ? `Sorry, there are no images available for menu "${menuName}" at the moment.`
              : `Sorry, there are no menu images available at the moment.`,
            imageUrls: []
          };
        }
        
        const menu = menus[0];
        
        // Parse menu_image_urls (stored as JSON string)
        let menuImageUrls = [];
        if (menu.menu_image_urls) {
          try {
            menuImageUrls = typeof menu.menu_image_urls === 'string' 
              ? JSON.parse(menu.menu_image_urls) 
              : menu.menu_image_urls;
            if (!Array.isArray(menuImageUrls)) {
              menuImageUrls = [];
            }
          } catch (e) {
            logger.warn('Failed to parse menu_image_urls', { menuId: menu.id, error: e.message });
            menuImageUrls = [];
          }
        }
        
        if (menuImageUrls.length === 0) {
          return {
            success: false,
            error: menuName 
              ? `Sorry, there are no images available for menu "${menu.name}" at the moment.`
              : `Sorry, there are no menu images available at the moment.`,
            imageUrls: []
          };
        }
        
        // Return the image URLs - the chatbot will send them
        return {
          success: true,
          message: `Here are the menu images for ${menu.name}:`,
          imageUrls: menuImageUrls,
          menuName: menu.name,
          shouldSendImages: true
        };
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
