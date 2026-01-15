// Item Repository
// Data access layer for items

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Remove analytics fields from item (reserved for premium features)
 */
function sanitizeItem(item) {
  if (!item) return null;
  
  const { times_ordered, times_delivered, ...sanitizedItem } = item;
  return sanitizedItem;
}

/**
 * Remove analytics fields from multiple items
 */
function sanitizeItems(items) {
  if (!items || !Array.isArray(items)) return items;
  return items.map(sanitizeItem);
}

/**
 * Find item by ID
 */
async function findById(itemId, businessId = null) {
  let sql = 'SELECT * FROM items WHERE id = ?';
  const params = [itemId];
  
  if (businessId) {
    sql += ' AND business_id = ?';
    params.push(businessId);
  }
  
  const items = await queryMySQL(sql, params);
  return sanitizeItem(items[0] || null);
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
  
  if (filters.userId || filters.branchId) {
    sql += ' AND (user_id = ? OR user_id IS NULL)';
    params.push(filters.userId || filters.branchId);
  }
  
  if (filters.availability) {
    sql += ' AND availability = ?';
    params.push(filters.availability);
  }
  
  sql += ' ORDER BY name';
  
  const items = await queryMySQL(sql, params);
  return sanitizeItems(items);
}

/**
 * Create item
 */
async function create(itemData) {
  const itemId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Use user_id (can be branch or business) instead of branch_id
    const userId = itemData.userId || itemData.branchId || itemData.businessId;
    
    await connection.query(`
      INSERT INTO items (
        id, business_id, menu_id, user_id, name, description,
        item_type, is_schedulable, min_schedule_hours,
        price, cost, preparation_time_minutes, duration_minutes, quantity, is_reusable,
        available_from, available_to, days_available,
        ingredients, availability, item_image_url,
        times_ordered, times_delivered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      itemId,
      itemData.businessId,
      itemData.menuId || null,
      userId,
      itemData.name,
      itemData.description || null,
      itemData.itemType || 'good',
      itemData.isSchedulable !== undefined ? (itemData.isSchedulable === true || itemData.isSchedulable === 'true') : false,
      itemData.minScheduleHours !== undefined ? parseInt(itemData.minScheduleHours, 10) : 0,
      itemData.price,
      itemData.cost || null,
      itemData.preparationTimeMinutes || null,
      itemData.durationMinutes || null,
      itemData.quantity !== undefined ? itemData.quantity : null,
      itemData.isReusable !== undefined ? (itemData.isReusable === true || itemData.isReusable === 'true') : true,
      itemData.availableFrom || null,
      itemData.availableTo || null,
      itemData.daysAvailable ? JSON.stringify(itemData.daysAvailable) : null,
      itemData.ingredients || null,
      itemData.availability || 'available',
      itemData.itemImageUrl || null,
      0, // times_ordered starts at 0
      0  // times_delivered starts at 0
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
    userId: 'user_id',
    branchId: 'user_id', // Map branchId to user_id for compatibility
    name: 'name',
    description: 'description',
    itemType: 'item_type',
    isSchedulable: 'is_schedulable',
    minScheduleHours: 'min_schedule_hours',
    price: 'price',
    cost: 'cost',
    preparationTimeMinutes: 'preparation_time_minutes',
    durationMinutes: 'duration_minutes',
    quantity: 'quantity',
    isReusable: 'is_reusable',
    availableFrom: 'available_from',
    availableTo: 'available_to',
    daysAvailable: 'days_available',
    ingredients: 'ingredients',
    availability: 'availability',
    itemImageUrl: 'item_image_url'
  };
  
  const updates = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updateData)) {
    const dbKey = fieldMap[key];
    if (dbKey && value !== undefined) {
      // Handle JSON fields
      if (key === 'daysAvailable' && Array.isArray(value)) {
        updates.push(`${dbKey} = ?`);
        values.push(JSON.stringify(value));
      } else {
        updates.push(`${dbKey} = ?`);
        values.push(value);
      }
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
 * Soft delete item (mark as unavailable)
 */
async function softDelete(itemId, businessId) {
  await queryMySQL(
    'UPDATE items SET is_available = false WHERE id = ? AND business_id = ?',
    [itemId, businessId]
  );
}

module.exports = {
  findById,
  find,
  create,
  update,
  softDelete
};
