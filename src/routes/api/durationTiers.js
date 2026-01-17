// Duration Tiers API Routes
// CRUD endpoints for item duration tiers

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const durationTiersRepository = require('../../repositories/durationTiersRepository');
const itemRepository = require('../../repositories/itemRepository');
const { asyncHandler } = require('../../middleware/errorHandler');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * GET /api/items/:itemId/duration-tiers
 * Get all duration tiers for an item
 */
router.get('/items/:itemId/duration-tiers', [
  param('itemId').isUUID().withMessage('Valid item ID required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { itemId } = req.params;
  
  // Verify item exists and belongs to user's business
  const item = await itemRepository.findById(itemId, req.businessId);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Item not found' }
    });
  }
  
  // Check if user has access to this item
  if (item.business_id !== req.businessId && item.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
    
    const tiers = await durationTiersRepository.getDurationTiersByItemId(itemId);
    
    res.json({
      success: true,
      data: { tiers }
    });
}));

/**
 * POST /api/items/:itemId/duration-tiers
 * Create a new duration tier for an item
 */
router.post('/items/:itemId/duration-tiers', [
  param('itemId').isUUID().withMessage('Valid item ID required'),
  body('durationMinutes').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { itemId } = req.params;
  const { durationMinutes, price } = req.body;
  
  // Verify item exists and belongs to user's business
  const item = await itemRepository.findById(itemId, req.businessId);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Item not found' }
    });
  }
  
  // Check if user has access to this item
  if (item.business_id !== req.businessId && item.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
    
    // Verify item is marked as rental
    if (!item.is_rental) {
      return res.status(400).json({
        success: false,
        error: { message: 'Item must be marked as rental to add duration tiers' }
      });
    }
    
    const tier = await durationTiersRepository.createDurationTier({
      itemId,
      durationMinutes,
      price
    });
    
    logger.info('Duration tier created', { itemId, tierId: tier.id, durationMinutes, price });
    
    res.status(201).json({
      success: true,
      data: { tier }
    });
}));

/**
 * PUT /api/duration-tiers/:id
 * Update a duration tier
 */
router.put('/duration-tiers/:id', [
  param('id').isUUID().withMessage('Valid tier ID required'),
  body('durationMinutes').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { id } = req.params;
  const { durationMinutes, price } = req.body;
  
  // Get existing tier
  const existingTier = await durationTiersRepository.getDurationTierById(id);
  if (!existingTier) {
    return res.status(404).json({
      success: false,
      error: { message: 'Duration tier not found' }
    });
  }
  
  // Verify item belongs to user's business
  const item = await itemRepository.findById(existingTier.item_id, req.businessId);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Associated item not found' }
    });
  }
  
  if (item.business_id !== req.businessId && item.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
    
    const tier = await durationTiersRepository.updateDurationTier(id, {
      durationMinutes,
      price
    });
    
    logger.info('Duration tier updated', { tierId: id, durationMinutes, price });
    
    res.json({
      success: true,
      data: { tier }
    });
}));

/**
 * DELETE /api/duration-tiers/:id
 * Delete a duration tier
 */
router.delete('/duration-tiers/:id', [
  param('id').isUUID().withMessage('Valid tier ID required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { id } = req.params;
  
  // Get existing tier
  const existingTier = await durationTiersRepository.getDurationTierById(id);
  if (!existingTier) {
    return res.status(404).json({
      success: false,
      error: { message: 'Duration tier not found' }
    });
  }
  
  // Verify item belongs to user's business
  const item = await itemRepository.findById(existingTier.item_id, req.businessId);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Associated item not found' }
    });
  }
  
  if (item.business_id !== req.businessId && item.user_id !== req.userId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied' }
    });
  }
    
    await durationTiersRepository.deleteDurationTier(id);
    
    logger.info('Duration tier deleted', { tierId: id });
    
    res.json({
      success: true,
      data: { message: 'Duration tier deleted successfully' }
    });
}));

module.exports = router;
