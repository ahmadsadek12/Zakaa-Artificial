// Validation Functions
// Read-only validation functions for anti-hallucination
// These functions DO NOT modify data, only return validation results

const cartManager = require('../cartManager');
const conversationManager = require('../conversationManager');
const logger = require('../../../utils/logger');
const { queryMySQL } = require('../../../config/database');
const botActionLogger = require('../botActionLogger');

/**
 * Get validation function definitions for OpenAI
 */
function getValidationFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'validate_cart_for_confirmation',
        description: 'Validate cart before order confirmation. Checks if cart has items, delivery type is set, address is provided (if delivery), and business is open. Returns structured validation errors. Use this BEFORE calling confirm_order to check if order can be placed.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'validate_reservation_request',
        description: 'Validate table reservation request. Checks date/time validity, table availability, guest count, and business hours. Returns structured validation errors. Use this BEFORE calling create_table_reservation.',
        parameters: {
          type: 'object',
          properties: {
            reservationDate: {
              type: 'string',
              description: 'Reservation date in YYYY-MM-DD format'
            },
            reservationTime: {
              type: 'string',
              description: 'Reservation time in HH:MM format'
            },
            numberOfGuests: {
              type: 'number',
              description: 'Number of guests'
            }
          },
          required: ['reservationDate', 'reservationTime', 'numberOfGuests']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'validate_cancellation_eligibility',
        description: 'Validate if an order or reservation can be cancelled. Checks cancellation deadlines (item-level and business-level policies), order/reservation status, and time remaining. Returns eligibility status and deadline information.',
        parameters: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Order ID to check (optional if reservationId provided)'
            },
            reservationId: {
              type: 'string',
              description: 'Reservation ID to check (optional if orderId provided)'
            }
          },
          required: []
        }
      }
    }
  ];
}

/**
 * Execute validation function
 */
async function executeValidationFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber, session } = context;
  const branchId = branch?.id || business.id;
  
  switch (functionName) {
    case 'validate_cart_for_confirmation': {
      try {
        const validationErrors = [];
        const warnings = [];
        
        // Get cart
        const cart = await cartManager.getCart(business.id, branchId, customerPhoneNumber);
        
        // Check if cart has items
        if (!cart.items || cart.items.length === 0) {
          validationErrors.push({
            field: 'cart',
            message: 'Cart is empty. Please add items before confirming.',
            code: 'EMPTY_CART'
          });
        }
        
        // Check if delivery type is set
        if (!cart.delivery_type) {
          validationErrors.push({
            field: 'delivery_type',
            message: 'Delivery type is not set. Please select delivery, takeaway, or dine-in.',
            code: 'MISSING_DELIVERY_TYPE'
          });
        }
        
        // Check address if delivery
        if (cart.delivery_type === 'delivery') {
          if (!cart.location_address) {
            validationErrors.push({
              field: 'address',
              message: 'Delivery address is required for delivery orders.',
              code: 'MISSING_ADDRESS'
            });
          }
        }
        
        // Check if business is open
        const openStatus = await conversationManager.isOpenNow(business.id, branchId);
        
        if (!cart.scheduled_for) {
          // Immediate order - check if business is open
          if (!openStatus.isOpen) {
            validationErrors.push({
              field: 'business_hours',
              message: `We're currently closed (${openStatus.reason}). Please schedule your order for when we're open.`,
              code: 'BUSINESS_CLOSED'
            });
          } else if (openStatus.lastOrderTimePassed && openStatus.isWithinOpeningHours) {
            validationErrors.push({
              field: 'business_hours',
              message: `We're past our last order time (${openStatus.lastOrderTime}). Please schedule your order for a future time.`,
              code: 'LAST_ORDER_TIME_PASSED'
            });
          } else if (openStatus.minutesUntilLastOrder !== null && openStatus.minutesUntilLastOrder <= 30) {
            warnings.push({
              field: 'business_hours',
              message: `Last order time is in ${openStatus.minutesUntilLastOrder} minutes. Please confirm quickly!`,
              code: 'APPROACHING_LAST_ORDER'
            });
          }
        } else {
          // Scheduled order - validate scheduled time
          const scheduledDate = new Date(cart.scheduled_for);
          const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][scheduledDate.getDay()];
          
          let dayOpeningHours = [];
          if (branchId && branchId !== business.id) {
            dayOpeningHours = await queryMySQL(`
              SELECT * FROM opening_hours 
              WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
            `, ['branch', branchId, dayOfWeek]);
          }
          
          if (dayOpeningHours.length === 0) {
            dayOpeningHours = await queryMySQL(`
              SELECT * FROM opening_hours 
              WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
            `, ['business', business.id, dayOfWeek]);
          }
          
          if (dayOpeningHours.length === 0 || dayOpeningHours[0].is_closed) {
            validationErrors.push({
              field: 'scheduled_time',
              message: `We're closed on ${dayOfWeek}. Please reschedule for a day when we're open.`,
              code: 'SCHEDULED_DAY_CLOSED'
            });
          }
        }
        
        // Log validation
        if (session && session.id) {
          if (validationErrors.length > 0) {
            await botActionLogger.logValidationFailure(
              session.id,
              'cart_confirmation',
              validationErrors.map(e => e.message).join('; ')
            );
          }
        }
        
        return {
          success: validationErrors.length === 0,
          valid: validationErrors.length === 0,
          validationErrors: validationErrors,
          warnings: warnings,
          cart: cart
        };
      } catch (error) {
        logger.error('Error validating cart:', error);
        return {
          success: false,
          valid: false,
          validationErrors: [{
            field: 'system',
            message: `Validation error: ${error.message}`,
            code: 'VALIDATION_ERROR'
          }],
          warnings: []
        };
      }
    }
    
    case 'validate_reservation_request': {
      const { reservationDate, reservationTime, numberOfGuests } = args;
      
      try {
        const validationErrors = [];
        
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(reservationDate)) {
          validationErrors.push({
            field: 'reservationDate',
            message: 'Invalid date format. Use YYYY-MM-DD format.',
            code: 'INVALID_DATE_FORMAT'
          });
        }
        
        // Validate time format
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(reservationTime)) {
          validationErrors.push({
            field: 'reservationTime',
            message: 'Invalid time format. Use HH:MM format (24-hour).',
            code: 'INVALID_TIME_FORMAT'
          });
        }
        
        // Validate guest count
        if (!numberOfGuests || numberOfGuests < 1) {
          validationErrors.push({
            field: 'numberOfGuests',
            message: 'Number of guests must be at least 1.',
            code: 'INVALID_GUEST_COUNT'
          });
        }
        
        // Check if date is in the past
        const requestedDateTime = new Date(`${reservationDate}T${reservationTime}`);
        const now = new Date();
        if (requestedDateTime < now) {
          validationErrors.push({
            field: 'reservationDate',
            message: 'Reservation date/time cannot be in the past.',
            code: 'PAST_DATE_TIME'
          });
        }
        
        // Check opening hours for the requested day
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestedDateTime.getDay()];
        
        let dayOpeningHours = [];
        if (branchId && branchId !== business.id) {
          dayOpeningHours = await queryMySQL(`
            SELECT * FROM opening_hours 
            WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
          `, ['branch', branchId, dayOfWeek]);
        }
        
        if (dayOpeningHours.length === 0) {
          dayOpeningHours = await queryMySQL(`
            SELECT * FROM opening_hours 
            WHERE owner_type = ? AND owner_id = ? AND day_of_week = ?
          `, ['business', business.id, dayOfWeek]);
        }
        
        if (dayOpeningHours.length === 0 || dayOpeningHours[0].is_closed) {
          validationErrors.push({
            field: 'reservationDate',
            message: `We're closed on ${dayOfWeek}. Please choose a different day.`,
            code: 'DAY_CLOSED'
          });
        } else if (dayOpeningHours[0].open_time && dayOpeningHours[0].close_time) {
          const openTime = dayOpeningHours[0].open_time.substring(0, 5);
          const closeTime = dayOpeningHours[0].close_time.substring(0, 5);
          
          if (reservationTime < openTime || reservationTime > closeTime) {
            validationErrors.push({
              field: 'reservationTime',
              message: `Reservation time must be between ${openTime} and ${closeTime} on ${dayOfWeek}.`,
              code: 'TIME_OUTSIDE_HOURS'
            });
          }
        }
        
        // Check table availability (basic check - full check done in create function)
        if (validationErrors.length === 0) {
          const tableRepository = require('../../../repositories/tableRepository');
          const ownerUserId = branchId || business.id;
          
          try {
            const availableTables = await tableRepository.findAvailableForSlot(
              ownerUserId,
              reservationDate,
              reservationTime,
              numberOfGuests,
              null
            );
            
            if (availableTables.length === 0) {
              validationErrors.push({
                field: 'table_availability',
                message: 'No tables available for the requested date, time, and party size.',
                code: 'NO_TABLES_AVAILABLE'
              });
            }
          } catch (error) {
            // Table check failed - log but don't block validation
            logger.warn('Error checking table availability during validation:', error);
          }
        }
        
        // Log validation
        if (session && session.id) {
          if (validationErrors.length > 0) {
            await botActionLogger.logValidationFailure(
              session.id,
              'reservation_request',
              validationErrors.map(e => e.message).join('; ')
            );
          }
        }
        
        return {
          success: validationErrors.length === 0,
          valid: validationErrors.length === 0,
          validationErrors: validationErrors
        };
      } catch (error) {
        logger.error('Error validating reservation request:', error);
        return {
          success: false,
          valid: false,
          validationErrors: [{
            field: 'system',
            message: `Validation error: ${error.message}`,
            code: 'VALIDATION_ERROR'
          }]
        };
      }
    }
    
    case 'validate_cancellation_eligibility': {
      const { orderId, reservationId } = args;
      
      try {
        if (!orderId && !reservationId) {
          return {
            success: false,
            valid: false,
            validationErrors: [{
              field: 'id',
              message: 'Either orderId or reservationId is required.',
              code: 'MISSING_ID'
            }]
          };
        }
        
        if (orderId) {
          // Validate order cancellation
          const orders = await queryMySQL(`
            SELECT o.*, 
                   MAX(i.cancelable_before_hours) as item_cancelable_hours,
                   u.default_cancelable_before_hours as business_cancelable_hours
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN items i ON oi.item_id = i.id
            LEFT JOIN users u ON o.business_id = u.id
            WHERE o.id = ? 
              AND o.customer_phone_number = ?
              AND o.business_id = ?
              AND o.status = 'accepted'
              AND o.scheduled_for IS NOT NULL
              AND o.scheduled_for > NOW()
            GROUP BY o.id, u.default_cancelable_before_hours
          `, [orderId, customerPhoneNumber, business.id]);
          
          if (orders.length === 0) {
            return {
              success: false,
              valid: false,
              validationErrors: [{
                field: 'orderId',
                message: 'Order not found, not scheduled, or cannot be cancelled.',
                code: 'ORDER_NOT_FOUND'
              }]
            };
          }
          
          const order = orders[0];
          const scheduledDate = new Date(order.scheduled_for);
          const hoursUntil = (scheduledDate - new Date()) / (1000 * 60 * 60);
          
          const cancelableBeforeHours = order.item_cancelable_hours ?? 
                                       order.business_cancelable_hours ?? 
                                       2;
          
          const canCancel = hoursUntil >= cancelableBeforeHours;
          
          return {
            success: true,
            valid: canCancel,
            canCancel: canCancel,
            hoursUntil: hoursUntil,
            cancelableBeforeHours: cancelableBeforeHours,
            deadline: canCancel ? null : new Date(scheduledDate.getTime() - cancelableBeforeHours * 60 * 60 * 1000).toISOString(),
            message: canCancel 
              ? `Order can be cancelled. Deadline: ${cancelableBeforeHours} hours before scheduled time.`
              : `Order cannot be cancelled. Cancellation deadline (${cancelableBeforeHours} hours before) has passed.`
          };
        }
        
        if (reservationId) {
          // Validate reservation cancellation
          const reservations = await queryMySQL(`
            SELECT * FROM reservations
            WHERE id = ?
              AND customer_phone_number = ?
              AND business_user_id = ?
              AND status = 'confirmed'
          `, [reservationId, customerPhoneNumber, business.id]);
          
          if (reservations.length === 0) {
            return {
              success: false,
              valid: false,
              validationErrors: [{
                field: 'reservationId',
                message: 'Reservation not found or cannot be cancelled.',
                code: 'RESERVATION_NOT_FOUND'
              }]
            };
          }
          
          const reservation = reservations[0];
          const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`);
          const hoursUntil = (reservationDateTime - new Date()) / (1000 * 60 * 60);
          
          // Default cancellation policy: 2 hours before
          const cancelableBeforeHours = 2;
          const canCancel = hoursUntil >= cancelableBeforeHours;
          
          return {
            success: true,
            valid: canCancel,
            canCancel: canCancel,
            hoursUntil: hoursUntil,
            cancelableBeforeHours: cancelableBeforeHours,
            deadline: canCancel ? null : new Date(reservationDateTime.getTime() - cancelableBeforeHours * 60 * 60 * 1000).toISOString(),
            message: canCancel
              ? `Reservation can be cancelled. Deadline: ${cancelableBeforeHours} hours before reservation time.`
              : `Reservation cannot be cancelled. Cancellation deadline (${cancelableBeforeHours} hours before) has passed.`
          };
        }
      } catch (error) {
        logger.error('Error validating cancellation eligibility:', error);
        return {
          success: false,
          valid: false,
          validationErrors: [{
            field: 'system',
            message: `Validation error: ${error.message}`,
            code: 'VALIDATION_ERROR'
          }]
        };
      }
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getValidationFunctionDefinitions,
  executeValidationFunction
};
