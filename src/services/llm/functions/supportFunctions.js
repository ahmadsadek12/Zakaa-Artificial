// Support Functions
// Functions for support tickets and employee handover

const ticketRepository = require('../../../repositories/ticketRepository');
const sessionManager = require('../sessionManager');
const botActionLogger = require('../botActionLogger');
const logger = require('../../../utils/logger');
const { queryMySQL } = require('../../../config/database');

/**
 * Get support function definitions for OpenAI
 */
function getSupportFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'create_support_ticket',
        description: 'Create a new support ticket. Use this when customer has a complaint, question, or issue that requires tracking. Automatically links to current session and any related order/reservation if provided.',
        parameters: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'Brief subject/title for the ticket'
            },
            message: {
              type: 'string',
              description: 'Initial message describing the issue'
            },
            orderId: {
              type: 'string',
              description: 'Related order ID (if issue is about an order)'
            },
            reservationId: {
              type: 'string',
              description: 'Related reservation ID (if issue is about a reservation)'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Priority level (default: medium)'
            }
          },
          required: ['subject', 'message']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'add_message_to_ticket',
        description: 'Add a message to an existing support ticket. Use this when customer is responding to or updating an existing ticket.',
        parameters: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'string',
              description: 'Ticket ID to add message to'
            },
            message: {
              type: 'string',
              description: 'Message content'
            }
          },
          required: ['ticketId', 'message']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_my_tickets',
        description: 'Get all support tickets for the current customer. Shows ticket status, subject, and recent activity.',
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
        name: 'request_human_assistance',
        description: 'Request human employee assistance. Use this when the bot cannot help the customer, customer explicitly asks for a human, or the issue is too complex. This locks the session, creates a support ticket, and assigns it to an available employee.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Reason for requesting human assistance (e.g., "Customer requested human", "Complex issue beyond bot capabilities", "Payment problem")'
            }
          },
          required: ['reason']
        }
      }
    }
  ];
}

/**
 * Execute support function
 */
async function executeSupportFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber, session } = context;
  
  if (!session || !session.id) {
    return {
      success: false,
      error: 'Session not found. Cannot execute support function.'
    };
  }
  
  const sessionId = session.id;
  let customerId = session.customer_id;
  
  // Auto-create customer if missing
  if (!customerId) {
    try {
      const customerRepository = require('../../../repositories/customerRepository');
      const platform = customerPhoneNumber.startsWith('telegram:') ? 'telegram' : 
                       customerPhoneNumber.startsWith('instagram:') ? 'instagram' :
                       customerPhoneNumber.startsWith('facebook:') ? 'facebook' : 'whatsapp';
      customerId = await customerRepository.findOrCreateCustomerByPhone(
        business.id,
        customerPhoneNumber,
        platform
      );
      
      // Update session with customer_id
      await queryMySQL(
        'UPDATE chat_sessions SET customer_id = ? WHERE id = ?',
        [customerId, sessionId]
      );
      
      logger.info('Auto-created customer for support function', {
        customerId,
        sessionId,
        customerPhoneNumber
      });
    } catch (error) {
      logger.error('Error auto-creating customer for support function:', error);
      return {
        success: false,
        error: 'Failed to create customer record. Please try again.'
      };
    }
  }
  
  switch (functionName) {
    case 'create_support_ticket': {
      const { subject, message, orderId, reservationId, priority } = args;
      
      if (!subject || !message) {
        return {
          success: false,
          error: 'Subject and message are required'
        };
      }
      
      try {
        // Validate order/reservation if provided
        if (orderId) {
          const orders = await queryMySQL(`
            SELECT id FROM orders
            WHERE id = ? AND business_id = ? AND customer_phone_number = ?
          `, [orderId, business.id, customerPhoneNumber]);
          
          if (orders.length === 0) {
            return {
              success: false,
              error: 'Order not found or does not belong to you'
            };
          }
        }
        
        if (reservationId) {
          const reservations = await queryMySQL(`
            SELECT id FROM reservations
            WHERE id = ? AND business_user_id = ? AND customer_phone_number = ?
          `, [reservationId, business.id, customerPhoneNumber]);
          
          if (reservations.length === 0) {
            return {
              success: false,
              error: 'Reservation not found or does not belong to you'
            };
          }
        }
        
        // Create ticket
        const ticket = await ticketRepository.createTicket({
          businessId: business.id,
          customerId: customerId,
          relatedOrderId: orderId || null,
          relatedReservationId: reservationId || null,
          sessionId: sessionId,
          subject: subject,
          status: 'open',
          priority: priority || 'medium',
          createdVia: 'bot',
          initialMessage: message,
          initialMessageSenderType: 'customer',
          initialMessageSenderId: customerId
        });
        
        logger.info('Support ticket created', {
          ticketId: ticket.id,
          customerId,
          businessId: business.id,
          subject
        });
        
        return {
          success: true,
          message: `Support ticket created successfully. Ticket #${ticket.id.substring(0, 8).toUpperCase()}. We'll get back to you soon!`,
          ticket: {
            id: ticket.id,
            ticketNumber: ticket.id.substring(0, 8).toUpperCase(),
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority
          }
        };
      } catch (error) {
        logger.error('Error creating support ticket:', error);
        return {
          success: false,
          error: `Failed to create ticket: ${error.message}`
        };
      }
    }
    
    case 'add_message_to_ticket': {
      const { ticketId, message } = args;
      
      if (!ticketId || !message) {
        return {
          success: false,
          error: 'Ticket ID and message are required'
        };
      }
      
      try {
        // Verify ticket belongs to customer
        const ticket = await ticketRepository.getTicketById(ticketId, business.id);
        
        if (!ticket) {
          return {
            success: false,
            error: 'Ticket not found'
          };
        }
        
        if (ticket.customer_id !== customerId) {
          return {
            success: false,
            error: 'Access denied: This ticket does not belong to you'
          };
        }
        
        // Add message
        await ticketRepository.addMessageToTicket(ticketId, {
          senderType: 'customer',
          senderId: customerId,
          message: message
        });
        
        logger.info('Message added to ticket', {
          ticketId,
          customerId
        });
        
        return {
          success: true,
          message: 'Your message has been added to the ticket. We\'ll respond soon!'
        };
      } catch (error) {
        logger.error('Error adding message to ticket:', error);
        return {
          success: false,
          error: `Failed to add message: ${error.message}`
        };
      }
    }
    
    case 'get_my_tickets': {
      try {
        const tickets = await ticketRepository.getCustomerTickets(customerId, business.id);
        
        if (tickets.length === 0) {
          return {
            success: true,
            message: 'You have no support tickets.',
            tickets: []
          };
        }
        
        // Get messages for each ticket
        const ticketsWithMessages = await Promise.all(
          tickets.map(async (ticket) => {
            const messages = await ticketRepository.getTicketMessages(ticket.id);
            return {
              ...ticket,
              ticketNumber: ticket.id.substring(0, 8).toUpperCase(),
              messageCount: messages.length,
              lastMessage: messages.length > 0 ? messages[messages.length - 1] : null
            };
          })
        );
        
        let message = '📋 **Your Support Tickets:**\n\n';
        for (const ticket of ticketsWithMessages) {
          message += `**Ticket #${ticket.ticketNumber}**\n`;
          message += `  Subject: ${ticket.subject || 'No subject'}\n`;
          message += `  Status: ${ticket.status}\n`;
          message += `  Priority: ${ticket.priority}\n`;
          message += `  Created: ${new Date(ticket.created_at).toLocaleString()}\n`;
          if (ticket.lastMessage) {
            message += `  Last message: ${ticket.lastMessage.message.substring(0, 50)}${ticket.lastMessage.message.length > 50 ? '...' : ''}\n`;
          }
          message += '\n';
        }
        
        return {
          success: true,
          message: message,
          tickets: ticketsWithMessages
        };
      } catch (error) {
        logger.error('Error getting customer tickets:', error);
        return {
          success: false,
          error: `Failed to get tickets: ${error.message}`
        };
      }
    }
    
    case 'request_human_assistance': {
      const { reason } = args;
      
      if (!reason) {
        return {
          success: false,
          error: 'Reason is required'
        };
      }
      
      try {
        // Lock session
        await sessionManager.lockSession(sessionId);
        
        // Find available employee (or leave unassigned)
        // For now, we'll leave it unassigned - employees can pick it up from dashboard
        const employeeId = null; // TODO: Implement employee assignment logic
        
        // Create support ticket automatically
        const ticket = await ticketRepository.createTicket({
          businessId: business.id,
          customerId: customerId,
          sessionId: sessionId,
          subject: `Human Assistance Request: ${reason.substring(0, 50)}`,
          status: 'open',
          priority: 'high',
          createdVia: 'bot',
          assignedEmployeeId: employeeId,
          initialMessage: `Customer requested human assistance. Reason: ${reason}`,
          initialMessageSenderType: 'system',
          initialMessageSenderId: null
        });
        
        // If employee found, assign to session
        if (employeeId) {
          await sessionManager.assignEmployee(sessionId, employeeId);
        }
        
        // Log handover
        await botActionLogger.logHandover(sessionId, employeeId, reason);
        
        logger.info('Human assistance requested', {
          sessionId,
          ticketId: ticket.id,
          employeeId,
          reason
        });
        
        return {
          success: true,
          message: `I've connected you with a human agent. Ticket #${ticket.id.substring(0, 8).toUpperCase()} has been created. Someone will assist you shortly!`,
          ticket: {
            id: ticket.id,
            ticketNumber: ticket.id.substring(0, 8).toUpperCase()
          },
          sessionLocked: true
        };
      } catch (error) {
        logger.error('Error requesting human assistance:', error);
        return {
          success: false,
          error: `Failed to request assistance: ${error.message}`
        };
      }
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getSupportFunctionDefinitions,
  executeSupportFunction
};
