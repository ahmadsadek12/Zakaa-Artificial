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
 * Get conversation history from the last hour
 */
async function getConversationHistory(businessId, branchId, customerPhoneNumber, limit = 50) {
  try {
    const messageLogs = await getMongoCollection('message_logs');
    if (!messageLogs) {
      // MongoDB not available - return empty array (conversation will work without history)
      logger.debug('MongoDB not available, skipping conversation history');
      return [];
    }
    
    // Get messages from the last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const allMessages = await messageLogs
      .find({
        business_id: businessId,
        branch_id: branchId || businessId,
        customer_phone_number: customerPhoneNumber,
        timestamp: { $gte: oneHourAgo }
      })
      .sort({ timestamp: 1 })
      .limit(limit)
      .toArray();
    
    // Map to role and text
    const formattedMessages = allMessages.map(m => ({
      role: m.direction === 'inbound' ? 'customer' : 'assistant',
      text: m.text || ''
    }));
    
    return formattedMessages;
  } catch (error) {
    // MongoDB unavailable or error - return empty array (chatbot will work without history)
    logger.debug('Error getting conversation history (MongoDB may be unavailable):', error.message);
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
    const messageHistory = await getConversationHistory(
      business.id, 
      branch?.id || business.id, 
      customerPhoneNumber
    );
    
    logger.info('Conversation history loaded', { 
      customerPhoneNumber, 
      messageCount: messageHistory.length,
      messages: messageHistory.map(m => ({ role: m.role, textPreview: m.text.substring(0, 50) }))
    });
    
    // Get or create cart (to check existing language preference)
    const cart = await cartManager.getCart(
      business.id, 
      branch?.id || business.id, 
      customerPhoneNumber
    );
    
    // Determine language preference
    // Default to English unless explicitly set to Arabic
    let language = cart.language || 'english';
    const isFirstMessage = messageHistory.length === 0;
    
    logger.info('Language check', { 
      customerPhoneNumber, 
      cartLanguage: cart.language, 
      isFirstMessage,
      messageHistoryLength: messageHistory.length
    });
    
    if (isFirstMessage) {
      logger.info('First message detected - sending language selection', { customerPhoneNumber });
      
      // First message in conversation - ask for language preference
      // Parse business.languages (JSON array) to get available languages
      let availableLanguages = ['english']; // default
      try {
        if (business.languages) {
          availableLanguages = typeof business.languages === 'string' 
            ? JSON.parse(business.languages) 
            : business.languages;
        }
      } catch (e) {
        logger.warn('Could not parse business languages, using default', { error: e.message });
      }
      
      // Build language options text
      const languageMap = {
        'english': 'English',
        'arabic': 'عربي',
        'arabizi': 'Lebanese',
        'french': 'Français'
      };
      
      const languageOptions = availableLanguages
        .map((lang, idx) => `${idx + 1}. ${languageMap[lang] || lang}`)
        .join('\n');
      
      const welcomeMessage = `Welcome to ${business.business_name}! 🌟\n\nPlease choose your preferred language:\n\n${languageOptions}`;
      
      logger.info('Sending language selection message', { 
        customerPhoneNumber, 
        messageLength: welcomeMessage.length 
      });
      
      // Return simple language selection message
      return {
        text: welcomeMessage,
        language: 'english',
        cart: cart
      };
    }
    
    // Check if message is a language selection response (number 1-4)
    // Only trigger this if:
    // 1. Language is not yet set
    // 2. Message is a single digit 1-4
    // 3. Conversation is still early (within first 3 messages from customer)
    const languageSelectionMatch = message.trim().match(/^[1-4]$/);
    const customerMessageCount = messageHistory.filter(m => m.role === 'customer').length;
    
    logger.info('Language selection check', {
      customerPhoneNumber,
      languageSet: !!language,
      messageMatches: !!languageSelectionMatch,
      customerMessageCount,
      willProcessAsLanguageSelection: !language && languageSelectionMatch && customerMessageCount <= 3
    });
    
    if (!language && languageSelectionMatch && customerMessageCount <= 3) {
      logger.info('Processing language selection', { 
        message, 
        customerMessageCount, 
        customerPhoneNumber 
      });
      
      // User is selecting language (number 1-4)
      let availableLanguages = ['english'];
      try {
        if (business.languages) {
          availableLanguages = typeof business.languages === 'string' 
            ? JSON.parse(business.languages) 
            : business.languages;
        }
      } catch (e) {
        availableLanguages = ['english'];
      }
      
      const selectedIndex = parseInt(languageSelectionMatch[0]) - 1;
      logger.info('Language selection details', {
        customerPhoneNumber,
        selectedNumber: languageSelectionMatch[0],
        selectedIndex,
        availableLanguages,
        isValidSelection: selectedIndex >= 0 && selectedIndex < availableLanguages.length
      });
      
      if (selectedIndex >= 0 && selectedIndex < availableLanguages.length) {
        language = availableLanguages[selectedIndex];
        
        logger.info('Updating cart with selected language', { 
          customerPhoneNumber, 
          language 
        });
        
        // Save language preference to cart
        await cartManager.updateCart(business.id, branch?.id || business.id, customerPhoneNumber, {
          language
        });
        
        // Return confirmation in selected language
        const confirmationMap = {
          'english': `Great! I'll assist you in English. How can I help you today?`,
          'arabic': `رائع! سأساعدك بالعربية. كيف يمكنني مساعدتك اليوم؟`,
          'arabizi': `Ktir mnih! Ra7 se3dak bil lebneniye. Kifak, shu baddak?`,
          'french': `Parfait! Je vais vous assister en français. Comment puis-je vous aider aujourd'hui?`
        };
        
        logger.info('Language confirmed and saved', { 
          customerPhoneNumber, 
          language,
          confirmationMessage: confirmationMap[language]
        });
        
        return {
          text: confirmationMap[language] || confirmationMap['english'],
          language: language,
          cart: cart
        };
      }
    }
    
    // Check if user is requesting language change
    const lowerMessage = message.toLowerCase();
    const requestsArabic = lowerMessage.includes('arabic') || lowerMessage.includes('عربي') || lowerMessage.includes('arabi');
    const requestsEnglish = lowerMessage.includes('english') || lowerMessage.includes('انجليزي') || lowerMessage.includes('inglizi');
    
    if (requestsArabic && language !== 'arabic') {
      language = 'arabic';
      logger.info('User requested Arabic language', { customerPhoneNumber });
      await cartManager.updateCart(business.id, branch?.id || business.id, customerPhoneNumber, {
        language: 'arabic'
      });
      
      return {
        text: 'تمام! رح حكيك بالعربي. كيف فيني ساعدك؟',
        language: 'arabic',
        cart: cart
      };
    } else if (requestsEnglish && language !== 'english') {
      language = 'english';
      logger.info('User requested English language', { customerPhoneNumber });
      await cartManager.updateCart(business.id, branch?.id || business.id, customerPhoneNumber, {
        language: 'english'
      });
      
      return {
        text: 'Great! I\'ll assist you in English. How can I help you today?',
        language: 'english',
        cart: cart
      };
    }
    
    logger.info('Using language preference', { 
      customerPhoneNumber, 
      language 
    });
    
    logger.info('Building prompt with language', { customerPhoneNumber, language });
    
    // Build prompt with full context
    const prompt = await promptBuilder.buildPrompt({
      business,
      branch,
      customerPhoneNumber,
      message,
      language,
      messageHistory
    });
    
    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: prompt.system }
    ];
    
    // Add conversation history
    for (const msg of messageHistory.slice(-10)) {
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
    const context = { business, branch, customerPhoneNumber };
    
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
      orderId
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
