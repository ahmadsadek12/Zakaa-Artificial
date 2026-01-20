// Reservation Functions
// Functions for table reservations

const logger = require('../../../utils/logger');
const reservationRepository = require('../../../repositories/reservationRepository');
const tableRepository = require('../../../repositories/tableRepository');

/**
 * Get reservation function definitions for OpenAI
 */
function getReservationFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'create_table_reservation',
        description: 'Create a table reservation. Use this when customer wants to reserve a table for a specific time.',
        parameters: {
          type: 'object',
          properties: {
            tableId: {
              type: 'string',
              description: 'Table ID to reserve'
            },
            startAt: {
              type: 'string',
              description: 'Reservation start time (ISO 8601 format)'
            },
            customerName: {
              type: 'string',
              description: 'Customer name (optional)'
            },
            numberOfGuests: {
              type: 'number',
              description: 'Number of guests (optional)'
            },
            notes: {
              type: 'string',
              description: 'Additional notes (optional)'
            }
          },
          required: ['tableId', 'startAt']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'cancel_table_reservation',
        description: 'Cancel a table reservation. Use this when customer wants to cancel their reservation.',
        parameters: {
          type: 'object',
          properties: {
            reservationId: {
              type: 'string',
              description: 'Reservation ID to cancel'
            }
          },
          required: ['reservationId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_available_tables',
        description: 'List available tables for a specific time. Use this when customer wants to see what tables are available.',
        parameters: {
          type: 'object',
          properties: {
            startAt: {
              type: 'string',
              description: 'Start time to check availability (ISO 8601 format)'
            },
            durationMinutes: {
              type: 'number',
              description: 'Duration in minutes (default: 60)'
            }
          },
          required: ['startAt']
        }
      }
    }
  ];
}

/**
 * Execute reservation function
 */
async function executeReservationFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber } = context;
  const branchId = branch?.id || business.id;
  
  switch (functionName) {
    case 'create_table_reservation': {
      const { tableId, startAt, customerName, numberOfGuests, notes } = args;
      
      if (!tableId || !startAt) {
        return {
          success: false,
          error: 'Table ID and start time are required.'
        };
      }
      
      const reservation = await reservationRepository.create({
        businessUserId: business.id,
        tableId,
        startAt: new Date(startAt),
        customerPhoneNumber,
        customerName: customerName || null,
        numberOfGuests: numberOfGuests || null,
        notes: notes || null,
        reservationKind: 'table',
        source: 'whatsapp',
        status: 'confirmed'
      });
      
      return {
        success: true,
        message: `Table reservation confirmed for ${new Date(startAt).toLocaleString()}.`,
        reservation
      };
    }
    
    case 'cancel_table_reservation': {
      const { reservationId } = args;
      
      if (!reservationId) {
        return {
          success: false,
          error: 'Reservation ID is required.'
        };
      }
      
      await reservationRepository.updateStatus(reservationId, business.id, 'cancelled');
      
      return {
        success: true,
        message: 'Table reservation cancelled successfully.'
      };
    }
    
    case 'list_available_tables': {
      const { startAt, durationMinutes } = args;
      
      if (!startAt) {
        return {
          success: false,
          error: 'Start time is required.'
        };
      }
      
      const tables = await tableRepository.findAvailable(business.id, new Date(startAt), durationMinutes || 60);
      
      return {
        success: true,
        tables: tables.map(t => ({
          id: t.id,
          label: t.label || `Table ${t.table_number}`,
          capacity: t.capacity
        })),
        message: `Found ${tables.length} available table(s).`
      };
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getReservationFunctionDefinitions,
  executeReservationFunction
};
