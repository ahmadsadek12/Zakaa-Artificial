// WhatsApp Message Sender
// Send messages via Meta WhatsApp Business API with retry logic and error handling

const axios = require('axios');
const { decryptToken } = require('../../../utils/encryption');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');

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
  if (!error.response) {
    // Network errors are retryable
    return true;
  }
  
  const status = error.response.status;
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
 * Send WhatsApp message with retry logic
 * @param {Object} params - Message parameters
 * @param {string} params.phoneNumberId - WhatsApp phone number ID
 * @param {string} params.accessToken - Encrypted or plain access token
 * @param {string} params.to - Recipient phone number
 * @param {string} params.message - Message text
 * @param {string} params.messageType - Message type (default: 'text')
 * @param {number} params.maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Object>} - API response
 */
async function sendMessage({ phoneNumberId, accessToken, to, message, messageType = 'text', maxRetries = 3 }) {
  // Decrypt token if encrypted
  let token = accessToken;
  if (accessToken && !accessToken.startsWith('EAA')) {
    try {
      token = decryptToken(accessToken);
    } catch (error) {
      logger.error('Failed to decrypt access token:', error);
      throw new Error('Invalid access token');
    }
  }
  
  if (!token) {
    throw new Error('Access token is required');
  }
  
  if (!phoneNumberId) {
    throw new Error('Phone number ID is required');
  }
  
  if (!to) {
    throw new Error('Recipient phone number is required');
  }
  
  const url = `https://graph.facebook.com/${CONSTANTS.WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: messageType,
    text: messageType === 'text' ? { body: message } : undefined
  };
  
  let lastError;
  
  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      logger.info('WhatsApp message sent successfully', { 
        to, 
        messageId: response.data.messages?.[0]?.id,
        attempt: attempt + 1
      });
      
      return response.data;
    } catch (error) {
      lastError = error;
      
      // Categorize error
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      // Log error details
      logger.warn('WhatsApp API error', {
        attempt: attempt + 1,
        maxRetries,
        status,
        errorCode: errorData?.error?.code,
        errorMessage: errorData?.error?.message,
        errorType: errorData?.error?.type,
        retryable: isRetryableError(error)
      });
      
      // Non-retryable errors (4xx except 429)
      if (status && status >= 400 && status < 500 && status !== 429) {
        logger.error('Non-retryable WhatsApp API error', {
          status,
          error: errorData?.error || error.message
        });
        throw error;
      }
      
      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = getRetryDelay(attempt);
        logger.info(`Retrying WhatsApp message send after ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries
        });
        await sleep(delay);
        continue;
      }
      
      // Max retries reached or non-retryable error
      break;
    }
  }
  
  // All retries exhausted
  logger.error('WhatsApp message send failed after all retries', {
    to,
    maxRetries,
    lastError: lastError?.response?.data || lastError?.message
  });
  
  throw lastError || new Error('Failed to send WhatsApp message after retries');
}

module.exports = {
  sendMessage
};
