// Authentication Middleware
// JWT authentication and authorization

const jwt = require('jsonwebtoken');
const CONSTANTS = require('../config/constants');
const { queryMySQL } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { message: 'No token provided' }
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, CONSTANTS.JWT_SECRET);
      
      // Fetch user from database to ensure they still exist and are active
      const users = await queryMySQL(
        'SELECT id, user_type, email, is_active, deleted_at FROM users WHERE id = ?',
        [decoded.userId]
      );
      
      if (!users || users.length === 0) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not found' }
        });
      }
      
      const user = users[0];
      
      if (user.deleted_at) {
        return res.status(401).json({
          success: false,
          error: { message: 'User account has been deleted' }
        });
      }
      
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: { message: 'User account is inactive' }
        });
      }
      
      // Attach user to request
      req.user = {
        id: user.id,
        userType: user.user_type,
        email: user.email
      };
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: { message: 'Token expired' }
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid token' }
        });
      }
      
      throw error;
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Authentication failed' }
    });
  }
}

/**
 * Require specific user types
 * @param {...string} allowedTypes - Allowed user types
 */
function requireUserType(...allowedTypes) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
    }
    
    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' }
      });
    }
    
    next();
  };
}

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @param {string} userType - User type
 * @returns {string} JWT token
 */
function generateToken(userId, userType) {
  return jwt.sign(
    { userId, userType },
    CONSTANTS.JWT_SECRET,
    { expiresIn: CONSTANTS.JWT_EXPIRES_IN }
  );
}

/**
 * Generate refresh token
 * @param {string} userId - User ID
 * @returns {string} Refresh token
 */
function generateRefreshToken(userId) {
  return jwt.sign(
    { userId, type: 'refresh' },
    CONSTANTS.JWT_SECRET,
    { expiresIn: CONSTANTS.JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {object} Decoded token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, CONSTANTS.JWT_SECRET);
}

module.exports = {
  authenticate,
  requireUserType,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};
