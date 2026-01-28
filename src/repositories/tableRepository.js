// Table Repository
// Data access layer for tables

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find table by ID
 * @param {string} tableId - Table ID
 * @param {string} ownerUserId - Optional owner user ID for validation
 * @param {string} businessId - Optional business ID for validation
 */
async function findById(tableId, ownerUserId = null, businessId = null) {
  let sql = 'SELECT * FROM tables WHERE id = ?';
  const params = [tableId];
  
  if (ownerUserId) {
    sql += ' AND owner_user_id = ?';
    params.push(ownerUserId);
  }
  
  if (businessId) {
    sql += ' AND business_id = ?';
    params.push(businessId);
  }
  
  const tables = await queryMySQL(sql, params);
  return tables[0] || null;
}

/**
 * Find tables by business/user
 * @param {string} ownerUserId - Owner user ID (branch user or business user)
 * @param {string} businessId - Optional business ID for filtering
 * @param {boolean} includeInactive - Include inactive tables
 * @param {string} date - Optional date (YYYY-MM-DD) to include reservation status
 */
async function findByBusiness(ownerUserId, businessId = null, includeInactive = false, date = null) {
  // Check which columns exist in tables table
  let hasOwnerUserId = false;
  let hasTableNumber = false;
  let hasBusinessId = false;
  let hasIsActive = false;
  
  try {
    const tableColumns = await queryMySQL(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tables'
    `);
    if (Array.isArray(tableColumns)) {
      const columnNames = tableColumns.map(c => c.COLUMN_NAME || c.column_name);
      hasOwnerUserId = columnNames.includes('owner_user_id');
      hasTableNumber = columnNames.includes('table_number');
      hasBusinessId = columnNames.includes('business_id');
      hasIsActive = columnNames.includes('is_active');
    }
  } catch (err) {
    console.warn('Could not check tables columns:', err.message);
    // Fallback: assume old schema
    hasOwnerUserId = false;
    hasTableNumber = false;
    hasBusinessId = false;
    hasIsActive = false;
  }

  // Check if reservation_type column exists
  let reservationTypeFilter = '';
  try {
    const columns = await queryMySQL(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'reservations' 
      AND COLUMN_NAME = 'reservation_type'
    `);
    if (Array.isArray(columns) && columns.length > 0) {
      reservationTypeFilter = "AND r.reservation_type = 'table'";
    }
  } catch (err) {
    console.warn('Could not check for reservation_type column:', err.message);
  }

  // Use appropriate column names based on what exists
  const ownerColumn = hasOwnerUserId ? 't.owner_user_id' : 't.user_id';
  const tableNumberColumn = hasTableNumber ? 't.table_number' : 't.number';
  const businessColumn = hasBusinessId ? 't.business_id' : null;
  const activeColumn = hasIsActive ? 't.is_active' : 't.reserved';

  let sql = `
    SELECT 
      t.*,
      CASE 
        WHEN ? IS NOT NULL THEN (
          SELECT COUNT(*) 
          FROM reservations r 
          WHERE r.table_id = t.id 
          AND r.reservation_date = ?
          AND r.status = 'confirmed'
          ${reservationTypeFilter}
        )
        ELSE 0
      END as reservation_count,
      CASE 
        WHEN ? IS NOT NULL THEN (
          SELECT GROUP_CONCAT(
            CONCAT(r.reservation_time, ':', r.id, ':', COALESCE(r.customer_name, ''), ':', COALESCE(r.number_of_guests, ''))
            ORDER BY r.reservation_time
            SEPARATOR '|'
          )
          FROM reservations r 
          WHERE r.table_id = t.id 
          AND r.reservation_date = ?
          AND r.status = 'confirmed'
          ${reservationTypeFilter}
        )
        ELSE NULL
      END as reservations_data
    FROM tables t
    WHERE ${ownerColumn} = ?
  `;
  const params = [date, date, date, date, ownerUserId];
  
  if (businessId && businessColumn) {
    sql += ` AND ${businessColumn} = ?`;
    params.push(businessId);
  }
  
  if (!includeInactive) {
    if (hasIsActive) {
      sql += ' AND t.is_active = true';
    } else {
      sql += ' AND t.reserved = false';
    }
  }
  
  sql += ` ORDER BY ${tableNumberColumn} ASC`;
  
  const tables = await queryMySQL(sql, params);
  
  // Parse reservations data into structured format and normalize column names
  return tables.map(table => {
    const result = { ...table };
    
    // Normalize column names for backward compatibility
    if (!result.owner_user_id && result.user_id) {
      result.owner_user_id = result.user_id;
    }
    if (!result.table_number && result.number) {
      result.table_number = result.number;
    }
    if (!result.min_seats && result.seats) {
      result.min_seats = result.seats;
      result.max_seats = result.seats;
    }
    if (!result.business_id && result.owner_user_id) {
      result.business_id = result.owner_user_id;
    }
    if (result.is_active === undefined && result.reserved !== undefined) {
      result.is_active = !result.reserved;
    }
    
    // Add reservation_status for frontend compatibility
    if (table.reservations_data) {
      const reservations = table.reservations_data.split('|').map(resStr => {
        const [time, id, customerName, numberOfGuests] = resStr.split(':');
        return {
          id,
          time,
          customerName: customerName || null,
          numberOfGuests: numberOfGuests ? parseInt(numberOfGuests) : null
        };
      });
      result.reservations = reservations;
      result.isReserved = reservations.length > 0;
      result.reservation_status = reservations.length > 0 ? 'reserved' : 'available';
    } else {
      result.reservations = [];
      result.isReserved = false;
      result.reservation_status = 'available';
    }
    
    // Remove raw reservations_data field
    delete result.reservations_data;
    
    return result;
  });
}

/**
 * Find available tables (active and not reserved at specific slot)
 * @param {string} ownerUserId - Owner user ID
 * @param {Date} date - Optional date to check availability
 * @param {string} time - Optional time to check availability
 */
async function findAvailable(ownerUserId, date = null, time = null) {
  let sql = `
    SELECT t.* 
    FROM tables t
    WHERE t.owner_user_id = ? 
    AND t.is_active = true
  `;
  const params = [ownerUserId];
  
  // If date and time provided, exclude tables with confirmed reservations at that slot
  if (date && time) {
    sql += `
      AND t.id NOT IN (
        SELECT r.table_id 
        FROM reservations r 
        WHERE r.table_id IS NOT NULL
        AND r.reservation_date = ?
        AND r.reservation_time = ?
        AND r.status = 'confirmed'
        AND r.reservation_type = 'table'
      )
    `;
    params.push(date, time);
  }
  
  sql += ' ORDER BY t.table_number ASC';
  
  return await queryMySQL(sql, params);
}

/**
 * Find available tables for a specific slot (excludes tables with confirmed reservations)
 * @param {string} ownerUserId - Owner user ID
 * @param {string} date - Reservation date (YYYY-MM-DD)
 * @param {string} time - Reservation time (HH:MM)
 * @param {number} numberOfGuests - Optional number of guests (filters by min_seats <= guests <= max_seats)
 * @param {string} positionPreference - Optional position preference (matches position_label)
 */
async function findAvailableForSlot(ownerUserId, date, time, numberOfGuests = null, positionPreference = null) {
  // Check which columns exist in tables table
  let hasOwnerUserId = false;
  let hasTableNumber = false;
  let hasIsActive = false;
  let hasMinSeats = false;
  let hasMaxSeats = false;
  
  try {
    const tableColumns = await queryMySQL(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tables'
      AND COLUMN_NAME IN ('owner_user_id', 'table_number', 'is_active', 'min_seats', 'max_seats')
    `);
    if (Array.isArray(tableColumns)) {
      const columnNames = tableColumns.map(c => c.COLUMN_NAME || c.column_name);
      hasOwnerUserId = columnNames.includes('owner_user_id');
      hasTableNumber = columnNames.includes('table_number');
      hasIsActive = columnNames.includes('is_active');
      hasMinSeats = columnNames.includes('min_seats');
      hasMaxSeats = columnNames.includes('max_seats');
    }
  } catch (err) {
    console.warn('Could not check tables columns:', err.message);
  }

  // Use appropriate column names based on what exists
  const ownerColumn = hasOwnerUserId ? 't.owner_user_id' : 't.user_id';
  const tableNumberColumn = hasTableNumber ? 't.table_number' : 't.number';
  const minSeatsColumn = hasMinSeats ? 't.min_seats' : 't.seats';
  const maxSeatsColumn = hasMaxSeats ? 't.max_seats' : 't.seats';
  
  // Build active status filter (is_active = true OR reserved = false)
  let activeFilter = '';
  if (hasIsActive) {
    activeFilter = 'AND t.is_active = true';
  } else {
    // Old schema: reserved = false means active
    activeFilter = 'AND (t.reserved = false OR t.reserved IS NULL)';
  }
  
  // Normalize time format (ensure HH:MM format, handle HH:MM:SS from database)
  // If time is in HH:MM:SS format, truncate to HH:MM for comparison
  const normalizedTime = time.length === 5 ? time : time.substring(0, 5);
  
  let sql = `
    SELECT t.* 
    FROM tables t
    WHERE ${ownerColumn} = ? 
    ${activeFilter}
    AND t.id NOT IN (
      SELECT r.table_id 
      FROM reservations r 
      WHERE r.table_id IS NOT NULL
      AND r.reservation_date = ?
      AND TIME_FORMAT(r.reservation_time, '%H:%i') = ?
      AND r.status = 'confirmed'
      AND r.reservation_type = 'table'
    )
  `;
  const params = [ownerUserId, date, normalizedTime];
  
  // Filter by guest count if provided
  if (numberOfGuests) {
    // If using old schema (only seats), check seats >= numberOfGuests
    // If using new schema (min_seats and max_seats), check min_seats <= numberOfGuests <= max_seats
    if (hasMinSeats && hasMaxSeats) {
      sql += ` AND ${minSeatsColumn} <= ? AND ${maxSeatsColumn} >= ?`;
      params.push(numberOfGuests, numberOfGuests);
    } else {
      // Old schema: just check if seats >= numberOfGuests
      sql += ` AND ${maxSeatsColumn} >= ?`;
      params.push(numberOfGuests);
    }
  }
  
  // Filter by position preference if provided
  if (positionPreference) {
    sql += ' AND LOWER(t.position_label) LIKE ?';
    params.push(`%${positionPreference.toLowerCase()}%`);
  }
  
  sql += ` ORDER BY ${tableNumberColumn} ASC`;
  
  return await queryMySQL(sql, params);
}

/**
 * Create table
 * @param {Object} tableData - Table data
 * @param {string} tableData.businessId - Business ID
 * @param {string} tableData.ownerUserId - Owner user ID (branch or business user)
 * @param {string} tableData.tableNumber - Table number
 * @param {number} tableData.minSeats - Minimum seats
 * @param {number} tableData.maxSeats - Maximum seats
 * @param {string} tableData.positionLabel - Optional position label
 * @param {string} tableData.positionNotes - Optional position notes
 * @param {boolean} tableData.isActive - Active status (default: true)
 */
async function create(tableData) {
  const tableId = generateUUID();
  
  // Support both old and new field names for backward compatibility
  const businessId = tableData.businessId || tableData.business_id;
  const ownerUserId = tableData.ownerUserId || tableData.owner_user_id || tableData.userId;
  const tableNumber = tableData.tableNumber || tableData.table_number || tableData.number;
  const minSeats = tableData.minSeats || tableData.min_seats || tableData.seats || 1;
  const maxSeats = tableData.maxSeats || tableData.max_seats || tableData.seats || 1;
  const positionLabel = tableData.positionLabel || tableData.position_label || tableData.label || null;
  const positionNotes = tableData.positionNotes || tableData.position_notes || null;
  const isActive = tableData.isActive !== undefined ? tableData.isActive : (tableData.is_active !== undefined ? tableData.is_active : true);
  
  // Get business_id from owner_user_id if not provided
  let finalBusinessId = businessId;
  if (!finalBusinessId && ownerUserId) {
    const [users] = await queryMySQL(
      'SELECT COALESCE(parent_user_id, id) as business_id FROM users WHERE id = ?',
      [ownerUserId]
    );
    if (users && users.length > 0) {
      finalBusinessId = users[0].business_id;
    }
  }
  
  await queryMySQL(`
    INSERT INTO tables (
      id, business_id, owner_user_id, table_number, 
      min_seats, max_seats, position_label, position_notes, 
      is_active, user_id, seats, number, label
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    tableId,
    finalBusinessId,
    ownerUserId,
    tableNumber,
    minSeats,
    maxSeats,
    positionLabel,
    positionNotes,
    isActive,
    ownerUserId, // Keep user_id for backward compatibility
    maxSeats, // Keep seats for backward compatibility (use max_seats)
    tableNumber, // Keep number for backward compatibility
    positionLabel // Keep label for backward compatibility
  ]);
  
  return await findById(tableId);
}

/**
 * Update table
 * @param {string} tableId - Table ID
 * @param {string} ownerUserId - Owner user ID for validation
 * @param {Object} updateData - Update data
 */
async function update(tableId, ownerUserId, updateData) {
  const fieldMap = {
    tableNumber: 'table_number',
    table_number: 'table_number',
    number: 'table_number', // Backward compatibility
    minSeats: 'min_seats',
    min_seats: 'min_seats',
    maxSeats: 'max_seats',
    max_seats: 'max_seats',
    seats: 'max_seats', // Backward compatibility - update max_seats
    positionLabel: 'position_label',
    position_label: 'position_label',
    label: 'position_label', // Backward compatibility
    positionNotes: 'position_notes',
    position_notes: 'position_notes',
    isActive: 'is_active',
    is_active: 'is_active'
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
  
  // If updating seats (old field), also update max_seats
  if (updateData.seats !== undefined && !updateData.maxSeats && !updateData.max_seats) {
    updates.push('max_seats = ?');
    values.push(updateData.seats);
    // Also update min_seats if not explicitly set
    if (!updateData.minSeats && !updateData.min_seats) {
      updates.push('min_seats = ?');
      values.push(updateData.seats);
    }
  }
  
  // If updating number (old field), also update table_number
  if (updateData.number !== undefined && !updateData.tableNumber && !updateData.table_number) {
    updates.push('table_number = ?');
    values.push(updateData.number);
  }
  
  // If updating label (old field), also update position_label
  if (updateData.label !== undefined && !updateData.positionLabel && !updateData.position_label) {
    updates.push('position_label = ?');
    values.push(updateData.label);
  }
  
  if (updates.length === 0) {
    return await findById(tableId, ownerUserId);
  }
  
  values.push(tableId, ownerUserId);
  
  await queryMySQL(
    `UPDATE tables SET ${updates.join(', ')} WHERE id = ? AND owner_user_id = ?`,
    values
  );
  
  return await findById(tableId, ownerUserId);
}

/**
 * Update reserved status (DEPRECATED - use reservation-based logic)
 * Kept for backward compatibility but does nothing
 */
async function updateReservedStatus(tableId, userId, reserved) {
  // Deprecated - reserved status is now derived from reservations
  // Keep method for backward compatibility but it's a no-op
  return await findById(tableId, userId);
}

/**
 * Delete table (soft delete by setting is_active = false)
 * @param {string} tableId - Table ID
 * @param {string} ownerUserId - Owner user ID for validation
 */
async function deleteTable(tableId, ownerUserId) {
  // Soft delete by setting is_active = false
  await queryMySQL(
    'UPDATE tables SET is_active = false WHERE id = ? AND owner_user_id = ?',
    [tableId, ownerUserId]
  );
  
  return await findById(tableId, ownerUserId);
}

module.exports = {
  findById,
  findByBusiness,
  findAvailable,
  findAvailableForSlot,
  create,
  update,
  updateReservedStatus,
  deleteTable
};
