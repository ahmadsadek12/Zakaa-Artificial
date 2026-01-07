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
const businessRoutes = require('./routes/api/businesses');
const branchRoutes = require('./routes/api/branches');
const webhookRoutes = require('./routes/webhook/whatsapp');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/branches', branchRoutes);
// app.use('/api/menus', menuRoutes);
// app.use('/api/items', itemRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/policies', policyRoutes);
// app.use('/api/opening-hours', openingHoursRoutes);
// app.use('/api/analytics', analyticsRoutes);
// app.use('/webhook', webhookRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
