// Business Routes
// Business profile, subscription, and WhatsApp management

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const userRepository = require('../../repositories/userRepository');
const { encryptToken, decryptToken } = require('../../../utils/encryption');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
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
  body('businessName').optional({ checkFalsy: true }).notEmpty().withMessage('Business name cannot be empty'),
  body('businessType').optional().custom((value) => {
    if (!value) return true; // Optional field
    // Accept both formats: 'f & b' or 'food and beverage'
    const validTypes = ['f & b', 'food and beverage', 'services', 'products'];
    if (validTypes.includes(value.toLowerCase())) return true;
    throw new Error('Invalid business type. Must be one of: f & b, services, products');
  }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email required'),
  body('contactPhoneNumber').optional({ checkFalsy: true }).isString().withMessage('Contact phone must be a string'),
  body('defaultLanguage').optional({ checkFalsy: true }).isIn(['arabic', 'arabizi', 'english', 'french']).withMessage('Invalid language'),
  body('languages').optional({ checkFalsy: true }).custom((value) => {
    // Accept null, undefined, or array
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return true;
    throw new Error('Languages must be an array or null');
  }),
  body('timezone').optional({ checkFalsy: true }).notEmpty().withMessage('Timezone cannot be empty'),
  body('businessDescription').optional({ checkFalsy: true }).isString(),
  body('locationLatitude').optional({ checkFalsy: true }).isDecimal().withMessage('Latitude must be a valid decimal'),
  body('locationLongitude').optional({ checkFalsy: true }).isDecimal().withMessage('Longitude must be a valid decimal'),
  body('deliveryRadiusKm').optional({ checkFalsy: true }).isDecimal({ min: 0 }).withMessage('Delivery radius must be positive'),
  body('whatsappPhoneNumberId').optional({ checkFalsy: true }).isString(),
  body('whatsappBusinessAccountId').optional({ checkFalsy: true }).isString(),
  body('telegramBotToken').optional({ checkFalsy: true }).isString(),
  body('chatbotEnabled').optional().custom((value) => {
    // Accept boolean or string "true"/"false"
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string' && (value === 'true' || value === 'false')) return true;
    throw new Error('Chatbot enabled must be true or false');
  }).toBoolean(),
  body('allowScheduledOrders').optional().custom((value) => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string' && (value === 'true' || value === 'false')) return true;
    throw new Error('Allow scheduled orders must be true or false');
  }).toBoolean(),
  body('allowDelivery').optional().custom((value) => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string' && (value === 'true' || value === 'false')) return true;
    throw new Error('Allow delivery must be true or false');
  }).toBoolean(),
  body('allowTakeaway').optional().custom((value) => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string' && (value === 'true' || value === 'false')) return true;
    throw new Error('Allow takeaway must be true or false');
  }).toBoolean(),
  body('allowOnSite').optional().custom((value) => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string' && (value === 'true' || value === 'false')) return true;
    throw new Error('Allow on site must be true or false');
  }).toBoolean()
], asyncHandler(async (req, res) => {
  // Log the request body for debugging
  logger.info('Business update request received', {
    userId: req.user.id,
    bodyKeys: Object.keys(req.body),
    body: req.body
  });
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Business update validation failed', {
      userId: req.user.id,
      errors: errors.array()
    });
    
    return res.status(400).json({
      success: false,
      error: { 
        message: 'Validation failed', 
        errors: errors.array().map(e => ({
          field: e.path || e.param,
          message: e.msg,
          value: e.value
        }))
      }
    });
  }
  
  const updateData = {};
  const allowedFields = [
    'businessName', 'businessType', 'email', 'contactPhoneNumber',
    'defaultLanguage', 'languages', 'timezone', 'businessDescription',
    'locationLatitude', 'locationLongitude', 'deliveryRadiusKm',
    'whatsappPhoneNumberId', 'whatsappBusinessAccountId', 'telegramBotToken',
    'allowScheduledOrders', 'allowDelivery', 'allowTakeaway', 'allowOnSite',
    'chatbotEnabled'
  ];
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      // Normalize businessType: 'food and beverage' -> 'f & b' (case-insensitive)
      if (field === 'businessType') {
        const businessType = String(req.body[field]).toLowerCase().trim();
        if (businessType === 'food and beverage' || businessType === 'food & beverage') {
          updateData[field] = 'f & b';
        } else {
          updateData[field] = req.body[field];
        }
      } else {
        updateData[field] = req.body[field];
      }
    }
  }
  
  logger.info('Update data received:', { updateData, chatbotEnabled: updateData.chatbotEnabled, type: typeof updateData.chatbotEnabled });
  
  try {
    const updatedUser = await userRepository.update(req.user.id, updateData);
  delete updatedUser.password_hash;
  
  // Convert MySQL boolean (tinyint) fields to proper JavaScript booleans
  if (updatedUser.chatbot_enabled !== undefined) {
    updatedUser.chatbot_enabled = Boolean(updatedUser.chatbot_enabled);
  }
  if (updatedUser.is_active !== undefined) {
    updatedUser.is_active = Boolean(updatedUser.is_active);
  }
  if (updatedUser.allow_scheduled_orders !== undefined) {
    updatedUser.allow_scheduled_orders = Boolean(updatedUser.allow_scheduled_orders);
  }
  if (updatedUser.allow_delivery !== undefined) {
    updatedUser.allow_delivery = Boolean(updatedUser.allow_delivery);
  }
  if (updatedUser.allow_takeaway !== undefined) {
    updatedUser.allow_takeaway = Boolean(updatedUser.allow_takeaway);
  }
  if (updatedUser.allow_on_site !== undefined) {
    updatedUser.allow_on_site = Boolean(updatedUser.allow_on_site);
  }
  
    logger.info(`Business profile updated: ${req.user.id}`, { chatbot_enabled: updatedUser.chatbot_enabled });
    
    res.json({
      success: true,
      data: { business: updatedUser }
    });
  } catch (error) {
    logger.error('Error updating business profile:', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
      updateData
    });
    
    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to update business profile',
        details: error.message 
      }
    });
  }
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

/**
 * List all branch users for current business
 * GET /api/businesses/me/branches
 */
router.get('/me/branches', asyncHandler(async (req, res) => {
  // Only business users (not branch users) can list branches
  if (req.isBranchUser) {
    return res.status(403).json({
      success: false,
      error: { message: 'Only business users can list branches' }
    });
  }
  
  if (!req.businessId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Business ID not found' }
    });
  }
  
  try {
    // Query users table for branch users
    const { queryMySQL } = require('../../config/database');
    const branches = await queryMySQL(`
      SELECT 
        u.id, u.email, u.business_name as branch_name, u.contact_phone_number,
        u.whatsapp_phone_number, u.whatsapp_phone_number_id, u.is_active,
        u.created_at,
        l.id as location_id, l.city, l.street, l.building, l.floor, l.notes as location_notes,
        l.latitude, l.longitude
      FROM users u
      LEFT JOIN locations l ON u.location_id = l.id
      WHERE u.user_type = 'branch' 
        AND u.parent_user_id = ?
        AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `, [req.businessId]);
    
    // Remove password_hash if present and format response
    const formattedBranches = (branches || []).map(branch => {
      const formatted = { ...branch };
      delete formatted.password_hash;
      return formatted;
    });
    
    res.json({
      success: true,
      data: { branches: formattedBranches },
      count: formattedBranches.length
    });
  } catch (error) {
    logger.error('Error fetching branches:', error);
    throw error;
  }
}));

/**
 * Create branch user
 * POST /api/businesses/me/branches
 */
router.post('/me/branches', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().isLength({ min: 8 }).withMessage('Password is required (minimum 8 characters)'),
  body('branchName').notEmpty().withMessage('Branch name is required'),
  body('contactPhoneNumber').optional({ checkFalsy: true }).isMobilePhone().withMessage('Valid phone number required'),
  body('whatsappPhoneNumber').optional({ checkFalsy: true }).isMobilePhone().withMessage('Valid WhatsApp phone number required')
], asyncHandler(async (req, res) => {
  // Only business users (not branch users) can create branches
  if (req.isBranchUser) {
    return res.status(403).json({
      success: false,
      error: { message: 'Only business users can create branches' }
    });
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { 
        message: 'Validation failed', 
        errors: errors.array().map(e => ({
          field: e.path || e.param,
          message: e.msg,
          value: e.value
        }))
      }
    });
  }
  
  const { email, password, branchName, contactPhoneNumber, whatsappPhoneNumber, whatsappPhoneNumberId, whatsappAccessToken, location } = req.body;
  
  // Trim branch name
  const trimmedBranchName = branchName ? String(branchName).trim() : '';
  
  // Location is now optional - only validate if provided
  // If location is provided but empty, treat it as null
  // Trim location fields if they exist
  let locationData = null;
  if (location && (location.city || location.street)) {
    locationData = {
      city: location.city ? String(location.city).trim() : null,
      street: location.street ? String(location.street).trim() : null,
      building: location.building ? String(location.building).trim() : null,
      floor: location.floor ? String(location.floor).trim() : null
    };
  }
  
  // Check if email is already in use
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: { message: 'Email is already in use' }
    });
  }
  
  // Check if WhatsApp phone number ID is already used
  if (whatsappPhoneNumberId) {
    const existingBranch = await userRepository.findByWhatsAppPhoneId(whatsappPhoneNumberId);
    if (existingBranch) {
      return res.status(409).json({
        success: false,
        error: { message: 'WhatsApp phone number ID already in use' }
      });
    }
  }
  
  // Encrypt WhatsApp token if provided
  const encryptedToken = whatsappAccessToken ? encryptToken(whatsappAccessToken) : null;
  
  // Create branch user in users table
  const branch = await userRepository.createBranchUser(req.businessId, {
    email,
    password,
    branchName: trimmedBranchName,
    location: locationData,
    contactPhoneNumber: contactPhoneNumber || null,
    whatsappPhoneNumber: whatsappPhoneNumber || null,
    whatsappPhoneNumberId: whatsappPhoneNumberId || null,
    whatsappAccessTokenEncrypted: encryptedToken,
    isActive: true
  });
  
  logger.info(`Branch user created: ${branch.id} (${branch.email}) for business: ${req.businessId}`);
  
  res.status(201).json({
    success: true,
    data: { branch }
  });
}));

/**
 * Update branch user
 * PUT /api/businesses/me/branches/:id
 */
router.put('/me/branches/:id', [
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('branchName').optional().notEmpty().withMessage('Branch name cannot be empty'),
  body('contactPhoneNumber').optional().isMobilePhone().withMessage('Valid phone number required')
], asyncHandler(async (req, res) => {
  // Only business users (not branch users) can update branches
  if (req.isBranchUser) {
    return res.status(403).json({
      success: false,
      error: { message: 'Only business users can update branches' }
    });
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  // Verify branch belongs to business (query users table)
  const branch = await userRepository.findById(req.params.id);
  if (!branch || branch.user_type !== 'branch' || branch.parent_user_id !== req.businessId || branch.deleted_at) {
    return res.status(404).json({
      success: false,
      error: { message: 'Branch not found' }
    });
  }
  
  const { email, password, branchName, contactPhoneNumber, whatsappPhoneNumber, whatsappPhoneNumberId, whatsappAccessToken, location, isActive } = req.body;
  
  // Check if email change conflicts
  if (email && email !== branch.email) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { message: 'Email is already in use' }
      });
    }
  }
  
  // Check if WhatsApp phone number ID change conflicts
  if (whatsappPhoneNumberId && whatsappPhoneNumberId !== branch.whatsapp_phone_number_id) {
    const existingBranch = await userRepository.findByWhatsAppPhoneId(whatsappPhoneNumberId);
    if (existingBranch && existingBranch.id !== req.params.id) {
      return res.status(409).json({
        success: false,
        error: { message: 'WhatsApp phone number ID already in use' }
      });
    }
  }
  
  // Handle location update/create
  const { queryMySQL, getMySQLConnection } = require('../../config/database');
  const { generateUUID } = require('../../utils/uuid');
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    let locationId = branch.location_id;
    if (location !== undefined) {
      if (locationId) {
        // Update existing location
        await connection.query(`
          UPDATE locations 
          SET city = ?, street = ?, building = ?, floor = ?, notes = ?, 
              latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          location.city,
          location.street,
          location.building || null,
          location.floor || null,
          location.notes || null,
          location.latitude || null,
          location.longitude || null,
          locationId
        ]);
      } else {
        // Create new location
        locationId = generateUUID();
        await connection.query(`
          INSERT INTO locations (id, city, street, building, floor, notes, latitude, longitude, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          locationId,
          location.city,
          location.street,
          location.building || null,
          location.floor || null,
          location.notes || null,
          location.latitude || null,
          location.longitude || null
        ]);
      }
    }
    
    // Prepare update data
    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (branchName !== undefined) updateData.businessName = branchName;
    if (contactPhoneNumber !== undefined) updateData.contactPhoneNumber = contactPhoneNumber;
    if (whatsappPhoneNumber !== undefined) updateData.whatsappPhoneNumber = whatsappPhoneNumber;
    if (whatsappPhoneNumberId !== undefined) updateData.whatsappPhoneNumberId = whatsappPhoneNumberId;
    if (whatsappAccessToken !== undefined) {
      updateData.whatsappAccessTokenEncrypted = encryptToken(whatsappAccessToken);
    }
    if (location !== undefined) updateData.locationId = locationId;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Update user record
    if (Object.keys(updateData).length > 0) {
      await userRepository.update(req.params.id, updateData);
    }
    
    // Update password if provided
    if (password) {
      await userRepository.updatePassword(req.params.id, password);
    }
    
    await connection.commit();
    
    // Return updated branch
    const updatedBranch = await userRepository.findById(req.params.id);
    delete updatedBranch.password_hash;
    
    logger.info(`Branch user updated: ${req.params.id} for business: ${req.businessId}`);
    
    res.json({
      success: true,
      data: { branch: updatedBranch }
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

/**
 * Delete branch user
 * DELETE /api/businesses/me/branches/:id
 */
router.delete('/me/branches/:id', asyncHandler(async (req, res) => {
  // Only business users (not branch users) can delete branches
  if (req.isBranchUser) {
    return res.status(403).json({
      success: false,
      error: { message: 'Only business users can delete branches' }
    });
  }
  
  // Verify branch belongs to business (query users table)
  const branch = await userRepository.findById(req.params.id);
  if (!branch || branch.user_type !== 'branch' || branch.parent_user_id !== req.businessId || branch.deleted_at) {
    return res.status(404).json({
      success: false,
      error: { message: 'Branch not found' }
    });
  }
  
  // Soft delete branch user (mark as deleted and inactive)
  await userRepository.softDelete(req.params.id);
  
  logger.info(`Branch user deleted: ${req.params.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    message: 'Branch deleted successfully'
  });
}));

module.exports = router;
