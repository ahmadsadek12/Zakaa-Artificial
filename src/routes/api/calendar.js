// Calendar API Routes
// Unified calendar for scheduled requests and reservations

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const calendarService = require('../../services/calendar/calendarService');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * Get unified calendar events (scheduled requests + reservations)
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/', [
  query('from').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('from must be in YYYY-MM-DD format'),
  query('to').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('to must be in YYYY-MM-DD format')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }
  
  try {
    const { from, to } = req.query;
    
    // Default to current month if not provided
    const today = new Date();
    const defaultFrom = from || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = to || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const events = await calendarService.getCalendarEvents(req.businessId, defaultFrom, defaultTo);
    
    res.json({
      success: true,
      data: { events }
    });
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch calendar events' }
    });
  }
}));

module.exports = router;
