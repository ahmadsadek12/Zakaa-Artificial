// Instagram Message Sender
// Send messages via Instagram Messaging API (Meta Graph API)

const logger = require('../../utils/logger');
const botIntegrationRepository = require('../../repositories/botIntegrationRepository');
const { decryptToken } = require('../../../utils/encryption');

/**
 * Send text message via Instagram
 */
async function sendMessage({ business, to, message }) {
  try {
    // Get Instagram integration
    const integration = await botIntegrationRepository.findByOwnerAndPlatform(
      'business',
      business.id,
      'instagram'
    );
    
    if (!integration || !integration.enabled) {
      throw new Error('Instagram integration not enabled');
    }
    
    // Get access token
    const accessToken = integration.access_token || 
      (integration.access_token_encrypted ? decryptToken(integration.access_token_encrypted) : null);
    
    if (!accessToken) {
      throw new Error('Instagram access token not found');
    }
    
    // Get page ID
    const pageId = integration.page_id;
    if (!pageId) {
      throw new Error('Instagram page ID not found');
    }
    
    // Send message via Instagram Graph API
    const fetch = require('node-fetch');
    const url = `https://graph.facebook.com/v18.0/${pageId}/messages`;
    
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
      throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    logger.info('Instagram message sent', {
      businessId: business.id,
      to,
      messageId: result.message_id
    });
    
    return result;
  } catch (error) {
    logger.error('Error sending Instagram message:', error);
    throw error;
  }
}

/**
 * Send image via Instagram
 */
async function sendImage({ business, to, imageUrl }) {
  try {
    // Get Instagram integration
    const integration = await botIntegrationRepository.findByOwnerAndPlatform(
      'business',
      business.id,
      'instagram'
    );
    
    if (!integration || !integration.enabled) {
      throw new Error('Instagram integration not enabled');
    }
    
    // Get access token
    const accessToken = integration.access_token || 
      (integration.access_token_encrypted ? decryptToken(integration.access_token_encrypted) : null);
    
    if (!accessToken) {
      throw new Error('Instagram access token not found');
    }
    
    // Get page ID
    const pageId = integration.page_id;
    if (!pageId) {
      throw new Error('Instagram page ID not found');
    }
    
    // Send image via Instagram Graph API
    const fetch = require('node-fetch');
    const url = `https://graph.facebook.com/v18.0/${pageId}/messages`;
    
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
      throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    logger.info('Instagram image sent', {
      businessId: business.id,
      to,
      imageUrl
    });
    
    return result;
  } catch (error) {
    logger.error('Error sending Instagram image:', error);
    throw error;
  }
}

module.exports = {
  sendMessage,
  sendImage
};
