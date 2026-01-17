// WhatsApp Webhook Handler
// Process incoming WhatsApp webhooks

const logger = require('../../utils/logger');
const contextResolver = require('./contextResolver');
const chatbotService = require('../llm/chatbot');
const messageSender = require('./messageSender');
const cartManager = require('../llm/cartManager');
const { generateUUID } = require('../../utils/uuid');

// Track which conversations have already received the "unavailable" message
// Key: `${businessId}:${customerPhoneNumber}`, Value: true
const unavailableMessageSent = new Map();

/**
 * Process incoming webhook
 */
async function processWebhook(webhookData) {
  try {
    // Extract entry data
    if (!webhookData.entry || webhookData.entry.length === 0) {
      logger.warn('Empty webhook entry');
      return;
    }
    
    for (const entry of webhookData.entry) {
      if (!entry.changes || entry.changes.length === 0) {
        continue;
      }
      
      for (const change of entry.changes) {
        if (change.value && change.value.messages) {
          // Process incoming messages
          for (const message of change.value.messages) {
            await processMessage(message, change.value);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error in processWebhook:', error);
    throw error;
  }
}

/**
 * Process individual message
 */
async function processMessage(message, value) {
  try {
    // Resolve business/branch context from phone number ID
    const context = await contextResolver.resolveContext(value.metadata?.phone_number_id);
    
    if (!context) {
      logger.warn('Could not resolve context for message', { phoneNumberId: value.metadata?.phone_number_id });
      return;
    }
    
    const { business, branch } = context;
    
    // Check if chatbot is enabled for this business
    // MySQL returns 0/1 (tinyint), not boolean - convert to boolean
    const chatbotEnabled = Boolean(business.chatbot_enabled);
    if (!chatbotEnabled) {
      const conversationKey = `${business.id}:${message.from}`;
      const alreadySent = unavailableMessageSent.has(conversationKey);
      
      if (!alreadySent) {
        // Send "unavailable" message only once
        logger.info('Chatbot is disabled - sending unavailable message', { 
          businessId: business.id, 
          from: message.from,
          chatbot_enabled: business.chatbot_enabled
        });
        await messageSender.sendMessage({
          business,
          branch,
          to: message.from,
          message: 'Our chatbot is currently unavailable. An agent will be with you soon.'
        });
        // Mark as sent for this conversation
        unavailableMessageSent.set(conversationKey, true);
      } else {
        // Already sent - just log the message and allow agent to respond manually
        logger.info('Chatbot disabled - message logged for agent response', {
          businessId: business.id,
          from: message.from
        });
      }
      
      // Extract message details and log for agent visibility
      const from = message.from;
      const messageId = message.id;
      const messageType = message.type;
      const timestamp = parseInt(message.timestamp);
      const text = message.text?.body || '';
      
      // Log message to MongoDB so agents can see it
      await logMessage({
        businessId: business.id,
        branchId: branch?.id,
        customerPhoneNumber: from,
        whatsappUserId: from,
        direction: 'inbound',
        channel: 'whatsapp',
        messageType,
        text,
        metaMessageId: messageId,
        timestamp: new Date(timestamp * 1000)
      });
      
      // Don't send chatbot response - allow agent to respond manually
      return;
    }
    
    // Clear the unavailable message flag if chatbot is now enabled
    // (in case it was disabled and re-enabled)
    const conversationKey = `${business.id}:${message.from}`;
    if (unavailableMessageSent.has(conversationKey)) {
      unavailableMessageSent.delete(conversationKey);
    }
    
    // Extract message details
    const from = message.from;
    const messageId = message.id;
    const messageType = message.type;
    const timestamp = parseInt(message.timestamp);
    const text = message.text?.body || '';
    
    // Log message to MongoDB
    await logMessage({
      businessId: business.id,
      branchId: branch?.id,
      customerPhoneNumber: from,
      whatsappUserId: from,
      direction: 'inbound',
      channel: 'whatsapp',
      messageType,
      text,
      metaMessageId: messageId,
      timestamp: new Date(timestamp * 1000)
    });
    
    // Get LLM response with full conversation context
    const response = await chatbotService.handleMessage({
      business,
      branch,
      customerPhoneNumber: from,
      message: text,
      messageType,
      messageId,
      whatsappUserId: from
    });
    
    // Send response via WhatsApp
    if (response && response.text) {
      // Build response message
      let responseMessage = response.text;
      
      // Cart summary is only shown when explicitly requested via get_cart function or during checkout
      // (get_cart includes cart summary in the message, so no need to add it here)
      
      // Add order confirmation message if order was created
      if (response.orderCreated && response.orderId) {
        responseMessage += `\n\n✅ Your order has been placed! Order #${response.orderId.substring(0, 8).toUpperCase()}`;
      }
      
      // Determine which WhatsApp provider to use
      const whatsappProvider = process.env.WHATSAPP_PROVIDER;
      
      // Send PDFs first if any
      if (response.pdfsToSend && response.pdfsToSend.length > 0) {
        const { sendDocument } = require('./messageSender');
        const { sendDocument: twilioSendDocument } = require('./twilioMessageSender');
        for (const pdf of response.pdfsToSend) {
          try {
            if (whatsappProvider === 'twilio') {
              const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
              await twilioSendDocument({
                to: from,
                from: twilioNumber,
                documentUrl: pdf.url,
                caption: pdf.caption
              });
            } else {
              await sendDocument({
                phoneNumberId: branch?.whatsapp_phone_number_id || business.whatsapp_phone_number_id,
                accessToken: branch?.whatsapp_access_token_encrypted || business.whatsapp_access_token_encrypted,
                to: from,
                documentUrl: pdf.url,
                caption: pdf.caption,
                filename: `menu.pdf`
              });
            }
            
            // Log outbound PDF message
            await logMessage({
              businessId: business.id,
              branchId: branch?.id,
              customerPhoneNumber: from,
              whatsappUserId: from,
              direction: 'outbound',
              channel: 'whatsapp',
              messageType: 'document',
              text: pdf.caption || 'Menu PDF',
              mediaUrl: pdf.url,
              metaMessageId: require('../../utils/uuid').generateUUID(),
              timestamp: new Date(),
              llmUsed: true
            });
          } catch (pdfError) {
            logger.error('Failed to send PDF via WhatsApp:', {
              to: from,
              documentUrl: pdf.url,
              error: pdfError.message
            });
          }
        }
      }
      
      // Send images if any
      if (response.imagesToSend && response.imagesToSend.length > 0) {
        const { sendImage } = require('./messageSender');
        for (const image of response.imagesToSend) {
          try {
            if (whatsappProvider === 'twilio') {
              const { sendImage: twilioSendImage } = require('./twilioMessageSender');
              const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
              await twilioSendImage({
                to: from,
                from: twilioNumber,
                imageUrl: image.url,
                caption: image.caption
              });
            } else {
              await sendImage({
                phoneNumberId: branch?.whatsapp_phone_number_id || business.whatsapp_phone_number_id,
                accessToken: branch?.whatsapp_access_token_encrypted || business.whatsapp_access_token_encrypted,
                to: from,
                imageUrl: image.url,
                caption: image.caption || ''
              });
            }
          } catch (imageError) {
            logger.error('Failed to send image via WhatsApp:', {
              to: from,
              imageUrl: image.url,
              error: imageError.message
            });
          }
        }
      }
      
      await messageSender.sendMessage({
        phoneNumberId: branch?.whatsapp_phone_number_id || business.whatsapp_phone_number_id,
        accessToken: branch?.whatsapp_access_token_encrypted || business.whatsapp_access_token_encrypted,
        to: from,
        message: responseMessage,
        messageType: 'text'
      });
      
      // Log outbound message
      await logMessage({
        businessId: business.id,
        branchId: branch?.id,
        customerPhoneNumber: from,
        whatsappUserId: from,
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
    logger.error('Error processing message:', error);
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
  processWebhook,
  processMessage,
  logMessage
};
