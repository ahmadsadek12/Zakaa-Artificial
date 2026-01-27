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
      // Select only core columns first, then try to get optional columns if they exist
      const users = await queryMySQL(
        `SELECT id, user_type, email, is_active, deleted_at, parent_user_id
         FROM users WHERE id = ?`,
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
      
      // Optional columns - set to null by default (columns may not exist in database)
      // These are only needed for advanced tenant isolation features
      // If the columns don't exist, the tenant isolation middleware will use user_type as fallback
      const roleScope = null;
      const employeeRole = null;
      const businessName = null;
      const contactPhoneNumber = null;
      
      // Attach user to request with all fields needed for tenant isolation
      req.user = {
        id: user.id,
        userType: user.user_type,
        user_type: user.user_type, // For backward compatibility
        userRole: user.user_type, // Use user_type as user_role since column doesn't exist
        parentUserId: user.parent_user_id || null,
        parent_user_id: user.parent_user_id || null, // For backward compatibility
        roleScope: roleScope,
        role_scope: roleScope, // For backward compatibility
        employeeRole: employeeRole,
        email: user.email,
        businessName: businessName,
        contactPhoneNumber: contactPhoneNumber
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
    
    // Branch users should have same permissions as business users
    const userType = req.user.userType;
    const allowedTypesWithBranch = allowedTypes.map(type => {
      if (type === CONSTANTS.USER_TYPES.BUSINESS) {
        return [type, CONSTANTS.USER_TYPES.BRANCH];
      }
      return [type];
    }).flat();
    
    if (!allowedTypesWithBranch.includes(userType)) {
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
  // Set expiration based on user type: 24h for non-admin, 7d for admin
  const expiresIn = userType === CONSTANTS.USER_TYPES.ADMIN 
    ? CONSTANTS.JWT_EXPIRES_IN 
    : CONSTANTS.JWT_EXPIRES_IN_NON_ADMIN;
  
  return jwt.sign(
    { userId, userType },
    CONSTANTS.JWT_SECRET,
    { expiresIn }
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

// Alias for backward compatibility
const authenticateToken = authenticate;

module.exports = {
  authenticate,
  authenticateToken, // Alias for backward compatibility
  requireUserType,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};
