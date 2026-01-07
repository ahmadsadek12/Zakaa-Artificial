// LLM Chatbot Service
// Handle messages with OpenAI integration

const OpenAI = require('openai');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');
const promptBuilder = require('./promptBuilder');
const languageDetector = require('./languageDetector');

const openai = new OpenAI({
  apiKey: CONSTANTS.OPENAI_API_KEY
});

/**
 * Handle incoming message
 */
async function handleMessage({ business, branch, customerPhoneNumber, message, messageType, messageId }) {
  try {
    // Detect language
    const language = await languageDetector.detectLanguage(message);
    
    // Build prompt with business context
    const prompt = await promptBuilder.buildPrompt({
      business,
      branch,
      customerPhoneNumber,
      message,
      language
    });
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: CONSTANTS.OPENAI_MODEL,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      max_tokens: CONSTANTS.OPENAI_MAX_TOKENS,
      temperature: CONSTANTS.OPENAI_TEMPERATURE
    });
    
    const responseText = completion.choices[0].message.content;
    
    logger.info('LLM response generated', { 
      customerPhoneNumber, 
      tokens: completion.usage?.total_tokens 
    });
    
    return {
      text: responseText,
      language,
      messageId,
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens
    };
  } catch (error) {
    logger.error('Error in chatbot service:', error);
    return {
      text: 'Sorry, I encountered an error. Please try again later.',
      language: 'english'
    };
  }
}

module.exports = {
  handleMessage
};
