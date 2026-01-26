// Cart Functions
// Functions for managing the customer's cart/ongoing order

const cartManager = require('../cartManager');
const logger = require('../../../utils/logger');
const { queryMySQL } = require('../../../config/database');
const cache = require('../../../utils/cache');

/**
 * Get cart function definitions for OpenAI
 */
function getCartFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'add_service_to_cart',
        description: 'Add a service to the customer\'s ongoing order. Use this when customer wants to order something (e.g., "I want pizza", "baddi pizza", "give me burger", "3 trio", "I want 5 burgers"). ⚠️ CRITICAL: Parse quantities from natural language - if customer says "3 trio" or "I want 3 trios", extract quantity=3 and itemName="trio" (NOT itemName="3 trio"). Always extract the number as quantity and the item name separately. Match the item name from available menu items.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to add (match exactly from menu items, or use closest match). ⚠️ DO NOT include numbers in itemName - if customer says "3 trio", use itemName="trio" and quantity=3. Extract only the item name, not the quantity.'
            },
            quantity: {
              type: 'number',
              description: 'Quantity to add. ⚠️ CRITICAL: Extract this from the customer\'s message. If they say "3 trio", "I want 3 trios", "give me 3 trio", etc., set quantity=3. If no number is mentioned, default to 1.',
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
        name: 'remove_service_from_cart',
        description: 'Remove a service from the customer\'s ongoing order. Use this when customer wants to remove something from their order. ⚠️ CRITICAL: Use this when customer says "remove [item]", "take out [item]", "I don\'t want [item]", "delete [item]", "cancel [item]", or any variation of wanting to remove an item. Make it easy for customers to remove items - if they mention removing something, call this function immediately.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to remove from ongoing order. Match from items currently in cart.'
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_service_quantity',
        description: 'Update the quantity of a service in the ongoing order. Use this when customer wants to change quantity (e.g., "make it 3", "I want 3 trios total", "remove 3 of the 6", "change to 5"). ⚠️ CRITICAL: If customer says "remove 3 of the 6" or "I have 6, remove 3", calculate the new quantity (6-3=3) and set quantity=3. If customer says "I want 3 trios overall" or "fix it to 3", set quantity=3. Always calculate the final desired quantity, not the change amount.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to update (match from items in cart)'
            },
            quantity: {
              type: 'number',
              description: 'The FINAL desired quantity (not the change amount). ⚠️ CRITICAL: If customer has 6 items and says "remove 3", calculate 6-3=3 and set quantity=3. If customer says "I want 3 total", set quantity=3. This is the final quantity they want, not how many to add/remove.'
            }
          },
          required: ['itemName', 'quantity']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'check_item_availability',
        description: 'Check if a specific item is available in the menu. Use this when customer asks "do you have [item]?", "is [item] available?", "do you sell [item]?", "how much is [item]?" etc. This queries the database to check if the item actually exists. DO NOT guess or assume - only use this function to check.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to check (e.g., "Pepsi", "pizza", "burger")'
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_cart',
        description: 'Get the current ongoing order contents. Use this when customer asks to see their order, order summary, or what they ordered.',
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
        description: 'Clear/empty the entire ongoing order. Remove all items and reset all prices to zero. Use this when customer wants to empty their order, start over, or clear everything.',
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
 * Execute cart function
 */
async function executeCartFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  const branchId = branch?.id || business.id;
  
  // Handle backward-compatible aliases
  if (functionName === 'add_item_to_cart') {
    functionName = 'add_service_to_cart';
  } else if (functionName === 'remove_item_from_cart') {
    functionName = 'remove_service_from_cart';
  } else if (functionName === 'update_item_quantity') {
    functionName = 'update_service_quantity';
  }
  
  switch (functionName) {
    case 'add_service_to_cart': {
      const { itemName, quantity = 1 } = args;
      
      // Check closing time BEFORE adding items
      const conversationManager = require('../conversationManager');
      const openStatus = await conversationManager.isOpenNow(business.id, branchId);
      
      let warningMessage = '';
      
      // Build warning message based on closing status
      if (!openStatus.isOpen) {
        warningMessage = `\n\n⚠️ Note: We're currently closed (${openStatus.reason}). `;
        if (business.allow_scheduled_orders) {
          warningMessage += `You can schedule this order for when we're open.`;
        } else {
          warningMessage += `Please check back during our opening hours.`;
        }
      } else if (openStatus.minutesUntilLastOrder !== null && openStatus.minutesUntilLastOrder <= 30) {
        warningMessage = `\n\n⚠️ Note: Last order time is in ${openStatus.minutesUntilLastOrder} minutes (${openStatus.lastOrderTime}). Please complete your order soon!`;
      }
      
      // Check current cart first to see if it has items
      const currentCart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      const hasExistingItems = currentCart.items && currentCart.items.length > 0;
      
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
      
      // Just add to cart directly - no confirmation needed
      // Users can clear cart explicitly if they want to start over
      
      // Add item to cart
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
        isOnlyScheduled: item.is_schedulable,
        isOpen: openStatus.isOpen,
        minutesUntilLastOrder: openStatus.minutesUntilLastOrder
      });
      
      // Check if item is "only scheduled" (is_schedulable = true means ONLY scheduled, not direct order)
      if (item.is_schedulable) {
        // Item can only be scheduled, inform customer
        return {
          success: true,
          message: `Added ${quantity}x ${item.name} to your ongoing order. Note: This item can only be scheduled for a future time. Please use the scheduling function to set a date and time before confirming your order.${warningMessage}`,
          cart: cart,
          requiresScheduling: true
        };
      }
      
      return {
        success: true,
        message: `Added ${quantity}x ${item.name} to your ongoing order ($${parseFloat(item.price * quantity).toFixed(2)})${warningMessage}`,
        cart: cart
      };
    }
    
    case 'remove_service_from_cart': {
      const { itemName } = args;
      const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      
      if (!cart.items || cart.items.length === 0) {
        return {
          success: false,
          error: `Your cart is empty. There's nothing to remove.`
        };
      }
      
      const cartItem = cart.items.find(item => 
        item.name.toLowerCase().includes(itemName.toLowerCase()) ||
        itemName.toLowerCase().includes(item.name.toLowerCase())
      );
      
      if (!cartItem) {
        // List available items to help customer
        const itemList = cart.items.map(item => `- ${item.name} (${item.quantity}x)`).join('\n');
        return {
          success: false,
          error: `Item "${itemName}" not found in your ongoing order.\n\nCurrent items in your cart:\n${itemList}\n\nPlease specify which item you'd like to remove.`
        };
      }
      
      const updatedCart = await cartManager.removeItemFromCart(
        business.id,
        branchId,
        customerPhoneNumber,
        cartItem.item_id
      );
      
      logger.info('Item removed from cart via function call', { itemName: cartItem.name });
      
      const remainingItems = updatedCart.items && updatedCart.items.length > 0;
      const message = remainingItems 
        ? `Removed ${cartItem.name} from your ongoing order.`
        : `Removed ${cartItem.name} from your ongoing order. Your cart is now empty.`;
      
      return {
        success: true,
        message: message,
        cart: updatedCart
      };
    }
    
    case 'update_service_quantity': {
      const { itemName, quantity } = args;
      const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      
      const cartItem = cart.items?.find(item => 
        item.name.toLowerCase().includes(itemName.toLowerCase()) ||
        itemName.toLowerCase().includes(item.name.toLowerCase())
      );
      
      if (!cartItem) {
        return {
          success: false,
          error: `Item "${itemName}" not found in your ongoing order.`
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
          message: `Removed ${cartItem.name} from your ongoing order`,
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
    
    case 'check_item_availability': {
      const { itemName } = args;
      
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
        
        if (items.length > 0) {
          item = items[0];
        }
      }
      
      if (!item) {
        return {
          success: false,
          available: false,
          error: `Sorry, we don't have "${itemName}" available. Would you like to see our menu?`,
          message: `Sorry, we don't have "${itemName}" available. Would you like to see our menu?`
        };
      }
      
      return {
        success: true,
        available: true,
        message: `Yes, we have ${item.name} for $${parseFloat(item.price).toFixed(2)}. Would you like to add it to your order?`,
        item: {
          name: item.name,
          price: parseFloat(item.price),
          description: item.description
        }
      };
    }
    
    case 'get_cart': {
      const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
      const summary = cartManager.getDetailedCartSummary(cart);
      
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
            message: 'Your ongoing order is already empty.',
            cart: { items: [], subtotal: 0, total: 0 }
          };
        }
        
        // Clear cart items and totals
        await cartManager.clearCart(business.id, branchId, customerPhoneNumber);
        
        // Also clear delivery-related fields
        const { getMySQLConnection } = require('../../../config/database');
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
          message: 'Your ongoing order has been cleared. It\'s now empty and ready for new items.',
          cart: clearedCart
        };
      } catch (error) {
        logger.error('Error clearing cart:', error);
        return {
          success: false,
          error: `Failed to clear ongoing order: ${error.message}`
        };
      }
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getCartFunctionDefinitions,
  executeCartFunction
};
