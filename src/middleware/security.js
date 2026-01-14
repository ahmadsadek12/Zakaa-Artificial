// Enhanced Security Middleware
// Additional security features for production deployment

const logger = require('../utils/logger');
const { queryMySQL } = require('../config/database');

/**
 * Password strength validation
 * Enforces complex password requirements
 */
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[@$!%*?&]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Account lockout tracking
 * Tracks failed login attempts and locks accounts
 */
const failedLoginAttempts = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

async function trackFailedLogin(email, ip) {
  const key = `${email}:${ip}`;
  const now = Date.now();
  
  if (!failedLoginAttempts.has(key)) {
    failedLoginAttempts.set(key, { count: 0, lockedUntil: null });
  }
  
  const record = failedLoginAttempts.get(key);
  
  // Check if account is currently locked
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    throw new Error(`Account temporarily locked. Try again in ${remainingMinutes} minutes.`);
  }
  
  // Reset lock if duration has passed
  if (record.lockedUntil && now >= record.lockedUntil) {
    record.count = 0;
    record.lockedUntil = null;
  }
  
  // Increment failed attempts
  record.count++;
  
  // Lock account if threshold exceeded
  if (record.count >= LOCKOUT_THRESHOLD) {
    record.lockedUntil = now + LOCKOUT_DURATION;
    logger.warn(`Account locked due to failed login attempts: ${email} from IP ${ip}`);
    throw new Error(`Too many failed login attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`);
  }
  
  logger.warn(`Failed login attempt ${record.count}/${LOCKOUT_THRESHOLD}: ${email} from IP ${ip}`);
}

function clearFailedLogin(email, ip) {
  const key = `${email}:${ip}`;
  failedLoginAttempts.delete(key);
}

/**
 * Security event logging
 * Logs security-related events for audit trail
 */
async function logSecurityEvent(event, details) {
  const logEntry = {
    timestamp: new Date(),
    event,
    ...details
  };
  
  logger.info('SECURITY_EVENT', logEntry);
  
  // TODO: Store in MongoDB audit_logs collection
  // const auditLogs = await getMongoCollection('audit_logs');
  // await auditLogs.insertOne(logEntry);
}

/**
 * IP whitelist middleware (for admin routes)
 * Restricts access to specified IP addresses
 */
function ipWhitelist(allowedIps = []) {
  return (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || allowedIps.length === 0) {
      return next(); // Skip in development or if no IPs configured
    }
    
    const clientIp = req.ip || req.connection.remoteAddress;
    
    if (!allowedIps.includes(clientIp)) {
      logger.warn(`Blocked access from non-whitelisted IP: ${clientIp}`);
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied from this IP address' }
      });
    }
    
    next();
  };
}

/**
 * Sensitive data masking
 * Masks sensitive information in logs
 */
function maskEmail(email) {
  if (!email) return email;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local[0] + '*'.repeat(Math.max(local.length - 2, 0)) + (local.length > 1 ? local[local.length - 1] : '');
  return `${maskedLocal}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone;
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}

/**
 * Request signing verification
 * Verifies signed requests (e.g., webhooks)
 */
function verifyRequestSignature(secret) {
  return (req, res, next) => {
    const signature = req.headers['x-signature'];
    
    if (!signature) {
      return res.status(401).json({
        success: false,
        error: { message: 'Missing signature' }
      });
    }
    
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      logger.warn('Invalid request signature');
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid signature' }
      });
    }
    
    next();
  };
}

/**
 * Admin action audit middleware
 * Logs all admin actions for audit trail
 */
function auditAdminAction(action) {
  return async (req, res, next) => {
    // Capture original send function
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log admin action
      logSecurityEvent('admin_action', {
        admin_id: req.user?.id,
        admin_email: req.user?.email,
        action,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        user_agent: req.get('user-agent'),
        success: res.statusCode < 400
      });
      
      // Call original send
      originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Sanitize user input
 * Removes potentially dangerous characters
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Rate limit by user
 * Additional rate limiting per authenticated user
 */
const userRequestCounts = new Map();
const USER_RATE_LIMIT = 100; // requests per window
const USER_RATE_WINDOW = 60 * 1000; // 1 minute

function userRateLimit(req, res, next) {
  if (!req.user) return next();
  
  const userId = req.user.id;
  const now = Date.now();
  
  if (!userRequestCounts.has(userId)) {
    userRequestCounts.set(userId, { count: 0, resetAt: now + USER_RATE_WINDOW });
  }
  
  const record = userRequestCounts.get(userId);
  
  // Reset if window has passed
  if (now >= record.resetAt) {
    record.count = 0;
    record.resetAt = now + USER_RATE_WINDOW;
  }
  
  record.count++;
  
  if (record.count > USER_RATE_LIMIT) {
    logger.warn(`User rate limit exceeded: ${userId}`);
    return res.status(429).json({
      success: false,
      error: { message: 'Too many requests. Please try again later.' }
    });
  }
  
  next();
}

/**
 * Secure headers middleware
 * Adds additional security headers
 */
function secureHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}

/**
 * Clean up expired lockouts periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedLoginAttempts.entries()) {
    if (record.lockedUntil && now >= record.lockedUntil) {
      failedLoginAttempts.delete(key);
    }
  }
  
  for (const [userId, record] of userRequestCounts.entries()) {
    if (now >= record.resetAt) {
      userRequestCounts.delete(userId);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

module.exports = {
  validatePasswordStrength,
  trackFailedLogin,
  clearFailedLogin,
  logSecurityEvent,
  ipWhitelist,
  maskEmail,
  maskPhone,
  verifyRequestSignature,
  auditAdminAction,
  sanitizeInput,
  userRateLimit,
  secureHeaders
};
