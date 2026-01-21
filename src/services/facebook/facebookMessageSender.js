// Facebook Message Sender
// Send messages via Facebook Messenger API (Meta Graph API)

const logger = require('../../utils/logger');
const botIntegrationRepository = require('../../repositories/botIntegrationRepository');
const { decryptToken } = require('../../utils/encryption');

/**
 * Send text message via Facebook Messenger
 */
async function sendMessage({ business, to, message }) {
  try {
    // Get Facebook integration
    const integration = await botIntegrationRepository.findByOwnerAndPlatform(
      'business',
      business.id,
      'facebook'
    );
    
    if (!integration || !integration.enabled) {
      throw new Error('Facebook integration not enabled');
    }
    
    // Get access token
    const accessToken = integration.access_token || 
      (integration.access_token_encrypted ? decryptToken(integration.access_token_encrypted) : null);
    
    if (!accessToken) {
      throw new Error('Facebook access token not found');
    }
    
    // Get page ID
    const pageId = integration.page_id;
    if (!pageId) {
      throw new Error('Facebook page ID not found');
    }
    
    // Send message via Facebook Graph API
    const fetch = require('node-fetch');
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        recipient: { id: to },
        message: { text: message },
        messaging_type: 'RESPONSE'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Facebook API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    logger.info('Facebook message sent', {
      businessId: business.id,
      to,
      messageId: result.message_id
    });
    
    return result;
  } catch (error) {
    logger.error('Error sending Facebook message:', error);
    throw error;
  }
}

/**
 * Send image via Facebook Messenger
 */
async function sendImage({ business, to, imageUrl }) {
  try {
    // Get Facebook integration
    const integration = await botIntegrationRepository.findByOwnerAndPlatform(
      'business',
      business.id,
      'facebook'
    );
    
    if (!integration || !integration.enabled) {
      throw new Error('Facebook integration not enabled');
    }
    
    // Get access token
    const accessToken = integration.access_token || 
      (integration.access_token_encrypted ? decryptToken(integration.access_token_encrypted) : null);
    
    if (!accessToken) {
      throw new Error('Facebook access token not found');
    }
    
    // Get page ID
    const pageId = integration.page_id;
    if (!pageId) {
      throw new Error('Facebook page ID not found');
    }
    
    // Send image via Facebook Graph API
    const fetch = require('node-fetch');
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        recipient: { id: to },
        message: {
          attachment: {
            type: 'image',
            payload: {
              url: imageUrl
            }
          }
        },
        messaging_type: 'RESPONSE'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Facebook API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    logger.info('Facebook image sent', {
      businessId: business.id,
      to,
      imageUrl
    });
    
    return result;
  } catch (error) {
    logger.error('Error sending Facebook image:', error);
    throw error;
  }
}

module.exports = {
  sendMessage,
  sendImage
};
