// Bot Action Logger
// Logs bot decisions and actions for debugging and analytics

const { queryMySQL } = require('../../config/database');
const { generateUUID } = require('../../utils/uuid');
const logger = require('../../utils/logger');

/**
 * Log a bot action
 * @param {string} sessionId - Chat session ID
 * @param {string} actionType - Action type ('intent_detected', 'function_called', 'validation_failed', 'handover_to_employee')
 * @param {Object} payload - Action payload (function name, arguments, result, etc.)
 * @returns {Promise<string>} Action ID
 */
async function logAction(sessionId, actionType, payload = {}) {
  try {
    const actionId = generateUUID();
    await queryMySQL(`
      INSERT INTO bot_actions (id, session_id, action_type, payload)
      VALUES (?, ?, ?, ?)
    `, [actionId, sessionId, actionType, JSON.stringify(payload)]);

    return actionId;
  } catch (error) {
    logger.error('Error logging bot action:', error);
    // Don't throw - logging failures shouldn't break the chatbot
    return null;
  }
}

/**
 * Get all actions for a session
 * @param {string} sessionId - Session ID
 * @param {number} limit - Limit results (default: 100)
 * @returns {Promise<Array>} Array of actions
 */
async function getSessionActions(sessionId, limit = 100) {
  try {
    return await queryMySQL(`
      SELECT * FROM bot_actions
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [sessionId, limit]);
  } catch (error) {
    logger.error('Error getting session actions:', error);
    return [];
  }
}

/**
 * Log function call
 * @param {string} sessionId - Session ID
 * @param {string} functionName - Function name
 * @param {Object} args - Function arguments
 * @param {Object} result - Function result
 * @returns {Promise<string>} Action ID
 */
async function logFunctionCall(sessionId, functionName, args, result) {
  return await logAction(sessionId, 'function_called', {
    functionName,
    arguments: args,
    result: result,
    success: result?.success !== false,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log intent detection
 * @param {string} sessionId - Session ID
 * @param {string} intent - Detected intent
 * @param {number} confidence - Confidence score (0-1)
 * @returns {Promise<string>} Action ID
 */
async function logIntent(sessionId, intent, confidence) {
  return await logAction(sessionId, 'intent_detected', {
    intent,
    confidence,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log validation failure
 * @param {string} sessionId - Session ID
 * @param {string} validationType - Type of validation that failed
 * @param {string} message - Error message
 * @returns {Promise<string>} Action ID
 */
async function logValidationFailure(sessionId, validationType, message) {
  return await logAction(sessionId, 'validation_failed', {
    validationType,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log employee handover
 * @param {string} sessionId - Session ID
 * @param {string} employeeId - Employee ID
 * @param {string} reason - Reason for handover
 * @returns {Promise<string>} Action ID
 */
async function logHandover(sessionId, employeeId, reason) {
  return await logAction(sessionId, 'handover_to_employee', {
    employeeId,
    reason,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log mode switch
 * @param {string} sessionId - Session ID
 * @param {string} oldMode - Previous mode
 * @param {string} newMode - New mode
 * @param {string} reason - Reason for mode switch (optional)
 * @returns {Promise<string>} Action ID
 */
async function logModeSwitch(sessionId, oldMode, newMode, reason = null) {
  return await logAction(sessionId, 'mode_switched', {
    oldMode,
    newMode,
    reason,
    timestamp: new Date().toISOString()
  });
}

/**
 * Enhanced intent logging with mode information
 * @param {string} sessionId - Session ID
 * @param {string} intent - Detected intent
 * @param {number} confidence - Confidence score (0-1)
 * @param {string} mode - Detected or set mode (optional)
 * @returns {Promise<string>} Action ID
 */
async function logIntentWithMode(sessionId, intent, confidence, mode = null) {
  const payload = {
    intent,
    confidence,
    timestamp: new Date().toISOString()
  };
  
  if (mode) {
    payload.mode = mode;
  }
  
  return await logAction(sessionId, 'intent_detected', payload);
}

module.exports = {
  logAction,
  getSessionActions,
  logFunctionCall,
  logIntent,
  logIntentWithMode,
  logValidationFailure,
  logHandover,
  logModeSwitch
};
