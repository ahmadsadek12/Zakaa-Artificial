// Reservation Reminder Job Scheduler
// Schedules and runs the reservation reminder job
// Sends reminders when restaurant opens on reservation day

const cron = require('node-cron');
const { sendReservationReminders } = require('./sendReservationReminders');
const logger = require('../utils/logger');

let reminderCronJob = null;

/**
 * Start the reservation reminder job
 * Runs every day at 8:00 AM (adjust based on typical restaurant opening time)
 * Can be customized per business in the future
 */
function startReservationReminderJob() {
  if (reminderCronJob) {
    logger.info('Reservation reminder job already running');
    return;
  }
  
  // Run every day at 8:00 AM
  // Format: minute hour day month dayofweek
  const cronSchedule = '0 8 * * *'; // 8:00 AM every day
  
  logger.info('Starting reservation reminder job', { 
    cron: cronSchedule,
    description: 'Sends reminders for today\'s reservations at 8:00 AM'
  });
  
  reminderCronJob = cron.schedule(cronSchedule, async () => {
    try {
      logger.info('Running reservation reminder job...');
      const result = await sendReservationReminders();
      logger.info('Reservation reminder job completed', result);
    } catch (error) {
      logger.error('Error running reservation reminder job', { 
        error: error.message,
        stack: error.stack 
      });
    }
  });
  
  logger.info('Reservation reminder job scheduled successfully');
}

/**
 * Stop the reservation reminder job
 */
function stopReservationReminderJob() {
  if (reminderCronJob) {
    reminderCronJob.stop();
    reminderCronJob = null;
    logger.info('Reservation reminder job stopped');
  }
}

module.exports = {
  startReservationReminderJob,
  stopReservationReminderJob
};
