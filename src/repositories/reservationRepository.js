// Reservation Repository
// Data access layer for reservations

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find reservation by ID
 */
async function findById(reservationId, businessUserId = null) {
  let sql = 'SELECT * FROM reservations WHERE id = ?';
  const params = [reservationId];
  
  if (businessUserId) {
    sql += ' AND business_user_id = ?';
    params.push(businessUserId);
  }
  
  const reservations = await queryMySQL(sql, params);
  return reservations[0] || null;
}

/**
 * Find reservations by business
 */
async function findByBusiness(businessUserId, filters = {}) {
  let sql = 'SELECT * FROM reservations WHERE business_user_id = ?';
  const params = [businessUserId];
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters.reservationDate) {
    sql += ' AND reservation_date = ?';
    params.push(filters.reservationDate);
  }
  
  if (filters.tableId) {
    sql += ' AND table_id = ?';
    params.push(filters.tableId);
  }
  
  if (filters.startDate) {
    sql += ' AND reservation_date >= ?';
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    sql += ' AND reservation_date <= ?';
    params.push(filters.endDate);
  }
  
  sql += ' ORDER BY reservation_date ASC, reservation_time ASC';
  
  // LIMIT cannot be a parameter in prepared statements, must use string interpolation
  if (filters.limit) {
    const limit = parseInt(filters.limit);
    sql += ` LIMIT ${limit}`;
  }
  
  return await queryMySQL(sql, params);
}

/**
 * Find reservations by date
 */
async function findByDate(businessUserId, date) {
  return await queryMySQL(
    'SELECT * FROM reservations WHERE business_user_id = ? AND reservation_date = ? ORDER BY reservation_time ASC',
    [businessUserId, date]
  );
}

/**
 * Find reservations by table
 */
async function findByTable(tableId, date = null) {
  let sql = 'SELECT * FROM reservations WHERE table_id = ?';
  const params = [tableId];
  
  if (date) {
    sql += ' AND reservation_date = ?';
    params.push(date);
  }
  
  sql += ' ORDER BY reservation_date ASC, reservation_time ASC';
  
  return await queryMySQL(sql, params);
}

/**
 * Create reservation
 */
async function create(reservationData) {
  const reservationId = generateUUID();
  
  await queryMySQL(`
    INSERT INTO reservations (
      id, user_id, business_user_id, table_id, item_id,
      customer_phone_number, customer_name,
      reservation_date, reservation_time, number_of_guests, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    reservationId,
    reservationData.userId || null,
    reservationData.businessUserId,
    reservationData.tableId || null,
    reservationData.itemId || null,
    reservationData.customerPhoneNumber,
    reservationData.customerName,
    reservationData.reservationDate,
    reservationData.reservationTime,
    reservationData.numberOfGuests || null,
    reservationData.notes || null,
    reservationData.status || 'confirmed'
  ]);
  
  // If table is assigned, mark it as reserved
  if (reservationData.tableId) {
    const tableRepo = require('./tableRepository');
    await tableRepo.updateReservedStatus(reservationData.tableId, reservationData.businessUserId, true);
  }
  
  return await findById(reservationId);
}

/**
 * Update reservation
 */
async function update(reservationId, businessUserId, updateData) {
  const fieldMap = {
    tableId: 'table_id',
    itemId: 'item_id',
    customerPhoneNumber: 'customer_phone_number',
    customerName: 'customer_name',
    reservationDate: 'reservation_date',
    reservationTime: 'reservation_time',
    numberOfGuests: 'number_of_guests',
    notes: 'notes',
    status: 'status'
  };
  
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get current reservation to check table changes
    const current = await findById(reservationId, businessUserId);
    if (!current) {
      throw new Error('Reservation not found');
    }
    
    const updates = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = fieldMap[key];
      if (dbKey && value !== undefined) {
        updates.push(`${dbKey} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length > 0) {
      values.push(reservationId, businessUserId);
      
      await connection.query(
        `UPDATE reservations SET ${updates.join(', ')} WHERE id = ? AND business_user_id = ?`,
        values
      );
    }
    
    // Handle table reservation status
    if (updateData.tableId !== undefined) {
      const tableRepo = require('./tableRepository');
      
      // Release old table if changed
      if (current.table_id && current.table_id !== updateData.tableId) {
        await tableRepo.updateReservedStatus(current.table_id, businessUserId, false);
      }
      
      // Reserve new table if assigned
      if (updateData.tableId && updateData.tableId !== current.table_id) {
        await tableRepo.updateReservedStatus(updateData.tableId, businessUserId, true);
      }
    }
    
    // Handle status changes
    if (updateData.status === 'cancelled' || updateData.status === 'completed') {
      if (current.table_id) {
        const tableRepo = require('./tableRepository');
        await tableRepo.updateReservedStatus(current.table_id, businessUserId, false);
      }
    }
    
    await connection.commit();
    
    return await findById(reservationId, businessUserId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update reservation status
 */
async function updateStatus(reservationId, businessUserId, status) {
  return await update(reservationId, businessUserId, { status });
}

/**
 * Delete reservation (cancel)
 */
async function deleteReservation(reservationId, businessUserId) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get reservation to release table
    const reservation = await findById(reservationId, businessUserId);
    if (reservation && reservation.table_id) {
      const tableRepo = require('./tableRepository');
      await tableRepo.updateReservedStatus(reservation.table_id, businessUserId, false);
    }
    
    // Delete reservation
    await connection.query(
      'DELETE FROM reservations WHERE id = ? AND business_user_id = ?',
      [reservationId, businessUserId]
    );
    
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
  findByBusiness,
  findByDate,
  findByTable,
  create,
  update,
  updateStatus,
  deleteReservation
};
