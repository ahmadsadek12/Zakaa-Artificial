// Categories Routes
// Category CRUD operations for service categories

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const categoryRepository = require('../../repositories/serviceCategoryRepository');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication and business/admin access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS));
router.use(tenantIsolation);

/**
 * List all categories for business
 * GET /api/categories
 */
router.get('/', asyncHandler(async (req, res) => {
  const categories = await categoryRepository.findByBusiness(req.businessId);
  
  res.json({
    success: true,
    data: { categories }
  });
}));

/**
 * Get category by ID
 * GET /api/categories/:id
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid category ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }
  
  const category = await categoryRepository.findById(req.params.id, req.businessId);
  
  if (!category) {
    return res.status(404).json({
      success: false,
      error: { message: 'Category not found' }
    });
  }
  
  res.json({
    success: true,
    data: { category }
  });
}));

/**
 * Create category
 * POST /api/categories
 */
router.post('/', [
  body('name').notEmpty().trim().withMessage('Category name is required'),
  body('name').isLength({ max: 255 }).withMessage('Category name must be 255 characters or less')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }
  
  const { name } = req.body;
  
  // Get current max sort_order and add 1 for new category
  const existingCategories = await categoryRepository.findByBusiness(req.businessId);
  const maxSortOrder = existingCategories.length > 0 
    ? Math.max(...existingCategories.map(c => c.sort_order || 0))
    : -1;
  const sortOrder = maxSortOrder + 1;
  
  // Check if category with same name already exists
  const existingCategories = await categoryRepository.findByBusiness(req.businessId);
  const duplicate = existingCategories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
  
  if (duplicate) {
    return res.status(409).json({
      success: false,
      error: { message: 'Category with this name already exists' }
    });
  }
  
  const category = await categoryRepository.create({
    businessId: req.businessId,
    name: name.trim(),
    sortOrder: sortOrder,
    isActive: true
  });
  
  logger.info(`Category created: ${category.id} for business: ${req.businessId}`);
  
  res.status(201).json({
    success: true,
    data: { category }
  });
}));

/**
 * Update category
 * PUT /api/categories/:id
 */
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid category ID'),
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('name').optional().isLength({ max: 255 }).withMessage('Category name must be 255 characters or less'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }
  
  const category = await categoryRepository.findById(req.params.id, req.businessId);
  
  if (!category) {
    return res.status(404).json({
      success: false,
      error: { message: 'Category not found' }
    });
  }
  
  // Check for duplicate name if name is being updated
  if (req.body.name) {
    const existingCategories = await categoryRepository.findByBusiness(req.businessId);
    const duplicate = existingCategories.find(
      cat => cat.id !== req.params.id && cat.name.toLowerCase() === req.body.name.toLowerCase()
    );
    
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: { message: 'Category with this name already exists' }
      });
    }
  }
  
  const updateData = {};
  if (req.body.name !== undefined) updateData.name = req.body.name.trim();
  if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
  
  const updatedCategory = await categoryRepository.update(req.params.id, req.businessId, updateData);
  
  logger.info(`Category updated: ${updatedCategory.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    data: { category: updatedCategory }
  });
}));

/**
 * Delete category (soft delete)
 * DELETE /api/categories/:id
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid category ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }
  
  const category = await categoryRepository.findById(req.params.id, req.businessId);
  
  if (!category) {
    return res.status(404).json({
      success: false,
      error: { message: 'Category not found' }
    });
  }
  
  await categoryRepository.softDelete(req.params.id, req.businessId);
  
  logger.info(`Category deleted: ${category.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
}));

module.exports = router;
