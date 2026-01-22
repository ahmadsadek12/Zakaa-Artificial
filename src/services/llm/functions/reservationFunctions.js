// Reservation Functions
// Functions for table reservations

const logger = require('../../../utils/logger');
const reservationRepository = require('../../../repositories/reservationRepository');
const tableRepository = require('../../../repositories/tableRepository');
const addonRepository = require('../../../repositories/addonRepository');
const { queryMySQL } = require('../../../config/database');

/**
 * Get reservation function definitions for OpenAI
 */
function getReservationFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'get_tables',
        description: 'Get list of available tables. Use this to show customer available tables or to help select a table for reservation.',
        parameters: {
          type: 'object',
          properties: {
            ownerUserId: {
              type: 'string',
              description: 'Owner user ID (branch user ID if applicable, otherwise business user ID). Optional - will use current context if not provided.'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_table_reservation',
        description: 'Create a table reservation. Use this when customer wants to reserve a table for a specific date and time. If tableNumber is not provided, automatically selects the best available table based on number of guests and preferences.',
        parameters: {
          type: 'object',
          properties: {
            reservationDate: {
              type: 'string',
              description: 'Reservation date in YYYY-MM-DD format (required)'
            },
            reservationTime: {
              type: 'string',
              description: 'Reservation time in HH:MM format (required)'
            },
            numberOfGuests: {
              type: 'number',
              description: 'Number of guests (recommended for auto-selecting appropriate table)'
            },
            customerName: {
              type: 'string',
              description: 'Customer name (optional)'
            },
            notes: {
              type: 'string',
              description: 'Additional notes or special requests (optional)'
            },
            tableNumber: {
              type: 'string',
              description: 'Specific table number to reserve (optional - if not provided, system will auto-select best available table)'
            },
            positionPreference: {
              type: 'string',
              description: 'Position preference like "terrace", "inside", "window", "near bar" (optional - helps auto-select table)'
            }
          },
          required: ['reservationDate', 'reservationTime']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'cancel_table_reservation',
        description: 'Cancel a table reservation. Use this when customer wants to cancel their reservation. Can find reservation by ID, or by date and time if ID not provided.',
        parameters: {
          type: 'object',
          properties: {
            reservationId: {
              type: 'string',
              description: 'Reservation ID to cancel (optional if date and time provided)'
            },
            reservationDate: {
              type: 'string',
              description: 'Reservation date in YYYY-MM-DD format (optional if reservationId provided)'
            },
            reservationTime: {
              type: 'string',
              description: 'Reservation time in HH:MM format (optional if reservationId provided)'
            }
          },
          required: []
        }
      }
    }
  ];
}

/**
 * Check if table reservations addon is active and business is F&B
 */
async function checkTableReservationsEligible(businessId) {
  try {
    // Check business type
    const [business] = await queryMySQL(
      `SELECT business_type FROM users WHERE id = ? AND user_type = 'business'`,
      [businessId]
    );
    
    if (!business || business.length === 0) {
      return { eligible: false, reason: 'Business not found' };
    }
    
    const businessType = business[0].business_type?.toLowerCase();
    if (businessType !== 'food and beverage' && businessType !== 'f & b' && businessType !== 'f&b') {
      return { eligible: false, reason: 'Table reservations are only available for Food & Beverage businesses' };
    }
    
    // Check if addon is active
    const isActive = await addonRepository.isAddonActive(businessId, 'table_reservations');
    if (!isActive) {
      return { eligible: false, reason: 'Table reservations are not enabled for this business' };
    }
    
    return { eligible: true };
  } catch (error) {
    logger.error('Error checking table reservations eligibility:', error);
    return { eligible: false, reason: 'Error checking eligibility' };
  }
}

/**
 * Execute reservation function
 */
async function executeReservationFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  const ownerUserId = branch?.id || business.id;
  
  // Determine platform from context (whatsapp, telegram, instagram, facebook)
  const platform = context.platform || 'whatsapp';
  const source = platform;
  
  // Check eligibility for table reservation functions
  if (functionName === 'get_tables' || functionName === 'create_table_reservation' || functionName === 'cancel_table_reservation') {
    const eligibility = await checkTableReservationsEligible(business.id);
    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason || 'Table reservations are not enabled for this business.'
      };
    }
  }
  
  switch (functionName) {
    case 'get_tables': {
      const { ownerUserId: requestedOwnerUserId } = args;
      const targetOwnerUserId = requestedOwnerUserId || ownerUserId;
      
      try {
        const tables = await tableRepository.findByBusiness(targetOwnerUserId, business.id, false);
        
        return {
          success: true,
          tables: tables.map(t => ({
            id: t.id,
            table_number: t.table_number || t.number,
            min_seats: t.min_seats || t.seats,
            max_seats: t.max_seats || t.seats,
            position_label: t.position_label || t.label,
            is_active: t.is_active
          })),
          message: `Found ${tables.length} active table(s).`
        };
      } catch (error) {
        logger.error('Error getting tables:', error);
        return {
          success: false,
          error: 'Failed to retrieve tables.'
        };
      }
    }
    
    case 'create_table_reservation': {
      const { reservationDate, reservationTime, numberOfGuests, customerName, notes, tableNumber, positionPreference } = args;
      
      if (!reservationDate || !reservationTime) {
        return {
          success: false,
          error: 'Reservation date and time are required.'
        };
      }
      
      try {
        let selectedTable = null;
        
        // If tableNumber provided, find that specific table
        if (tableNumber) {
          const tables = await tableRepository.findByBusiness(ownerUserId, business.id, false);
          selectedTable = tables.find(t => 
            (t.table_number || t.number || '').toLowerCase() === tableNumber.toLowerCase()
          );
          
          if (!selectedTable) {
            return {
              success: false,
              error: `Table "${tableNumber}" not found or is not active.`
            };
          }
          
          if (!selectedTable.is_active) {
            return {
              success: false,
              error: `Table "${tableNumber}" is not active.`
            };
          }
        } else {
          // Auto-select best fit table
          const availableTables = await tableRepository.findAvailableForSlot(
            ownerUserId,
            reservationDate,
            reservationTime,
            numberOfGuests || null,
            positionPreference || null
          );
          
          if (availableTables.length === 0) {
            return {
              success: false,
              error: 'No available tables found for the requested date and time.'
            };
          }
          
          // Select first available table (best fit based on filters)
          selectedTable = availableTables[0];
        }
        
        // Validate guest count fits table capacity
        if (numberOfGuests) {
          const minSeats = selectedTable.min_seats || selectedTable.seats || 1;
          const maxSeats = selectedTable.max_seats || selectedTable.seats || 1;
          
          if (numberOfGuests < minSeats || numberOfGuests > maxSeats) {
            return {
              success: false,
              error: `Table "${selectedTable.table_number || selectedTable.number}" can accommodate ${minSeats}-${maxSeats} guests, but ${numberOfGuests} guests were requested.`
            };
          }
        }
        
        // Create reservation
        const reservation = await reservationRepository.create({
          businessUserId: business.id,
          ownerUserId: ownerUserId,
          tableId: selectedTable.id,
          customerPhoneNumber,
          customerName: customerName || null,
          reservationDate,
          reservationTime,
          numberOfGuests: numberOfGuests || null,
          notes: notes || null,
          reservationType: 'table',
          reservationKind: 'table',
          source: source,
          platform: platform,
          status: 'confirmed'
        });
        
        const tableDisplayName = selectedTable.table_number || selectedTable.number || 'selected table';
        
        return {
          success: true,
          message: `Table reservation confirmed for ${reservationDate} at ${reservationTime} at ${tableDisplayName}.`,
          reservation: {
            id: reservation.id,
            table_number: tableDisplayName,
            reservation_date: reservationDate,
            reservation_time: reservationTime,
            number_of_guests: numberOfGuests || null
          }
        };
      } catch (error) {
        logger.error('Error creating table reservation:', error);
        
        if (error.message.includes('already reserved')) {
          return {
            success: false,
            error: 'The selected table is already reserved at this date and time. Please choose a different time or table.'
          };
        }
        
        return {
          success: false,
          error: `Failed to create reservation: ${error.message}`
        };
      }
    }
    
    case 'cancel_table_reservation': {
      const { reservationId, reservationDate, reservationTime } = args;
      
      try {
        let reservation = null;
        
        if (reservationId) {
          // Find by ID
          reservation = await reservationRepository.findById(reservationId, business.id);
        } else if (reservationDate && reservationTime) {
          // Find by customer phone, date, and time
          const reservations = await reservationRepository.findByBusiness(business.id, {
            reservationDate,
            status: 'confirmed',
            reservationType: 'table'
          });
          
          // Filter by time and customer phone
          reservation = reservations.find(r => 
            r.reservation_time === reservationTime &&
            r.customer_phone_number === customerPhoneNumber
          );
        } else {
          // Find latest confirmed reservation for this customer
          const reservations = await reservationRepository.findByBusiness(business.id, {
            status: 'confirmed',
            reservationType: 'table'
          });
          
          reservation = reservations
            .filter(r => r.customer_phone_number === customerPhoneNumber)
            .sort((a, b) => {
              const dateA = new Date(`${a.reservation_date} ${a.reservation_time}`);
              const dateB = new Date(`${b.reservation_date} ${b.reservation_time}`);
              return dateB - dateA; // Most recent first
            })[0];
        }
        
        if (!reservation) {
          return {
            success: false,
            error: 'Reservation not found. Please provide reservation ID or date and time.'
          };
        }
        
        await reservationRepository.updateStatus(reservation.id, business.id, 'cancelled');
        
        return {
          success: true,
          message: 'Table reservation cancelled successfully.'
        };
      } catch (error) {
        logger.error('Error cancelling reservation:', error);
        return {
          success: false,
          error: `Failed to cancel reservation: ${error.message}`
        };
      }
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getReservationFunctionDefinitions,
  executeReservationFunction
};
