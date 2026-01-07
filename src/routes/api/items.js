// Item Routes
// Item CRUD operations with S3 image upload

const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const itemRepository = require('../../repositories/itemRepository');
const { s3, S3_CONFIG } = require('../../config/aws');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');
const { generateUUID } = require('../../utils/uuid');

// All routes require authentication and business/admin access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS));
router.use(tenantIsolation);

// Configure multer for S3 upload
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: S3_CONFIG.bucket,
    acl: 'public-read',
    key: function (req, file, cb) {
      const folder = 'items';
      const fileName = `${generateUUID()}-${file.originalname}`;
      cb(null, `${folder}/${fileName}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * List items with filters
 * GET /api/items?menuId=&branchId=&availability=
 */
router.get('/', asyncHandler(async (req, res) => {
  const filters = {
    businessId: req.businessId,
    menuId: req.query.menuId || null,
    branchId: req.query.branchId || null,
    availability: req.query.availability || null
  };
  
  const items = await itemRepository.find(filters);
  
  res.json({
    success: true,
    data: { items },
    count: items.length
  });
}));

/**
 * Get item details
 * GET /api/items/:id
 */
router.get('/:id', requireOwnership('items'), asyncHandler(async (req, res) => {
  const item = await itemRepository.findById(req.params.id, req.businessId);
  
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { message: 'Item not found' }
    });
  }
  
  res.json({
    success: true,
    data: { item }
  });
}));

/**
 * Create item
 * POST /api/items
 */
router.post('/', [
  body('name').notEmpty().withMessage('Item name required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('menuId').optional().isUUID().withMessage('menuId must be a valid UUID'),
  body('availability').optional().isIn(['available', 'out_of_stock', 'hidden']).withMessage('Invalid availability')
], upload.single('itemImage'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { name, description, menuId, branchId, price, cost, preparationTimeMinutes, availability } = req.body;
  const itemImageUrl = req.file ? req.file.location : null;
  
  const item = await itemRepository.create({
    businessId: req.businessId,
    menuId: menuId || null,
    branchId: branchId || null,
    name,
    description,
    price: parseFloat(price),
    cost: cost ? parseFloat(cost) : null,
    preparationTimeMinutes: preparationTimeMinutes ? parseInt(preparationTimeMinutes) : null,
    availability: availability || 'available',
    itemImageUrl
  });
  
  logger.info(`Item created: ${item.id} for business: ${req.businessId}`);
  
  res.status(201).json({
    success: true,
    data: { item }
  });
}));

/**
 * Update item
 * PUT /api/items/:id
 */
router.put('/:id', requireOwnership('items'), [
  body('name').optional().notEmpty().withMessage('Item name cannot be empty'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('availability').optional().isIn(['available', 'out_of_stock', 'hidden']).withMessage('Invalid availability')
], upload.single('itemImage'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const updateData = {};
  const { name, description, menuId, branchId, price, cost, preparationTimeMinutes, availability } = req.body;
  
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (menuId !== undefined) updateData.menuId = menuId;
  if (branchId !== undefined) updateData.branchId = branchId;
  if (price !== undefined) updateData.price = parseFloat(price);
  if (cost !== undefined) updateData.cost = cost ? parseFloat(cost) : null;
  if (preparationTimeMinutes !== undefined) updateData.preparationTimeMinutes = preparationTimeMinutes ? parseInt(preparationTimeMinutes) : null;
  if (availability !== undefined) updateData.availability = availability;
  
  // Handle image upload
  if (req.file) {
    updateData.itemImageUrl = req.file.location;
  }
  
  const updatedItem = await itemRepository.update(req.params.id, req.businessId, updateData);
  
  logger.info(`Item updated: ${req.params.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    data: { item: updatedItem }
  });
}));

/**
 * Delete item (soft delete)
 * DELETE /api/items/:id
 */
router.delete('/:id', requireOwnership('items'), asyncHandler(async (req, res) => {
  await itemRepository.softDelete(req.params.id, req.businessId);
  
  logger.info(`Item deleted: ${req.params.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    message: 'Item deleted successfully'
  });
}));

/**
 * Update item availability
 * PUT /api/items/:id/availability
 */
router.put('/:id/availability', requireOwnership('items'), [
  body('availability').isIn(['available', 'out_of_stock', 'hidden']).withMessage('Invalid availability')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { availability } = req.body;
  
  const updatedItem = await itemRepository.update(req.params.id, req.businessId, { availability });
  
  res.json({
    success: true,
    data: { item: updatedItem }
  });
}));

module.exports = router;
