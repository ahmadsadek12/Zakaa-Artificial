// WhatsApp Message Sender
// Send messages via Meta WhatsApp Business API

const axios = require('axios');
const { decryptToken } = require('../../utils/encryption');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Send WhatsApp message
 */
async function sendMessage({ phoneNumberId, accessToken, to, message, messageType = 'text' }) {
  try {
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
    
    const url = `https://graph.facebook.com/${CONSTANTS.WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: messageType,
      text: messageType === 'text' ? { body: message } : undefined
    };
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    logger.info('WhatsApp message sent successfully', { to, messageId: response.data.messages?.[0]?.id });
    
    return response.data;
  } catch (error) {
    logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendMessage
};
