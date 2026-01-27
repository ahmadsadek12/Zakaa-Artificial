// Chat Session Manager
// Manages persistent chatbot sessions for stateful conversations

const { queryMySQL, getMySQLConnection } = require('../../config/database');
const { generateUUID } = require('../../utils/uuid');
const logger = require('../../utils/logger');
const customerRepository = require('../../repositories/customerRepository');

/**
 * Get or create a chat session
 * @param {string} businessId - Business user ID
 * @param {string} customerPhoneNumber - Customer phone number
 * @param {string} platform - Platform ('whatsapp', 'telegram', etc.)
 * @param {string} mode - Session mode ('delivery', 'takeaway', 'dine_in', 'support')
 * @returns {Promise<Object>} Chat session object
 */
async function getOrCreateSession(businessId, customerPhoneNumber, platform, mode = 'support') {
  try {
    // Auto-create customer record if doesn't exist
    const customerId = await customerRepository.findOrCreateCustomerByPhone(
      businessId,
      customerPhoneNumber,
      platform
    );

    // Try to find existing active session (not locked, not assigned to employee)
    // Use customer_id for lookup instead of just phone number
    const sessions = await queryMySQL(`
      SELECT * FROM chat_sessions
      WHERE business_id = ?
        AND customer_id = ?
        AND platform = ?
        AND locked = FALSE
        AND assigned_employee_id IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `, [businessId, customerId, platform]);

    if (sessions.length > 0) {
      // Update mode if different
      if (sessions[0].mode !== mode) {
        await queryMySQL(`
          UPDATE chat_sessions
          SET mode = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [mode, sessions[0].id]);
        sessions[0].mode = mode;
      }
      return sessions[0];
    }

    // Create new session with customer_id
    const sessionId = generateUUID();
    await queryMySQL(`
      INSERT INTO chat_sessions (
        id, business_id, customer_id, platform, mode, step, draft_payload, locked, assigned_employee_id
      ) VALUES (?, ?, ?, ?, ?, 'start', '{}', FALSE, NULL)
    `, [sessionId, businessId, customerId, platform, mode]);

    const newSessions = await queryMySQL(`
      SELECT * FROM chat_sessions WHERE id = ?
    `, [sessionId]);

    return newSessions[0];
  } catch (error) {
    logger.error('Error getting/creating chat session:', error);
    throw error;
  }
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @param {string} businessId - Business ID for validation (optional)
 * @returns {Promise<Object|null>} Session object or null
 */
async function getSession(sessionId, businessId = null) {
  try {
    let query = 'SELECT * FROM chat_sessions WHERE id = ?';
    const params = [sessionId];

    if (businessId) {
      query += ' AND business_id = ?';
      params.push(businessId);
    }

    const sessions = await queryMySQL(query, params);
    return sessions.length > 0 ? sessions[0] : null;
  } catch (error) {
    logger.error('Error getting session:', error);
    throw error;
  }
}

/**
 * Update session step and draft payload
 * @param {string} sessionId - Session ID
 * @param {string} step - Current step (e.g., 'collecting_items', 'awaiting_address', 'confirming')
 * @param {Object} draftPayload - Draft payload (cart state, etc.)
 * @returns {Promise<boolean>} Success
 */
async function updateSessionStep(sessionId, step, draftPayload = null) {
  try {
    const connection = await getMySQLConnection();
    
    try {
      await connection.beginTransaction();

      let query = 'UPDATE chat_sessions SET step = ?, updated_at = CURRENT_TIMESTAMP';
      const params = [step];

      if (draftPayload !== null) {
        query += ', draft_payload = ?';
        params.push(JSON.stringify(draftPayload));
      }

      query += ' WHERE id = ?';
      params.push(sessionId);

      await connection.query(query, params);
      await connection.commit();

      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error updating session step:', error);
    throw error;
  }
}

/**
 * Lock a session (e.g., during order confirmation)
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success
 */
async function lockSession(sessionId) {
  try {
    await queryMySQL(`
      UPDATE chat_sessions
      SET locked = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [sessionId]);
    return true;
  } catch (error) {
    logger.error('Error locking session:', error);
    throw error;
  }
}

/**
 * Unlock a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success
 */
async function unlockSession(sessionId) {
  try {
    await queryMySQL(`
      UPDATE chat_sessions
      SET locked = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [sessionId]);
    return true;
  } catch (error) {
    logger.error('Error unlocking session:', error);
    throw error;
  }
}

/**
 * Assign employee to a session
 * @param {string} sessionId - Session ID
 * @param {string} employeeId - Employee user ID
 * @returns {Promise<boolean>} Success
 */
async function assignEmployee(sessionId, employeeId) {
  try {
    await queryMySQL(`
      UPDATE chat_sessions
      SET assigned_employee_id = ?, locked = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [employeeId, sessionId]);
    return true;
  } catch (error) {
    logger.error('Error assigning employee:', error);
    throw error;
  }
}

/**
 * Get all sessions for a business
 * @param {string} businessId - Business ID
 * @param {string} employeeId - Employee ID (optional, for filtering)
 * @returns {Promise<Array>} Array of sessions
 */
async function getBusinessSessions(businessId, employeeId = null) {
  try {
    let query = `
      SELECT * FROM chat_sessions
      WHERE business_id = ?
    `;
    const params = [businessId];

    if (employeeId) {
      query += ' AND assigned_employee_id = ?';
      params.push(employeeId);
    }

    query += ' ORDER BY updated_at DESC';

    return await queryMySQL(query, params);
  } catch (error) {
    logger.error('Error getting business sessions:', error);
    throw error;
  }
}

/**
 * Switch session mode safely
 * Validates mode transition, clears incompatible data, logs the switch
 * @param {string} sessionId - Session ID
 * @param {string} newMode - New mode ('delivery', 'takeaway', 'dine_in', 'support')
 * @param {string} reason - Reason for mode switch (optional)
 * @returns {Promise<Object>} Updated session object
 */
async function switchSessionMode(sessionId, newMode, reason = null) {
  try {
    const validModes = ['delivery', 'takeaway', 'dine_in', 'support'];
    if (!validModes.includes(newMode)) {
      throw new Error(`Invalid mode: ${newMode}`);
    }

    // Get current session
    const session = await getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const oldMode = session.mode;
    
    // If mode is the same, no need to switch
    if (oldMode === newMode) {
      return session;
    }

    const connection = await getMySQLConnection();
    try {
      await connection.beginTransaction();

      // Clear incompatible draft_payload data when switching modes
      let clearedPayload = {};
      if (session.draft_payload) {
        try {
          const currentPayload = typeof session.draft_payload === 'string' 
            ? JSON.parse(session.draft_payload) 
            : session.draft_payload;
          
          // Keep only compatible data based on mode
          if (newMode === 'support') {
            // Support mode - clear order/reservation data
            clearedPayload = {};
          } else if (['delivery', 'takeaway', 'dine_in'].includes(newMode)) {
            // Order modes - keep cart data if exists
            if (currentPayload.cart) {
              clearedPayload.cart = currentPayload.cart;
            }
          }
        } catch (e) {
          // If payload is invalid JSON, start fresh
          clearedPayload = {};
        }
      }

      // Update session: new mode, reset step, clear incompatible payload
      await connection.query(`
        UPDATE chat_sessions
        SET mode = ?, step = 'start', draft_payload = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newMode, JSON.stringify(clearedPayload), sessionId]);

      await connection.commit();

      // Log mode switch (will be called by botActionLogger)
      const botActionLogger = require('./botActionLogger');
      await botActionLogger.logModeSwitch(sessionId, oldMode, newMode, reason);

      // Return updated session
      const updatedSessions = await queryMySQL(`
        SELECT * FROM chat_sessions WHERE id = ?
      `, [sessionId]);

      logger.info('Session mode switched', {
        sessionId,
        oldMode,
        newMode,
        reason
      });

      return updatedSessions[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error switching session mode:', error);
    throw error;
  }
}

/**
 * Resume a chat session
 * Retrieves session with step and draft_payload for bot to resume naturally
 * @param {string} sessionId - Session ID
 * @param {string} businessId - Business ID for validation (optional)
 * @returns {Promise<Object|null>} Session object with resume data or null
 */
async function resumeSession(sessionId, businessId = null) {
  try {
    const session = await getSession(sessionId, businessId);
    
    if (!session) {
      return null;
    }

    // Parse draft_payload if it's a string
    let draftPayload = {};
    if (session.draft_payload) {
      try {
        draftPayload = typeof session.draft_payload === 'string'
          ? JSON.parse(session.draft_payload)
          : session.draft_payload;
      } catch (e) {
        logger.warn('Error parsing draft_payload:', e);
        draftPayload = {};
      }
    }

    return {
      ...session,
      draft_payload: draftPayload,
      step: session.step || 'start',
      mode: session.mode || 'support'
    };
  } catch (error) {
    logger.error('Error resuming session:', error);
    throw error;
  }
}

module.exports = {
  getOrCreateSession,
  getSession,
  updateSessionStep,
  lockSession,
  unlockSession,
  assignEmployee,
  getBusinessSessions,
  switchSessionMode,
  resumeSession
};
