// Menu Repository
// Data access layer for menus

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find menu by ID
 */
async function findById(menuId, businessId = null) {
  let sql = 'SELECT * FROM menus WHERE id = ? AND deleted_at IS NULL';
  const params = [menuId];
  
  if (businessId) {
    sql += ' AND business_id = ?';
    params.push(businessId);
  }
  
  const menus = await queryMySQL(sql, params);
  return menus[0] || null;
}

/**
 * Find all menus for a business
 */
async function findByBusinessId(businessId, includeDeleted = false) {
  let sql = 'SELECT * FROM menus WHERE business_id = ?';
  
  if (!includeDeleted) {
    sql += ' AND deleted_at IS NULL';
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return await queryMySQL(sql, [businessId]);
}

/**
 * Get menu items
 */
async function getMenuItems(menuId, businessId) {
  return await queryMySQL(`
    SELECT * FROM items 
    WHERE menu_id = ? AND business_id = ? AND deleted_at IS NULL
    ORDER BY name
  `, [menuId, businessId]);
}

/**
 * Create menu
 */
async function create(menuData) {
  const menuId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    await connection.query(`
      INSERT INTO menus (
        id, business_id, name, description, is_shared,
        menu_image_url, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      menuId,
      menuData.businessId,
      menuData.name,
      menuData.description || null,
      menuData.isShared !== undefined ? menuData.isShared : false,
      menuData.menuImageUrl || null,
      menuData.isActive !== undefined ? menuData.isActive : true
    ]);
    
    await connection.commit();
    
    return await findById(menuId, menuData.businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update menu
 */
async function update(menuId, businessId, updateData) {
  const fieldMap = {
    name: 'name',
    description: 'description',
    isShared: 'is_shared',
    menuImageUrl: 'menu_image_url',
    isActive: 'is_active'
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
    return await findById(menuId, businessId);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(menuId, businessId);
  
  await queryMySQL(
    `UPDATE menus SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
    values
  );
  
  return await findById(menuId, businessId);
}

/**
 * Soft delete menu
 */
async function softDelete(menuId, businessId) {
  await queryMySQL(
    'UPDATE menus SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = ? AND business_id = ?',
    [menuId, businessId]
  );
}

/**
 * Attach menu to branches
 */
async function attachToBranches(menuId, businessId, branchIds) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Verify menu belongs to business
    const menu = await findById(menuId, businessId);
    if (!menu) {
      throw new Error('Menu not found');
    }
    
    // Remove existing attachments
    await connection.query(
      'DELETE FROM branch_menus WHERE menu_id = ?',
      [menuId]
    );
    
    // Add new attachments
    for (const branchId of branchIds) {
      const id = generateUUID();
      await connection.query(`
        INSERT INTO branch_menus (id, branch_id, menu_id)
        SELECT ?, ?, ?
        FROM branches
        WHERE id = ? AND business_id = ? AND deleted_at IS NULL
      `, [id, branchId, menuId, branchId, businessId]);
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  findById,
  findByBusinessId,
  getMenuItems,
  create,
  update,
  softDelete,
  attachToBranches
};
