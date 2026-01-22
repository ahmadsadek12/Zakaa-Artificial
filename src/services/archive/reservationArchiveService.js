// Reservation Archive Service
// Archive completed/cancelled reservations from MySQL to MongoDB

const reservationRepository = require('../../repositories/reservationRepository');
const { getMongoCollection } = require('../../config/database');
const logger = require('../../utils/logger');
const { generateUUID } = require('../../utils/uuid');

/**
 * Archive reservation to MongoDB
 * @param {string} reservationId - Reservation ID
 */
async function archiveReservation(reservationId) {
  try {
    // Get reservation with full details
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      logger.warn(`Reservation ${reservationId} not found for archiving`);
      return null;
    }
    
    // Build reservation log document (matching order_logs style)
    const reservationLog = {
      _id: generateUUID(),
      reservation_id: reservation.id,
      business_id: reservation.business_user_id,
      owner_user_id: reservation.owner_user_id || reservation.user_id,
      table_id: reservation.table_id || null,
      customer_phone_number: reservation.customer_phone_number,
      customer_name: reservation.customer_name || null,
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      number_of_guests: reservation.number_of_guests || null,
      notes: reservation.notes || null,
      status: reservation.status,
      reservation_type: reservation.reservation_type || reservation.reservation_kind || 'table',
      source: reservation.source || 'whatsapp',
      platform: reservation.platform || reservation.source || 'whatsapp',
      // Table snapshots
      min_seats_snapshot: reservation.min_seats_snapshot || null,
      max_seats_snapshot: reservation.max_seats_snapshot || null,
      position_snapshot: reservation.position_snapshot || null,
      // Timestamps
      start_at: reservation.start_at || null,
      created_at: reservation.created_at,
      completed_at: reservation.completed_at || null,
      cancelled_at: reservation.cancelled_at || null,
      checked_in_at: reservation.checked_in_at || null,
      no_show: reservation.no_show || false,
      archived_at: new Date()
    };
    
    // Insert into MongoDB
    const reservationLogs = await getMongoCollection('reservation_logs');
    await reservationLogs.insertOne(reservationLog);
    
    logger.info(`Reservation ${reservationId} archived to MongoDB`);
    
    return reservationLog;
  } catch (error) {
    logger.error(`Error archiving reservation ${reservationId}:`, error);
    throw error;
  }
}

/**
 * Archive multiple reservations
 * @param {Array<string>} reservationIds - Array of reservation IDs
 */
async function archiveReservations(reservationIds) {
  const archived = [];
  const errors = [];
  
  for (const reservationId of reservationIds) {
    try {
      const reservationLog = await archiveReservation(reservationId);
      if (reservationLog) {
        archived.push(reservationLog);
      }
    } catch (error) {
      logger.error(`Error archiving reservation ${reservationId}:`, error);
      errors.push({ reservationId, error: error.message });
    }
  }
  
  return {
    archived,
    errors,
    total: reservationIds.length
  };
}

/**
 * Archive old completed/cancelled reservations
 * Archives reservations that are completed or cancelled and older than specified days
 * @param {number} olderThanDays - Archive reservations older than this many days (default: 30)
 */
async function archiveOldReservations(olderThanDays = 30) {
  try {
    const { queryMySQL, getMySQLConnection } = require('../../config/database');
    const connection = await getMySQLConnection();
    
    try {
      // Find reservations to archive
      const [reservations] = await connection.query(`
        SELECT id 
        FROM reservations 
        WHERE status IN ('completed', 'cancelled')
        AND (
          (completed_at IS NOT NULL AND completed_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
          OR (cancelled_at IS NOT NULL AND cancelled_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
          OR (status = 'completed' AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
          OR (status = 'cancelled' AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
        )
        LIMIT 100
      `, [olderThanDays, olderThanDays, olderThanDays, olderThanDays]);
      
      if (reservations.length === 0) {
        connection.release();
        return { archived: [], errors: [], total: 0 };
      }
      
      logger.info(`Found ${reservations.length} reservation(s) to archive`);
      
      const reservationIds = reservations.map(r => r.id);
      const result = await archiveReservations(reservationIds);
      
      // Delete archived reservations from MySQL
      if (result.archived.length > 0) {
        await connection.beginTransaction();
        
        try {
          const archivedIds = result.archived.map(a => a.reservation_id);
          await connection.query(
            `DELETE FROM reservations WHERE id IN (${archivedIds.map(() => '?').join(',')})`,
            archivedIds
          );
          
          await connection.commit();
          logger.info(`Deleted ${archivedIds.length} archived reservation(s) from MySQL`);
        } catch (error) {
          await connection.rollback();
          logger.error('Error deleting archived reservations from MySQL:', error);
          throw error;
        }
      }
      
      connection.release();
      
      return result;
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('Error archiving old reservations:', error);
    throw error;
  }
}

module.exports = {
  archiveReservation,
  archiveReservations,
  archiveOldReservations
};
