// Rate Limiter for OpenAI API
// Handles rate limiting and retries with exponential backoff

const logger = require('./logger');

class RateLimiter {
  constructor(maxRequestsPerMinute = 3, maxRetries = 3) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.maxRetries = maxRetries;
    this.requests = []; // Track request timestamps
    this.queue = []; // Queue of pending requests
    this.processing = false;
  }

  /**
   * Wait for rate limit window
   */
  async waitForRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests (older than 1 minute)
    this.requests = this.requests.filter(timestamp => timestamp > oneMinuteAgo);

    // If we've hit the limit, wait
    if (this.requests.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest) + 1000; // Add 1 second buffer
      
      logger.warn(`Rate limit reached (${this.requests.length}/${this.maxRequestsPerMinute}). Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Clean up after waiting
      this.requests = this.requests.filter(timestamp => timestamp > Date.now() - 60000);
    }

    // Record this request
    this.requests.push(Date.now());
  }

  /**
   * Execute function with rate limiting and retry
   */
  async execute(func, context = '') {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Wait for rate limit window
        await this.waitForRateLimit();
        
        // Execute the function
        const result = await func();
        
        if (attempt > 0) {
          logger.info(`Request succeeded after ${attempt} retries`, { context });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if it's a rate limit error (429) or quota error (429 with specific message)
        const isRateLimit = error.status === 429 && 
                           (error.message?.includes('rate limit') ||
                            error.message?.includes('Rate limit') ||
                            error.message?.includes('RPM'));
        
        // Check if it's a quota/billing error (different from rate limit)
        const isQuotaError = error.status === 429 && 
                            (error.message?.includes('quota') ||
                             error.message?.includes('Quota') ||
                             error.message?.includes('billing') ||
                             error.message?.includes('Billing') ||
                             error.message?.includes('insufficient_funds') ||
                             error.message?.includes('exceeded'));
        
        if (isQuotaError) {
          // Quota errors should not retry - account has no credits
          logger.error('OpenAI quota/billing error - account has no credits or exceeded quota', {
            context,
            error: error.message,
            status: error.status,
            code: error.code
          });
          throw new Error('OpenAI API quota exceeded. Please check your account billing and credits at https://platform.openai.com/account/billing');
        }
        
        if (isRateLimit) {
          const retryAfter = error.response?.headers?.['retry-after'] || 
                            (error.message?.match(/Please try again in (\d+)s/)?.[1] * 1000) ||
                            60000; // Default 60 seconds
          
          if (attempt < this.maxRetries - 1) {
            logger.warn(`Rate limit error (attempt ${attempt + 1}/${this.maxRetries}). Retrying after ${retryAfter / 1000}s...`, {
              context,
              error: error.message
            });
            
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            
            // Reset rate limit tracking after waiting
            this.requests = [];
            continue;
          }
        }
        
        // For non-rate-limit errors, throw immediately
        if (!isRateLimit && !isQuotaError) {
          throw error;
        }
      }
    }
    
    // If we get here, all retries failed
    logger.error(`Request failed after ${this.maxRetries} retries`, {
      context,
      error: lastError?.message
    });
    
    throw lastError || new Error('Request failed after retries');
  }
}

// Singleton instance
const rateLimiter = new RateLimiter(
  parseInt(process.env.OPENAI_MAX_RPM || '3'), // Default to 3 for free tier
  parseInt(process.env.OPENAI_MAX_RETRIES || '3')
);

module.exports = rateLimiter;
