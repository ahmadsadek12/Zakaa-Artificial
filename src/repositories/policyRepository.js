// Policy Repository
// Data access layer for policies

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find policy by ID
 */
async function findById(policyId) {
  const policies = await queryMySQL(
    'SELECT * FROM policies WHERE id = ?',
    [policyId]
  );
  return policies[0] || null;
}

/**
 * Find policies by owner
 */
async function findByOwner(ownerType, ownerId) {
  return await queryMySQL(
    'SELECT * FROM policies WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC',
    [ownerType, ownerId]
  );
}

/**
 * Create policy
 */
async function create(policyData) {
  const policyId = generateUUID();
  
  await queryMySQL(`
    INSERT INTO policies (id, owner_type, owner_id, policy_type, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    policyId,
    policyData.ownerType,
    policyData.ownerId,
    policyData.policyType,
    policyData.title || null,
    policyData.description
  ]);
  
  return await findById(policyId);
}

/**
 * Update policy
 */
async function update(policyId, updateData) {
  const fieldMap = {
    policyType: 'policy_type',
    title: 'title',
    description: 'description'
  };
  
  const updates = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updateData)) {
    const dbKey = fieldMap[key];
    if (dbKey && value !== undefined) {
      updates.push(`${dbKey} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) {
    return await findById(policyId);
  }
  
  values.push(policyId);
  
  await queryMySQL(
    `UPDATE policies SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await findById(policyId);
}

/**
 * Delete policy
 */
async function delete(policyId) {
  await queryMySQL('DELETE FROM policies WHERE id = ?', [policyId]);
}

module.exports = {
  findById,
  findByOwner,
  create,
  update,
  delete
};
