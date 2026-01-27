// Session Functions
// Functions for intent detection, mode switching, and session management

const sessionManager = require('../sessionManager');
const botActionLogger = require('../botActionLogger');
const logger = require('../../../utils/logger');

/**
 * Get session function definitions for OpenAI
 */
function getSessionFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'detect_intent_and_set_mode',
        description: 'Detect customer intent and set the conversation mode. Use this at the START of conversations or when customer intent is unclear. Mode determines the conversation flow: delivery (home delivery orders), takeaway (pickup orders), dine_in (table reservations/dine-in orders), or support (general questions/support). This should be called BEFORE any order or reservation functions. Mode is separate from delivery_type - mode is the conversation intent, delivery_type is the order preference.',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['delivery', 'takeaway', 'dine_in', 'support'],
              description: 'Detected conversation mode: delivery (home delivery), takeaway (pickup), dine_in (table reservations/dine-in), or support (general questions)'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score (0-1) for the detected intent',
              minimum: 0,
              maximum: 1
            }
          },
          required: ['mode']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'switch_conversation_mode',
        description: 'Switch the conversation to a different mode. Use this when customer changes their intent mid-conversation (e.g., switches from ordering to asking questions, or changes from delivery to takeaway). This safely resets incompatible data and updates the session state.',
        parameters: {
          type: 'object',
          properties: {
            newMode: {
              type: 'string',
              enum: ['delivery', 'takeaway', 'dine_in', 'support'],
              description: 'New conversation mode to switch to'
            }
          },
          required: ['newMode']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'resume_chat_session',
        description: 'Resume a previous chat session. Use this when customer references a previous conversation or when recovering from a disconnect. Returns the session state including step and draft data.',
        parameters: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to resume (optional - if not provided, will use current session)'
            }
          },
          required: []
        }
      }
    }
  ];
}

/**
 * Execute session function
 */
async function executeSessionFunction(functionName, args, context) {
  const { business, branch, customerPhoneNumber, session } = context;
  
  if (!session || !session.id) {
    return {
      success: false,
      error: 'Session not found. Cannot execute session function.'
    };
  }
  
  const sessionId = session.id;
  
  switch (functionName) {
    case 'detect_intent_and_set_mode': {
      const { mode, confidence = 0.8 } = args;
      
      if (!mode) {
        return {
          success: false,
          error: 'Mode is required'
        };
      }
      
      const validModes = ['delivery', 'takeaway', 'dine_in', 'support'];
      if (!validModes.includes(mode)) {
        return {
          success: false,
          error: `Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`
        };
      }
      
      try {
        // Get current session mode
        const currentSession = await sessionManager.getSession(sessionId);
        const currentMode = currentSession?.mode || 'support';
        
        // If mode is different, switch it
        if (currentMode !== mode) {
          await sessionManager.switchSessionMode(sessionId, mode, 'Intent detected');
        }
        
        // Log intent detection with mode
        await botActionLogger.logIntentWithMode(sessionId, 'intent_detected', confidence, mode);
        
        logger.info('Intent detected and mode set', {
          sessionId,
          mode,
          confidence,
          previousMode: currentMode
        });
        
        return {
          success: true,
          message: `Conversation mode set to: ${mode}`,
          mode,
          confidence
        };
      } catch (error) {
        logger.error('Error detecting intent and setting mode:', error);
        return {
          success: false,
          error: `Failed to set mode: ${error.message}`
        };
      }
    }
    
    case 'switch_conversation_mode': {
      const { newMode } = args;
      
      if (!newMode) {
        return {
          success: false,
          error: 'newMode is required'
        };
      }
      
      const validModes = ['delivery', 'takeaway', 'dine_in', 'support'];
      if (!validModes.includes(newMode)) {
        return {
          success: false,
          error: `Invalid mode: ${newMode}. Must be one of: ${validModes.join(', ')}`
        };
      }
      
      try {
        const updatedSession = await sessionManager.switchSessionMode(
          sessionId,
          newMode,
          'Customer changed intent'
        );
        
        logger.info('Conversation mode switched', {
          sessionId,
          newMode,
          oldMode: session.mode
        });
        
        return {
          success: true,
          message: `Conversation mode switched to: ${newMode}`,
          mode: newMode,
          step: updatedSession.step
        };
      } catch (error) {
        logger.error('Error switching conversation mode:', error);
        return {
          success: false,
          error: `Failed to switch mode: ${error.message}`
        };
      }
    }
    
    case 'resume_chat_session': {
      const { sessionId: requestedSessionId } = args;
      const targetSessionId = requestedSessionId || sessionId;
      
      try {
        const resumedSession = await sessionManager.resumeSession(targetSessionId, business.id);
        
        if (!resumedSession) {
          return {
            success: false,
            error: 'Session not found'
          };
        }
        
        logger.info('Session resumed', {
          sessionId: targetSessionId,
          mode: resumedSession.mode,
          step: resumedSession.step
        });
        
        return {
          success: true,
          message: `Session resumed. Current mode: ${resumedSession.mode}, Step: ${resumedSession.step}`,
          session: {
            id: resumedSession.id,
            mode: resumedSession.mode,
            step: resumedSession.step,
            draft_payload: resumedSession.draft_payload
          }
        };
      } catch (error) {
        logger.error('Error resuming session:', error);
        return {
          success: false,
          error: `Failed to resume session: ${error.message}`
        };
      }
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getSessionFunctionDefinitions,
  executeSessionFunction
};
