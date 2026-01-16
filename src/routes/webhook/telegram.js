// Telegram Webhook Routes
// Handle incoming Telegram webhook updates

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const telegramWebhookHandler = require('../../services/telegram/telegramWebhookHandler');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

/**
 * Telegram webhook endpoint (with businessId in URL)
 * POST /webhook/telegram/:businessId
 * Telegram will send updates to this endpoint
 */
router.post('/:businessId', asyncHandler(async (req, res) => {
  // Return 200 immediately to acknowledge receipt (required by Telegram)
  res.status(200).send('OK');
  
  // Process webhook asynchronously
  try {
    const update = req.body;
    const businessId = req.params.businessId;
    
    if (!update || !update.update_id) {
      logger.warn('Invalid Telegram update received', {
        body: JSON.stringify(req.body).substring(0, 200),
        businessId
      });
      return;
    }
    
    logger.debug('Processing Telegram update', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallbackQuery: !!update.callback_query,
      businessId
    });
    
    await telegramWebhookHandler.processTelegramUpdate(update, businessId);
  } catch (error) {
    logger.error('Error processing Telegram webhook:', { error: error.message, businessId: req.params.businessId });
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
