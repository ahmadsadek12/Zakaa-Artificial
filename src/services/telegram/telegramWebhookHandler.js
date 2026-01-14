// Telegram Webhook Handler
// Process incoming Telegram webhook updates

const logger = require('../../utils/logger');
const chatbotService = require('../llm/chatbot');
const telegramMessageSender = require('./telegramMessageSender');
const userRepository = require('../../repositories/userRepository');
const { generateUUID } = require('../../utils/uuid');
const { getMongoCollection } = require('../../config/database');

/**
 * Process incoming Telegram update
 * Telegram sends updates with message, callback_query, etc.
 */
async function processTelegramUpdate(update) {
  try {
    // Handle different update types
    if (update.message) {
      await processMessage(update.message);
    } else if (update.callback_query) {
      await processCallbackQuery(update.callback_query);
    } else {
      logger.debug('Unhandled Telegram update type', {
        updateId: update.update_id,
        hasMessage: !!update.message,
        hasCallbackQuery: !!update.callback_query
      });
    }
  } catch (error) {
    logger.error('Error processing Telegram update:', error);
    throw error;
  }
}

/**
 * Process incoming message
 */
async function processMessage(message) {
  try {
    // Skip edited messages
    if (message.edit_date) {
      return;
    }
    
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const text = message.text || '';
    const messageId = message.message_id;
    const from = message.from;
    const location = message.location; // GPS coordinates if user shared location
    
    // Only handle private chats for now
    if (chatType !== 'private') {
      logger.debug('Ignoring non-private Telegram chat', { chatType, chatId });
      return;
    }
    
    // Get user identifier (telegram user ID)
    const telegramUserId = from.id.toString();
    const customerPhoneNumber = `telegram:${telegramUserId}`; // Use telegram: prefix as identifier
    
    logger.info('Received Telegram message', {
      chatId,
      telegramUserId,
      username: from.username,
      firstName: from.first_name,
      textLength: text.length,
      messageId
    });
    
    // Resolve business context - for now, we'll use the test business
    // In production, you might store telegram_bot_id in the database and match it
    const business = await resolveBusinessFromTelegram();
    
    if (!business) {
      logger.warn('Could not resolve business for Telegram message', { chatId });
      await telegramMessageSender.sendMessage({
        chatId,
        message: 'Sorry, this bot is not configured. Please contact support.'
      });
      return;
    }
    
    // Check if chatbot is enabled for this business
    if (business.chatbot_enabled === false) {
      logger.info('Chatbot is disabled for this business', { businessId: business.id, chatId });
      await telegramMessageSender.sendMessage({
        chatId,
        message: 'Our chatbot is currently unavailable. Please contact us directly at ' + (business.contact_phone_number || business.whatsapp_phone_number || 'our phone number') + '. Thank you!'
      });
      return;
    }
    
    // Use business as branch (no separate branch for Telegram bot)
    const branch = null;
    
    // Handle location sharing
    if (location) {
      logger.info('Received location from customer', {
        chatId,
        latitude: location.latitude,
        longitude: location.longitude,
        customerPhoneNumber
      });
      
      // Log location message to MongoDB
      await logMessage({
        business_id: business.id,
        branch_id: branch?.id || business.id,
        customer_phone_number: customerPhoneNumber,
        whatsapp_user_id: customerPhoneNumber,
        direction: 'inbound',
        channel: 'telegram',
        message_type: 'location',
        text: `Location: ${location.latitude}, ${location.longitude}`,
        meta_message_id: messageId.toString(),
        timestamp: new Date()
      });
      
      // Save location directly to cart using chatbot function
      const chatbotFunctions = require('../llm/chatbotFunctions');
      const result = await chatbotFunctions.executeFunction(
        'set_location',
        {
          latitude: location.latitude,
          longitude: location.longitude,
          name: location.name || null,
          address: location.address || null
        },
        {
          business,
          branchId: branch?.id || business.id,
          customerPhoneNumber
        }
      );
      
      // Send confirmation
      const responseMessage = result.message || 'Thank you! Your location has been saved.';
      await telegramMessageSender.sendMessage({
        chatId,
        message: responseMessage
      });
      
      // Log outbound message to MongoDB
      await logMessage({
        business_id: business.id,
        branch_id: branch?.id || business.id,
        customer_phone_number: customerPhoneNumber,
        whatsapp_user_id: customerPhoneNumber,
        direction: 'outbound',
        channel: 'telegram',
        message_type: 'text',
        text: responseMessage,
        meta_message_id: messageId.toString(),
        timestamp: new Date()
      });
      
      return;
    }
    
    // Handle text messages
    if (!text) {
      return; // No text and no location, skip
    }
    
    // Log inbound message to MongoDB
    await logMessage({
      business_id: business.id,
      branch_id: branch?.id || business.id,
      customer_phone_number: customerPhoneNumber,
      whatsapp_user_id: customerPhoneNumber,
      direction: 'inbound',
      channel: 'telegram',
      message_type: 'text',
      text: text,
      meta_message_id: messageId.toString(),
      timestamp: new Date()
    });
    
    // Get LLM response with full conversation context
    const response = await chatbotService.handleMessage({
      business,
      branch,
      customerPhoneNumber: customerPhoneNumber,
      message: text,
      messageType: 'text',
      messageId: messageId.toString(),
      whatsappUserId: customerPhoneNumber // Reusing this field for Telegram
    });
    
    // Send response via Telegram
    if (response && response.text) {
      let responseMessage = response.text;
      
      // Add cart summary if cart exists and has items
      if (response.cart && response.cart.items && response.cart.items.length > 0) {
        const cartManager = require('../llm/cartManager');
        const cartSummary = cartManager.getCartSummary(response.cart);
        if (!responseMessage.toLowerCase().includes('cart') && !responseMessage.toLowerCase().includes('total:')) {
          responseMessage += `\n\n${cartSummary}`;
        }
      }
      
      // Add order confirmation message if order was created
      if (response.orderCreated && response.orderId) {
        responseMessage += `\n\n✅ Your order has been placed! Order #${response.orderId.substring(0, 8).toUpperCase()}`;
      }
      
      // Send via Telegram
      // Note: We'll send as plain text for now to avoid Markdown escaping issues
      // You can enable Markdown later if needed
      const sendResult = await telegramMessageSender.sendMessageWithRetry({
        chatId,
        message: responseMessage,
        options: {
          parse_mode: undefined, // Use plain text for now
          disable_web_page_preview: true
        }
      });
      
      // Log outbound message to MongoDB
      await logMessage({
        business_id: business.id,
        branch_id: branch?.id || business.id,
        customer_phone_number: customerPhoneNumber,
        whatsapp_user_id: customerPhoneNumber,
        direction: 'outbound',
        channel: 'telegram',
        message_type: 'text',
        text: responseMessage,
        meta_message_id: sendResult?.message_id?.toString() || messageId.toString(),
        timestamp: new Date()
      });
    }
  } catch (error) {
    logger.error('Error processing Telegram message:', error);
    // Try to send error message to user
    try {
      if (message && message.chat) {
        await telegramMessageSender.sendMessage({
          chatId: message.chat.id,
          message: 'Sorry, I encountered an error. Please try again later.'
        });
      }
    } catch (sendError) {
      logger.error('Failed to send error message to user:', sendError);
    }
    throw error;
  }
}

/**
 * Process callback query (button clicks)
 */
async function processCallbackQuery(callbackQuery) {
  try {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const queryId = callbackQuery.id;
    
    logger.info('Received Telegram callback query', {
      chatId,
      data,
      queryId
    });
    
    // Answer callback query to remove loading state
    const bot = telegramMessageSender.getTelegramBot();
    if (bot) {
      await bot.answerCallbackQuery(queryId, { text: 'Processing...' });
    }
    
    // Handle callback data (e.g., cart actions, menu navigation, etc.)
    // For now, just acknowledge it
    logger.debug('Callback query processed', { data });
  } catch (error) {
    logger.error('Error processing Telegram callback query:', error);
    throw error;
  }
}

/**
 * Resolve business from Telegram bot
 * For now, we'll match by bot token or use a default test business
 */
async function resolveBusinessFromTelegram() {
  try {
    // Find the test business by email
    const business = await userRepository.findByEmail('test@zakaa.com');
    
    if (business && business.user_type === 'business') {
      return business;
    }
    
    logger.warn('Test business not found');
    return null;
  } catch (error) {
    logger.error('Error resolving business from Telegram:', error);
    return null;
  }
}

/**
 * Log message to MongoDB
 */
async function logMessage(messageData) {
  try {
    const messageLogs = await getMongoCollection('message_logs');
    
    // MongoDB not available - skip logging silently
    if (!messageLogs) {
      return;
    }
    
    await messageLogs.insertOne({
      _id: generateUUID(),
      ...messageData,
      timestamp: messageData.timestamp || new Date()
    });
  } catch (error) {
    logger.error('Error logging message:', error);
    // Don't throw - logging is non-critical
  }
}

module.exports = {
  processTelegramUpdate,
  processMessage,
  processCallbackQuery
};
