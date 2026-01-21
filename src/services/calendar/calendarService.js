// Calendar Service
// Unified calendar for scheduled requests and reservations

const orderRepository = require('../../repositories/orderRepository');
const reservationRepository = require('../../repositories/reservationRepository');
const logger = require('../../utils/logger');

/**
 * Get unified calendar events (scheduled requests + reservations)
 * @param {string} businessId - Business ID
 * @param {string} from - Start date (ISO format: YYYY-MM-DD)
 * @param {string} to - End date (ISO format: YYYY-MM-DD)
 * @returns {Promise<Array>} Array of calendar events
 */
async function getCalendarEvents(businessId, from, to) {
  try {
    // Get scheduled requests (orders with request_type='scheduled_request')
    const scheduledRequests = await orderRepository.find({
      businessId,
      requestType: 'scheduled_request',
      scheduledForFrom: from ? `${from} 00:00:00` : null,
      scheduledForTo: to ? `${to} 23:59:59` : null
    });
    
    // Filter to only scheduled requests with scheduled_for in range (additional client-side filter)
    const filteredRequests = scheduledRequests.filter(order => {
      if (!order.scheduled_for) return false;
      const scheduledDate = new Date(order.scheduled_for);
      const fromDate = from ? new Date(from) : new Date(0);
      const toDate = to ? new Date(to + 'T23:59:59') : new Date('9999-12-31');
      return scheduledDate >= fromDate && scheduledDate <= toDate;
    });
    
    // Get reservations
    const reservations = await reservationRepository.findByBusiness(businessId, {
      from: from ? `${from} 00:00:00` : null,
      to: to ? `${to} 23:59:59` : null
    });
    
    // Transform scheduled requests to calendar events
    const requestEvents = filteredRequests.map(order => ({
      id: order.id,
      type: 'scheduled_request',
      title: `Scheduled Request - ${order.customer_phone_number}`,
      startAt: order.scheduled_for,
      endAt: order.scheduled_for, // Same as start for now
      customerPhoneNumber: order.customer_phone_number,
      status: order.status,
      total: parseFloat(order.total || 0),
      deliveryType: order.delivery_type,
      notes: order.notes
    }));
    
    // Transform reservations to calendar events
    const reservationEvents = reservations.map(reservation => {
      // Use start_at if available, otherwise combine reservation_date and reservation_time
      let startAt;
      if (reservation.start_at) {
        startAt = reservation.start_at;
      } else if (reservation.reservation_date && reservation.reservation_time) {
        startAt = `${reservation.reservation_date}T${reservation.reservation_time}:00`;
      } else {
        startAt = reservation.reservation_date || null;
      }
      
      // Calculate end time (default 2 hours for table reservations, 1 hour for appointments)
      let endAt = null;
      if (startAt) {
        const start = new Date(startAt);
        const durationHours = reservation.reservation_kind === 'appointment' ? 1 : 2;
        endAt = new Date(start.getTime() + durationHours * 60 * 60 * 1000).toISOString();
      }
      
      return {
        id: reservation.id,
        type: 'reservation',
        title: reservation.reservation_kind === 'table' 
          ? `Table Reservation - ${reservation.customer_name}`
          : `Appointment - ${reservation.customer_name}`,
        startAt: startAt,
        endAt: endAt,
        customerPhoneNumber: reservation.customer_phone_number,
        customerName: reservation.customer_name,
        status: reservation.status,
        reservationKind: reservation.reservation_kind,
        tableId: reservation.table_id,
        numberOfGuests: reservation.number_of_guests,
        notes: reservation.notes
      };
    });
    
    // Combine and sort by start time
    const allEvents = [...requestEvents, ...reservationEvents].sort((a, b) => {
      const dateA = new Date(a.startAt);
      const dateB = new Date(b.startAt);
      return dateA - dateB;
    });
    
    return allEvents;
  } catch (error) {
    logger.error('Error getting calendar events:', error);
    throw error;
  }
}

module.exports = {
  getCalendarEvents
};
