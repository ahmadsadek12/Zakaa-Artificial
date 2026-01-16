// Express App Setup
// Main application configuration

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const CONSTANTS = require('./config/constants');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/api/auth');
const adminRoutes = require('./routes/api/admin');
const adminProfileRoutes = require('./routes/api/adminProfile');
const businessRoutes = require('./routes/api/businesses');
const branchRoutes = require('./routes/api/branches');
const menuRoutes = require('./routes/api/menus');
const itemRoutes = require('./routes/api/items');
const policyRoutes = require('./routes/api/policies');
const openingHoursRoutes = require('./routes/api/openingHours');
const orderRoutes = require('./routes/api/orders');
const cartRoutes = require('./routes/api/carts');
const analyticsRoutes = require('./routes/api/analytics');
const tableRoutes = require('./routes/api/tables');
const reservationRoutes = require('./routes/api/reservations');
const webhookRoutes = require('./routes/webhook/whatsapp');
const telegramWebhookRoutes = require('./routes/webhook/telegram');

const app = express();

// Security middleware
app.use(helmet());

// Additional security headers
const { secureHeaders } = require('./middleware/security');
app.use(secureHeaders);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Raw body parser for Meta webhook routes (must be before JSON parser)
// Meta WhatsApp webhooks need raw body for signature verification
// This only processes application/json (Meta format)
// Twilio sends form-encoded (application/x-www-form-urlencoded) which will be handled by express.urlencoded()
app.use('/webhook/whatsapp', express.raw({ 
  type: 'application/json', 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for signature verification (Meta only)
    if (buf && buf.length) {
      req.rawBody = buf;
    }
  }
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs (increased from 5)
  skipSuccessfulRequests: true, // Only count failed login attempts
  message: 'Too many login attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/', authLimiter);

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check route (before auth)
app.use('/health', healthRoutes);

// API Documentation (Swagger) - Optional, only in development or if enabled
if (CONSTANTS.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  try {
    const swaggerUi = require('swagger-ui-express');
    const fs = require('fs');
    const path = require('path');
    
    // Try to load swagger.yaml if it exists
    const swaggerYamlPath = path.join(__dirname, '../swagger.yaml');
    if (fs.existsSync(swaggerYamlPath)) {
      const yaml = require('js-yaml');
      const swaggerSpec = yaml.load(fs.readFileSync(swaggerYamlPath, 'utf8'));
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
      logger.info('Swagger API documentation available at /api-docs');
    }
  } catch (error) {
    logger.debug('Swagger UI not available - install swagger-ui-express and js-yaml for API documentation');
  }
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminProfileRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/opening-hours', openingHoursRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/webhook/whatsapp', webhookRoutes);
app.use('/webhook/telegram', telegramWebhookRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
