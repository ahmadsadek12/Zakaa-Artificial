// Facebook Webhook Handler
// Process incoming Facebook webhooks (Meta Messenger API)

const logger = require('../../utils/logger');
const chatbotService = require('../llm/chatbot');
const facebookMessageSender = require('./facebookMessageSender');
const botIntegrationRepository = require('../../repositories/botIntegrationRepository');
const userRepository = require('../../repositories/userRepository');
const { generateUUID } = require('../../utils/uuid');
const { getMongoCollection } = require('../../config/database');

// Track which conversations have already received the "unavailable" message
// Key: `${businessId}:${customerId}`, Value: true
const unavailableMessageSent = new Map();

/**
 * Process incoming webhook
 * Facebook webhooks follow Meta's webhook format (similar to WhatsApp/Instagram)
 */
async function processWebhook(webhookData, businessId = null) {
  try {
    // Extract entry data (Meta format)
    if (!webhookData.entry || webhookData.entry.length === 0) {
      logger.warn('Empty Facebook webhook entry');
      return;
    }
    
    for (const entry of webhookData.entry) {
      if (!entry.messaging || entry.messaging.length === 0) {
        continue;
      }
      
      for (const messaging of entry.messaging) {
        if (messaging.message) {
          await processMessage(messaging, entry, businessId);
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
async function processMessage(messaging, entry, businessId = null) {
  try {
    const message = messaging.message;
    const sender = messaging.sender;
    const recipient = messaging.recipient;
    
    // Get page ID from recipient (Facebook page)
    const pageId = recipient.id;
    
    // Resolve business from page ID
    const business = await resolveBusinessFromFacebook(pageId, businessId);
    
    if (!business) {
      logger.warn('Could not resolve business for Facebook message', { pageId, businessId });
      return;
    }
    
    // Check contract approval (CRITICAL GATE)
    if (business.contract_status !== 'approved') {
      logger.warn('Contract not approved - blocking Facebook webhook', {
        businessId: business.id,
        contractStatus: business.contract_status
      });
      
      const conversationKey = `${business.id}:${sender.id}`;
      const alreadySent = unavailableMessageSent.has(conversationKey);
      
      if (!alreadySent) {
        await facebookMessageSender.sendMessage({
          business,
          to: sender.id,
          message: 'Our service is currently unavailable. Please contact support.'
        });
        unavailableMessageSent.set(conversationKey, true);
      }
      return;
    }
    
    // Check if Facebook integration is enabled
    const integration = await botIntegrationRepository.findByOwnerAndPlatform(
      'business',
      business.id,
      'facebook'
    );
    
    if (!integration || !integration.enabled) {
      logger.warn('Facebook integration not enabled - blocking webhook', {
        businessId: business.id
      });
      
      const conversationKey = `${business.id}:${sender.id}`;
      const alreadySent = unavailableMessageSent.has(conversationKey);
      
      if (!alreadySent) {
        await facebookMessageSender.sendMessage({
          business,
          to: sender.id,
          message: 'Facebook integration is not enabled. Please contact support.'
        });
        unavailableMessageSent.set(conversationKey, true);
      }
      return;
    }
    
    // Check if chatbot is enabled
    const chatbotEnabled = Boolean(business.chatbot_enabled);
    if (!chatbotEnabled) {
      const conversationKey = `${business.id}:${sender.id}`;
      const alreadySent = unavailableMessageSent.has(conversationKey);
      
      if (!alreadySent) {
        logger.info('Chatbot is disabled - sending unavailable message', { 
          businessId: business.id, 
          from: sender.id
        });
        await facebookMessageSender.sendMessage({
          business,
          to: sender.id,
          message: 'Our chatbot is currently unavailable. An agent will be with you soon.'
        });
        unavailableMessageSent.set(conversationKey, true);
      }
      return;
    }
    
    // Extract message details
    const customerId = sender.id;
    const customerPhoneNumber = `facebook:${customerId}`;
    const messageId = message.mid || generateUUID();
    const messageType = message.text ? 'text' : (message.attachments ? 'media' : 'unknown');
    const text = message.text || '';
    const timestamp = messaging.timestamp;
    
    logger.info('Processing Facebook message', {
      businessId: business.id,
      customerId,
      messageId,
      messageType,
      textLength: text.length,
      timestamp
    });
    
    // Use business as branch (no separate branch for Facebook)
    const branch = null;
    
    // Process message through chatbot
    const response = await chatbotService.handleMessage({
      business,
      branch,
      customerPhoneNumber,
      message: text,
      messageType,
      messageId,
      platform: 'facebook'
    });
    
    // Send response via Facebook
    if (response && response.text) {
      await facebookMessageSender.sendMessage({
        business,
        to: customerId,
        message: response.text
      });
      
      // Send images if any
      if (response.images && response.images.length > 0) {
        for (const imageUrl of response.images) {
          await facebookMessageSender.sendImage({
            business,
            to: customerId,
            imageUrl
          });
        }
      }
    }
    
    // Log message to MongoDB (if available)
    try {
      const messageLogs = await getMongoCollection('message_logs');
      await messageLogs.insertOne({
        business_id: business.id,
        branch_id: null,
        customer_phone_number: customerPhoneNumber,
        direction: 'inbound',
        platform: 'facebook',
        message_type: messageType,
        content: text,
        message_id: messageId,
        created_at: new Date(timestamp * 1000)
      });
    } catch (mongoError) {
      logger.debug('MongoDB not available for message logging:', mongoError.message);
    }
    
  } catch (error) {
    logger.error('Error processing Facebook message:', error);
    throw error;
  }
}

/**
 * Resolve business from Facebook page ID
 */
async function resolveBusinessFromFacebook(pageId, businessId = null) {
  try {
    // If businessId is provided (from webhook URL), use it directly
    if (businessId) {
      const business = await userRepository.findById(businessId);
      if (business && business.user_type === 'business') {
        return business;
      }
    }
    
    // Otherwise, find by page_id in bot_integrations
    const { queryMySQL } = require('../../config/database');
    const [integrations] = await queryMySQL(
      `SELECT * FROM bot_integrations 
       WHERE platform = 'facebook' AND page_id = ? AND enabled = true
       LIMIT 1`,
      [pageId]
    );
    
    if (integrations && integrations.length > 0) {
      const business = await userRepository.findById(integrations[0].owner_id);
      return business;
    }
    
    return null;
  } catch (error) {
    logger.error('Error resolving business from Facebook:', error);
    return null;
  }
}

module.exports = {
  processWebhook,
  processMessage
};
