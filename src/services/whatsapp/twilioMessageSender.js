// Twilio WhatsApp Message Sender
// Send messages via Twilio WhatsApp API

const twilio = require('twilio');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');

let twilioClient = null;

/**
 * Initialize Twilio client
 */
function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = CONSTANTS.TWILIO_ACCOUNT_SID;
    const authToken = CONSTANTS.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio Account SID and Auth Token must be configured');
    }
    
    twilioClient = twilio(accountSid, authToken);
  }
  
  return twilioClient;
}

/**
 * Send WhatsApp message via Twilio
 * @param {Object} params - Message parameters
 * @param {string} params.to - Recipient in Twilio format (whatsapp:+96176891114)
 * @param {string} params.from - Twilio number in Twilio format (whatsapp:+14155238886)
 * @param {string} params.message - Message text
 * @returns {Promise<Object>} - Twilio message object
 */
async function sendMessage({ to, from, message, maxRetries = 3 }) {
  try {
    if (!to || !from || !message) {
      throw new Error('to, from, and message are required');
    }
    
    // Ensure Twilio format (whatsapp: prefix)
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromNumber = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    
    const client = getTwilioClient();
    
    let lastError;
    
    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const twilioMessage = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          body: message
        });
        
        logger.info('Twilio WhatsApp message sent successfully', {
          to: toNumber,
          messageSid: twilioMessage.sid,
          attempt: attempt + 1
        });
        
        return twilioMessage;
      } catch (error) {
        lastError = error;
        
        // Twilio error codes
        const statusCode = error.status;
        const errorCode = error.code;
        
        logger.warn('Twilio API error', {
          attempt: attempt + 1,
          maxRetries,
          statusCode,
          errorCode,
          errorMessage: error.message,
          retryable: isRetryableError(error)
        });
        
        // Non-retryable errors (4xx except rate limits)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          logger.error('Non-retryable Twilio API error', {
            statusCode,
            errorCode,
            error: error.message
          });
          throw error;
        }
        
        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(error)) {
          const delay = getRetryDelay(attempt);
          logger.info(`Retrying Twilio message send after ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries
          });
          await sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    // All retries exhausted
    logger.error('Twilio message send failed after all retries', {
      to: toNumber,
      from: fromNumber,
      maxRetries,
      lastError: lastError?.message
    });
    
    throw lastError || new Error('Failed to send Twilio message after retries');
  } catch (error) {
    logger.error('Error sending Twilio WhatsApp message:', error);
    throw error;
  }
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  if (!error.status) {
    // Network errors are retryable
    return true;
  }
  
  const status = error.status;
  // Retry on 5xx errors and rate limit (429)
  return status >= 500 || status === 429;
}

/**
 * Get retry delay with exponential backoff
 */
function getRetryDelay(attempt, baseDelay = 1000) {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Send image via Twilio WhatsApp
 * @param {Object} params - Image parameters
 * @param {string} params.to - Recipient in Twilio format (whatsapp:+96176891114)
 * @param {string} params.from - Twilio number in Twilio format (whatsapp:+14155238886)
 * @param {string} params.imageUrl - URL of the image to send
 * @param {string} params.caption - Optional caption for the image
 * @param {number} params.maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Object>} - Twilio message object
 */
async function sendImage({ to, from, imageUrl, caption = '', maxRetries = 3 }) {
  try {
    if (!to || !from || !imageUrl) {
      throw new Error('to, from, and imageUrl are required');
    }
    
    // Ensure Twilio format (whatsapp: prefix)
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromNumber = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    
    const client = getTwilioClient();
    
    let lastError;
    
    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const twilioMessage = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          mediaUrl: [imageUrl],
          body: caption || undefined // Optional caption
        });
        
        logger.info('Twilio WhatsApp image sent successfully', {
          to: toNumber,
          messageSid: twilioMessage.sid,
          imageUrl,
          attempt: attempt + 1
        });
        
        return twilioMessage;
      } catch (error) {
        lastError = error;
        
        // Twilio error codes
        const statusCode = error.status;
        const errorCode = error.code;
        
        logger.warn('Twilio API error (image)', {
          attempt: attempt + 1,
          maxRetries,
          statusCode,
          errorCode,
          errorMessage: error.message,
          retryable: isRetryableError(error)
        });
        
        // Non-retryable errors (4xx except rate limits)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          logger.error('Non-retryable Twilio API error (image)', {
            statusCode,
            errorCode,
            error: error.message
          });
          throw error;
        }
        
        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(error)) {
          const delay = getRetryDelay(attempt);
          logger.info(`Retrying Twilio image send after ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries
          });
          await sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    // All retries exhausted
    logger.error('Twilio image send failed after all retries', {
      to: toNumber,
      from: fromNumber,
      imageUrl,
      maxRetries,
      lastError: lastError?.message
    });
    
    throw lastError || new Error('Failed to send Twilio image after retries');
  } catch (error) {
    logger.error('Error sending Twilio WhatsApp image:', error);
    throw error;
  }
}

/**
 * Send WhatsApp document/PDF via Twilio
 * @param {Object} params - Document parameters
 * @param {string} params.to - Recipient in Twilio format (whatsapp:+96176891114)
 * @param {string} params.from - Twilio number in Twilio format (whatsapp:+14155238886)
 * @param {string} params.documentUrl - URL of the document/PDF to send
 * @param {string} params.caption - Optional caption for the document
 * @param {number} params.maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Object>} - Twilio message object
 */
async function sendDocument({ to, from, documentUrl, caption = '', maxRetries = 3 }) {
  try {
    if (!to || !from || !documentUrl) {
      throw new Error('to, from, and documentUrl are required');
    }
    
    // Ensure Twilio format (whatsapp: prefix)
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromNumber = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    
    const client = getTwilioClient();
    
    let lastError;
    
    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const twilioMessage = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          mediaUrl: [documentUrl], // Twilio expects an array for mediaUrl
          body: caption || undefined // Caption goes in the body
        });
        
        logger.info('Twilio WhatsApp document sent successfully', {
          to: toNumber,
          messageSid: twilioMessage.sid,
          documentUrl,
          attempt: attempt + 1
        });
        
        return twilioMessage;
      } catch (error) {
        lastError = error;
        
        // Twilio error codes
        const statusCode = error.status;
        const errorCode = error.code;
        
        logger.warn('Twilio API document send error', {
          attempt: attempt + 1,
          maxRetries,
          statusCode,
          errorCode,
          errorMessage: error.message,
          retryable: isRetryableError(error)
        });
        
        // Non-retryable errors (4xx except rate limits)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          logger.error('Non-retryable Twilio API document send error', {
            statusCode,
            errorCode,
            error: error.message
          });
          throw error;
        }
        
        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(error)) {
          const delay = getRetryDelay(attempt);
          logger.info(`Retrying Twilio document send after ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries
          });
          await sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    // All retries exhausted
    logger.error('Twilio document send failed after all retries', {
      to: toNumber,
      from: fromNumber,
      documentUrl,
      maxRetries,
      lastError: lastError?.message
    });
    
    throw lastError || new Error('Failed to send Twilio document after retries');
  } catch (error) {
    logger.error('Error sending Twilio WhatsApp document:', error);
    throw error;
  }
}

module.exports = {
  sendMessage,
  sendImage,
  sendDocument
};
