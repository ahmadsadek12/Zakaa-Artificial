// Carrier Repository
// Data access layer for carriers

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find carrier by ID
 */
async function findById(carrierId) {
  const carriers = await queryMySQL(
    'SELECT * FROM carriers WHERE id = ? AND deleted_at IS NULL',
    [carrierId]
  );
  return carriers[0] || null;
}

/**
 * Find carrier by user ID (business or branch)
 */
async function findByUserId(userId) {
  const carriers = await queryMySQL(
    'SELECT * FROM carriers WHERE user_id = ? AND deleted_at IS NULL',
    [userId]
  );
  return carriers[0] || null;
}

/**
 * Find carriers by business ID
 */
async function findByBusiness(businessId) {
  return await queryMySQL(
    'SELECT * FROM carriers WHERE business_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [businessId]
  );
}

/**
 * Find carriers by branch ID
 */
async function findByBranch(branchId) {
  return await queryMySQL(
    'SELECT * FROM carriers WHERE branch_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [branchId]
  );
}

/**
 * Create carrier
 */
async function create(carrierData) {
  const id = generateUUID();
  await queryMySQL(
    `INSERT INTO carriers 
     (id, user_id, business_id, branch_id, name, phone_number, is_active) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      carrierData.userId,
      carrierData.businessId,
      carrierData.branchId || null,
      carrierData.name,
      carrierData.phoneNumber,
      carrierData.isActive !== undefined ? carrierData.isActive : true
    ]
  );
  return await findById(id);
}

/**
 * Update carrier
 */
async function update(carrierId, updates) {
  const allowedFields = {
    name: 'name',
    phoneNumber: 'phone_number',
    isActive: 'is_active'
  };
  
  const setClauses = [];
  const values = [];
  
  for (const [key, dbField] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) {
      setClauses.push(`${dbField} = ?`);
      values.push(updates[key]);
    }
  }
  
  if (setClauses.length === 0) {
    return await findById(carrierId);
  }
  
  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(carrierId);
  
  await queryMySQL(
    `UPDATE carriers SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    values
  );
  
  return await findById(carrierId);
}

/**
 * Soft delete carrier
 */
async function softDelete(carrierId) {
  await queryMySQL(
    `UPDATE carriers 
     SET deleted_at = NOW(), updated_at = NOW() 
     WHERE id = ?`,
    [carrierId]
  );
}

module.exports = {
  findById,
  findByUserId,
  findByBusiness,
  findByBranch,
  create,
  update,
  softDelete
};
