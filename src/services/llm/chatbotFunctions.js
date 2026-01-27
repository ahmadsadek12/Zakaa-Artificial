// Chatbot Functions
// Functions that OpenAI can call directly to modify the database
// Main router that combines all function modules

const logger = require('../../utils/logger');

// Import all function modules
const cartFunctions = require('./functions/cartFunctions');
const orderFunctions = require('./functions/orderFunctions');
const deliveryFunctions = require('./functions/deliveryFunctions');
const menuFunctions = require('./functions/menuFunctions');
const businessHoursFunctions = require('./functions/businessHoursFunctions');
const reservationFunctions = require('./functions/reservationFunctions');
const orderNotesFunction = require('./functions/orderNotesFunction');
const sessionFunctions = require('./functions/sessionFunctions');
const supportFunctions = require('./functions/supportFunctions');
const validationFunctions = require('./functions/validationFunctions');

/**
 * Get available functions/tools for OpenAI
 * Combines all function definitions from modules
 */
function getAvailableFunctions() {
  return [
    ...sessionFunctions.getSessionFunctionDefinitions(),
    ...cartFunctions.getCartFunctionDefinitions(),
    ...deliveryFunctions.getDeliveryFunctionDefinitions(),
    ...orderFunctions.getOrderFunctionDefinitions(),
    ...menuFunctions.getMenuFunctionDefinitions(),
    ...businessHoursFunctions.getBusinessHoursFunctionDefinitions(),
    ...reservationFunctions.getReservationFunctionDefinitions(),
    ...orderNotesFunction.getOrderNotesFunctionDefinitions(),
    ...supportFunctions.getSupportFunctionDefinitions(),
    ...validationFunctions.getValidationFunctionDefinitions()
  ];
}

/**
 * Execute a function call
 * Routes to appropriate module handler
 */
async function executeFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  
  try {
    // Try each module handler in order
    // Each handler returns null if it doesn't handle the function (including aliases)
    // Session functions first (for mode/intent detection)
    // Validation functions before execution functions
    const handlers = [
      sessionFunctions.executeSessionFunction,
      validationFunctions.executeValidationFunction,
      cartFunctions.executeCartFunction,
      orderFunctions.executeOrderFunction,
      deliveryFunctions.executeDeliveryFunction,
      menuFunctions.executeMenuFunction,
      businessHoursFunctions.executeBusinessHoursFunction,
      reservationFunctions.executeReservationFunction,
      orderNotesFunction.executeOrderNotesFunction,
      supportFunctions.executeSupportFunction
    ];
    
    for (const handler of handlers) {
      const result = await handler(functionName, args, context);
      if (result !== null) {
          return result;
      }
    }
    
    // If no handler found the function, return error
        return {
          success: false,
          error: `Unknown function: ${functionName}`
        };
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
