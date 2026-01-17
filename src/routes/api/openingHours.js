// Opening Hours Routes
// Opening hours CRUD operations

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation, verifyOwnership } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const openingHoursRepository = require('../../repositories/openingHoursRepository');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * Get opening hours
 * GET /api/opening-hours?ownerType=business&ownerId=
 */
router.get('/', asyncHandler(async (req, res) => {
  const { ownerType, ownerId } = req.query;
  
  // Verify ownership
  if (ownerType === 'business' && req.user.userType !== 'admin' && ownerId !== req.businessId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
  
  if (ownerType === 'branch' && req.user.userType !== 'admin') {
    const { queryMySQL } = require('../../config/database');
    const branches = await queryMySQL(
      `SELECT parent_user_id FROM users WHERE id = ? AND user_type = 'branch' AND is_active = true AND deleted_at IS NULL`,
      [ownerId]
    );
    
    if (!branches || branches.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch not found' }
      });
    }
    
    const branch = branches[0];
    // Verify branch belongs to the business
    if (branch.parent_user_id !== req.businessId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch does not belong to your business' }
      });
    }
  }
  
  if (!ownerType || !ownerId) {
    return res.status(400).json({
      success: false,
      error: { message: 'ownerType and ownerId are required' }
    });
  }
  
  const hours = await openingHoursRepository.findByOwner(ownerType, ownerId);
  
  res.json({
    success: true,
    data: { openingHours: hours },
    count: hours.length
  });
}));

/**
 * Create or update opening hours
 * POST /api/opening-hours
 */
router.post('/', [
  body('ownerType').isIn(['business', 'branch']).withMessage('Invalid owner type'),
  body('ownerId').isUUID().withMessage('ownerId must be a valid UUID'),
  body('hours').isObject().withMessage('hours must be an object'),
  body('hours.monday').optional().isObject(),
  body('hours.tuesday').optional().isObject(),
  body('hours.wednesday').optional().isObject(),
  body('hours.thursday').optional().isObject(),
  body('hours.friday').optional().isObject(),
  body('hours.saturday').optional().isObject(),
  body('hours.sunday').optional().isObject()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { ownerType, ownerId, hours } = req.body;
  
  // Verify ownership
  if (ownerType === 'business' && req.user.userType !== 'admin' && ownerId !== req.businessId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
  
  if (ownerType === 'branch' && req.user.userType !== 'admin') {
    const { queryMySQL } = require('../../config/database');
    const branches = await queryMySQL(
      `SELECT parent_user_id FROM users WHERE id = ? AND user_type = 'branch' AND is_active = true AND deleted_at IS NULL`,
      [ownerId]
    );
    
    if (!branches || branches.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch not found' }
      });
    }
    
    const branch = branches[0];
    // Verify branch belongs to the business
    if (branch.parent_user_id !== req.businessId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch does not belong to your business' }
      });
    }
  }
  
  logger.info(`Saving opening hours for ${ownerType}: ${ownerId}`, {
    hoursCount: Object.keys(hours).length,
    hours: hours
  });
  
  const openingHours = await openingHoursRepository.upsert(ownerType, ownerId, hours);
  
  logger.info(`Opening hours updated for ${ownerType}: ${ownerId}`, {
    savedCount: openingHours.length
  });
  
  res.json({
    success: true,
    data: { openingHours },
    count: openingHours.length
  });
}));

/**
 * Delete opening hours
 * DELETE /api/opening-hours?ownerType=business&ownerId=
 */
router.delete('/', asyncHandler(async (req, res) => {
  const { ownerType, ownerId } = req.query;
  
  // Verify ownership
  if (ownerType === 'business' && req.user.userType !== 'admin' && ownerId !== req.businessId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
  
  if (ownerType === 'branch' && req.user.userType !== 'admin') {
    const { queryMySQL } = require('../../config/database');
    const branches = await queryMySQL(
      `SELECT parent_user_id FROM users WHERE id = ? AND user_type = 'branch' AND is_active = true AND deleted_at IS NULL`,
      [ownerId]
    );
    
    if (!branches || branches.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch not found' }
      });
    }
    
    const branch = branches[0];
    // Verify branch belongs to the business
    if (branch.parent_user_id !== req.businessId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch does not belong to your business' }
      });
    }
  }
  
  if (!ownerType || !ownerId) {
    return res.status(400).json({
      success: false,
      error: { message: 'ownerType and ownerId are required' }
    });
  }
  
  await openingHoursRepository.deleteByOwner(ownerType, ownerId);
  
  logger.info(`Opening hours deleted for ${ownerType}: ${ownerId}`);
  
  res.json({
    success: true,
    message: 'Opening hours deleted successfully'
  });
}));

module.exports = router;
