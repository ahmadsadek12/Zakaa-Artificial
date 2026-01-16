// Telegram Message Sender
// Send messages via Telegram Bot API

const TelegramBot = require('node-telegram-bot-api');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');

// Cache bot instances per token to avoid recreating them for every message
// Key: botToken, Value: TelegramBot instance
const botInstances = new Map();

/**
 * Get or create Telegram bot instance for a specific token
 * @param {string} botToken - Telegram bot token (optional, falls back to CONSTANTS)
 */
function getTelegramBot(botToken = null) {
  // If no token provided, use the one from CONSTANTS (for backward compatibility)
  const token = botToken || CONSTANTS.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    logger.error('Telegram bot token is not configured');
    return null;
  }
  
  // Check if we already have an instance for this token
  if (botInstances.has(token)) {
    return botInstances.get(token);
  }
  
  try {
    // Create new bot instance for this token
    const botInstance = new TelegramBot(token, { polling: false });
    botInstances.set(token, botInstance);
    logger.info('Telegram bot instance created', {
      tokenPrefix: token.substring(0, 15) + '...'
    });
    return botInstance;
  } catch (error) {
    logger.error('Failed to create Telegram bot instance:', {
      error: error.message,
      tokenPrefix: token.substring(0, 15) + '...'
    });
    return null;
  }
}

/**
 * Send message via Telegram
 * @param {Object} params - Message parameters
 * @param {string|number} params.chatId - Telegram chat ID
 * @param {string} params.message - Message text
 * @param {string} params.botToken - Telegram bot token (optional)
 * @param {Object} params.options - Additional options (parse_mode, etc.)
 */
async function sendMessage({ chatId, message, botToken = null, options = {} }) {
  try {
    const bot = getTelegramBot(botToken);
    if (!bot) {
      throw new Error('Telegram bot not initialized');
    }
    
    // Default options - don't set parse_mode unless explicitly provided
    const messageOptions = { ...options };
    
    // Only set default parse_mode if not provided and not explicitly set to undefined
    if (!messageOptions.hasOwnProperty('parse_mode') && !options.disableWebPagePreview) {
      // Default to plain text for safety
      messageOptions.parse_mode = undefined;
    }
    
    const result = await bot.sendMessage(chatId, message, messageOptions);
    
    logger.info('Telegram message sent successfully', {
      chatId,
      messageId: result.message_id,
      textLength: message.length
    });
    
    return result;
  } catch (error) {
    logger.error('Error sending Telegram message:', {
      chatId,
      error: error.message,
      code: error.response?.statusCode || error.code
    });
    throw error;
  }
}

/**
 * Send message with retry logic
 */
async function sendMessageWithRetry({ chatId, message, botToken = null, options = {}, maxRetries = 3 }) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendMessage({ chatId, message, botToken, options });
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors (like invalid chat ID, etc.)
      if (error.response?.statusCode === 400 || error.response?.statusCode === 403) {
        logger.warn('Telegram API error - not retrying', {
          statusCode: error.response.statusCode,
          error: error.message
        });
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
        logger.info(`Retrying Telegram message send after ${delay}ms`, {
          attempt,
          maxRetries
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error('Telegram message send failed after all retries', {
    chatId,
    maxRetries,
    lastError: lastError?.message
  });
  
  throw lastError;
}

/**
 * Send photo/image via Telegram
 * @param {Object} params - Photo parameters
 * @param {string|number} params.chatId - Telegram chat ID
 * @param {string} params.imageUrl - URL of the image to send
 * @param {string} params.botToken - Telegram bot token (optional)
 * @param {string} params.caption - Optional caption for the image
 * @param {Object} params.options - Additional options
 */
async function sendPhoto({ chatId, imageUrl, botToken = null, caption = '', options = {} }) {
  try {
    const bot = getTelegramBot(botToken);
    if (!bot) {
      throw new Error('Telegram bot not initialized');
    }
    
    const result = await bot.sendPhoto(chatId, imageUrl, {
      caption,
      ...options
    });
    
    logger.info('Telegram photo sent successfully', {
      chatId,
      messageId: result.message_id,
      imageUrl
    });
    
    return result;
  } catch (error) {
    logger.error('Error sending Telegram photo:', {
      chatId,
      imageUrl,
      error: error.message,
      code: error.response?.statusCode || error.code
    });
    throw error;
  }
}

/**
 * Send document/PDF via Telegram
 * @param {Object} params - Document parameters
 * @param {string|number} params.chatId - Telegram chat ID
 * @param {string} params.documentUrl - URL of the document/PDF to send
 * @param {string} params.botToken - Telegram bot token (optional)
 * @param {string} params.caption - Optional caption for the document
 * @param {Object} params.options - Additional options
 */
async function sendDocument({ chatId, documentUrl, botToken = null, caption = '', options = {} }) {
  try {
    const bot = getTelegramBot(botToken);
    if (!bot) {
      throw new Error('Telegram bot not initialized');
    }
    
    const result = await bot.sendDocument(chatId, documentUrl, {
      caption,
      ...options
    });
    
    logger.info('Telegram document sent successfully', {
      chatId,
      messageId: result.message_id,
      documentUrl
    });
    
    return result;
  } catch (error) {
    logger.error('Error sending Telegram document:', {
      chatId,
      documentUrl,
      error: error.message,
      code: error.response?.statusCode || error.code
    });
    throw error;
  }
}

module.exports = {
  getTelegramBot,
  sendMessage,
  sendMessageWithRetry,
  sendPhoto,
  sendDocument
};
