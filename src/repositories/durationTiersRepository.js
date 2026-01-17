// Duration Tiers Repository
// Data access layer for item_duration_tiers table

const { v4: uuidv4 } = require('uuid');
const { queryMySQL } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all duration tiers for an item
 */
async function getDurationTiersByItemId(itemId) {
  try {
    const tiers = await queryMySQL(
      `SELECT * FROM item_duration_tiers 
       WHERE item_id = ? 
       ORDER BY duration_minutes ASC`,
      [itemId]
    );
    return tiers;
  } catch (error) {
    logger.error('Error fetching duration tiers:', error);
    throw error;
  }
}

/**
 * Get a single duration tier by ID
 */
async function getDurationTierById(tierId) {
  try {
    const tiers = await queryMySQL(
      `SELECT * FROM item_duration_tiers WHERE id = ?`,
      [tierId]
    );
    return tiers[0] || null;
  } catch (error) {
    logger.error('Error fetching duration tier:', error);
    throw error;
  }
}

/**
 * Create a new duration tier
 */
async function createDurationTier({ itemId, durationMinutes, price }) {
  try {
    const id = uuidv4();
    await queryMySQL(
      `INSERT INTO item_duration_tiers (id, item_id, duration_minutes, price)
       VALUES (?, ?, ?, ?)`,
      [id, itemId, durationMinutes, price]
    );
    
    return await getDurationTierById(id);
  } catch (error) {
    logger.error('Error creating duration tier:', error);
    throw error;
  }
}

/**
 * Update a duration tier
 */
async function updateDurationTier(tierId, { durationMinutes, price }) {
  try {
    const updates = [];
    const values = [];
    
    if (durationMinutes !== undefined) {
      updates.push('duration_minutes = ?');
      values.push(durationMinutes);
    }
    
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }
    
    if (updates.length === 0) {
      return await getDurationTierById(tierId);
    }
    
    values.push(tierId);
    
    await queryMySQL(
      `UPDATE item_duration_tiers 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      values
    );
    
    return await getDurationTierById(tierId);
  } catch (error) {
    logger.error('Error updating duration tier:', error);
    throw error;
  }
}

/**
 * Delete a duration tier
 */
async function deleteDurationTier(tierId) {
  try {
    await queryMySQL(
      `DELETE FROM item_duration_tiers WHERE id = ?`,
      [tierId]
    );
    return true;
  } catch (error) {
    logger.error('Error deleting duration tier:', error);
    throw error;
  }
}

/**
 * Delete all duration tiers for an item
 */
async function deleteDurationTiersByItemId(itemId) {
  try {
    await queryMySQL(
      `DELETE FROM item_duration_tiers WHERE item_id = ?`,
      [itemId]
    );
    return true;
  } catch (error) {
    logger.error('Error deleting duration tiers:', error);
    throw error;
  }
}

module.exports = {
  getDurationTiersByItemId,
  getDurationTierById,
  createDurationTier,
  updateDurationTier,
  deleteDurationTier,
  deleteDurationTiersByItemId
};
