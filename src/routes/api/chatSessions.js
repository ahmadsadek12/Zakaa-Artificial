// Chat Sessions API Routes
// Manages chat sessions for employee handover and monitoring

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const sessionManager = require('../../services/llm/sessionManager');
const botActionLogger = require('../../services/llm/botActionLogger');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { authenticateToken } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');

// All routes require authentication and tenant isolation
router.use(authenticateToken);
router.use(tenantIsolation);

/**
 * GET /api/chat-sessions - List chat sessions
 * Business owners see all sessions, employees see only assigned sessions
 */
router.get('/', asyncHandler(async (req, res) => {
  const businessId = req.businessId;
  const employeeId = req.isEmployee ? req.user.id : null;
  
  const sessions = await sessionManager.getBusinessSessions(businessId, employeeId);
  
  // Get action counts for each session
  const sessionsWithActions = await Promise.all(
    sessions.map(async (session) => {
      const actions = await botActionLogger.getSessionActions(session.id, 10);
      return {
        ...session,
        recentActions: actions.length,
        lastActionAt: actions.length > 0 ? actions[0].created_at : null
      };
    })
  );
  
  res.json({
    success: true,
    data: sessionsWithActions
  });
}));

/**
 * GET /api/chat-sessions/:id - Get session details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const businessId = req.businessId;
  
  const session = await sessionManager.getSession(sessionId, businessId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: { message: 'Session not found' }
    });
  }
  
  // Employees can only access assigned sessions
  if (req.isEmployee && session.assigned_employee_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied: Session not assigned to you' }
    });
  }
  
  // Get all actions for this session
  const actions = await botActionLogger.getSessionActions(session.id);
  
  res.json({
    success: true,
    data: {
      ...session,
      actions
    }
  });
}));

/**
 * PUT /api/chat-sessions/:id/assign - Assign employee to session
 * Only business owners can assign
 */
router.put('/:id/assign', [
  body('employeeId').isUUID().withMessage('Employee ID must be a valid UUID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }
  
  // Only business owners can assign
  if (req.isEmployee) {
    return res.status(403).json({
      success: false,
      error: { message: 'Only business owners can assign sessions' }
    });
  }
  
  const sessionId = req.params.id;
  const employeeId = req.body.employeeId;
  const businessId = req.businessId;
  
  // Verify session belongs to business
  const session = await sessionManager.getSession(sessionId, businessId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: { message: 'Session not found' }
    });
  }
  
  // Verify employee belongs to business
  const userRepository = require('../../repositories/userRepository');
  const employeeBusinessId = await userRepository.getEmployeeBusinessId(employeeId);
  if (employeeBusinessId !== businessId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Employee does not belong to this business' }
    });
  }
  
  // Assign employee
  await sessionManager.assignEmployee(sessionId, employeeId);
  
  // Log handover
  await botActionLogger.logHandover(sessionId, employeeId, 'Manual assignment by business owner');
  
  res.json({
    success: true,
    message: 'Employee assigned to session'
  });
}));

/**
 * PUT /api/chat-sessions/:id/unlock - Unlock session
 */
router.put('/:id/unlock', asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const businessId = req.businessId;
  
  // Verify session belongs to business
  const session = await sessionManager.getSession(sessionId, businessId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: { message: 'Session not found' }
    });
  }
  
  // Employees can only unlock their assigned sessions
  if (req.isEmployee && session.assigned_employee_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied: Session not assigned to you' }
    });
  }
  
  await sessionManager.unlockSession(sessionId);
  
  res.json({
    success: true,
    message: 'Session unlocked'
  });
}));

module.exports = router;
