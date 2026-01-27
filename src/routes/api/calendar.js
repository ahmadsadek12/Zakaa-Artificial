// Calendar API Routes
// Unified calendar for scheduled requests and reservations

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const calendarService = require('../../services/calendar/calendarService');
const googleCalendarService = require('../../services/calendar/googleCalendarService');
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

/**
 * Get Google Calendar OAuth URL
 * GET /api/calendar/google/oauth/url
 */
router.get('/google/oauth/url', asyncHandler(async (req, res) => {
  try {
    const authUrl = googleCalendarService.getAuthUrl(req.businessId);
    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    logger.error('Error generating Google OAuth URL:', error);
    
    // Check if it's a credentials configuration error
    if (error.message && error.message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        error: { 
          message: 'Google Calendar integration is not configured. Please contact support.',
          details: 'Google OAuth credentials are missing from server configuration.'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate OAuth URL' }
    });
  }
}));

/**
 * Google Calendar OAuth callback
 * GET /api/calendar/google/oauth/callback
 */
router.get('/google/oauth/callback', asyncHandler(async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: { message: 'Authorization code missing' }
      });
    }

    const businessId = state || req.businessId;
    
    // Verify business ID matches authenticated user
    const roleScope = req.user?.roleScope || req.user?.role_scope;
    const userType = req.user?.userType || req.user?.user_type;
    if (businessId !== req.businessId && roleScope !== 'platform_admin' && userType !== CONSTANTS.USER_TYPES.ADMIN) {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized' }
      });
    }

    await googleCalendarService.exchangeCodeForTokens(code, businessId);
    
    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?google_calendar=connected`);
  } catch (error) {
    logger.error('Error in Google OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?google_calendar=error&message=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * Get Google Calendar connection status
 * GET /api/calendar/google/status
 */
router.get('/google/status', asyncHandler(async (req, res) => {
  try {
    const status = await googleCalendarService.getConnectionStatus(req.businessId);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting Google Calendar status:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get Google Calendar status' }
    });
  }
}));

/**
 * Disconnect Google Calendar
 * DELETE /api/calendar/google
 */
router.delete('/google', asyncHandler(async (req, res) => {
  try {
    await googleCalendarService.disconnectGoogleCalendar(req.businessId);
    res.json({
      success: true,
      message: 'Google Calendar disconnected successfully'
    });
  } catch (error) {
    logger.error('Error disconnecting Google Calendar:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to disconnect Google Calendar' }
    });
  }
}));

/**
 * Sync calendar events to Google Calendar
 * POST /api/calendar/google/sync
 */
router.post('/google/sync', asyncHandler(async (req, res) => {
  try {
    const { from, to } = req.query;
    
    // Default to current month if not provided
    const today = new Date();
    const defaultFrom = from || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = to || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Get calendar events
    const events = await calendarService.getCalendarEvents(req.businessId, defaultFrom, defaultTo);
    
    // Sync each event to Google Calendar
    const syncResults = [];
    for (const event of events) {
      try {
        const googleEventId = await googleCalendarService.syncEventToGoogle(req.businessId, {
          title: event.title,
          startAt: event.startAt,
          endAt: event.endAt || event.startAt,
          description: event.notes || `Type: ${event.type}`,
          customerPhoneNumber: event.customerPhoneNumber,
          customerName: event.customerName,
          location: event.location
        });
        syncResults.push({ eventId: event.id, googleEventId, success: true });
      } catch (error) {
        logger.error(`Error syncing event ${event.id} to Google Calendar:`, error);
        syncResults.push({ eventId: event.id, success: false, error: error.message });
      }
    }
    
    res.json({
      success: true,
      data: {
        synced: syncResults.filter(r => r.success).length,
        failed: syncResults.filter(r => !r.success).length,
        results: syncResults
      }
    });
  } catch (error) {
    logger.error('Error syncing to Google Calendar:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to sync to Google Calendar' }
    });
  }
}));

module.exports = router;
