// Reservation Auto-Complete Job
// Automatically complete table reservations when reservation time passes

const cron = require('node-cron');
const { queryMySQL, getMySQLConnection } = require('../config/database');
const logger = require('../utils/logger');
const reservationRepository = require('../repositories/reservationRepository');

let reservationAutoCompleteJob = null;

/**
 * Auto-complete reservations that have passed their scheduled time
 */
async function autoCompleteReservations() {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Find reservations where:
    // - status = 'confirmed'
    // - reservation_type = 'table'
    // - reservation_datetime <= NOW()
    const [reservations] = await connection.query(`
      SELECT id, business_user_id, reservation_date, reservation_time, start_at
      FROM reservations
      WHERE status = 'confirmed'
      AND reservation_type = 'table'
      AND (
        (start_at IS NOT NULL AND start_at <= NOW())
        OR (start_at IS NULL AND CONCAT(reservation_date, ' ', reservation_time) <= NOW())
      )
    `);
    
    if (reservations.length === 0) {
      await connection.commit();
      return { completed: 0, errors: [] };
    }
    
    logger.info(`Found ${reservations.length} reservation(s) to auto-complete`);
    
    const errors = [];
    let completed = 0;
    
    for (const reservation of reservations) {
      try {
        await reservationRepository.updateStatus(
          reservation.id,
          reservation.business_user_id,
          'completed'
        );
        completed++;
      } catch (error) {
        logger.error(`Error auto-completing reservation ${reservation.id}:`, error);
        errors.push({ reservationId: reservation.id, error: error.message });
      }
    }
    
    await connection.commit();
    
    if (completed > 0) {
      logger.info(`Auto-completed ${completed} reservation(s)`);
    }
    
    if (errors.length > 0) {
      logger.warn(`Errors auto-completing ${errors.length} reservation(s):`, errors);
    }
    
    return { completed, errors };
  } catch (error) {
    await connection.rollback();
    logger.error('Error in auto-complete reservations job:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Start reservation auto-complete job
 */
function startReservationAutoCompleteJob() {
  if (reservationAutoCompleteJob) {
    logger.warn('Reservation auto-complete job already running');
    return;
  }
  
  // Run every 5 minutes
  const cronExpression = '*/5 * * * *';
  
  logger.info(`Starting reservation auto-complete job with cron: ${cronExpression}`);
  
  reservationAutoCompleteJob = cron.schedule(cronExpression, async () => {
    logger.debug('Reservation auto-complete job started');
    
    try {
      const result = await autoCompleteReservations();
      
      if (result.completed > 0) {
        logger.info('Reservation auto-complete job completed', {
          completed: result.completed,
          errors: result.errors.length
        });
      }
      
      if (result.errors.length > 0) {
        logger.error('Reservation auto-complete job errors:', result.errors);
      }
    } catch (error) {
      logger.error('Reservation auto-complete job failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Beirut'
  });
  
  logger.info('Reservation auto-complete job scheduled successfully');
}

/**
 * Stop reservation auto-complete job
 */
function stopReservationAutoCompleteJob() {
  if (reservationAutoCompleteJob) {
    reservationAutoCompleteJob.stop();
    reservationAutoCompleteJob = null;
    logger.info('Reservation auto-complete job stopped');
  }
}

module.exports = {
  startReservationAutoCompleteJob,
  stopReservationAutoCompleteJob,
  autoCompleteReservations
};
