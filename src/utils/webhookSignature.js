// Webhook Signature Verification
// Verify Meta WhatsApp webhook signatures

const crypto = require('crypto');
const CONSTANTS = require('../config/constants');
const logger = require('./logger');

/**
 * Verify WhatsApp webhook signature
 * @param {string} signature - X-Hub-Signature-256 header value
 * @param {Buffer|string} payload - Raw request body
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhookSignature(signature, payload) {
  try {
    if (!signature) {
      logger.warn('Missing webhook signature header');
      return false;
    }
    
    const webhookSecret = CONSTANTS.WHATSAPP_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('WHATSAPP_WEBHOOK_SECRET not configured - skipping signature verification');
      // In development, allow without secret if not configured
      if (CONSTANTS.NODE_ENV === 'development') {
        return true;
      }
      return false;
    }
    
    // Extract signature (format: sha256=<hash>)
    const expectedSignature = signature.replace('sha256=', '');
    
    // Calculate HMAC SHA256 of payload using secret
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const calculatedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
    
    if (!isValid) {
      logger.warn('Webhook signature verification failed', {
        expectedPrefix: expectedSignature.substring(0, 10),
        calculatedPrefix: calculatedSignature.substring(0, 10)
      });
    }
    
    return isValid;
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Middleware to verify webhook signature
 */
function verifyWebhookSignatureMiddleware(req, res, next) {
  const signature = req.get('X-Hub-Signature-256');
  const rawBody = req.body;
  
  // Convert body to string if it's an object (Express parses JSON automatically)
  let bodyString;
  if (typeof rawBody === 'object') {
    bodyString = JSON.stringify(rawBody);
  } else {
    bodyString = rawBody;
  }
  
  const isValid = verifyWebhookSignature(signature, bodyString);
  
  if (!isValid) {
    logger.warn('Webhook signature verification failed', {
      hasSignature: !!signature,
      bodyLength: bodyString?.length || 0
    });
    return res.status(403).json({
      success: false,
      error: { message: 'Invalid webhook signature' }
    });
  }
  
  next();
}

module.exports = {
  verifyWebhookSignature,
  verifyWebhookSignatureMiddleware
};
