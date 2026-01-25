// Bot Integration Repository
// Data access layer for bot integrations

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');
const { encryptToken, decryptToken } = require('../../utils/encryption');

/**
 * Find integration by owner and platform
 */
async function findByOwnerAndPlatform(ownerType, ownerId, platform) {
  try {
    const integrations = await queryMySQL(
      `SELECT * FROM bot_integrations 
       WHERE owner_type = ? AND owner_id = ? AND platform = ?`,
      [ownerType, ownerId, platform]
    );
    
    if (!integrations || !Array.isArray(integrations) || integrations.length === 0) {
      return null;
    }
    
    const integration = integrations[0];
    
    if (!integration) {
      return null;
    }
    
    // Decrypt token if present
    if (integration.access_token_encrypted) {
      try {
        integration.access_token = decryptToken(integration.access_token_encrypted);
      } catch (error) {
        console.error('Failed to decrypt token:', error);
        // Don't fail the whole request if decryption fails
        integration.access_token = null;
      }
    }
    
    return integration;
  } catch (error) {
    console.error('Error in findByOwnerAndPlatform:', error);
    throw error;
  }
}

/**
 * Find all integrations for owner
 */
async function findByOwner(ownerType, ownerId) {
  const integrations = await queryMySQL(
    `SELECT * FROM bot_integrations 
     WHERE owner_type = ? AND owner_id = ?
     ORDER BY platform`,
    [ownerType, ownerId]
  );
  
  // Decrypt tokens
  return integrations.map(integration => {
    if (integration.access_token_encrypted) {
      try {
        integration.access_token = decryptToken(integration.access_token_encrypted);
      } catch (error) {
        console.error('Failed to decrypt token:', error);
      }
    }
    return integration;
  });
}

/**
 * Find integration by phone number ID (for WhatsApp)
 */
async function findByPhoneNumberId(phoneNumberId) {
  const integrations = await queryMySQL(
    `SELECT * FROM bot_integrations 
     WHERE phone_number_id = ? AND platform = 'whatsapp'`,
    [phoneNumberId]
  );
  
  if (!integrations || integrations.length === 0) {
    return null;
  }
  
  const integration = integrations[0];
  
  // Decrypt token if present
  if (integration.access_token_encrypted) {
    try {
      integration.access_token = decryptToken(integration.access_token_encrypted);
    } catch (error) {
      console.error('Failed to decrypt token:', error);
    }
  }
  
  return integration;
}

/**
 * Create or update integration
 */
async function upsert(integrationData) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if exists
    const [existing] = await connection.query(
      `SELECT id FROM bot_integrations 
       WHERE owner_type = ? AND owner_id = ? AND platform = ?`,
      [integrationData.ownerType, integrationData.ownerId, integrationData.platform]
    );
    
    // Encrypt token if provided
    let encryptedToken = null;
    if (integrationData.accessToken) {
      encryptedToken = encryptToken(integrationData.accessToken);
    }
    
    const configJson = integrationData.configJson 
      ? (typeof integrationData.configJson === 'string' 
          ? integrationData.configJson 
          : JSON.stringify(integrationData.configJson))
      : '{}';
    
    if (existing.length > 0) {
      // Update existing
      await connection.query(
        `UPDATE bot_integrations 
         SET enabled = ?,
             config_json = ?,
             access_token_encrypted = ?,
             phone_number = ?,
             phone_number_id = ?,
             page_id = ?,
             app_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          integrationData.enabled !== undefined ? integrationData.enabled : false,
          configJson,
          encryptedToken || integrationData.accessTokenEncrypted || null,
          integrationData.phoneNumber || null,
          integrationData.phoneNumberId || null,
          integrationData.pageId || null,
          integrationData.appId || null,
          existing[0].id
        ]
      );
      
      await connection.commit();
      return await findByOwnerAndPlatform(
        integrationData.ownerType,
        integrationData.ownerId,
        integrationData.platform
      );
    } else {
      // Create new
      const id = generateUUID();
      await connection.query(
        `INSERT INTO bot_integrations 
         (id, owner_type, owner_id, platform, enabled, config_json, 
          access_token_encrypted, phone_number, phone_number_id, page_id, app_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          integrationData.ownerType,
          integrationData.ownerId,
          integrationData.platform,
          integrationData.enabled !== undefined ? integrationData.enabled : false,
          configJson,
          encryptedToken || null,
          integrationData.phoneNumber || null,
          integrationData.phoneNumberId || null,
          integrationData.pageId || null,
          integrationData.appId || null
        ]
      );
      
      await connection.commit();
      return await findByOwnerAndPlatform(
        integrationData.ownerType,
        integrationData.ownerId,
        integrationData.platform
      );
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update integration enabled status
 */
async function updateEnabled(ownerType, ownerId, platform, enabled) {
  await queryMySQL(
    `UPDATE bot_integrations 
     SET enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE owner_type = ? AND owner_id = ? AND platform = ?`,
    [enabled, ownerType, ownerId, platform]
  );
  
  return await findByOwnerAndPlatform(ownerType, ownerId, platform);
}

/**
 * Delete integration
 */
async function deleteIntegration(ownerType, ownerId, platform) {
  await queryMySQL(
    `DELETE FROM bot_integrations 
     WHERE owner_type = ? AND owner_id = ? AND platform = ?`,
    [ownerType, ownerId, platform]
  );
}

module.exports = {
  findByOwnerAndPlatform,
  findByOwner,
  findByPhoneNumberId,
  upsert,
  updateEnabled,
  deleteIntegration
};
