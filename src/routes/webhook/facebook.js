// Facebook Webhook Routes
// Handle incoming Facebook webhook updates

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/errorHandler');
const facebookWebhookHandler = require('../../services/facebook/facebookWebhookHandler');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

/**
 * Facebook webhook verification (Meta requirement)
 * GET /webhook/facebook/:businessId
 */
router.get('/:businessId', asyncHandler(async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Verify token (should match your configured verify token)
  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
  
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Facebook webhook verified', { businessId: req.params.businessId });
    res.status(200).send(challenge);
  } else {
    logger.warn('Facebook webhook verification failed', {
      businessId: req.params.businessId,
      mode,
      tokenMatch: token === verifyToken
    });
    res.sendStatus(403);
  }
}));

/**
 * Facebook message webhook
 * POST /webhook/facebook/:businessId
 */
router.post('/:businessId', asyncHandler(async (req, res) => {
  // Return 200 immediately to acknowledge receipt (required by Meta)
  res.status(200).send('OK');
  
  // Process webhook asynchronously
  try {
    const webhookData = req.body;
    const businessId = req.params.businessId;
    
    if (!webhookData || !webhookData.entry) {
      logger.warn('Invalid Facebook webhook received', {
        body: JSON.stringify(req.body).substring(0, 200),
        businessId
      });
      return;
    }
    
    logger.debug('Processing Facebook webhook', {
      entryCount: webhookData.entry?.length || 0,
      businessId
    });
    
    await facebookWebhookHandler.processWebhook(webhookData, businessId);
  } catch (error) {
    logger.error('Error processing Facebook webhook:', { 
      error: error.message, 
      businessId: req.params.businessId,
      stack: error.stack
    });
    // Error logged but don't fail the webhook response (already sent 200 OK)
  }
}));

module.exports = router;
