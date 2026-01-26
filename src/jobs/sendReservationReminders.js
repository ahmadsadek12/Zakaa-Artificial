// Reservation Reminder Job
// Sends reminders to customers on the day of their reservation when restaurant opens

const { queryMySQL } = require('../config/database');
const { sendWhatsAppMessage } = require('../services/whatsapp/whatsappService');
const { sendMessage: sendTelegramMessage } = require('../services/telegram/telegramMessageSender');
const logger = require('../utils/logger');

/**
 * Send reservation reminders for today's reservations
 * Runs when restaurant opens each day
 */
async function sendReservationReminders() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    logger.info('Starting reservation reminder job', { date: today });
    
    // Get all confirmed reservations for today
    const reservations = await queryMySQL(
      `SELECT 
        r.id,
        r.customer_phone_number,
        r.customer_name,
        r.reservation_date,
        r.reservation_time,
        r.number_of_guests,
        r.platform,
        t.table_number,
        t.number as table_number_alt,
        u.business_name,
        u.contact_phone_number
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      JOIN users u ON r.business_user_id = u.id
      WHERE r.reservation_date = ?
        AND r.status = 'confirmed'
        AND r.reservation_type = 'table'
        AND r.reminder_sent = false
      ORDER BY r.reservation_time ASC`,
      [today]
    );
    
    if (!reservations || reservations.length === 0) {
      logger.info('No reservations found for today that need reminders');
      return { sent: 0, failed: 0 };
    }
    
    logger.info(`Found ${reservations.length} reservation(s) to send reminders for`);
    
    let sent = 0;
    let failed = 0;
    
    for (const reservation of reservations) {
      try {
        const reservationNumber = reservation.id.substring(0, 8).toUpperCase();
        const tableNumber = reservation.table_number || reservation.table_number_alt || 'your table';
        const customerName = reservation.customer_name || 'valued guest';
        const guests = reservation.number_of_guests ? `for ${reservation.number_of_guests} ${reservation.number_of_guests === 1 ? 'guest' : 'guests'}` : '';
        
        // Build reminder message
        const message = `🔔 Reservation Reminder

Hello ${customerName}! 👋

This is a friendly reminder about your table reservation at ${reservation.business_name} today.

📋 Reservation #${reservationNumber}
⏰ Time: ${reservation.reservation_time}
🪑 Table: ${tableNumber}
${guests ? `👥 Guests: ${reservation.number_of_guests}\n` : ''}
We look forward to welcoming you! If you need to make any changes, please contact us at ${reservation.contact_phone_number || 'the restaurant'}.

See you soon! ✨`;
        
        // Send based on platform
        if (reservation.platform === 'telegram') {
          const chatId = reservation.customer_phone_number.replace('telegram:', '');
          await sendTelegramMessage({ chatId, message });
        } else if (reservation.platform === 'whatsapp') {
          await sendWhatsAppMessage(reservation.customer_phone_number, message);
        } else {
          // Default to WhatsApp
          await sendWhatsAppMessage(reservation.customer_phone_number, message);
        }
        
        // Mark reminder as sent
        await queryMySQL(
          'UPDATE reservations SET reminder_sent = true WHERE id = ?',
          [reservation.id]
        );
        
        sent++;
        logger.info('Reservation reminder sent successfully', {
          reservationId: reservation.id,
          customerPhone: reservation.customer_phone_number,
          platform: reservation.platform
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        failed++;
        logger.error('Failed to send reservation reminder', {
          reservationId: reservation.id,
          error: error.message
        });
      }
    }
    
    logger.info('Reservation reminder job completed', { sent, failed });
    return { sent, failed };
    
  } catch (error) {
    logger.error('Error in sendReservationReminders job', { error: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = {
  sendReservationReminders
};
