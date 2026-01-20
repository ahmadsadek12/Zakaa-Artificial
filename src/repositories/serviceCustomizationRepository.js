// Service Customization Repository
// Data access layer for service customizations

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find customization by ID
 */
async function findById(customizationId) {
  const customizations = await queryMySQL(
    'SELECT * FROM service_customizations WHERE id = ?',
    [customizationId]
  );
  return customizations[0] || null;
}

/**
 * Find all customizations for item
 */
async function findByItem(itemId) {
  return await queryMySQL(
    `SELECT * FROM service_customizations 
     WHERE item_id = ? AND is_active = true
     ORDER BY name`,
    [itemId]
  );
}

/**
 * Create customization
 */
async function create(customizationData) {
  const customizationId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    await connection.query(
      `INSERT INTO service_customizations 
       (id, item_id, name, price, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        customizationId,
        customizationData.itemId,
        customizationData.name,
        customizationData.price || 0,
        customizationData.isActive !== undefined ? customizationData.isActive : true
      ]
    );
    
    await connection.commit();
    return await findById(customizationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update customization
 */
async function update(customizationId, updateData) {
  const updates = [];
  const values = [];
  
  if (updateData.name !== undefined) {
    updates.push('name = ?');
    values.push(updateData.name);
  }
  
  if (updateData.price !== undefined) {
    updates.push('price = ?');
    values.push(updateData.price);
  }
  
  if (updateData.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(updateData.isActive);
  }
  
  if (updates.length === 0) {
    return await findById(customizationId);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(customizationId);
  
  await queryMySQL(
    `UPDATE service_customizations 
     SET ${updates.join(', ')} 
     WHERE id = ?`,
    values
  );
  
  return await findById(customizationId);
}

/**
 * Delete customization (soft delete)
 */
async function softDelete(customizationId) {
  await queryMySQL(
    `UPDATE service_customizations 
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [customizationId]
  );
}

module.exports = {
  findById,
  findByItem,
  create,
  update,
  softDelete
};
