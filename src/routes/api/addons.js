// Add-ons API Routes
// Handle addon management endpoints

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const addonRepository = require('../../repositories/addonRepository');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * Get all available addons with business activation status
 * GET /api/addons
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    // Get all available addons
    const allAddons = await addonRepository.findAll();
    
    // Get business addon statuses
    const businessAddons = await addonRepository.findBusinessAddons(req.businessId);
    
    // Create a map of addon_key -> business addon status
    const businessAddonMap = {};
    businessAddons.forEach(ba => {
      businessAddonMap[ba.addon_key] = {
        status: ba.status,
        priceOverride: ba.price_override,
        activatedAt: ba.created_at
      };
    });
    
    // Combine addons with business status
    const addons = allAddons.map(addon => ({
      addon_key: addon.addon_key,
      name: addon.name,
      default_price: parseFloat(addon.default_price || 0),
      isActive: businessAddonMap[addon.addon_key]?.status === 'active' || false,
      status: businessAddonMap[addon.addon_key]?.status || 'inactive',
      priceOverride: businessAddonMap[addon.addon_key]?.priceOverride || null,
      activatedAt: businessAddonMap[addon.addon_key]?.activatedAt || null
    }));
    
    res.json({
      success: true,
      data: { addons }
    });
  } catch (error) {
    logger.error('Error fetching addons:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch addons' }
    });
  }
}));

/**
 * Activate or deactivate addon
 * PUT /api/addons/:addonKey
 */
router.put('/:addonKey', [
  param('addonKey').notEmpty().withMessage('Addon key is required'),
  body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  body('priceOverride').optional().isFloat({ min: 0 }).withMessage('Price override must be a positive number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }
  
  // Only business and admin can activate/deactivate addons
  if (req.user.userType !== CONSTANTS.USER_TYPES.BUSINESS && req.user.userType !== CONSTANTS.USER_TYPES.ADMIN) {
    return res.status(403).json({
      success: false,
      error: { message: 'Only business and admin users can manage addons' }
    });
  }
  
  try {
    const { addonKey } = req.params;
    const { status, priceOverride } = req.body;
    
    let result;
    if (status === 'active') {
      result = await addonRepository.activateAddon(req.businessId, addonKey, priceOverride || null);
    } else {
      result = await addonRepository.deactivateAddon(req.businessId, addonKey);
    }
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { message: 'Addon not found' }
      });
    }
    
    res.json({
      success: true,
      data: {
        addon_key: result.addon_key,
        name: result.name,
        status: result.status,
        priceOverride: result.price_override
      }
    });
  } catch (error) {
    logger.error('Error updating addon:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update addon' }
    });
  }
}));

module.exports = router;
