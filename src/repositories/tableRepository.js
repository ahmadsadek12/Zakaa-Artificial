// Table Repository
// Data access layer for tables

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find table by ID
 */
async function findById(tableId, userId = null) {
  let sql = 'SELECT * FROM tables WHERE id = ?';
  const params = [tableId];
  
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  
  const tables = await queryMySQL(sql, params);
  return tables[0] || null;
}

/**
 * Find tables by business/user
 */
async function findByBusiness(userId, includeReserved = true) {
  let sql = 'SELECT * FROM tables WHERE user_id = ?';
  const params = [userId];
  
  if (!includeReserved) {
    sql += ' AND reserved = false';
  }
  
  sql += ' ORDER BY number ASC';
  
  return await queryMySQL(sql, params);
}

/**
 * Find available tables (not reserved)
 */
async function findAvailable(userId) {
  return await queryMySQL(
    'SELECT * FROM tables WHERE user_id = ? AND reserved = false ORDER BY number ASC',
    [userId]
  );
}

/**
 * Create table
 */
async function create(tableData) {
  const tableId = generateUUID();
  
  await queryMySQL(`
    INSERT INTO tables (id, user_id, seats, number, reserved)
    VALUES (?, ?, ?, ?, ?)
  `, [
    tableId,
    tableData.userId,
    tableData.seats,
    tableData.number,
    tableData.reserved !== undefined ? tableData.reserved : false
  ]);
  
  return await findById(tableId);
}

/**
 * Update table
 */
async function update(tableId, userId, updateData) {
  const fieldMap = {
    seats: 'seats',
    number: 'number',
    reserved: 'reserved'
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
    return await findById(tableId, userId);
  }
  
  values.push(tableId, userId);
  
  await queryMySQL(
    `UPDATE tables SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );
  
  return await findById(tableId, userId);
}

/**
 * Update reserved status
 */
async function updateReservedStatus(tableId, userId, reserved) {
  await queryMySQL(
    'UPDATE tables SET reserved = ? WHERE id = ? AND user_id = ?',
    [reserved, tableId, userId]
  );
  
  return await findById(tableId, userId);
}

/**
 * Delete table
 */
async function deleteTable(tableId, userId) {
  await queryMySQL(
    'DELETE FROM tables WHERE id = ? AND user_id = ?',
    [tableId, userId]
  );
}

module.exports = {
  findById,
  findByBusiness,
  findAvailable,
  create,
  update,
  updateReservedStatus,
  deleteTable
};
