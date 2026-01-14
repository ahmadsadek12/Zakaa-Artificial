// Policy Routes
// Policy CRUD operations

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const policyRepository = require('../../repositories/policyRepository');
const { verifyOwnership } = require('../../middleware/tenant');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * List policies
 * GET /api/policies?ownerType=business&ownerId=
 */
router.get('/', asyncHandler(async (req, res) => {
  const { ownerType, ownerId } = req.query;
  
  // If owner is business, verify ownership
  if (ownerType === 'business' && ownerId) {
    if (req.user.userType !== 'admin' && ownerId !== req.businessId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
    }
  }
  
  // If owner is branch, verify branch belongs to business
  if (ownerType === 'branch' && ownerId) {
    if (req.user.userType !== 'admin') {
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
      
      // Verify branch belongs to the business
      if (branches[0].parent_user_id !== req.businessId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied: Branch does not belong to your business' }
        });
      }
    }
  }
  
  if (!ownerType || !ownerId) {
    return res.status(400).json({
      success: false,
      error: { message: 'ownerType and ownerId are required' }
    });
  }
  
  const policies = await policyRepository.findByOwner(ownerType, ownerId);
  
  res.json({
    success: true,
    data: { policies },
    count: policies.length
  });
}));

/**
 * Create policy
 * POST /api/policies
 */
router.post('/', [
  body('ownerType').isIn(['business', 'branch']).withMessage('Invalid owner type'),
  body('ownerId').isUUID().withMessage('ownerId must be a valid UUID'),
  body('policyType').isIn(['delivery', 'refund', 'cancellation', 'custom']).withMessage('Invalid policy type'),
  body('description').notEmpty().withMessage('Description required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { ownerType, ownerId, policyType, title, description } = req.body;
  
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
    
    // Verify branch belongs to the business
    if (branches[0].parent_user_id !== req.businessId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch does not belong to your business' }
      });
    }
  }
  
  const policy = await policyRepository.create({
    ownerType,
    ownerId,
    policyType,
    title,
    description
  });
  
  logger.info(`Policy created: ${policy.id}`);
  
  res.status(201).json({
    success: true,
    data: { policy }
  });
}));

/**
 * Update policy
 * PUT /api/policies/:id
 */
router.put('/:id', [
  body('policyType').optional().isIn(['delivery', 'refund', 'cancellation', 'custom']).withMessage('Invalid policy type'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const policy = await policyRepository.findById(req.params.id);
  if (!policy) {
    return res.status(404).json({
      success: false,
      error: { message: 'Policy not found' }
    });
  }
  
  // Verify ownership
  if (policy.owner_type === 'business' && req.user.userType !== 'admin' && policy.owner_id !== req.businessId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
  
  if (policy.owner_type === 'branch' && req.user.userType !== 'admin') {
    const { queryMySQL } = require('../../config/database');
    const [users] = await queryMySQL(
      'SELECT id, parent_user_id, user_role FROM users WHERE id = ? AND user_role = ?',
      [policy.owner_id, 'branch']
    );
    
    if (!users || users.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch not found' }
      });
    }
    
    const branchUser = users[0];
    const isOwner = req.isBranchUser 
      ? branchUser.id === req.userId
      : branchUser.parent_user_id === req.businessId;
    
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
    }
  }
  
  const updateData = {};
  const { policyType, title, description } = req.body;
  
  if (policyType !== undefined) updateData.policyType = policyType;
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  
  const updatedPolicy = await policyRepository.update(req.params.id, updateData);
  
  logger.info(`Policy updated: ${req.params.id}`);
  
  res.json({
    success: true,
    data: { policy: updatedPolicy }
  });
}));

/**
 * Delete policy
 * DELETE /api/policies/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const policy = await policyRepository.findById(req.params.id);
  if (!policy) {
    return res.status(404).json({
      success: false,
      error: { message: 'Policy not found' }
    });
  }
  
  // Verify ownership
  if (policy.owner_type === 'business' && req.user.userType !== 'admin' && policy.owner_id !== req.businessId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
  
  if (policy.owner_type === 'branch' && req.user.userType !== 'admin') {
    const { queryMySQL } = require('../../config/database');
    const [users] = await queryMySQL(
      'SELECT id, parent_user_id, user_role FROM users WHERE id = ? AND user_role = ?',
      [policy.owner_id, 'branch']
    );
    
    if (!users || users.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Branch not found' }
      });
    }
    
    const branchUser = users[0];
    const isOwner = req.isBranchUser 
      ? branchUser.id === req.userId
      : branchUser.parent_user_id === req.businessId;
    
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
    }
  }
  
  await policyRepository.deletePolicy(req.params.id);
  
  logger.info(`Policy deleted: ${req.params.id}`);
  
  res.json({
    success: true,
    message: 'Policy deleted successfully'
  });
}));

module.exports = router;
