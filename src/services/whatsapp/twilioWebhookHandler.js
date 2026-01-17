// Twilio WhatsApp Webhook Handler
// Process incoming Twilio WhatsApp webhooks

const logger = require('../../utils/logger');
const contextResolver = require('./contextResolver');
const chatbotService = require('../llm/chatbot');
const twilioMessageSender = require('./twilioMessageSender');
const cartManager = require('../llm/cartManager');
const { generateUUID } = require('../../utils/uuid');

/**
 * Process incoming Twilio webhook
 * Twilio sends form-encoded data with fields: From, Body, MessageSid, AccountSid, etc.
 */
async function processTwilioWebhook(req) {
  try {
    // Twilio sends form-encoded data (req.body is parsed by express.urlencoded)
    const from = req.body.From; // Format: whatsapp:+96176891114
    const body = req.body.Body || '';
    const messageSid = req.body.MessageSid;
    const accountSid = req.body.AccountSid;
    const to = req.body.To; // Twilio number that received the message (e.g., whatsapp:+14155238886)
    
    // Extract phone number from Twilio format (whatsapp:+96176891114 -> +96176891114)
    const customerPhoneNumber = from.replace('whatsapp:', '');
    const twilioNumber = to.replace('whatsapp:', '');
    
    logger.info('Received Twilio WhatsApp message', {
      from: customerPhoneNumber,
      to: twilioNumber,
      messageSid,
      bodyLength: body.length
    });
    
    // Resolve business/branch context from Twilio phone number
    // For Twilio sandbox, we can use the Twilio number or account SID to find the business
    // Since it's sandbox, we might need to match by the Twilio number in the database
    const context = await contextResolver.resolveContextFromTwilioNumber(twilioNumber, accountSid);
    
    if (!context) {
      logger.warn('Could not resolve context for Twilio message', { 
        twilioNumber, 
        accountSid 
      });
      // For sandbox testing, you might want to use a default business
      // Or create a test business in the database
      return;
    }
    
    const { business, branch } = context;
    
    // Log message to MongoDB
    await logMessage({
      businessId: business.id,
      branchId: branch?.id,
      customerPhoneNumber: customerPhoneNumber,
      whatsappUserId: customerPhoneNumber,
      direction: 'inbound',
      channel: 'whatsapp',
      messageType: 'text',
      text: body,
      metaMessageId: messageSid,
      timestamp: new Date()
    });
    
    // Get LLM response with full conversation context
    const response = await chatbotService.handleMessage({
      business,
      branch,
      customerPhoneNumber: customerPhoneNumber,
      message: body,
      messageType: 'text',
      messageId: messageSid,
      whatsappUserId: customerPhoneNumber
    });
    
    // Send response via Twilio
    if (response && response.text) {
      let responseMessage = response.text;
      
      // Cart summary is only shown when explicitly requested via get_cart function or during checkout
      // (get_cart includes cart summary in the message, so no need to add it here)
      
      // Add order confirmation message if order was created
      if (response.orderCreated && response.orderId) {
        responseMessage += `\n\n✅ Your order has been placed! Order #${response.orderId.substring(0, 8).toUpperCase()}`;
      }
      
      // Send via Twilio
      await twilioMessageSender.sendMessage({
        to: from, // Use full Twilio format (whatsapp:+96176891114)
        from: to, // Twilio sandbox number (whatsapp:+14155238886)
        message: responseMessage
      });
      
      // Log outbound message
      await logMessage({
        businessId: business.id,
        branchId: branch?.id,
        customerPhoneNumber: customerPhoneNumber,
        whatsappUserId: customerPhoneNumber,
        direction: 'outbound',
        channel: 'whatsapp',
        messageType: 'text',
        text: responseMessage,
        metaMessageId: response.messageId || generateUUID(),
        timestamp: new Date(),
        llmUsed: true,
        tokensIn: response.tokensIn || null,
        tokensOut: response.tokensOut || null,
        orderCreated: response.orderCreated || false,
        orderId: response.orderId || null
      });
    }
  } catch (error) {
    logger.error('Error processing Twilio webhook:', error);
    throw error;
  }
}

/**
 * Log message to MongoDB
 */
async function logMessage(messageData) {
  try {
    const { getMongoCollection } = require('../../config/database');
    const messageLogs = await getMongoCollection('message_logs');
    
    // MongoDB not available - skip logging silently
    if (!messageLogs) {
      return;
    }
    
    await messageLogs.insertOne({
      _id: require('../../utils/uuid').generateUUID(),
      ...messageData,
      timestamp: messageData.timestamp || new Date()
    });
  } catch (error) {
    logger.error('Error logging message:', error);
    // Don't throw - logging is non-critical
  }
}

module.exports = {
  processTwilioWebhook
};
