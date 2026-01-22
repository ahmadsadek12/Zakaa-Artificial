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
  
  if (filters.ownerUserId) {
    sql += ' AND owner_user_id = ?';
    params.push(filters.ownerUserId);
  }
  
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
    sql += ' AND (reservation_date >= ? OR start_at >= ?)';
    params.push(filters.startDate, filters.startDate);
  }
  
  if (filters.endDate) {
    sql += ' AND (reservation_date <= ? OR start_at <= ?)';
    params.push(filters.endDate, filters.endDate);
  }
  
  if (filters.reservationKind) {
    sql += ' AND reservation_kind = ?';
    params.push(filters.reservationKind);
  }
  
  if (filters.reservationType) {
    sql += ' AND reservation_type = ?';
    params.push(filters.reservationType);
  }
  
  if (filters.type) {
    sql += ' AND reservation_type = ?';
    params.push(filters.type);
  }
  
  if (filters.from) {
    sql += ' AND start_at >= ?';
    params.push(filters.from);
  }
  
  if (filters.to) {
    sql += ' AND start_at <= ?';
    params.push(filters.to);
  }
  
  sql += ' ORDER BY COALESCE(start_at, CONCAT(reservation_date, " ", reservation_time)) ASC';
  
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
 * Find reservation by table, date, and time (for double-booking check)
 * @param {string} tableId - Table ID
 * @param {string} date - Reservation date (YYYY-MM-DD)
 * @param {string} time - Reservation time (HH:MM)
 * @param {string} excludeReservationId - Optional reservation ID to exclude from check
 */
async function findByTableAndDateTime(tableId, date, time, excludeReservationId = null) {
  let sql = `
    SELECT * FROM reservations 
    WHERE table_id = ? 
    AND reservation_date = ? 
    AND reservation_time = ?
    AND status = 'confirmed'
    AND reservation_type = 'table'
  `;
  const params = [tableId, date, time];
  
  if (excludeReservationId) {
    sql += ' AND id != ?';
    params.push(excludeReservationId);
  }
  
  sql += ' LIMIT 1';
  
  const reservations = await queryMySQL(sql, params);
  return reservations[0] || null;
}

/**
 * Create reservation
 * @param {Object} reservationData - Reservation data
 */
async function create(reservationData) {
  const reservationId = generateUUID();
  
  // Calculate start_at from reservation_date + reservation_time if not provided
  let startAt = reservationData.startAt;
  if (!startAt && reservationData.reservationDate && reservationData.reservationTime) {
    startAt = `${reservationData.reservationDate} ${reservationData.reservationTime}`;
  }
  
  // Determine owner_user_id
  const ownerUserId = reservationData.ownerUserId || reservationData.userId || reservationData.businessUserId;
  
  // Determine reservation_type
  const reservationType = reservationData.reservationType || 
                          (reservationData.reservationKind === 'appointment' ? 'appointment' : 
                           reservationData.reservationKind === 'table' ? 'table' : 'table');
  
  // Determine platform from source
  const platform = reservationData.platform || reservationData.source || 'whatsapp';
  
  // Snapshot table details if table_id is provided
  let minSeatsSnapshot = reservationData.minSeatsSnapshot || reservationData.min_seats_snapshot || null;
  let maxSeatsSnapshot = reservationData.maxSeatsSnapshot || reservationData.max_seats_snapshot || null;
  let positionSnapshot = reservationData.positionSnapshot || reservationData.position_snapshot || null;
  
  if (reservationData.tableId && (!minSeatsSnapshot || !maxSeatsSnapshot)) {
    const tableRepo = require('./tableRepository');
    const table = await tableRepo.findById(reservationData.tableId);
    if (table) {
      minSeatsSnapshot = minSeatsSnapshot || table.min_seats || table.seats;
      maxSeatsSnapshot = maxSeatsSnapshot || table.max_seats || table.seats;
      positionSnapshot = positionSnapshot || table.position_label || table.label;
    }
  }
  
  // Prevent double-booking: check for existing confirmed reservation at same table/date/time
  if (reservationData.tableId && reservationData.reservationDate && reservationData.reservationTime) {
    const existing = await findByTableAndDateTime(
      reservationData.tableId,
      reservationData.reservationDate,
      reservationData.reservationTime
    );
    
    if (existing) {
      throw new Error('Table is already reserved at this date and time');
    }
  }
  
  await queryMySQL(`
    INSERT INTO reservations (
      id, user_id, business_user_id, owner_user_id, table_id, item_id,
      customer_phone_number, customer_name,
      reservation_date, reservation_time, number_of_guests, notes, status,
      reservation_kind, reservation_type, start_at, source, platform,
      min_seats_snapshot, max_seats_snapshot, position_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    reservationId,
    reservationData.userId || null,
    reservationData.businessUserId,
    ownerUserId,
    reservationData.tableId || null,
    reservationData.itemId || null,
    reservationData.customerPhoneNumber,
    reservationData.customerName,
    reservationData.reservationDate,
    reservationData.reservationTime,
    reservationData.numberOfGuests || null,
    reservationData.notes || null,
    reservationData.status || 'confirmed',
    reservationData.reservationKind || 'table',
    reservationType,
    startAt || null,
    reservationData.source || 'whatsapp',
    platform,
    minSeatsSnapshot,
    maxSeatsSnapshot,
    positionSnapshot
  ]);
  
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
    status: 'status',
    reservationKind: 'reservation_kind',
    reservationType: 'reservation_type',
    startAt: 'start_at',
    source: 'source',
    platform: 'platform',
    ownerUserId: 'owner_user_id'
  };
  
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get current reservation to check table changes
    const current = await findById(reservationId, businessUserId);
    if (!current) {
      throw new Error('Reservation not found');
    }
    
    // Prevent double-booking if updating table/date/time
    if ((updateData.tableId || updateData.reservationDate || updateData.reservationTime) && 
        reservationId && current.reservation_type === 'table') {
      const checkTableId = updateData.tableId || current.table_id;
      const checkDate = updateData.reservationDate || current.reservation_date;
      const checkTime = updateData.reservationTime || current.reservation_time;
      
      if (checkTableId && checkDate && checkTime) {
        const existing = await findByTableAndDateTime(checkTableId, checkDate, checkTime, reservationId);
        if (existing) {
          throw new Error('Table is already reserved at this date and time');
        }
      }
    }
    
    const updates = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = fieldMap[key];
      if (dbKey && value !== undefined) {
        // If updating reservation_date or reservation_time, recalculate start_at
        if (key === 'reservationDate' || key === 'reservationTime') {
          // Will be handled after this loop
        } else {
          updates.push(`${dbKey} = ?`);
          values.push(value);
        }
      }
    }
    
    // Recalculate start_at if date or time changed
    if (updateData.reservationDate !== undefined || updateData.reservationTime !== undefined) {
      const newDate = updateData.reservationDate || current.reservation_date;
      const newTime = updateData.reservationTime || current.reservation_time;
      if (newDate && newTime) {
        updates.push('start_at = ?');
        values.push(`${newDate} ${newTime}`);
      }
    }
    
    // Handle status changes - set timestamps
    if (updateData.status === 'completed' && current.status !== 'completed') {
      updates.push('completed_at = NOW()');
    }
    
    if (updateData.status === 'cancelled' && current.status !== 'cancelled') {
      updates.push('cancelled_at = NOW()');
    }
    
    if (updates.length > 0) {
      values.push(reservationId, businessUserId);
      
      await connection.query(
        `UPDATE reservations SET ${updates.join(', ')} WHERE id = ? AND business_user_id = ?`,
        values
      );
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
 * @param {string} reservationId - Reservation ID
 * @param {string} businessUserId - Business user ID
 * @param {string} status - New status ('confirmed', 'cancelled', 'completed', 'no_show')
 */
async function updateStatus(reservationId, businessUserId, status) {
  const updateData = { status };
  
  // Set appropriate timestamps based on status
  if (status === 'completed') {
    updateData.completed_at = new Date();
  } else if (status === 'cancelled') {
    updateData.cancelled_at = new Date();
  }
  
  return await update(reservationId, businessUserId, updateData);
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
  findByTableAndDateTime,
  create,
  update,
  updateStatus,
  deleteReservation
};
