// Authentication Routes
// Register, login, refresh, logout endpoints

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../../middleware/errorHandler');
const { generateToken, generateRefreshToken, verifyRefreshToken, authenticate } = require('../../middleware/auth');
const userRepository = require('../../repositories/userRepository');
const { generateUUID } = require('../../utils/uuid');
const logger = require('../../utils/logger');

/**
 * Register new business
 * POST /api/auth/register
 */
router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('businessName').notEmpty().withMessage('Business name required'),
  body('businessType').isIn(['restaurant', 'sports_court', 'salon', 'other']).withMessage('Invalid business type'),
  body('contactPhoneNumber').optional().isMobilePhone().withMessage('Valid phone number required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { email, password, businessName, businessType, contactPhoneNumber } = req.body;
  
  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: { message: 'User with this email already exists' }
    });
  }
  
  // Create user
  const user = await userRepository.create({
    email,
    password,
    userType: 'business',
    businessName,
    businessType,
    contactPhoneNumber
  });
  
  // Generate tokens
  const token = generateToken(user.id, user.user_type);
  const refreshToken = generateRefreshToken(user.id);
  
  logger.info(`New business registered: ${user.id} - ${user.email}`);
  
  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        businessName: user.business_name,
        userType: user.user_type,
        subscriptionType: user.subscription_type
      },
      token,
      refreshToken
    }
  });
}));

/**
 * Login
 * POST /api/auth/login
 */
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { email, password } = req.body;
  
  // Verify password
  const userId = await userRepository.verifyPasswordByEmail(email, password);
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid email or password' }
    });
  }
  
  // Get user
  const user = await userRepository.findById(userId);
  if (!user || !user.is_active) {
    return res.status(403).json({
      success: false,
      error: { message: 'Account is inactive' }
    });
  }
  
  // Generate tokens
  const token = generateToken(user.id, user.user_type);
  const refreshToken = generateRefreshToken(user.id);
  
  logger.info(`User logged in: ${user.id} - ${user.email}`);
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        businessName: user.business_name,
        userType: user.user_type,
        subscriptionType: user.subscription_type
      },
      token,
      refreshToken
    }
  });
}));

/**
 * Refresh token
 * POST /api/auth/refresh
 */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { refreshToken } = req.body;
  
  try {
    const decoded = verifyRefreshToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid refresh token' }
      });
    }
    
    // Get user
    const user = await userRepository.findById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(403).json({
        success: false,
        error: { message: 'Account is inactive' }
      });
    }
    
    // Generate new tokens
    const newToken = generateToken(user.id, user.user_type);
    const newRefreshToken = generateRefreshToken(user.id);
    
    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired refresh token' }
    });
  }
}));

/**
 * Get current user
 * GET /api/auth/me
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' }
    });
  }
  
  // Remove sensitive data
  delete user.password_hash;
  
  res.json({
    success: true,
    data: { user }
  });
}));

/**
 * Logout (client-side token removal, but can add token blacklist here if needed)
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // In a production system, you might want to blacklist the token
  // For now, client-side removal is sufficient
  
  logger.info(`User logged out: ${req.user.id}`);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

module.exports = router;
