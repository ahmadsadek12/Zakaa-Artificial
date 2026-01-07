// Application Constants
// Centralized constants for the application

require('dotenv').config();

const CONSTANTS = {
  // App
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key-here',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // WhatsApp
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v21.0',
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'your-webhook-verify-token',
  WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET || 'your-webhook-secret',
  
  // OpenAI / LLM
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
  OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  
  // Archival
  ARCHIVE_ORDER_AGE_HOURS: parseInt(process.env.ARCHIVE_ORDER_AGE_HOURS || '24'),
  ARCHIVE_JOB_CRON: process.env.ARCHIVE_JOB_CRON || '0 2 * * *', // Daily at 2 AM
  
  // Feature Flags
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true',
  ENABLE_SCHEDULED_ORDERS: process.env.ENABLE_SCHEDULED_ORDERS === 'true',
  
  // User Types
  USER_TYPES: {
    ADMIN: 'admin',
    BUSINESS: 'business',
    CUSTOMER: 'customer'
  },
  
  // Subscription Types
  SUBSCRIPTION_TYPES: {
    STANDARD: 'standard',
    PREMIUM: 'premium'
  },
  
  // Subscription Status
  SUBSCRIPTION_STATUS: {
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    CANCELED: 'canceled'
  },
  
  // Order Status
  ORDER_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    PREPARING: 'preparing',
    READY: 'ready',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  // Delivery Types
  DELIVERY_TYPES: {
    TAKEAWAY: 'takeaway',
    DELIVERY: 'delivery',
    ON_SITE: 'on_site'
  },
  
  // Languages
  LANGUAGES: {
    ARABIC: 'arabic',
    ARABIZI: 'arabizi',
    ENGLISH: 'english',
    FRENCH: 'french'
  },
  
  // Business Types
  BUSINESS_TYPES: {
    RESTAURANT: 'restaurant',
    SPORTS_COURT: 'sports_court',
    SALON: 'salon',
    OTHER: 'other'
  },
  
  // Defaults
  DEFAULT_TIMEZONE: 'Asia/Beirut',
  DEFAULT_LANGUAGE: 'arabic',
  DEFAULT_SUBSCRIPTION_TYPE: 'standard',
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
};

module.exports = CONSTANTS;
