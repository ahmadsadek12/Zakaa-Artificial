// Order Notes Function
// Function for setting special instructions/notes on orders

const cartManager = require('../cartManager');
const logger = require('../../../utils/logger');
const { getMySQLConnection } = require('../../../config/database');

/**
 * Get order notes function definitions for OpenAI
 */
function getOrderNotesFunctionDefinitions() {
  return [
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
 * Execute order notes function
 */
async function executeOrderNotesFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  const branchId = branch?.id || business.id;
  
  switch (functionName) {
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
            error: 'Cannot add notes: Your ongoing order is empty. Please add items first.'
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
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getOrderNotesFunctionDefinitions,
  executeOrderNotesFunction
};
