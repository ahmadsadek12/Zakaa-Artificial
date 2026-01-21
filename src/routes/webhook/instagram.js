// Instagram Webhook Routes
// Handle incoming Instagram webhook updates

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const instagramWebhookHandler = require('../../services/instagram/instagramWebhookHandler');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

/**
 * Instagram webhook verification (Meta requirement)
 * GET /webhook/instagram/:businessId
 */
router.get('/:businessId', asyncHandler(async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Verify token (should match your configured verify token)
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
  
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Instagram webhook verified', { businessId: req.params.businessId });
    res.status(200).send(challenge);
  } else {
    logger.warn('Instagram webhook verification failed', {
      businessId: req.params.businessId,
      mode,
      tokenMatch: token === verifyToken
    });
    res.sendStatus(403);
  }
}));

/**
 * Instagram message webhook
 * POST /webhook/instagram/:businessId
 */
router.post('/:businessId', asyncHandler(async (req, res) => {
  // Return 200 immediately to acknowledge receipt (required by Meta)
  res.status(200).send('OK');
  
  // Process webhook asynchronously
  try {
    const webhookData = req.body;
    const businessId = req.params.businessId;
    
    if (!webhookData || !webhookData.entry) {
      logger.warn('Invalid Instagram webhook received', {
        body: JSON.stringify(req.body).substring(0, 200),
        businessId
      });
      return;
    }
    
    logger.debug('Processing Instagram webhook', {
      entryCount: webhookData.entry?.length || 0,
      businessId
    });
    
    await instagramWebhookHandler.processWebhook(webhookData, businessId);
  } catch (error) {
    logger.error('Error processing Instagram webhook:', { 
      error: error.message, 
      businessId: req.params.businessId,
      stack: error.stack
    });
    // Error logged but don't fail the webhook response (already sent 200 OK)
  }
}));

module.exports = router;
