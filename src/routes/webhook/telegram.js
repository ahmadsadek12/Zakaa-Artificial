// Telegram Webhook Routes
// Handle incoming Telegram webhook updates

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const telegramWebhookHandler = require('../../services/telegram/telegramWebhookHandler');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

/**
 * Telegram webhook endpoint
 * POST /webhook/telegram
 * Telegram will send updates to this endpoint
 */
router.post('/', asyncHandler(async (req, res) => {
  // Return 200 immediately to acknowledge receipt (required by Telegram)
  res.status(200).send('OK');
  
  // Process webhook asynchronously
  try {
    const update = req.body;
    
    if (!update || !update.update_id) {
      logger.warn('Invalid Telegram update received', {
        body: JSON.stringify(req.body).substring(0, 200)
      });
      return;
    }
    
    logger.debug('Processing Telegram update', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallbackQuery: !!update.callback_query
    });
    
    await telegramWebhookHandler.processTelegramUpdate(update);
  } catch (error) {
    logger.error('Error processing Telegram webhook:', error);
    // Error logged but don't fail the webhook response (already sent 200 OK)
  }
}));

/**
 * Get webhook info (for debugging)
 * GET /webhook/telegram/info
 */
router.get('/info', (req, res) => {
  res.json({
    service: 'telegram-webhook',
    botToken: CONSTANTS.TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured',
    webhookUrl: `${CONSTANTS.API_BASE_URL}/webhook/telegram`
  });
});

module.exports = router;
