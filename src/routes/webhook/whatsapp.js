// WhatsApp Webhook Routes
// Webhook verification and message handling

const express = require('express');
const router = express.Router();
const CONSTANTS = require('../../config/constants');
const { asyncHandler } = require('../../middleware/errorHandler');
const webhookHandler = require('../../services/whatsapp/webhookHandler');
const logger = require('../../utils/logger');

/**
 * Webhook verification (Meta requirement)
 * GET /webhook/whatsapp
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === CONSTANTS.WHATSAPP_VERIFY_TOKEN) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed', { mode, token });
    res.sendStatus(403);
  }
});

/**
 * WhatsApp message webhook
 * POST /webhook/whatsapp
 */
router.post('/', asyncHandler(async (req, res) => {
  // Return 200 immediately to acknowledge receipt
  res.status(200).send('OK');
  
  // Process webhook asynchronously
  try {
    await webhookHandler.processWebhook(req.body);
  } catch (error) {
    logger.error('Error processing WhatsApp webhook:', error);
    // Error logged but don't fail the webhook response
  }
}));

module.exports = router;
