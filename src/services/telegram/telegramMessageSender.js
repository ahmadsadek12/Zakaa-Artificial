// Telegram Message Sender
// Send messages via Telegram Bot API

const TelegramBot = require('node-telegram-bot-api');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');

let botInstance = null;

/**
 * Get or create Telegram bot instance
 */
function getTelegramBot() {
  if (botInstance) {
    return botInstance;
  }
  
  const botToken = CONSTANTS.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('Telegram bot token is not configured');
    return null;
  }
  
  try {
    // Use polling in development, webhook in production
    // For now, we'll use polling as a fallback but primarily use webhook
    botInstance = new TelegramBot(botToken, { polling: false });
    logger.info('Telegram bot instance created');
    return botInstance;
  } catch (error) {
    logger.error('Failed to create Telegram bot instance:', error);
    return null;
  }
}

/**
 * Send message via Telegram
 * @param {Object} params - Message parameters
 * @param {string|number} params.chatId - Telegram chat ID
 * @param {string} params.message - Message text
 * @param {Object} params.options - Additional options (parse_mode, etc.)
 */
async function sendMessage({ chatId, message, options = {} }) {
  try {
    const bot = getTelegramBot();
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
async function sendMessageWithRetry({ chatId, message, options = {}, maxRetries = 3 }) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendMessage({ chatId, message, options });
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

module.exports = {
  getTelegramBot,
  sendMessage,
  sendMessageWithRetry
};
