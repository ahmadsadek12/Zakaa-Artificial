// Telegram Webhook Handler
// Process incoming Telegram webhook updates

const logger = require('../../utils/logger');
const chatbotService = require('../llm/chatbot');
const telegramMessageSender = require('./telegramMessageSender');
const userRepository = require('../../repositories/userRepository');
const botIntegrationRepository = require('../../repositories/botIntegrationRepository');
const { generateUUID } = require('../../utils/uuid');
const { getMongoCollection } = require('../../config/database');

// Track which conversations have already received the "unavailable" message
// Key: `${businessId}:${customerPhoneNumber}`, Value: true
const unavailableMessageSent = new Map();

/**
 * Process incoming Telegram update
 * Telegram sends updates with message, callback_query, etc.
 */
async function processTelegramUpdate(update, businessId = null) {
  try {
    // Handle different update types
    if (update.message) {
      await processMessage(update.message, businessId);
    } else if (update.callback_query) {
      await processCallbackQuery(update.callback_query, businessId);
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
async function processMessage(message, businessId = null) {
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
      messageId,
      businessId
    });
    
    // Resolve business context using the businessId from the webhook URL
    const business = await resolveBusinessFromTelegram(businessId);
    
    if (!business) {
      logger.warn('Could not resolve business for Telegram message', { chatId, businessId });
      // Can't send a message without a valid business/token
      return;
    }
    
    // Use business as branch (no separate branch for Telegram bot)
    const branch = null;
    
    // Check if chatbot is enabled for this business
    // MySQL returns 0/1 (tinyint), not boolean - convert to boolean
    const chatbotEnabled = Boolean(business.chatbot_enabled);
    if (!chatbotEnabled) {
      const conversationKey = `${business.id}:${customerPhoneNumber}`;
      const alreadySent = unavailableMessageSent.has(conversationKey);
      
      if (!alreadySent) {
        // Send "unavailable" message only once
        logger.info('Chatbot is disabled - sending unavailable message', { 
          businessId: business.id, 
          chatId,
          chatbot_enabled: business.chatbot_enabled
        });
        await telegramMessageSender.sendMessage({
          chatId,
          message: 'Our chatbot is currently unavailable. An agent will be with you soon.',
          botToken: business.telegram_bot_token
        });
        // Mark as sent for this conversation
        unavailableMessageSent.set(conversationKey, true);
      } else {
        // Already sent - just log the message and allow agent to respond manually
        logger.info('Chatbot disabled - message logged for agent response', {
          businessId: business.id,
          chatId
        });
      }
      
      // Log message to MongoDB so agents can see it (non-blocking)
      logMessage({
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
      }).catch(err => logger.debug('Failed to log message (non-critical):', err));
      
      // Don't send chatbot response - allow agent to respond manually
      return;
    }
    
    // Clear the unavailable message flag if chatbot is now enabled
    // (in case it was disabled and re-enabled)
    const conversationKey = `${business.id}:${customerPhoneNumber}`;
    if (unavailableMessageSent.has(conversationKey)) {
      unavailableMessageSent.delete(conversationKey);
    }
    
    // Handle location sharing
    if (location) {
      logger.info('Received location from customer', {
        chatId,
        latitude: location.latitude,
        longitude: location.longitude,
        customerPhoneNumber
      });
      
      // Log location message to MongoDB (non-blocking)
      logMessage({
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
      }).catch(err => logger.debug('Failed to log message (non-critical):', err));
      
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
        message: responseMessage,
        botToken: business.telegram_bot_token
      });
      
      // Log outbound message to MongoDB (non-blocking)
      logMessage({
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
      }).catch(err => logger.debug('Failed to log message (non-critical):', err));
      
      return;
    }
    
    // Handle text messages
    if (!text) {
      return; // No text and no location, skip
    }
    
    // Log inbound message to MongoDB (non-blocking)
    logMessage({
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
    }).catch(err => logger.debug('Failed to log message (non-critical):', err));
    
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
      
      // Handle menusToSend - send each menu separately with its own message
      if (response.menusToSend && response.menusToSend.length > 0) {
        for (const menu of response.menusToSend) {
          try {
            const menuMessage = menu.message || `Here is our ${menu.menuName} menu`;
            
            logger.debug('Processing menu to send (Telegram)', {
              menuName: menu.menuName,
              hasImageUrls: !!menu.imageUrls,
              imageUrlsLength: menu.imageUrls?.length || 0,
              hasPdfUrl: !!menu.pdfUrl,
              hasMenuLink: !!menu.menuLink
            });
            
            // Send menu images if any (with caption)
            if (menu.imageUrls && Array.isArray(menu.imageUrls) && menu.imageUrls.length > 0) {
              logger.debug('Sending menu images (Telegram)', {
                menuName: menu.menuName,
                imageCount: menu.imageUrls.length
              });
              for (const imageUrl of menu.imageUrls) {
                try {
                  await telegramMessageSender.sendPhoto({
                    chatId,
                    imageUrl: imageUrl,
                    caption: menuMessage,
                    botToken: business.telegram_bot_token
                  });
                } catch (imageError) {
                  logger.error('Failed to send menu image via Telegram:', {
                    chatId,
                    imageUrl: imageUrl,
                    error: imageError.message
                  });
                }
              }
            }
            
            // Send menu PDF if any (with caption)
            if (menu.pdfUrl) {
              try {
                await telegramMessageSender.sendDocument({
                  chatId,
                  documentUrl: menu.pdfUrl,
                  caption: menuMessage,
                  botToken: business.telegram_bot_token
                });
              } catch (pdfError) {
                logger.error('Failed to send menu PDF via Telegram:', {
                  chatId,
                  documentUrl: menu.pdfUrl,
                  error: pdfError.message
                });
              }
            }
            
            // Send menu link if any (as text message with the menu message)
            if (menu.menuLink) {
              try {
                const linkMessage = `${menuMessage}\n🔗 Menu link: ${menu.menuLink}`;
                await telegramMessageSender.sendMessageWithRetry({
                  chatId,
                  message: linkMessage,
                  botToken: business.telegram_bot_token,
                  options: {
                    parse_mode: undefined,
                    disable_web_page_preview: false
                  }
                });
              } catch (linkError) {
                logger.error('Failed to send menu link via Telegram:', {
                  chatId,
                  menuLink: menu.menuLink,
                  error: linkError.message
                });
              }
            }
          } catch (menuError) {
            logger.error('Failed to send menu via Telegram:', {
              chatId,
              menuName: menu.menuName,
              error: menuError.message
            });
          }
        }
        
        // Skip the old PDF/image handling if we already sent menus
        // Don't send the general text response either since we sent menu-specific messages
        logger.debug('Sent menus via menusToSend (Telegram), skipping old handlers');
        return;
      }
      
      // Send PDFs first if any (old structure - for backward compatibility)
      if (response.pdfsToSend && response.pdfsToSend.length > 0) {
        for (const pdf of response.pdfsToSend) {
          try {
            await telegramMessageSender.sendDocument({
              chatId,
              documentUrl: pdf.url,
              caption: pdf.caption || '',
              botToken: business.telegram_bot_token
            });
          } catch (pdfError) {
            logger.error('Failed to send PDF via Telegram:', {
              chatId,
              documentUrl: pdf.url,
              error: pdfError.message
            });
          }
        }
      }
      
      // Send images if any
      if (response.imagesToSend && response.imagesToSend.length > 0) {
        for (const image of response.imagesToSend) {
          try {
            await telegramMessageSender.sendPhoto({
              chatId,
              imageUrl: image.url,
              caption: image.caption || '',
              botToken: business.telegram_bot_token
            });
          } catch (imageError) {
            logger.error('Failed to send image via Telegram:', {
              chatId,
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
        const sendResult = await telegramMessageSender.sendMessageWithRetry({
          chatId,
          message: responseMessage,
          botToken: business.telegram_bot_token,
          options: {
            parse_mode: undefined, // Use plain text for now
            disable_web_page_preview: true
          }
        });
        
        // Log outbound message to MongoDB (non-blocking)
        logMessage({
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
        }).catch(err => logger.debug('Failed to log message (non-critical):', err));
      }
    }
  } catch (error) {
    logger.error('Error processing Telegram message:', error);
    // Try to send error message to user
    try {
      if (message && message.chat && business && business.telegram_bot_token) {
        await telegramMessageSender.sendMessage({
          chatId: message.chat.id,
          message: 'Sorry, I encountered an error. Please try again later.',
          botToken: business.telegram_bot_token
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
async function processCallbackQuery(callbackQuery, businessId = null) {
  try {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const queryId = callbackQuery.id;
    
    logger.info('Received Telegram callback query', {
      chatId,
      data,
      queryId,
      businessId
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
 * Matches business by ID from the webhook URL
 */
async function resolveBusinessFromTelegram(businessId) {
  try {
    if (!businessId) {
      logger.warn('No businessId provided in Telegram webhook');
      return null;
    }
    
    // Find the business by ID
    const business = await userRepository.findById(businessId);
    
    if (business && business.user_type === 'business') {
      logger.info('Resolved business from Telegram webhook', {
        businessId: business.id,
        businessName: business.business_name || business.email
      });
      return business;
    }
    
    logger.warn('Business not found for Telegram message', { businessId });
    return null;
  } catch (error) {
    logger.error('Error resolving business from Telegram:', { businessId, error: error.message });
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
