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
  let sql = 'SELECT * FROM items WHERE id = ? AND deleted_at IS NULL';
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
  let sql = 'SELECT * FROM items WHERE deleted_at IS NULL';
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
  
  if (filters.availabilityStatus) {
    sql += ' AND availability_status = ?';
    params.push(filters.availabilityStatus);
  }
  
  if (filters.serviceType) {
    sql += ' AND service_type = ?';
    params.push(filters.serviceType);
  }
  
  if (filters.categoryId) {
    sql += ' AND category_id = ?';
    params.push(filters.categoryId);
  }
  
  // Order by category sort_order, then by item name
  sql += ` ORDER BY 
    CASE WHEN category_id IS NULL THEN 9999 ELSE (
      SELECT sort_order FROM service_categories WHERE id = items.category_id
    ) END,
    name ASC`;
  
  const items = await queryMySQL(sql, params);
  return sanitizeItems(items);
}

/**
 * Find items by category
 */
async function findByCategory(categoryId, businessId) {
  return await queryMySQL(
    `SELECT * FROM items 
     WHERE category_id = ? AND business_id = ? AND deleted_at IS NULL
     ORDER BY name`,
    [categoryId, businessId]
  );
}

/**
 * Update stock quantity
 */
async function updateStockQuantity(itemId, businessId, quantity) {
  await queryMySQL(
    'UPDATE items SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?',
    [quantity, itemId, businessId]
  );
  
  return await findById(itemId, businessId);
}

/**
 * Decrement stock quantity
 */
async function decrementStock(itemId, businessId, quantity = 1) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get current stock
    const [items] = await connection.query(
      'SELECT stock_quantity FROM items WHERE id = ? AND business_id = ? FOR UPDATE',
      [itemId, businessId]
    );
    
    if (items.length === 0) {
      throw new Error('Item not found');
    }
    
    const currentStock = items[0].stock_quantity;
    
    // If stock_quantity is NULL, it means unlimited - don't decrement
    if (currentStock === null) {
      await connection.commit();
      return { stock_quantity: null };
    }
    
    // Check if enough stock
    if (currentStock < quantity) {
      await connection.rollback();
      throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
    }
    
    // Decrement
    const newStock = currentStock - quantity;
    await connection.query(
      'UPDATE items SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?',
      [newStock, itemId, businessId]
    );
    
    await connection.commit();
    return { stock_quantity: newStock };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
        price, cost, preparation_time_minutes, duration_minutes, 
        service_type, availability_status, stock_quantity, only_scheduled, reminder_minutes_before, category_id,
        quantity, is_reusable, is_rental, track_quantity, -- Deprecated fields kept for backward compatibility
        available_from, available_to, days_available,
        ingredients, availability, item_image_url,
        times_ordered, times_delivered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      itemData.serviceType || 'physical',
      itemData.availabilityStatus || 'available',
      itemData.stockQuantity !== undefined ? itemData.stockQuantity : null,
      itemData.onlyScheduled !== undefined ? (itemData.onlyScheduled === true || itemData.onlyScheduled === 'true') : false,
      itemData.reminderMinutesBefore || null,
      itemData.categoryId || null,
      itemData.quantity !== undefined ? itemData.quantity : null, // Deprecated
      itemData.isReusable !== undefined ? (itemData.isReusable === true || itemData.isReusable === 'true') : true, // Deprecated
      itemData.isRental !== undefined ? (itemData.isRental === true || itemData.isRental === 'true') : false, // Deprecated
      itemData.trackQuantity !== undefined ? (itemData.trackQuantity === true || itemData.trackQuantity === 'true') : false, // Deprecated
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
    serviceType: 'service_type',
    availabilityStatus: 'availability_status',
    stockQuantity: 'stock_quantity',
    onlyScheduled: 'only_scheduled',
    reminderMinutesBefore: 'reminder_minutes_before',
    categoryId: 'category_id',
    quantity: 'quantity', // Deprecated
    isReusable: 'is_reusable', // Deprecated
    isRental: 'is_rental', // Deprecated
    trackQuantity: 'track_quantity', // Deprecated
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
 * Soft delete item (set deleted_at timestamp)
 */
async function softDelete(itemId, businessId) {
  await queryMySQL(
    'UPDATE items SET deleted_at = CURRENT_TIMESTAMP, availability = \'hidden\' WHERE id = ? AND business_id = ?',
    [itemId, businessId]
  );
}

module.exports = {
  findById,
  find,
  findByCategory,
  create,
  update,
  updateStockQuantity,
  decrementStock,
  softDelete
};
