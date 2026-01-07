// Item Repository
// Data access layer for items

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find item by ID
 */
async function findById(itemId, businessId = null) {
  let sql = 'SELECT * FROM items WHERE id = ? AND deleted_at IS NULL';
  const params = [itemId];
  
  if (businessId) {
    sql += ' AND business_id = ?';
    params.push(businessId);
  }
  
  const items = await queryMySQL(sql, params);
  return items[0] || null;
}

/**
 * Find items by filters
 */
async function find(filters = {}) {
  let sql = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  
  if (filters.businessId) {
    sql += ' AND business_id = ?';
    params.push(filters.businessId);
  }
  
  if (filters.menuId) {
    sql += ' AND menu_id = ?';
    params.push(filters.menuId);
  }
  
  if (filters.branchId) {
    sql += ' AND (branch_id = ? OR branch_id IS NULL)';
    params.push(filters.branchId);
  }
  
  if (filters.availability) {
    sql += ' AND availability = ?';
    params.push(filters.availability);
  }
  
  sql += ' AND deleted_at IS NULL';
  sql += ' ORDER BY name';
  
  return await queryMySQL(sql, params);
}

/**
 * Create item
 */
async function create(itemData) {
  const itemId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    await connection.query(`
      INSERT INTO items (
        id, business_id, menu_id, branch_id, name, description,
        price, cost, preparation_time_minutes, availability,
        item_image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      itemId,
      itemData.businessId,
      itemData.menuId || null,
      itemData.branchId || null,
      itemData.name,
      itemData.description || null,
      itemData.price,
      itemData.cost || null,
      itemData.preparationTimeMinutes || null,
      itemData.availability || 'available',
      itemData.itemImageUrl || null
    ]);
    
    await connection.commit();
    
    return await findById(itemId, itemData.businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update item
 */
async function update(itemId, businessId, updateData) {
  const fieldMap = {
    menuId: 'menu_id',
    branchId: 'branch_id',
    name: 'name',
    description: 'description',
    price: 'price',
    cost: 'cost',
    preparationTimeMinutes: 'preparation_time_minutes',
    availability: 'availability',
    itemImageUrl: 'item_image_url'
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
    return await findById(itemId, businessId);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(itemId, businessId);
  
  await queryMySQL(
    `UPDATE items SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
    values
  );
  
  return await findById(itemId, businessId);
}

/**
 * Soft delete item
 */
async function softDelete(itemId, businessId) {
  await queryMySQL(
    'UPDATE items SET deleted_at = CURRENT_TIMESTAMP, availability = ? WHERE id = ? AND business_id = ?',
    ['hidden', itemId, businessId]
  );
}

module.exports = {
  findById,
  find,
  create,
  update,
  softDelete
};
