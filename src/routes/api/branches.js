// Branch Routes
// Branch CRUD operations with location support

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const branchRepository = require('../../repositories/branchRepository');
const { encryptToken } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS));
router.use(tenantIsolation);

/**
 * List all branches for business
 * GET /api/branches
 */
router.get('/', asyncHandler(async (req, res) => {
  const branches = await branchRepository.findByBusinessId(req.businessId);
  
  res.json({
    success: true,
    data: { branches },
    count: branches.length
  });
}));

/**
 * Get branch details
 * GET /api/branches/:id
 */
router.get('/:id', requireOwnership('branches'), asyncHandler(async (req, res) => {
  const branch = await branchRepository.findById(req.params.id, req.businessId);
  
  if (!branch) {
    return res.status(404).json({
      success: false,
      error: { message: 'Branch not found' }
    });
  }
  
  res.json({
    success: true,
    data: { branch }
  });
}));

/**
 * Create branch
 * POST /api/branches
 */
router.post('/', [
  body('branchName').notEmpty().withMessage('Branch name required'),
  body('location.city').notEmpty().withMessage('City required'),
  body('location.street').notEmpty().withMessage('Street required'),
  body('contactPhoneNumber').optional().isMobilePhone().withMessage('Valid phone number required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { branchName, location, contactPhoneNumber, whatsappPhoneNumber, whatsappPhoneNumberId, whatsappAccessToken, minOrderValue, avgPreparationTimeMinutes } = req.body;
  
  // Check if WhatsApp phone number ID is already used
  if (whatsappPhoneNumberId) {
    const existingBranch = await branchRepository.findByWhatsAppPhoneId(whatsappPhoneNumberId);
    if (existingBranch) {
      return res.status(409).json({
        success: false,
        error: { message: 'WhatsApp phone number ID already in use' }
      });
    }
  }
  
  // Encrypt WhatsApp token if provided
  const encryptedToken = whatsappAccessToken ? encryptToken(whatsappAccessToken) : null;
  
  const branch = await branchRepository.create({
    businessId: req.businessId,
    branchName,
    location,
    contactPhoneNumber,
    whatsappPhoneNumber,
    whatsappPhoneNumberId,
    whatsappAccessTokenEncrypted: encryptedToken,
    minOrderValue,
    avgPreparationTimeMinutes
  });
  
  logger.info(`Branch created: ${branch.id} for business: ${req.businessId}`);
  
  res.status(201).json({
    success: true,
    data: { branch }
  });
}));

/**
 * Update branch
 * PUT /api/branches/:id
 */
router.put('/:id', requireOwnership('branches'), [
  body('branchName').optional().notEmpty().withMessage('Branch name cannot be empty'),
  body('location.city').optional().notEmpty().withMessage('City cannot be empty'),
  body('location.street').optional().notEmpty().withMessage('Street cannot be empty')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const updateData = {};
  const { branchName, location, contactPhoneNumber, whatsappPhoneNumber, whatsappPhoneNumberId, whatsappAccessToken, minOrderValue, avgPreparationTimeMinutes, isActive } = req.body;
  
  if (branchName !== undefined) updateData.branchName = branchName;
  if (location !== undefined) updateData.location = location;
  if (contactPhoneNumber !== undefined) updateData.contactPhoneNumber = contactPhoneNumber;
  if (whatsappPhoneNumber !== undefined) updateData.whatsappPhoneNumber = whatsappPhoneNumber;
  if (whatsappPhoneNumberId !== undefined) updateData.whatsappPhoneNumberId = whatsappPhoneNumberId;
  if (minOrderValue !== undefined) updateData.minOrderValue = minOrderValue;
  if (avgPreparationTimeMinutes !== undefined) updateData.avgPreparationTimeMinutes = avgPreparationTimeMinutes;
  if (isActive !== undefined) updateData.isActive = isActive;
  
  // Encrypt WhatsApp token if provided
  if (whatsappAccessToken) {
    updateData.whatsappAccessTokenEncrypted = encryptToken(whatsappAccessToken);
  }
  
  const updatedBranch = await branchRepository.update(req.params.id, req.businessId, updateData);
  
  logger.info(`Branch updated: ${req.params.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    data: { branch: updatedBranch }
  });
}));

/**
 * Delete branch (soft delete)
 * DELETE /api/branches/:id
 */
router.delete('/:id', requireOwnership('branches'), asyncHandler(async (req, res) => {
  await branchRepository.softDelete(req.params.id, req.businessId);
  
  logger.info(`Branch deleted: ${req.params.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    message: 'Branch deleted successfully'
  });
}));

/**
 * Get branch menus
 * GET /api/branches/:id/menus
 */
router.get('/:id/menus', requireOwnership('branches'), asyncHandler(async (req, res) => {
  const menus = await branchRepository.getBranchMenus(req.params.id, req.businessId);
  
  res.json({
    success: true,
    data: { menus },
    count: menus.length
  });
}));

module.exports = router;
