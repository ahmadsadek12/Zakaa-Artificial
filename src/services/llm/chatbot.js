// LLM Chatbot Service
// Handle messages with OpenAI integration and conversation management

const OpenAI = require('openai');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');
const promptBuilder = require('./promptBuilder');
const languageDetector = require('./languageDetector');
const cartManager = require('./cartManager');
const conversationManager = require('./conversationManager');
const orderService = require('../order/orderService');
const { getMongoCollection } = require('../../config/database');

const openai = new OpenAI({
  apiKey: CONSTANTS.OPENAI_API_KEY
});

/**
 * Get conversation history
 */
async function getConversationHistory(businessId, branchId, customerPhoneNumber, limit = 10) {
  try {
    const messageLogs = await getMongoCollection('message_logs');
    
    const messages = await messageLogs
      .find({
        business_id: businessId,
        branch_id: branchId || businessId,
        customer_phone_number: customerPhoneNumber,
        direction: 'inbound'
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    // Also get outbound messages for context
    const outboundMessages = await messageLogs
      .find({
        business_id: businessId,
        branch_id: branchId || businessId,
        customer_phone_number: customerPhoneNumber,
        direction: 'outbound'
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    // Combine and sort
    const allMessages = [...messages, ...outboundMessages]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit)
      .map(m => ({
        role: m.direction === 'inbound' ? 'customer' : 'assistant',
        text: m.text || ''
      }));
    
    return allMessages;
  } catch (error) {
    logger.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Parse chatbot response for actions
 */
function parseResponseActions(responseText, cart) {
  const actions = {
    addItem: null,
    removeItem: null,
    showCart: false,
    confirmOrder: false,
    updateDeliveryType: null,
    setScheduledFor: null,
    setCustomerName: null,
    setDeliveryAddress: null
  };
  
  const lowerResponse = responseText.toLowerCase();
  
  // Check for cart display
  if (lowerResponse.includes('cart') || lowerResponse.includes('order summary') || lowerResponse.includes('current order')) {
    actions.showCart = true;
  }
  
  // Check for order confirmation
  if (lowerResponse.includes('order confirmed') || lowerResponse.includes('order placed') || 
      lowerResponse.includes('your order') || lowerResponse.includes('order #')) {
    actions.confirmOrder = true;
  }
  
  // Check for item addition (simple pattern matching - LLM should be explicit)
  const addMatch = responseText.match(/(?:adding|added|add)\s+([^,.!?]+)/i);
  if (addMatch) {
    actions.addItem = addMatch[1].trim();
  }
  
  // Check for item removal
  const removeMatch = responseText.match(/(?:removing|removed|remove)\s+([^,.!?]+)/i);
  if (removeMatch) {
    actions.removeItem = removeMatch[1].trim();
  }
  
  // Check for delivery type
  if (lowerResponse.includes('delivery')) {
    actions.updateDeliveryType = 'delivery';
  } else if (lowerResponse.includes('takeaway') || lowerResponse.includes('pickup')) {
    actions.updateDeliveryType = 'takeaway';
  } else if (lowerResponse.includes('on-site') || lowerResponse.includes('on site')) {
    actions.updateDeliveryType = 'on_site';
  }
  
  // Check for scheduled date/time
  const dateMatch = responseText.match(/(?:scheduled|scheduled for|date|time|at)\s+([\d\-\/:\s]+)/i);
  if (dateMatch) {
    actions.setScheduledFor = dateMatch[1].trim();
  }
  
  return actions;
}

/**
 * Handle incoming message with full conversation context
 */
async function handleMessage({ business, branch, customerPhoneNumber, message, messageType, messageId, whatsappUserId }) {
  try {
    // Detect language
    const language = await languageDetector.detectLanguage(message);
    
    // Get conversation history
    const messageHistory = await getConversationHistory(
      business.id, 
      branch?.id || business.id, 
      customerPhoneNumber
    );
    
    // Get or create cart
    const cart = await cartManager.getCart(
      business.id, 
      branch?.id || business.id, 
      customerPhoneNumber
    );
    
    // Update cart language if needed
    if (language && cart.language !== language) {
      await cartManager.updateCart(business.id, branch?.id || business.id, customerPhoneNumber, {
        language
      });
    }
    
    // Build prompt with full context
    const prompt = await promptBuilder.buildPrompt({
      business,
      branch,
      customerPhoneNumber,
      message,
      language,
      messageHistory
    });
    
    // Call OpenAI with conversation history
    const messages = [
      { role: 'system', content: prompt.system }
    ];
    
    // Add conversation history
    for (const msg of messageHistory.slice(-10)) {
      messages.push({
        role: msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.text
      });
    }
    
    // Add current message
    messages.push({ role: 'user', content: prompt.user });
    
    const completion = await openai.chat.completions.create({
      model: CONSTANTS.OPENAI_MODEL,
      messages: messages,
      max_tokens: CONSTANTS.OPENAI_MAX_TOKENS,
      temperature: CONSTANTS.OPENAI_TEMPERATURE
    });
    
    const responseText = completion.choices[0].message.content;
    
    // Parse response for actions
    const actions = parseResponseActions(responseText, cart);
    
    // Execute actions
    let updatedCart = cart;
    
    if (actions.addItem) {
      // Find item by name (fuzzy matching)
      const items = await require('../../config/database').queryMySQL(
        `SELECT * FROM items 
         WHERE business_id = ? AND availability = 'available' AND deleted_at IS NULL
         AND (LOWER(name) LIKE ? OR LOWER(name) LIKE ?)`,
        [business.id, `%${actions.addItem.toLowerCase()}%`, `%${actions.addItem.toLowerCase().split(' ')[0]}%`]
      );
      
      if (items.length > 0) {
        const item = items[0];
        updatedCart = await cartManager.addItemToCart(
          business.id,
          branch?.id || business.id,
          customerPhoneNumber,
          {
            itemId: item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: 1
          }
        );
      }
    }
    
    if (actions.removeItem) {
      // Find item in cart
      const cartItem = cart.items.find(item => 
        item.name.toLowerCase().includes(actions.removeItem.toLowerCase())
      );
      
      if (cartItem) {
        updatedCart = await cartManager.removeItemFromCart(
          business.id,
          branch?.id || business.id,
          customerPhoneNumber,
          cartItem.item_id
        );
      }
    }
    
    if (actions.updateDeliveryType) {
      updatedCart = await cartManager.updateCart(
        business.id,
        branch?.id || business.id,
        customerPhoneNumber,
        { delivery_type: actions.updateDeliveryType }
      );
    }
    
    // Check if order should be created
    let orderCreated = false;
    let orderId = null;
    
    if (actions.confirmOrder && updatedCart.items && updatedCart.items.length > 0) {
      // Process order creation
      const orderResult = await conversationManager.processChatbotResponse({
        business,
        branch,
        customerPhoneNumber,
        message,
        response: { text: responseText },
        cart: updatedCart,
        language
      });
      
      if (orderResult.orderCreated) {
        orderCreated = true;
        orderId = orderResult.orderId;
        
        // Replace placeholder in response with actual order ID
        responseText = responseText.replace(/ORDER_ID/g, orderResult.orderNumber || orderId.substring(0, 8).toUpperCase());
      }
    }
    
    logger.info('LLM response generated', { 
      customerPhoneNumber, 
      language,
      tokens: completion.usage?.total_tokens,
      orderCreated
    });
    
    return {
      text: responseText,
      language,
      messageId,
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      cart: updatedCart,
      actions,
      orderCreated,
      orderId
    };
  } catch (error) {
    logger.error('Error in chatbot service:', error);
    return {
      text: 'Sorry, I encountered an error. Please try again later.',
      language: 'english',
      cart: null
    };
  }
}

module.exports = {
  handleMessage,
  getConversationHistory
};
