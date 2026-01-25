// Google Calendar Service
// Handles OAuth flow and calendar synchronization

const { google } = require('googleapis');
const userRepository = require('../../repositories/userRepository');
const logger = require('../../utils/logger');

// OAuth2 client configuration
function getOAuth2Client() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/calendar/google/oauth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  } catch (error) {
    logger.error('Error creating OAuth2 client:', error);
    throw error;
  }
}

/**
 * Get OAuth authorization URL
 * @param {string} businessId - Business ID
 * @returns {string} Authorization URL
 */
function getAuthUrl(businessId) {
  try {
    const oauth2Client = getOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: businessId, // Pass business ID in state for callback
      prompt: 'consent' // Force consent to get refresh token
    });

    return url;
  } catch (error) {
    logger.error('Error generating Google OAuth URL:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @param {string} businessId - Business ID
 * @returns {Promise<Object>} Tokens object
 */
async function exchangeCodeForTokens(code, businessId) {
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in database
    const integrationData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope,
      calendar_id: 'primary' // Default to primary calendar
    };

    await userRepository.update(businessId, {
      googleCalendarIntegrationJson: JSON.stringify(integrationData)
    });

    logger.info(`Google Calendar tokens stored for business: ${businessId}`);
    return tokens;
  } catch (error) {
    logger.error('Error exchanging code for tokens:', error);
    throw error;
  }
}

/**
 * Get authenticated calendar client for a business
 * @param {string} businessId - Business ID
 * @returns {Promise<Object>} Authenticated calendar client
 */
async function getCalendarClient(businessId) {
  try {
    const user = await userRepository.findById(businessId);
    if (!user || !user.google_calendar_integration_json) {
      throw new Error('Google Calendar not connected for this business');
    }

    const integrationData = JSON.parse(user.google_calendar_integration_json);
    const oauth2Client = getOAuth2Client();

    oauth2Client.setCredentials({
      access_token: integrationData.access_token,
      refresh_token: integrationData.refresh_token,
      expiry_date: integrationData.expiry_date
    });

    // Refresh token if expired
    if (integrationData.expiry_date && new Date(integrationData.expiry_date) <= new Date()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored tokens
      const updatedData = {
        ...integrationData,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      };
      
      await userRepository.update(businessId, {
        googleCalendarIntegrationJson: JSON.stringify(updatedData)
      });

      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return { calendar, calendarId: integrationData.calendar_id || 'primary' };
  } catch (error) {
    logger.error('Error getting calendar client:', error);
    throw error;
  }
}

/**
 * Sync event to Google Calendar
 * @param {string} businessId - Business ID
 * @param {Object} event - Event object with title, startAt, endAt, description, etc.
 * @returns {Promise<string>} Google Calendar event ID
 */
async function syncEventToGoogle(businessId, event) {
  try {
    const { calendar, calendarId } = await getCalendarClient(businessId);

    const googleEvent = {
      summary: event.title,
      description: event.description || `Phone: ${event.customerPhoneNumber || 'N/A'}`,
      start: {
        dateTime: new Date(event.startAt).toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: new Date(event.endAt || event.startAt).toISOString(),
        timeZone: 'UTC'
      }
    };

    // Add location if available
    if (event.location) {
      googleEvent.location = event.location;
    }

    // Add attendees if available
    if (event.customerPhoneNumber) {
      googleEvent.attendees = [{
        email: `${event.customerPhoneNumber}@example.com`, // Placeholder, can be improved
        displayName: event.customerName || event.customerPhoneNumber
      }];
    }

    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: googleEvent
    });

    logger.info(`Event synced to Google Calendar: ${response.data.id} for business: ${businessId}`);
    return response.data.id;
  } catch (error) {
    logger.error('Error syncing event to Google Calendar:', error);
    throw error;
  }
}

/**
 * Update event in Google Calendar
 * @param {string} businessId - Business ID
 * @param {string} googleEventId - Google Calendar event ID
 * @param {Object} event - Updated event object
 * @returns {Promise<void>}
 */
async function updateEventInGoogle(businessId, googleEventId, event) {
  try {
    const { calendar, calendarId } = await getCalendarClient(businessId);

    const googleEvent = {
      summary: event.title,
      description: event.description || `Phone: ${event.customerPhoneNumber || 'N/A'}`,
      start: {
        dateTime: new Date(event.startAt).toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: new Date(event.endAt || event.startAt).toISOString(),
        timeZone: 'UTC'
      }
    };

    if (event.location) {
      googleEvent.location = event.location;
    }

    await calendar.events.update({
      calendarId: calendarId,
      eventId: googleEventId,
      resource: googleEvent
    });

    logger.info(`Event updated in Google Calendar: ${googleEventId} for business: ${businessId}`);
  } catch (error) {
    logger.error('Error updating event in Google Calendar:', error);
    throw error;
  }
}

/**
 * Delete event from Google Calendar
 * @param {string} businessId - Business ID
 * @param {string} googleEventId - Google Calendar event ID
 * @returns {Promise<void>}
 */
async function deleteEventFromGoogle(businessId, googleEventId) {
  try {
    const { calendar, calendarId } = await getCalendarClient(businessId);

    await calendar.events.delete({
      calendarId: calendarId,
      eventId: googleEventId
    });

    logger.info(`Event deleted from Google Calendar: ${googleEventId} for business: ${businessId}`);
  } catch (error) {
    logger.error('Error deleting event from Google Calendar:', error);
    throw error;
  }
}

/**
 * Get Google Calendar connection status
 * @param {string} businessId - Business ID
 * @returns {Promise<Object>} Connection status
 */
async function getConnectionStatus(businessId) {
  try {
    const user = await userRepository.findById(businessId);
    if (!user || !user.google_calendar_integration_json) {
      return { connected: false, enabled: false };
    }

    const integrationData = JSON.parse(user.google_calendar_integration_json);
    
    // Test connection by trying to get calendar
    try {
      const { calendar, calendarId } = await getCalendarClient(businessId);
      await calendar.calendars.get({ calendarId });
      
      return {
        connected: true,
        enabled: true,
        calendarId: integrationData.calendar_id || 'primary'
      };
    } catch (error) {
      logger.error('Error testing Google Calendar connection:', error);
      return { connected: false, enabled: false, error: error.message };
    }
  } catch (error) {
    logger.error('Error getting Google Calendar status:', error);
    return { connected: false, enabled: false };
  }
}

/**
 * Disconnect Google Calendar
 * @param {string} businessId - Business ID
 * @returns {Promise<void>}
 */
async function disconnectGoogleCalendar(businessId) {
  try {
    await userRepository.update(businessId, {
      googleCalendarIntegrationJson: null
    });
    logger.info(`Google Calendar disconnected for business: ${businessId}`);
  } catch (error) {
    logger.error('Error disconnecting Google Calendar:', error);
    throw error;
  }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  getCalendarClient,
  syncEventToGoogle,
  updateEventInGoogle,
  deleteEventFromGoogle,
  getConnectionStatus,
  disconnectGoogleCalendar
};
