// Support Tickets API Routes
// Employee dashboard endpoints for ticket management

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const ticketRepository = require('../../repositories/ticketRepository');
const customerRepository = require('../../repositories/customerRepository');
const { tenantIsolation } = require('../../middleware/tenant');
const { authenticateToken } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { queryMySQL } = require('../../config/database');
const telegramMessageSender = require('../../services/telegram/telegramMessageSender');
const logger = require('../../utils/logger');

// All routes require authentication and tenant isolation
router.use(authenticateToken);
router.use(tenantIsolation);

/**
 * GET /api/tickets - List tickets with filters
 * Business owners see all tickets, employees see only assigned tickets
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const businessId = req.businessId;
    
    if (!businessId) {
      logger.error('Business ID missing in tickets route', {
        userId: req.user?.id,
        userType: req.user?.user_type,
        isEmployee: req.isEmployee
      });
      return res.status(400).json({
        success: false,
        error: { message: 'Business ID is required' }
      });
    }
    
    const employeeId = req.isEmployee ? req.user.id : null;
    
    const filters = {
      status: req.query.status || null,
      priority: req.query.priority || null,
      unassigned: req.query.unassigned === 'true',
      customerId: req.query.customerId || null,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50
    };
    
    // Ensure limit is a valid number
    if (isNaN(filters.limit) || filters.limit < 1) {
      filters.limit = 50;
    }
    
    // Employees can only see assigned tickets
    if (employeeId) {
      filters.assignedEmployeeId = employeeId;
    }
    
    const tickets = await ticketRepository.getBusinessTickets(businessId, filters);
    
    // Get message counts for each ticket
    const ticketsWithDetails = await Promise.all(
      tickets.map(async (ticket) => {
        try {
          const messages = await ticketRepository.getTicketMessages(ticket.id);
          return {
            ...ticket,
            messageCount: messages.length,
            lastMessage: messages.length > 0 ? messages[messages.length - 1] : null
          };
        } catch (error) {
          logger.error('Error getting messages for ticket', { ticketId: ticket.id, error: error.message });
          return {
            ...ticket,
            messageCount: 0,
            lastMessage: null
          };
        }
      })
    );
    
    res.json({
      success: true,
      data: ticketsWithDetails
    });
  } catch (error) {
    logger.error('Error in GET /api/tickets:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch tickets' }
    });
  }
}));

/**
 * GET /api/tickets/:id - Get ticket details with messages
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const ticketId = req.params.id;
  const businessId = req.businessId;
  
  const ticket = await ticketRepository.getTicketById(ticketId, businessId);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { message: 'Ticket not found' }
    });
  }
  
  // Employees can only access assigned tickets
  if (req.isEmployee && ticket.assigned_employee_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied: Ticket not assigned to you' }
    });
  }
  
  // Get all messages
  const messages = await ticketRepository.getTicketMessages(ticketId);
  
  res.json({
    success: true,
    data: {
      ...ticket,
      messages
    }
  });
}));

/**
 * POST /api/tickets/:id/messages - Add message to ticket (employee)
 */
router.post('/:id/messages', [
  body('message').trim().notEmpty().withMessage('Message is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const ticketId = req.params.id;
  const businessId = req.businessId;
  const { message } = req.body;
  
  // Verify ticket exists and belongs to business
  const ticket = await ticketRepository.getTicketById(ticketId, businessId);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { message: 'Ticket not found' }
    });
  }
  
  // Employees can only add messages to assigned tickets
  if (req.isEmployee && ticket.assigned_employee_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied: Ticket not assigned to you' }
    });
  }
  
  // Add message
  const newMessage = await ticketRepository.addMessageToTicket(ticketId, {
    senderType: 'employee',
    senderId: req.user.id,
    message: message
  });
  
  // Send message to customer via Telegram if customer exists
  if (ticket.customer_id) {
    try {
      // Get customer phone number
      const customer = await customerRepository.findById(ticket.customer_id);
      
      if (customer && customer.contact_phone_number) {
        // Try to find the platform from chat_sessions
        const sessions = await queryMySQL(`
          SELECT platform 
          FROM chat_sessions 
          WHERE customer_id = ? AND business_id = ?
          ORDER BY updated_at DESC
          LIMIT 1
        `, [ticket.customer_id, businessId]);
        
        let customerPhoneNumber = customer.contact_phone_number;
        let platform = 'telegram'; // Default to telegram
        
        if (sessions.length > 0) {
          platform = sessions[0].platform || 'telegram';
        }
        
        // Try to find the full phone number format (with platform prefix) from orders
        const orders = await queryMySQL(`
          SELECT customer_phone_number, order_source
          FROM orders
          WHERE customer_phone_number LIKE ? AND business_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `, [`%${customer.contact_phone_number}%`, businessId]);
        
        if (orders.length > 0) {
          customerPhoneNumber = orders[0].customer_phone_number;
          platform = orders[0].order_source === 'telegram' ? 'telegram' : 'whatsapp';
        } else if (platform === 'telegram') {
          // Default: assume telegram format if platform is telegram
          customerPhoneNumber = `telegram:${customer.contact_phone_number}`;
        }
        
        // Get business to get telegram bot token
        const businesses = await queryMySQL(
          'SELECT telegram_bot_token FROM users WHERE id = ?',
          [businessId]
        );
        
        if (businesses.length > 0 && businesses[0].telegram_bot_token && platform === 'telegram') {
          // Extract Telegram chat ID
          const chatId = customerPhoneNumber.startsWith('telegram:')
            ? customerPhoneNumber.replace('telegram:', '')
            : customerPhoneNumber;
          
          await telegramMessageSender.sendMessage({
            chatId: parseInt(chatId),
            message: message,
            botToken: businesses[0].telegram_bot_token
          });
          
          logger.info('Ticket message sent to customer via Telegram', {
            ticketId,
            customerId: ticket.customer_id,
            chatId,
            employeeId: req.user.id
          });
        }
      }
    } catch (error) {
      // Log error but don't fail the request - message is already saved
      logger.error('Error sending ticket message to customer:', {
        ticketId,
        customerId: ticket.customer_id,
        error: error.message
      });
    }
  }
  
  logger.info('Employee added message to ticket', {
    ticketId,
    employeeId: req.user.id,
    businessId
  });
  
  res.json({
    success: true,
    data: newMessage
  });
}));

/**
 * PUT /api/tickets/:id/assign - Assign ticket to employee
 * Only business owners can assign
 */
router.put('/:id/assign', [
  body('employeeId').notEmpty().withMessage('Employee ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  if (req.isEmployee) {
    return res.status(403).json({
      success: false,
      error: { message: 'Only business owners can assign tickets' }
    });
  }
  
  const ticketId = req.params.id;
  const businessId = req.businessId;
  const { employeeId } = req.body;
  
  // Verify ticket exists
  const ticket = await ticketRepository.getTicketById(ticketId, businessId);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { message: 'Ticket not found' }
    });
  }
  
  // Assign ticket
  await ticketRepository.assignTicket(ticketId, employeeId);
  
  logger.info('Ticket assigned', {
    ticketId,
    employeeId,
    businessId,
    assignedBy: req.user.id
  });
  
  res.json({
    success: true,
    message: 'Ticket assigned successfully'
  });
}));

/**
 * PUT /api/tickets/:id/status - Update ticket status
 */
router.put('/:id/status', [
  body('status').isIn(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])
    .withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const ticketId = req.params.id;
  const businessId = req.businessId;
  const { status } = req.body;
  
  // Verify ticket exists
  const ticket = await ticketRepository.getTicketById(ticketId, businessId);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { message: 'Ticket not found' }
    });
  }
  
  // Employees can only update assigned tickets
  if (req.isEmployee && ticket.assigned_employee_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied: Ticket not assigned to you' }
    });
  }
  
  // Update status
  await ticketRepository.updateTicketStatus(ticketId, status);
  
  logger.info('Ticket status updated', {
    ticketId,
    status,
    updatedBy: req.user.id,
    businessId
  });
  
  res.json({
    success: true,
    message: 'Ticket status updated successfully'
  });
}));

module.exports = router;
