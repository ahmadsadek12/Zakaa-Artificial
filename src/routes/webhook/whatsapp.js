// WhatsApp Webhook Routes
// Webhook verification and message handling
// Supports both Meta WhatsApp Business API and Twilio WhatsApp

const express = require('express');
const router = express.Router();
const CONSTANTS = require('../../config/constants');
const { asyncHandler } = require('../../middleware/errorHandler');
const webhookHandler = require('../../services/whatsapp/webhookHandler');
const { verifyWebhookSignature } = require('../../utils/webhookSignature');
const logger = require('../../utils/logger');

/**
 * Middleware to parse raw body and verify signature (Meta only)
 * Only applies to JSON content-type requests (Meta format)
 * Twilio requests (form-encoded) skip this middleware
 */
function parseAndVerifyWebhook(req, res, next) {
  // Check if this is a Meta webhook (JSON format)
  const contentType = req.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Not Meta format - skip (will be handled as Twilio)
    return next();
  }
  
  // Parse JSON from raw body buffer (provided by express.raw())
  if (req.body && Buffer.isBuffer(req.body)) {
    const rawBody = req.body;
    req.rawBody = rawBody; // Keep raw body for signature verification
    
    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch (error) {
      logger.error('Failed to parse webhook body as JSON:', error);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    
    // Verify signature (Meta webhooks)
    const signature = req.get('X-Hub-Signature-256');
    
    // Skip verification in development if secret not set
    if (CONSTANTS.NODE_ENV === 'development' && !CONSTANTS.WHATSAPP_WEBHOOK_SECRET) {
      logger.debug('Skipping webhook signature verification in development mode');
      return next();
    }
    
    const isValid = verifyWebhookSignature(signature, rawBody);
    
    if (!isValid) {
      logger.warn('Webhook signature verification failed', {
        hasSignature: !!signature,
        bodyLength: rawBody.length
      });
      return res.status(403).json({
        success: false,
        error: { message: 'Invalid webhook signature' }
      });
    }
  } else if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    // Raw body stored by express.raw() verify callback
    const rawBody = req.rawBody;
    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch (error) {
      logger.error('Failed to parse raw body as JSON:', error);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    
    // Verify signature
    const signature = req.get('X-Hub-Signature-256');
    if (CONSTANTS.NODE_ENV !== 'development' || CONSTANTS.WHATSAPP_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(signature, rawBody);
      if (!isValid) {
        return res.status(403).json({
          success: false,
          error: { message: 'Invalid webhook signature' }
        });
      }
    }
  } else {
    // Body already parsed (might be Twilio format or already processed)
    // Just continue
    logger.debug('Webhook body already parsed or not in expected format');
  }
  
  next();
}

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
 * Supports both Meta WhatsApp Business API and Twilio WhatsApp
 * 
 * Detection logic:
 * - Twilio: Has 'From' and 'Body' fields (form-encoded, Content-Type: application/x-www-form-urlencoded)
 * - Meta: Has 'entry' array (JSON format, Content-Type: application/json)
 * 
 * Note: express.raw() only processes application/json, so Twilio form-encoded 
 * requests will be processed by express.urlencoded() middleware
 */
router.post('/', parseAndVerifyWebhook, asyncHandler(async (req, res) => {
  // Return 200 immediately to acknowledge receipt (required by both providers)
  res.status(200).send('OK');
  
  // Process webhook asynchronously based on detected format
  try {
    // Detect provider by request format
    // Twilio sends form-encoded with 'From' and 'Body' fields
    if (req.body.From && req.body.Body) {
      // Twilio format - form-encoded data
      logger.debug('Processing Twilio webhook');
      const twilioWebhookHandler = require('../../services/whatsapp/twilioWebhookHandler');
      await twilioWebhookHandler.processTwilioWebhook(req);
    } else if (req.body.entry && Array.isArray(req.body.entry)) {
      // Meta format - JSON with entry array
      logger.debug('Processing Meta webhook');
      await webhookHandler.processWebhook(req.body);
    } else {
      logger.warn('Unknown webhook format - cannot process', {
        contentType: req.get('content-type'),
        bodyKeys: Object.keys(req.body || {}),
        sampleBody: JSON.stringify(req.body).substring(0, 200)
      });
    }
  } catch (error) {
    logger.error('Error processing WhatsApp webhook:', error);
    // Error logged but don't fail the webhook response (already sent 200 OK)
  }
}));

module.exports = router;
