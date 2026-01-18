// LLM Chatbot Service
// Handle messages with OpenAI integration and conversation management

const OpenAI = require('openai');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');
const promptBuilder = require('./promptBuilder');
const languageDetector = require('./languageDetector');
const cartManager = require('./cartManager');
const conversationManager = require('./conversationManager');
const orderService = require('../order/orderService');
const { getMongoCollection } = require('../../config/database');
const { getAvailableFunctions, executeFunction } = require('./chatbotFunctions');
const rateLimiter = require('../../utils/rateLimiter');

// Create OpenAI client - will be reinitialized if API key changes
let openai = new OpenAI({
  apiKey: CONSTANTS.OPENAI_API_KEY
});

/**
 * Reinitialize OpenAI client with new API key (useful if key changes)
 */
function reinitializeOpenAIClient() {
  openai = new OpenAI({
    apiKey: CONSTANTS.OPENAI_API_KEY
  });
  logger.info('OpenAI client reinitialized with new API key');
}

/**
 * Sanitize LLM response before sending to WhatsApp
 * - Remove malicious content
 * - Limit length (WhatsApp limit: 4096 characters)
 * - Escape special characters if needed
 */
function sanitizeResponse(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // WhatsApp message limit: 4096 characters per message
  const MAX_LENGTH = 4096;
  
  // Truncate if too long
  if (text.length > MAX_LENGTH) {
    logger.warn('LLM response exceeded maximum length, truncating', { 
      originalLength: text.length,
      maxLength: MAX_LENGTH
    });
    text = text.substring(0, MAX_LENGTH - 100) + '\n\n[Message truncated...]';
  }
  
  // Remove potential script tags or HTML that could be injected
  // Note: WhatsApp messages are plain text, but sanitize anyway for safety
  text = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, ''); // Remove any HTML tags
  
  // Remove excessive whitespace
  text = text.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines
  text = text.replace(/[ \t]{3,}/g, '  '); // Max 2 consecutive spaces
  
  // Trim
  text = text.trim();
  
  return text;
}

/**
 * Get conversation history - reset after 3 hours of inactivity or when customer requests fresh start
 * Note: Orders (previous/ongoing/scheduled) are always accessible from database regardless of conversation history
 */
async function getConversationHistory(businessId, branchId, customerPhoneNumber, currentMessage = '', limit = 50) {
  try {
    const messageLogs = await getMongoCollection('message_logs');
    if (!messageLogs) {
      // MongoDB not available - return empty array (conversation will work without history)
      logger.warn('MongoDB not available, skipping conversation history', {
        businessId,
        branchId,
        customerPhoneNumber
      });
      return [];
    }
    
    // Check if customer explicitly requested a fresh start
    const freshStartPhrases = [
      'start fresh', 'fresh start', 'new conversation', 'start new',
      'forget everything', 'forget all', 'reset conversation', 'reset chat',
      'clear history', 'start over', 'begin again', 'new chat'
    ];
    const messageLower = (currentMessage || '').toLowerCase();
    const requestedFreshStart = freshStartPhrases.some(phrase => messageLower.includes(phrase));
    
    if (requestedFreshStart) {
      logger.info('Customer requested fresh start - resetting conversation history', {
        customerPhoneNumber,
        message: currentMessage.substring(0, 50)
      });
      return [];
    }
    
    // Get the last message timestamp to check if more than 3 hours have passed
    const lastMessageQuery = {
      business_id: businessId,
      branch_id: branchId || businessId,
      customer_phone_number: customerPhoneNumber
    };
    
    const lastMessage = await messageLogs
      .findOne(lastMessageQuery, { sort: { timestamp: -1 } });
    
    if (lastMessage) {
      const lastMessageTime = new Date(lastMessage.timestamp);
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      
      // If last message was more than 3 hours ago, reset conversation (fresh start)
      if (lastMessageTime < threeHoursAgo) {
        logger.info('Last message was more than 3 hours ago - resetting conversation history', {
          customerPhoneNumber,
          lastMessageTime: lastMessageTime.toISOString(),
          hoursSinceLastMessage: (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60)
        });
        return [];
      }
    }
    
    // Get messages from the last 3 hours (for active conversations)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    
    const query = {
      business_id: businessId,
      branch_id: branchId || businessId,
      customer_phone_number: customerPhoneNumber,
      timestamp: { $gte: threeHoursAgo }
    };
    
    logger.info('Fetching conversation history', {
      businessId,
      branchId: branchId || businessId,
      customerPhoneNumber,
      query
    });
    
    const allMessages = await messageLogs
      .find(query)
      .sort({ timestamp: 1 })
      .limit(limit)
      .toArray();
    
    logger.info('Conversation history retrieved', {
      customerPhoneNumber,
      messageCount: allMessages.length,
      messages: allMessages.map(m => ({
        direction: m.direction,
        timestamp: m.timestamp,
        textPreview: (m.text || '').substring(0, 50)
      }))
    });
    
    // Map to role and text
    const formattedMessages = allMessages.map(m => ({
      role: m.direction === 'inbound' ? 'customer' : 'assistant',
      text: m.text || ''
    }));
    
    return formattedMessages;
  } catch (error) {
    // MongoDB unavailable or error - log as warning so we can see it
    logger.error('Error getting conversation history (MongoDB may be unavailable):', {
      error: error.message,
      stack: error.stack,
      businessId,
      branchId,
      customerPhoneNumber
    });
    return [];
  }
}

/**
 * Handle incoming message with full conversation context
 * Uses OpenAI function calling to directly modify the database
 */
async function handleMessage({ business, branch, customerPhoneNumber, message, messageType, messageId, whatsappUserId }) {
  try {
    // Check if OpenAI API key is configured
    if (!CONSTANTS.OPENAI_API_KEY || CONSTANTS.OPENAI_API_KEY.trim() === '') {
      logger.error('OpenAI API key is not configured or is empty');
      return {
        text: 'Sorry, the AI service is not configured. Please contact support.',
        language: 'english',
        cart: null
      };
    }
    
    // Reinitialize client in case API key changed (hot reload)
    // Check if current key matches the constant
    const currentKey = process.env.OPENAI_API_KEY;
    if (currentKey && currentKey !== CONSTANTS.OPENAI_API_KEY) {
      logger.info('OpenAI API key changed, reinitializing client');
      CONSTANTS.OPENAI_API_KEY = currentKey;
      reinitializeOpenAIClient();
    }
    
    // Get conversation history first to check if this is first message
    // Pass current message to detect if customer requested fresh start
    const messageHistory = await getConversationHistory(
      business.id, 
      branch?.id || business.id, 
      customerPhoneNumber,
      message // Pass current message to check for fresh start requests
    );
    
    logger.info('Conversation history loaded', { 
      customerPhoneNumber, 
      messageCount: messageHistory.length,
      isFirstMessage: messageHistory.length === 0,
      messages: messageHistory.map(m => ({ role: m.role, textPreview: m.text.substring(0, 50) }))
    });
    
    // Get or create cart
    const cart = await cartManager.getCart(
      business.id, 
      branch?.id || business.id, 
      customerPhoneNumber
    );
    
    // Automatically detect language from incoming message
    // Respond in Arabic only if Arabic script is detected, otherwise English
    const detectedLanguage = await languageDetector.detectLanguage(message);
    const language = detectedLanguage === 'arabic' ? 'arabic' : 'english';
    
    logger.info('Language detection', { 
      customerPhoneNumber, 
      messagePreview: message.substring(0, 50),
      detectedLanguage,
      responseLanguage: language
    });
    
    logger.info('Building prompt with detected language', { customerPhoneNumber, language, isFirstMessage: messageHistory.length === 0 });
    
    // Build prompt with full context
    const prompt = await promptBuilder.buildPrompt({
      business,
      branch,
      customerPhoneNumber,
      message,
      language,
      messageHistory,
      isFirstMessage: messageHistory.length === 0
    });
    
    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: prompt.system }
    ];
    
    // Add conversation history (REDUCED - only for conversational flow, NOT for business data)
    // Limit to 5 messages to prevent outdated business info from influencing responses
    for (const msg of messageHistory.slice(-5)) {
      messages.push({
        role: msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.text
      });
    }
    
    // Add current message
    messages.push({ role: 'user', content: prompt.user });
    
    // Get available functions
    const tools = getAvailableFunctions();
    
    logger.info('System prompt language instruction', { 
      customerPhoneNumber,
      language,
      promptPreview: prompt.system.substring(0, 300) 
    });
    
    // Call OpenAI with function calling enabled (with rate limiting)
    let completion = await rateLimiter.execute(
      async () => await openai.chat.completions.create({
        model: CONSTANTS.OPENAI_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: 'auto', // Let OpenAI decide when to call functions
        max_completion_tokens: CONSTANTS.OPENAI_MAX_TOKENS,
        temperature: CONSTANTS.OPENAI_TEMPERATURE
      }),
      `OpenAI API call for ${customerPhoneNumber}`
    );
    
    let assistantMessage = completion.choices[0].message;
    let updatedCart = cart;
    let orderCreated = false;
    let orderId = null;
    
    // Handle function calls (can be multiple)
    const context = { business, branch, customerPhoneNumber, language };
    
    // Keep processing until we get a final text response (max 5 iterations to prevent infinite loops)
    let iterations = 0;
    const maxIterations = 5;
    
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
      iterations++;
      
      // Add assistant's message (with tool calls) to messages
      messages.push(assistantMessage);
      
      // Execute all function calls (batch them to reduce API calls)
      const functionResults = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        logger.info('Executing function call', { functionName, args: functionArgs });
        
        try {
          // Execute the function
          const result = await executeFunction(functionName, functionArgs, context);
          
          // Handle confirm_order specially
          if (functionName === 'confirm_order' && result.success && result.readyToConfirm) {
            // Process order creation
            const orderResult = await conversationManager.processChatbotResponse({
              business,
              branch,
              customerPhoneNumber,
              message,
              response: { text: 'Order confirmed' },
              cart: result.cart,
              language
            });
            
            if (orderResult.orderCreated) {
              orderCreated = true;
              orderId = orderResult.orderId;
              result.orderNumber = orderResult.orderNumber || orderId.substring(0, 8).toUpperCase();
              result.message = `Order confirmed! Your order #${result.orderNumber} has been placed.`;
            }
          }
          
          // Update cart if function modified it
          if (result.cart) {
            updatedCart = result.cart;
          }
          
          // Track image URLs from function results
          if (result.shouldSendImage && result.imageUrl) {
            if (!context.imagesToSend) {
              context.imagesToSend = [];
            }
            context.imagesToSend.push({
              url: result.imageUrl,
              caption: result.message || `Image of ${result.itemName || 'item'}`
            });
          }
          
          // Track PDF URLs from function results
          if (result.shouldSendPdf) {
            if (!context.pdfsToSend) {
              context.pdfsToSend = [];
            }
            // Handle single PDF or array of PDFs
            if (result.pdfUrl) {
              context.pdfsToSend.push({
                url: result.pdfUrl,
                caption: result.message || `Menu PDF for ${result.menuName || 'menu'}`
              });
            } else if (result.pdfUrls && Array.isArray(result.pdfUrls) && result.pdfUrls.length > 0) {
              // Multiple PDFs (from get_menu_items)
              for (const pdfUrl of result.pdfUrls) {
                context.pdfsToSend.push({
                  url: pdfUrl,
                  caption: result.message || 'Menu PDF'
                });
              }
            }
          }
          
          // Track menu image URLs from function results
          if (result.shouldSendImages && result.imageUrls && Array.isArray(result.imageUrls) && result.imageUrls.length > 0) {
            if (!context.imagesToSend) {
              context.imagesToSend = [];
            }
            // Add all menu images
            for (const imageUrl of result.imageUrls) {
              context.imagesToSend.push({
                url: imageUrl,
                caption: result.message || `Menu image for ${result.menuName || 'menu'}`
              });
            }
          }
          
          functionResults.push({
            tool_call_id: toolCall.id,
            result: result
          });
        } catch (error) {
          logger.error(`Error executing function ${functionName}:`, error);
          functionResults.push({
            tool_call_id: toolCall.id,
            result: {
              success: false,
              error: error.message
            }
          });
        }
      }
      
      // Add all function results to messages
      for (const { tool_call_id, result } of functionResults) {
        messages.push({
          role: 'tool',
          tool_call_id: tool_call_id,
          content: JSON.stringify(result)
        });
      }
      
      // Get next response from OpenAI (with function results) - with rate limiting
      completion = await rateLimiter.execute(
        async () => await openai.chat.completions.create({
          model: CONSTANTS.OPENAI_MODEL,
          messages: messages,
          tools: tools,
          tool_choice: 'auto',
          max_completion_tokens: CONSTANTS.OPENAI_MAX_TOKENS,
          temperature: CONSTANTS.OPENAI_TEMPERATURE
        }),
        `OpenAI follow-up call ${iterations} for ${customerPhoneNumber}`
      );
      
      assistantMessage = completion.choices[0].message;
    }
    
    if (iterations >= maxIterations) {
      logger.warn('Reached max iterations for function calling loop', { customerPhoneNumber });
    }
    
    // Get final text response
    let responseText = assistantMessage.content || 'Sorry, I encountered an issue. Please try again.';
    
    // Replace ORDER_ID placeholder if order was created
    if (orderCreated && orderId) {
      const orderNumber = orderId.substring(0, 8).toUpperCase();
      responseText = responseText.replace(/ORDER_ID/g, orderNumber);
    }
    
    // Sanitize LLM response
    responseText = sanitizeResponse(responseText);
    
    logger.info('LLM response generated with function calling', { 
      customerPhoneNumber, 
      language,
      tokens: completion.usage?.total_tokens,
      orderCreated,
      functionCalls: messages.filter(m => m.tool_calls).length
    });
    
    return {
      text: responseText,
      language,
      messageId,
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      cart: updatedCart,
      orderCreated,
      orderId,
      imagesToSend: context.imagesToSend || [],
      pdfsToSend: context.pdfsToSend || []
    };
  } catch (error) {
    logger.error('Error in chatbot service:', {
      error: error.message,
      stack: error.stack,
      customerPhoneNumber
    });
    
    // Provide more helpful error message based on error type
    let errorMessage = 'Sorry, I encountered an error. Please try again later.';
    
    if (error.message && error.message.includes('API key')) {
      errorMessage = 'Sorry, the AI service is not properly configured. Please contact support.';
    } else if (error.message && (error.message.includes('quota') || error.message.includes('Quota') || error.message.includes('exceeded') && error.message.includes('quota'))) {
      errorMessage = 'OpenAI API quota exceeded. The account has no credits or billing is not set up. Please check account billing at https://platform.openai.com/account/billing';
      logger.error('OpenAI quota/billing error - account needs credits or billing setup', {
        error: error.message,
        status: error.status,
        code: error.code
      });
    } else if (error.message && error.message.includes('rate limit')) {
      errorMessage = 'Sorry, the service is busy right now. Please try again in a moment.';
    } else if (error.status === 429) {
      // Generic 429 error - could be rate limit or quota
      if (error.message?.includes('insufficient_funds') || error.message?.includes('billing')) {
        errorMessage = 'OpenAI API quota exceeded. Please check account billing and add credits.';
      } else {
        errorMessage = 'Sorry, too many requests. Please try again in a moment.';
      }
    } else if (error.status === 401) {
      errorMessage = 'Invalid OpenAI API key. Please check your API key configuration.';
      logger.error('OpenAI authentication failed - invalid API key');
    }
    
    return {
      text: errorMessage,
      language: 'english',
      cart: null
    };
  }
}

module.exports = {
  handleMessage,
  getConversationHistory,
  sanitizeResponse // Export for testing
};
