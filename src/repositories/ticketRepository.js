// Ticket Repository
// Data access layer for support tickets

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');
const logger = require('../utils/logger');

/**
 * Create a new support ticket
 * @param {Object} data - Ticket data
 * @returns {Promise<Object>} Created ticket
 */
async function createTicket(data) {
  try {
    const ticketId = generateUUID();
    const connection = await getMySQLConnection();
    
    try {
      await connection.beginTransaction();
      
      await connection.query(`
        INSERT INTO support_tickets (
          id, business_id, customer_id, related_order_id, related_reservation_id,
          session_id, subject, status, priority, created_via, assigned_employee_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ticketId,
        data.businessId,
        data.customerId || null,
        data.relatedOrderId || null,
        data.relatedReservationId || null,
        data.sessionId || null,
        data.subject || null,
        data.status || 'open',
        data.priority || 'medium',
        data.createdVia || 'bot',
        data.assignedEmployeeId || null
      ]);
      
      // If initial message provided, add it
      if (data.initialMessage) {
        await connection.query(`
          INSERT INTO support_ticket_messages (
            id, ticket_id, sender_type, sender_id, message
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          generateUUID(),
          ticketId,
          data.initialMessageSenderType || 'customer',
          data.initialMessageSenderId || data.customerId || null,
          data.initialMessage
        ]);
      }
      
      await connection.commit();
      
      // Return created ticket
      const tickets = await queryMySQL(`
        SELECT * FROM support_tickets WHERE id = ?
      `, [ticketId]);
      
      return tickets[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error creating ticket:', error);
    throw error;
  }
}

/**
 * Get ticket by ID with validation
 * @param {string} ticketId - Ticket ID
 * @param {string} businessId - Business ID for validation
 * @returns {Promise<Object|null>} Ticket or null
 */
async function getTicketById(ticketId, businessId) {
  try {
    const tickets = await queryMySQL(`
      SELECT * FROM support_tickets
      WHERE id = ? AND business_id = ?
    `, [ticketId, businessId]);
    
    return tickets.length > 0 ? tickets[0] : null;
  } catch (error) {
    logger.error('Error getting ticket:', error);
    throw error;
  }
}

/**
 * Get all tickets for a customer
 * @param {string} customerId - Customer ID
 * @param {string} businessId - Business ID
 * @returns {Promise<Array>} Array of tickets
 */
async function getCustomerTickets(customerId, businessId) {
  try {
    return await queryMySQL(`
      SELECT * FROM support_tickets
      WHERE customer_id = ? AND business_id = ?
      ORDER BY created_at DESC
    `, [customerId, businessId]);
  } catch (error) {
    logger.error('Error getting customer tickets:', error);
    throw error;
  }
}

/**
 * Add message to ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Created message
 */
async function addMessageToTicket(ticketId, messageData) {
  try {
    const messageId = generateUUID();
    const connection = await getMySQLConnection();
    
    try {
      await connection.beginTransaction();
      
      // Add message
      await connection.query(`
        INSERT INTO support_ticket_messages (
          id, ticket_id, sender_type, sender_id, message
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        messageId,
        ticketId,
        messageData.senderType,
        messageData.senderId || null,
        messageData.message
      ]);
      
      // Update ticket status if needed
      if (messageData.updateStatus) {
        await connection.query(`
          UPDATE support_tickets
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [messageData.updateStatus, ticketId]);
      } else {
        // Auto-update status based on sender
        if (messageData.senderType === 'customer') {
          await connection.query(`
            UPDATE support_tickets
            SET status = 'waiting_customer', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status != 'closed'
          `, [ticketId]);
        } else if (messageData.senderType === 'employee') {
          await connection.query(`
            UPDATE support_tickets
            SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'waiting_customer'
          `, [ticketId]);
        }
      }
      
      await connection.commit();
      
      // Return created message
      const messages = await queryMySQL(`
        SELECT * FROM support_ticket_messages WHERE id = ?
      `, [messageId]);
      
      return messages[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error adding message to ticket:', error);
    throw error;
  }
}

/**
 * Update ticket status
 * @param {string} ticketId - Ticket ID
 * @param {string} status - New status
 * @returns {Promise<boolean>} Success
 */
async function updateTicketStatus(ticketId, status) {
  try {
    await queryMySQL(`
      UPDATE support_tickets
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, ticketId]);
    
    return true;
  } catch (error) {
    logger.error('Error updating ticket status:', error);
    throw error;
  }
}

/**
 * Assign ticket to employee
 * @param {string} ticketId - Ticket ID
 * @param {string} employeeId - Employee ID
 * @returns {Promise<boolean>} Success
 */
async function assignTicket(ticketId, employeeId) {
  try {
    await queryMySQL(`
      UPDATE support_tickets
      SET assigned_employee_id = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [employeeId, ticketId]);
    
    return true;
  } catch (error) {
    logger.error('Error assigning ticket:', error);
    throw error;
  }
}

/**
 * Get tickets for business with filters
 * @param {string} businessId - Business ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Array of tickets
 */
async function getBusinessTickets(businessId, filters = {}) {
  try {
    let query = `
      SELECT * FROM support_tickets
      WHERE business_id = ?
    `;
    const params = [businessId];
    
    // Apply filters
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }
    
    if (filters.assignedEmployeeId) {
      query += ' AND assigned_employee_id = ?';
      params.push(filters.assignedEmployeeId);
    }
    
    if (filters.unassigned) {
      query += ' AND assigned_employee_id IS NULL';
    }
    
    if (filters.customerId) {
      query += ' AND customer_id = ?';
      params.push(filters.customerId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    // LIMIT cannot be a parameter in prepared statements, must use string interpolation
    if (filters.limit && !isNaN(filters.limit) && filters.limit > 0) {
      const limitValue = parseInt(filters.limit, 10);
      query += ` LIMIT ${limitValue}`;
    }
    
    return await queryMySQL(query, params);
  } catch (error) {
    logger.error('Error getting business tickets:', error);
    throw error;
  }
}

/**
 * Get ticket messages
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Array>} Array of messages
 */
async function getTicketMessages(ticketId) {
  try {
    return await queryMySQL(`
      SELECT * FROM support_ticket_messages
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `, [ticketId]);
  } catch (error) {
    logger.error('Error getting ticket messages:', error);
    throw error;
  }
}

module.exports = {
  createTicket,
  getTicketById,
  getCustomerTickets,
  addMessageToTicket,
  updateTicketStatus,
  assignTicket,
  getBusinessTickets,
  getTicketMessages
};
