// Opening Hours Repository
// Data access layer for opening hours

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Find opening hours by owner
 */
async function findByOwner(ownerType, ownerId) {
  return await queryMySQL(
    'SELECT * FROM opening_hours WHERE owner_type = ? AND owner_id = ? ORDER BY day_of_week',
    [ownerType, ownerId]
  );
}

/**
 * Create or update opening hours for owner
 */
async function upsert(ownerType, ownerId, hoursData) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Delete existing hours
    await connection.query(
      'DELETE FROM opening_hours WHERE owner_type = ? AND owner_id = ?',
      [ownerType, ownerId]
    );
    
    // Insert new hours
    for (const day of DAYS_OF_WEEK) {
      const dayData = hoursData[day];
      if (dayData) {
        const id = generateUUID();
        await connection.query(`
          INSERT INTO opening_hours (id, owner_type, owner_id, day_of_week, open_time, close_time, is_closed)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          ownerType,
          ownerId,
          day,
          dayData.open || null,
          dayData.close || null,
          dayData.closed === true || dayData.isClosed === true
        ]);
      }
    }
    
    await connection.commit();
    
    return await findByOwner(ownerType, ownerId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Delete opening hours for owner
 */
async function deleteByOwner(ownerType, ownerId) {
  await queryMySQL(
    'DELETE FROM opening_hours WHERE owner_type = ? AND owner_id = ?',
    [ownerType, ownerId]
  );
}

module.exports = {
  findByOwner,
  upsert,
  deleteByOwner
};
