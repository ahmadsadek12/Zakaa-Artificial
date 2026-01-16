// Telegram Webhook Setup Service
// Automatically configure webhook when bot token is updated

const axios = require('axios');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Validate Telegram bot token and get bot info
 * @param {string} botToken - Telegram bot token
 * @returns {Promise<Object>} Bot information if valid
 */
async function validateBotToken(botToken) {
  if (!botToken || typeof botToken !== 'string') {
    throw new Error('Invalid bot token format');
  }

  // Validate token format: should be like "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
  if (!botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
    throw new Error('Bot token format is invalid. Expected format: <bot_id>:<token>');
  }

  try {
    const getMeUrl = `https://api.telegram.org/bot${botToken}/getMe`;
    const response = await axios.get(getMeUrl, { timeout: 10000 });

    if (response.data.ok) {
      return response.data.result;
    } else {
      throw new Error(response.data.description || 'Invalid bot token');
    }
  } catch (error) {
    if (error.response?.data?.description) {
      throw new Error(`Telegram API error: ${error.response.data.description}`);
    }
    throw new Error(`Failed to validate bot token: ${error.message}`);
  }
}

/**
 * Set webhook URL for Telegram bot
 * @param {string} botToken - Telegram bot token
 * @param {string} webhookUrl - Full webhook URL (e.g., http://18.206.123.45:3000/webhook/telegram)
 * @returns {Promise<Object>} Webhook setup result
 */
async function setWebhook(botToken, webhookUrl) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('Invalid webhook URL');
  }

  // Validate webhook URL format
  if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
    throw new Error('Webhook URL must start with http:// or https://');
  }

  try {
    const setWebhookUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
    const response = await axios.post(setWebhookUrl, {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query']
    }, { timeout: 10000 });

    if (response.data.ok) {
      logger.info('Telegram webhook set successfully', {
        botToken: botToken.substring(0, 20) + '...',
        webhookUrl
      });
      return response.data.result;
    } else {
      throw new Error(response.data.description || 'Failed to set webhook');
    }
  } catch (error) {
    if (error.response?.data?.description) {
      throw new Error(`Telegram API error: ${error.response.data.description}`);
    }
    throw new Error(`Failed to set webhook: ${error.message}`);
  }
}

/**
 * Get current webhook info
 * @param {string} botToken - Telegram bot token
 * @returns {Promise<Object>} Current webhook information
 */
async function getWebhookInfo(botToken) {
  try {
    const getWebhookUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
    const response = await axios.get(getWebhookUrl, { timeout: 10000 });

    if (response.data.ok) {
      return response.data.result;
    } else {
      throw new Error(response.data.description || 'Failed to get webhook info');
    }
  } catch (error) {
    if (error.response?.data?.description) {
      throw new Error(`Telegram API error: ${error.response.data.description}`);
    }
    throw new Error(`Failed to get webhook info: ${error.message}`);
  }
}

/**
 * Setup Telegram bot webhook automatically
 * This function is called when a business updates their bot token
 * @param {string} botToken - Telegram bot token
 * @returns {Promise<Object>} Setup result with bot info and webhook status
 */
async function setupTelegramBotWebhook(botToken) {
  try {
    // Step 1: Validate the bot token
    logger.info('Validating Telegram bot token...');
    const botInfo = await validateBotToken(botToken);
    
    logger.info('Bot token validated successfully', {
      botId: botInfo.id,
      botUsername: botInfo.username,
      botName: botInfo.first_name
    });

    // Step 2: Determine webhook URL
    // In production (EC2), use the API_BASE_URL from constants
    // In development, skip webhook setup (use ngrok manually)
    const webhookUrl = `${CONSTANTS.API_BASE_URL}/webhook/telegram`;

    // Step 3: Set the webhook
    logger.info('Setting Telegram webhook...', { webhookUrl });
    await setWebhook(botToken, webhookUrl);

    logger.info('Telegram bot webhook configured successfully', {
      botUsername: botInfo.username,
      webhookUrl
    });

    return {
      success: true,
      botInfo: {
        id: botInfo.id,
        username: botInfo.username,
        name: botInfo.first_name
      },
      webhookUrl
    };
  } catch (error) {
    logger.error('Failed to setup Telegram bot webhook', {
      error: error.message
    });
    
    // Return structured error
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete webhook (useful for cleanup or switching to polling)
 * @param {string} botToken - Telegram bot token
 */
async function deleteWebhook(botToken) {
  try {
    const deleteWebhookUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
    const response = await axios.post(deleteWebhookUrl, {}, { timeout: 10000 });

    if (response.data.ok) {
      logger.info('Telegram webhook deleted successfully');
      return true;
    } else {
      throw new Error(response.data.description || 'Failed to delete webhook');
    }
  } catch (error) {
    logger.error('Failed to delete webhook', { error: error.message });
    throw error;
  }
}

module.exports = {
  validateBotToken,
  setWebhook,
  getWebhookInfo,
  setupTelegramBotWebhook,
  deleteWebhook
};
