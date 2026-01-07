// Business Routes
// Business profile, subscription, and WhatsApp management

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const userRepository = require('../../repositories/userRepository');
const { encryptToken, decryptToken } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS));
router.use(tenantIsolation);

/**
 * Get current business profile
 * GET /api/businesses/me
 */
router.get('/me', asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  // Remove sensitive data
  delete user.password_hash;
  
  // Decrypt WhatsApp token if present
  if (user.whatsapp_access_token_encrypted) {
    try {
      user.whatsapp_access_token = decryptToken(user.whatsapp_access_token_encrypted);
    } catch (error) {
      logger.error('Failed to decrypt WhatsApp token:', error);
    }
  }
  
  res.json({
    success: true,
    data: { business: user }
  });
}));

/**
 * Update business profile
 * PUT /api/businesses/me
 */
router.put('/me', [
  body('businessName').optional().notEmpty().withMessage('Business name cannot be empty'),
  body('businessType').optional().isIn(['restaurant', 'sports_court', 'salon', 'other']).withMessage('Invalid business type'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('contactPhoneNumber').optional().isMobilePhone().withMessage('Valid phone number required'),
  body('defaultLanguage').optional().isIn(['arabic', 'arabizi', 'english', 'french']).withMessage('Invalid language'),
  body('timezone').optional().notEmpty().withMessage('Timezone cannot be empty')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const updateData = {};
  const allowedFields = [
    'businessName', 'businessType', 'email', 'contactPhoneNumber',
    'defaultLanguage', 'timezone', 'allowScheduledOrders', 'allowDelivery',
    'allowTakeaway', 'allowOnSite'
  ];
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }
  
  const updatedUser = await userRepository.update(req.user.id, updateData);
  delete updatedUser.password_hash;
  
  logger.info(`Business profile updated: ${req.user.id}`);
  
  res.json({
    success: true,
    data: { business: updatedUser }
  });
}));

/**
 * Get subscription details
 * GET /api/businesses/me/subscription
 */
router.get('/me/subscription', asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  res.json({
    success: true,
    data: {
      subscription: {
        type: user.subscription_type,
        price: user.subscription_price,
        status: user.subscription_status,
        startedAt: user.subscription_started_at,
        endsAt: user.subscription_ends_at
      }
    }
  });
}));

/**
 * Update subscription
 * PUT /api/businesses/me/subscription
 */
router.put('/me/subscription', [
  body('subscriptionType').isIn(['standard', 'premium']).withMessage('Invalid subscription type'),
  body('subscriptionPrice').optional().isFloat({ min: 0 }).withMessage('Price must be positive'),
  body('subscriptionStatus').optional().isIn(['active', 'past_due', 'canceled']).withMessage('Invalid subscription status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const updateData = {
    subscriptionType: req.body.subscriptionType,
    subscriptionPrice: req.body.subscriptionPrice,
    subscriptionStatus: req.body.subscriptionStatus,
    subscriptionStartedAt: req.body.subscriptionStartedAt ? new Date(req.body.subscriptionStartedAt) : undefined,
    subscriptionEndsAt: req.body.subscriptionEndsAt ? new Date(req.body.subscriptionEndsAt) : undefined
  };
  
  const updatedUser = await userRepository.update(req.user.id, updateData);
  
  logger.info(`Subscription updated for business: ${req.user.id}`, {
    subscriptionType: updatedUser.subscription_type,
    status: updatedUser.subscription_status
  });
  
  res.json({
    success: true,
    data: {
      subscription: {
        type: updatedUser.subscription_type,
        price: updatedUser.subscription_price,
        status: updatedUser.subscription_status,
        startedAt: updatedUser.subscription_started_at,
        endsAt: updatedUser.subscription_ends_at
      }
    }
  });
}));

/**
 * Connect WhatsApp account
 * POST /api/businesses/me/whatsapp/connect
 */
router.post('/me/whatsapp/connect', [
  body('whatsappPhoneNumber').notEmpty().withMessage('WhatsApp phone number required'),
  body('whatsappPhoneNumberId').notEmpty().withMessage('WhatsApp phone number ID required'),
  body('whatsappAccessToken').notEmpty().withMessage('WhatsApp access token required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { whatsappPhoneNumber, whatsappPhoneNumberId, whatsappAccessToken } = req.body;
  
  // Check if phone number ID is already used by another business
  const existingBusiness = await userRepository.findByWhatsAppPhoneId(whatsappPhoneNumberId);
  if (existingBusiness && existingBusiness.id !== req.user.id) {
    return res.status(409).json({
      success: false,
      error: { message: 'WhatsApp phone number ID already in use' }
    });
  }
  
  // Encrypt access token
  const encryptedToken = encryptToken(whatsappAccessToken);
  
  // Update business
  const updatedUser = await userRepository.update(req.user.id, {
    whatsappPhoneNumber,
    whatsappPhoneNumberId,
    whatsappAccessTokenEncrypted: encryptedToken
  });
  
  logger.info(`WhatsApp connected for business: ${req.user.id}`);
  
  res.json({
    success: true,
    data: {
      business: {
        id: updatedUser.id,
        whatsappPhoneNumber: updatedUser.whatsapp_phone_number,
        whatsappPhoneNumberId: updatedUser.whatsapp_phone_number_id
      }
    },
    message: 'WhatsApp account connected successfully'
  });
}));

/**
 * Get WhatsApp connection status
 * GET /api/businesses/me/whatsapp/status
 */
router.get('/me/whatsapp/status', asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  const isConnected = !!(user.whatsapp_phone_number_id && user.whatsapp_access_token_encrypted);
  
  res.json({
    success: true,
    data: {
      connected: isConnected,
      whatsappPhoneNumber: user.whatsapp_phone_number || null,
      whatsappPhoneNumberId: user.whatsapp_phone_number_id || null
    }
  });
}));

module.exports = router;
