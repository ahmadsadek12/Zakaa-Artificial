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

module.exports = {
  sendMessage
};
