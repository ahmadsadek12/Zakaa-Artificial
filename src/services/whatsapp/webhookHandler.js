// WhatsApp Webhook Handler
// Process incoming WhatsApp webhooks

const logger = require('../../utils/logger');
const contextResolver = require('./contextResolver');
const chatbotService = require('../llm/chatbot');
const messageSender = require('./messageSender');
const cartManager = require('../llm/cartManager');
const { generateUUID } = require('../../utils/uuid');
const { requireContractApproved } = require('../../middleware/contractGate');
const botIntegrationRepository = require('../../repositories/botIntegrationRepository');
const { queryMySQL } = require('../../config/database');

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
    
    // Check contract approval (CRITICAL GATE)
    if (business.contract_status !== 'approved') {
      logger.warn('Contract not approved - blocking webhook', {
        businessId: business.id,
        contractStatus: business.contract_status
      });
      
      const conversationKey = `${business.id}:${message.from}`;
      const alreadySent = unavailableMessageSent.has(conversationKey);
      
      if (!alreadySent) {
        await messageSender.sendMessage({
          business,
          branch,
          to: message.from,
          message: 'Our service is currently unavailable. Please contact support.'
        });
        unavailableMessageSent.set(conversationKey, true);
      }
      return;
    }
    
    // Check if WhatsApp integration is enabled
    const integration = await botIntegrationRepository.findByOwnerAndPlatform(
      branch ? 'branch' : 'business',
      branch?.id || business.id,
      'whatsapp'
    );
    
    if (!integration || !integration.enabled) {
      logger.warn('WhatsApp integration not enabled - blocking webhook', {
        businessId: business.id,
        branchId: branch?.id
      });
      
      const conversationKey = `${business.id}:${message.from}`;
      const alreadySent = unavailableMessageSent.has(conversationKey);
      
      if (!alreadySent) {
        await messageSender.sendMessage({
          business,
          branch,
          to: message.from,
          message: 'WhatsApp integration is not enabled. Please contact support.'
        });
        unavailableMessageSent.set(conversationKey, true);
      }
      return;
    }
    
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
      
      // Remove S3 URLs from message text (they should only be sent as media files, never as links)
      // Remove markdown image links: ![text](url) format
      responseMessage = responseMessage.replace(/!\[([^\]]*)\]\(https?:\/\/[^\)]*\.s3[^\)]*\.amazonaws\.com[^\)]*\)/gi, '');
      responseMessage = responseMessage.replace(/!\[([^\]]*)\]\(https?:\/\/[^\)]*amazonaws\.com[^\)]*s3[^\)]*\)/gi, '');
      // Remove plain S3 URLs: https://bucket.s3.amazonaws.com/... or https://bucket.s3.region.amazonaws.com/...
      responseMessage = responseMessage.replace(/https?:\/\/[^\s]*\.s3[^\s]*\.amazonaws\.com[^\s]*/gi, '');
      responseMessage = responseMessage.replace(/https?:\/\/[^\s]*amazonaws\.com[^\s]*s3[^\s]*/gi, '');
      // Remove numbered markdown links like: "1. ![Menu Image](url)" or "2. ![Menu Image](url)"
      responseMessage = responseMessage.replace(/\d+\.\s*!\[([^\]]*)\]\([^\)]*\)/gi, '');
      // Clean up multiple spaces and empty lines
      responseMessage = responseMessage.replace(/\n{3,}/g, '\n\n').trim();
      
      // Cart summary is only shown when explicitly requested via get_cart function or during checkout
      // (get_cart includes cart summary in the message, so no need to add it here)
      
      // Add order confirmation message if order was created
      if (response.orderCreated && response.orderId) {
        responseMessage += `\n\n✅ Your order has been placed! Order #${response.orderId.substring(0, 8).toUpperCase()}`;
      }
      
      // Determine which WhatsApp provider to use
      const whatsappProvider = process.env.WHATSAPP_PROVIDER;
      
      // Handle menusToSend - send each menu separately with its own message
      if (response.menusToSend && response.menusToSend.length > 0) {
        const { sendMessage } = require('./messageSender');
        const { sendImage } = require('./messageSender');
        const { sendDocument } = require('./messageSender');
        const { sendMessage: twilioSendMessage } = require('./twilioMessageSender');
        const { sendImage: twilioSendImage } = require('./twilioMessageSender');
        const { sendDocument: twilioSendDocument } = require('./twilioMessageSender');
        
        for (const menu of response.menusToSend) {
          try {
            // Send text message first: "Here is our [menu name] menu"
            const menuMessage = menu.message || `Here is our ${menu.menuName} menu`;
            
            if (whatsappProvider === 'twilio') {
              const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
              await twilioSendMessage({
                to: from,
                from: twilioNumber,
                message: menuMessage
              });
            } else {
              await sendMessage({
                phoneNumberId: branch?.whatsapp_phone_number_id || business.whatsapp_phone_number_id,
                accessToken: branch?.whatsapp_access_token_encrypted || business.whatsapp_access_token_encrypted,
                to: from,
                message: menuMessage,
                messageType: 'text'
              });
            }
            
            // Log text message
            await logMessage({
              businessId: business.id,
              branchId: branch?.id,
              customerPhoneNumber: from,
              whatsappUserId: from,
              direction: 'outbound',
              channel: 'whatsapp',
              messageType: 'text',
              text: menuMessage,
              metaMessageId: require('../../utils/uuid').generateUUID(),
              timestamp: new Date(),
              llmUsed: true
            });
            
            // Send menu images if any
            if (menu.imageUrls && Array.isArray(menu.imageUrls) && menu.imageUrls.length > 0) {
              for (const imageUrl of menu.imageUrls) {
                try {
                  if (whatsappProvider === 'twilio') {
                    const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
                    await twilioSendImage({
                      to: from,
                      from: twilioNumber,
                      imageUrl: imageUrl,
                      caption: ''
                    });
                  } else {
                    await sendImage({
                      phoneNumberId: branch?.whatsapp_phone_number_id || business.whatsapp_phone_number_id,
                      accessToken: branch?.whatsapp_access_token_encrypted || business.whatsapp_access_token_encrypted,
                      to: from,
                      imageUrl: imageUrl,
                      caption: ''
                    });
                  }
                  
                  // Log image message
                  await logMessage({
                    businessId: business.id,
                    branchId: branch?.id,
                    customerPhoneNumber: from,
                    whatsappUserId: from,
                    direction: 'outbound',
                    channel: 'whatsapp',
                    messageType: 'image',
                    mediaUrl: imageUrl,
                    metaMessageId: require('../../utils/uuid').generateUUID(),
                    timestamp: new Date(),
                    llmUsed: true
                  });
                } catch (imageError) {
                  logger.error('Failed to send menu image via WhatsApp:', {
                    to: from,
                    imageUrl: imageUrl,
                    error: imageError.message
                  });
                }
              }
            }
            
            // Send menu link if any (as text message)
            if (menu.menuLink) {
              try {
                const linkMessage = `🔗 Menu link: ${menu.menuLink}`;
                if (whatsappProvider === 'twilio') {
                  const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
                  await twilioSendMessage({
                    to: from,
                    from: twilioNumber,
                    message: linkMessage
                  });
                } else {
                  await sendMessage({
                    phoneNumberId: branch?.whatsapp_phone_number_id || business.whatsapp_phone_number_id,
                    accessToken: branch?.whatsapp_access_token_encrypted || business.whatsapp_access_token_encrypted,
                    to: from,
                    message: linkMessage,
                    messageType: 'text'
                  });
                }
                
                // Log link message
                await logMessage({
                  businessId: business.id,
                  branchId: branch?.id,
                  customerPhoneNumber: from,
                  whatsappUserId: from,
                  direction: 'outbound',
                  channel: 'whatsapp',
                  messageType: 'text',
                  text: linkMessage,
                  metaMessageId: require('../../utils/uuid').generateUUID(),
                  timestamp: new Date(),
                  llmUsed: true
                });
              } catch (linkError) {
                logger.error('Failed to send menu link via WhatsApp:', {
                  to: from,
                  menuLink: menu.menuLink,
                  error: linkError.message
                });
              }
            }
            
            // Send menu PDF if any
            if (menu.pdfUrl) {
              try {
                if (whatsappProvider === 'twilio') {
                  const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
                  await twilioSendDocument({
                    to: from,
                    from: twilioNumber,
                    documentUrl: menu.pdfUrl,
                    caption: ''
                  });
                } else {
                  await sendDocument({
                    phoneNumberId: branch?.whatsapp_phone_number_id || business.whatsapp_phone_number_id,
                    accessToken: branch?.whatsapp_access_token_encrypted || business.whatsapp_access_token_encrypted,
                    to: from,
                    documentUrl: menu.pdfUrl,
                    caption: '',
                    filename: `${menu.menuName || 'menu'}.pdf`
                  });
                }
                
                // Log PDF message
                await logMessage({
                  businessId: business.id,
                  branchId: branch?.id,
                  customerPhoneNumber: from,
                  whatsappUserId: from,
                  direction: 'outbound',
                  channel: 'whatsapp',
                  messageType: 'document',
                  text: `Menu PDF: ${menu.menuName}`,
                  mediaUrl: menu.pdfUrl,
                  metaMessageId: require('../../utils/uuid').generateUUID(),
                  timestamp: new Date(),
                  llmUsed: true
                });
              } catch (pdfError) {
                logger.error('Failed to send menu PDF via WhatsApp:', {
                  to: from,
                  documentUrl: menu.pdfUrl,
                  error: pdfError.message
                });
              }
            }
          } catch (menuError) {
            logger.error('Failed to send menu via WhatsApp:', {
              to: from,
              menuName: menu.menuName,
              error: menuError.message
            });
          }
        }
        
        // Skip the old PDF/image handling if we already sent menus
        // Don't send the general text response either since we sent menu-specific messages
        return;
      }
      
      // Send PDFs first if any (old structure - for backward compatibility)
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
      
      // Only send text message if no images/PDFs were sent, or if there's meaningful content (like order confirmation)
      const hasMediaToSend = (response.imagesToSend && response.imagesToSend.length > 0) || 
                             (response.pdfsToSend && response.pdfsToSend.length > 0);
      
      // Skip text message if media was sent, unless there's important content (order confirmation, etc.)
      if (!hasMediaToSend || (responseMessage && responseMessage.trim().length > 0 && response.orderCreated)) {
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
