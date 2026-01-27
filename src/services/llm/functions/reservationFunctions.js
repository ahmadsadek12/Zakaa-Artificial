// Reservation Functions
// Functions for table reservations

const logger = require('../../../utils/logger');
const reservationRepository = require('../../../repositories/reservationRepository');
const tableRepository = require('../../../repositories/tableRepository');
const addonRepository = require('../../../repositories/addonRepository');
const itemRepository = require('../../../repositories/itemRepository');
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
        description: 'Create a table reservation. Use when customer wants to reserve a table. If customer specifies a table number/position (e.g., "table 5", "terrace table"), include it. Otherwise, system auto-selects best table based on guest count. IMPORTANT: Always ask for customer name before creating reservation.',
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
              description: 'Number of guests (HIGHLY RECOMMENDED for auto-selecting appropriate table)'
            },
            customerName: {
              type: 'string',
              description: 'Customer name (REQUIRED - ask customer for their name if not provided)'
            },
            notes: {
              type: 'string',
              description: 'Additional notes or special requests (optional)'
            },
            tableNumber: {
              type: 'string',
              description: 'Specific table number customer wants (e.g., "5", "T3"). Optional - if not provided, auto-selects best table.'
            },
            positionPreference: {
              type: 'string',
              description: 'Position preference: "terrace", "inside", "window", "near bar", "quiet corner" (helps auto-select table if no specific table requested)'
            }
          },
          required: ['reservationDate', 'reservationTime', 'customerName']
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
    },
    {
      type: 'function',
      function: {
        name: 'add_item_to_reservation',
        description: 'Add items to an existing table reservation. Use this when customer wants to pre-order items for their reservation (e.g., "add 2 pizzas to my reservation", "I want 3 burgers for my table reservation"). Only use this if customer has an existing confirmed reservation. If customer is making a new reservation AND wants to add items, first create the reservation, then add items.',
        parameters: {
          type: 'object',
          properties: {
            reservationId: {
              type: 'string',
              description: 'Reservation ID (optional if date and time provided)'
            },
            reservationDate: {
              type: 'string',
              description: 'Reservation date in YYYY-MM-DD format (optional if reservationId provided)'
            },
            reservationTime: {
              type: 'string',
              description: 'Reservation time in HH:MM format (optional if reservationId provided)'
            },
            itemName: {
              type: 'string',
              description: 'Name of the item to add (e.g., "pizza", "burger", "trio")'
            },
            quantity: {
              type: 'number',
              description: 'Quantity of the item (default: 1). Parse from customer message - "3 pizzas" means quantity=3, itemName="pizza"'
            },
            notes: {
              type: 'string',
              description: 'Special notes or modifications for this item (optional)'
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'remove_item_from_reservation',
        description: 'Remove an item from a table reservation. Use this when customer wants to remove items they previously added to their reservation.',
        parameters: {
          type: 'object',
          properties: {
            reservationId: {
              type: 'string',
              description: 'Reservation ID (optional if date and time provided)'
            },
            reservationDate: {
              type: 'string',
              description: 'Reservation date in YYYY-MM-DD format (optional if reservationId provided)'
            },
            reservationTime: {
              type: 'string',
              description: 'Reservation time in HH:MM format (optional if reservationId provided)'
            },
            itemName: {
              type: 'string',
              description: 'Name of the item to remove'
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_reservation_items',
        description: 'Get all items added to a table reservation. Use this to show customer what items they have pre-ordered for their reservation.',
        parameters: {
          type: 'object',
          properties: {
            reservationId: {
              type: 'string',
              description: 'Reservation ID (optional if date and time provided)'
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
    if (!businessId) {
      logger.error('checkTableReservationsEligible called with undefined businessId');
      return { eligible: false, reason: 'Business ID is required' };
    }
    
    // Check business type
    const business = await queryMySQL(
      `SELECT business_type FROM users 
       WHERE id = ? 
         AND (role_scope = 'business_owner' OR user_type = 'business')`,
      [businessId]
    );
    
    if (!business || business.length === 0) {
      logger.error('Business not found for table reservations', { businessId });
      return { eligible: false, reason: 'Business not found' };
    }
    
    const businessRow = business[0];
    if (!businessRow) {
      logger.error('Business row is undefined', { businessId, business });
      return { eligible: false, reason: 'Business not found' };
    }
    
    const businessType = businessRow.business_type?.toLowerCase();
    if (businessType !== 'food and beverage' && businessType !== 'f & b' && businessType !== 'f&b') {
      return { eligible: false, reason: 'Table reservations are only available for Food & Beverage businesses' };
    }
    
    // Check if addon is active
    const isActive = await addonRepository.isAddonActive(businessId, 'table_reservations');
    logger.info('Table reservations addon check', { 
      businessId, 
      isActive,
      addonKey: 'table_reservations'
    });
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
    if (!business || !business.id) {
      logger.error('Business is undefined in table reservation context', { business, context });
      return {
        success: false,
        error: 'Business information is missing. Please contact support.'
      };
    }
    
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
      
      const validationErrors = [];
      
      if (!reservationDate || !reservationTime) {
        validationErrors.push({
          field: 'reservationDateTime',
          message: 'Reservation date and time are required.',
          code: 'MISSING_DATE_TIME'
        });
      }
      
      if (!customerName) {
        validationErrors.push({
          field: 'customerName',
          message: 'Customer name is required for table reservations. Please provide your name.',
          code: 'MISSING_CUSTOMER_NAME'
        });
      }
      
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: validationErrors.map(e => e.message).join(' '),
          validationErrors: validationErrors
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
        const reservationNumber = reservation.id.substring(0, 8).toUpperCase();
        
        return {
          success: true,
          message: `✅ Your table reservation has been confirmed!\n\n📋 Reservation #${reservationNumber}\n👤 Name: ${customerName}\n📅 Date: ${reservationDate}\n⏰ Time: ${reservationTime}\n🪑 Table: ${tableDisplayName}\n${numberOfGuests ? `👥 Guests: ${numberOfGuests}\n` : ''}\nWe look forward to seeing you!`,
          reservation: {
            id: reservation.id,
            reservation_number: reservationNumber,
            customer_name: customerName,
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
    
    case 'add_item_to_reservation': {
      const { reservationId, reservationDate, reservationTime, itemName, quantity = 1, notes } = args;
      
      try {
        // Find reservation
        let reservation = null;
        
        if (reservationId) {
          reservation = await reservationRepository.findById(reservationId, business.id);
        } else if (reservationDate && reservationTime) {
          const reservations = await reservationRepository.findByBusiness(business.id, {
            reservationDate,
            status: 'confirmed',
            reservationType: 'table'
          });
          
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
        
        // Find item by name (fuzzy match)
        const items = await itemRepository.findByBusiness(business.id, branch?.id || null);
        const item = items.find(i => 
          i.name.toLowerCase().includes(itemName.toLowerCase()) ||
          itemName.toLowerCase().includes(i.name.toLowerCase())
        );
        
        if (!item) {
          return {
            success: false,
            error: `Item "${itemName}" not found. Would you like to see our menu?`
          };
        }
        
        // Check availability
        if (item.availability !== 'available' && item.availability_status !== 'available') {
          return {
            success: false,
            error: `Sorry, "${item.name}" is currently not available.`
          };
        }
        
        // Add item to reservation
        await reservationRepository.addItemToReservation(reservation.id, {
          itemId: item.id,
          quantity: quantity,
          notes: notes || null
        });
        
        const reservationItems = await reservationRepository.getReservationItems(reservation.id);
        const totalItems = reservationItems.reduce((sum, ri) => sum + ri.quantity, 0);
        
        return {
          success: true,
          message: `Added ${quantity}x ${item.name} to your reservation for ${reservation.reservation_date} at ${reservation.reservation_time}. You now have ${totalItems} item(s) pre-ordered.`,
          reservation: {
            id: reservation.id,
            reservation_date: reservation.reservation_date,
            reservation_time: reservation.reservation_time,
            items: reservationItems.map(ri => ({
              name: ri.name_at_time,
              quantity: ri.quantity,
              price: ri.price_at_time
            }))
          }
        };
      } catch (error) {
        logger.error('Error adding item to reservation:', error);
        return {
          success: false,
          error: `Failed to add item to reservation: ${error.message}`
        };
      }
    }
    
    case 'remove_item_from_reservation': {
      const { reservationId, reservationDate, reservationTime, itemName } = args;
      
      try {
        // Find reservation
        let reservation = null;
        
        if (reservationId) {
          reservation = await reservationRepository.findById(reservationId, business.id);
        } else if (reservationDate && reservationTime) {
          const reservations = await reservationRepository.findByBusiness(business.id, {
            reservationDate,
            status: 'confirmed',
            reservationType: 'table'
          });
          
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
        
        // Get reservation items
        const reservationItems = await reservationRepository.getReservationItems(reservation.id);
        
        // Find item to remove
        const itemToRemove = reservationItems.find(ri => 
          ri.name_at_time.toLowerCase().includes(itemName.toLowerCase()) ||
          itemName.toLowerCase().includes(ri.name_at_time.toLowerCase())
        );
        
        if (!itemToRemove) {
          const itemList = reservationItems.map(ri => `- ${ri.name_at_time} (${ri.quantity}x)`).join('\n');
          return {
            success: false,
            error: `Item "${itemName}" not found in your reservation. Current items:\n${itemList || 'No items added yet.'}`
          };
        }
        
        // Remove item
        await reservationRepository.removeItemFromReservation(reservation.id, itemToRemove.item_id);
        
        const updatedItems = await reservationRepository.getReservationItems(reservation.id);
        
        return {
          success: true,
          message: `Removed ${itemToRemove.name_at_time} from your reservation.`,
          reservation: {
            id: reservation.id,
            reservation_date: reservation.reservation_date,
            reservation_time: reservation.reservation_time,
            items: updatedItems.map(ri => ({
              name: ri.name_at_time,
              quantity: ri.quantity,
              price: ri.price_at_time
            }))
          }
        };
      } catch (error) {
        logger.error('Error removing item from reservation:', error);
        return {
          success: false,
          error: `Failed to remove item from reservation: ${error.message}`
        };
      }
    }
    
    case 'get_reservation_items': {
      const { reservationId, reservationDate, reservationTime } = args;
      
      try {
        // Find reservation
        let reservation = null;
        
        if (reservationId) {
          reservation = await reservationRepository.findById(reservationId, business.id);
        } else if (reservationDate && reservationTime) {
          const reservations = await reservationRepository.findByBusiness(business.id, {
            reservationDate,
            status: 'confirmed',
            reservationType: 'table'
          });
          
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
        
        const items = await reservationRepository.getReservationItems(reservation.id);
        
        if (items.length === 0) {
          return {
            success: true,
            message: `Your reservation for ${reservation.reservation_date} at ${reservation.reservation_time} has no items added yet.`,
            items: []
          };
        }
        
        const itemsList = items.map(ri => 
          `${ri.quantity}x ${ri.name_at_time} - $${ri.price_at_time} each`
        ).join('\n');
        const total = items.reduce((sum, ri) => sum + (parseFloat(ri.price_at_time) * ri.quantity), 0);
        
        return {
          success: true,
          message: `Items for your reservation on ${reservation.reservation_date} at ${reservation.reservation_time}:\n${itemsList}\n\nTotal: $${total.toFixed(2)}`,
          items: items.map(ri => ({
            name: ri.name_at_time,
            quantity: ri.quantity,
            price: ri.price_at_time
          })),
          total: total
        };
      } catch (error) {
        logger.error('Error getting reservation items:', error);
        return {
          success: false,
          error: `Failed to get reservation items: ${error.message}`
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
