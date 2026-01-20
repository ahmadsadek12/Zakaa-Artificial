// Service Category Repository
// Data access layer for service categories

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find category by ID
 */
async function findById(categoryId, businessId = null) {
  let sql = 'SELECT * FROM service_categories WHERE id = ?';
  const params = [categoryId];
  
  if (businessId) {
    sql += ' AND business_id = ?';
    params.push(businessId);
  }
  
  const categories = await queryMySQL(sql, params);
  return categories[0] || null;
}

/**
 * Find all categories for business
 */
async function findByBusiness(businessId) {
  return await queryMySQL(
    `SELECT * FROM service_categories 
     WHERE business_id = ? AND is_active = true
     ORDER BY sort_order, name`,
    [businessId]
  );
}

/**
 * Create category
 */
async function create(categoryData) {
  const categoryId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    await connection.query(
      `INSERT INTO service_categories 
       (id, business_id, name, sort_order, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        categoryId,
        categoryData.businessId,
        categoryData.name,
        categoryData.sortOrder || 0,
        categoryData.isActive !== undefined ? categoryData.isActive : true
      ]
    );
    
    await connection.commit();
    return await findById(categoryId, categoryData.businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update category
 */
async function update(categoryId, businessId, updateData) {
  const updates = [];
  const values = [];
  
  if (updateData.name !== undefined) {
    updates.push('name = ?');
    values.push(updateData.name);
  }
  
  if (updateData.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    values.push(updateData.sortOrder);
  }
  
  if (updateData.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(updateData.isActive);
  }
  
  if (updates.length === 0) {
    return await findById(categoryId, businessId);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(categoryId, businessId);
  
  await queryMySQL(
    `UPDATE service_categories 
     SET ${updates.join(', ')} 
     WHERE id = ? AND business_id = ?`,
    values
  );
  
  return await findById(categoryId, businessId);
}

/**
 * Delete category (soft delete by setting is_active = false)
 */
async function softDelete(categoryId, businessId) {
  await queryMySQL(
    `UPDATE service_categories 
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND business_id = ?`,
    [categoryId, businessId]
  );
}

module.exports = {
  findById,
  findByBusiness,
  create,
  update,
  softDelete
};
