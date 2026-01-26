// Addon Repository
// Data access layer for addons

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find addon by key
 */
async function findByKey(addonKey) {
  const addons = await queryMySQL(
    'SELECT * FROM addons WHERE addon_key = ? AND is_active = true',
    [addonKey]
  );
  return addons[0] || null;
}

/**
 * Find all addons
 */
async function findAll() {
  return await queryMySQL(
    'SELECT * FROM addons WHERE is_active = true ORDER BY name'
  );
}

/**
 * Find business addon status
 */
async function findBusinessAddon(businessId, addonKey) {
  const addons = await queryMySQL(
    `SELECT ba.*, a.addon_key, a.name, a.default_price
     FROM business_addons ba
     INNER JOIN addons a ON ba.addon_id = a.id
     WHERE ba.business_id = ? AND a.addon_key = ?`,
    [businessId, addonKey]
  );
  return addons[0] || null;
}

/**
 * Find all business addons with status
 */
async function findBusinessAddons(businessId) {
  return await queryMySQL(
    `SELECT ba.*, a.addon_key, a.name, a.default_price
     FROM business_addons ba
     INNER JOIN addons a ON ba.addon_id = a.id
     WHERE ba.business_id = ?
     ORDER BY a.name`,
    [businessId]
  );
}

/**
 * Activate addon for business
 */
async function activateAddon(businessId, addonKey, priceOverride = null) {
  const addon = await findByKey(addonKey);
  if (!addon) {
    throw new Error(`Addon "${addonKey}" not found`);
  }
  
  const connection = await getMySQLConnection();
  try {
    await connection.beginTransaction();
    
    // Check if exists
    const [existing] = await connection.query(
      `SELECT id FROM business_addons 
       WHERE business_id = ? AND addon_id = ?`,
      [businessId, addon.id]
    );
    
    if (existing.length > 0) {
      // Update existing
      await connection.query(
        `UPDATE business_addons 
         SET status = 'active', 
             price_override = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE business_id = ? AND addon_id = ?`,
        [priceOverride, businessId, addon.id]
      );
    } else {
      // Create new
      const id = generateUUID();
      await connection.query(
        `INSERT INTO business_addons 
         (id, business_id, addon_id, status, price_override) 
         VALUES (?, ?, ?, 'active', ?)`,
        [id, businessId, addon.id, priceOverride]
      );
    }
    
    await connection.commit();
    return await findBusinessAddon(businessId, addonKey);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Deactivate addon for business
 */
async function deactivateAddon(businessId, addonKey) {
  const addon = await findByKey(addonKey);
  if (!addon) {
    throw new Error(`Addon "${addonKey}" not found`);
  }
  
  await queryMySQL(
    `UPDATE business_addons 
     SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
     WHERE business_id = ? AND addon_id = ?`,
    [businessId, addon.id]
  );
  
  return await findBusinessAddon(businessId, addonKey);
}

/**
 * Check if addon is active
 */
async function isAddonActive(businessId, addonKey) {
  const businessAddon = await findBusinessAddon(businessId, addonKey);
  return businessAddon && businessAddon.status === 'active';
}

module.exports = {
  findByKey,
  findAll,
  findBusinessAddon,
  findBusinessAddons,
  activateAddon,
  deactivateAddon,
  isAddonActive
};
