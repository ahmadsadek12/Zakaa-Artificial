// Menu Routes
// Menu CRUD operations

const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const menuRepository = require('../../repositories/menuRepository');
const { uploadToS3, S3_CONFIG } = require('../../config/aws');
const { s3 } = require('../../config/aws');
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
      const folder = 'menus';
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
 * List all menus for business
 * GET /api/menus
 */
router.get('/', asyncHandler(async (req, res) => {
  const menus = await menuRepository.findByBusinessId(req.businessId);
  
  res.json({
    success: true,
    data: { menus },
    count: menus.length
  });
}));

/**
 * Get menu details
 * GET /api/menus/:id
 */
router.get('/:id', requireOwnership('menus'), asyncHandler(async (req, res) => {
  const menu = await menuRepository.findById(req.params.id, req.businessId);
  
  if (!menu) {
    return res.status(404).json({
      success: false,
      error: { message: 'Menu not found' }
    });
  }
  
  // Get menu items
  const items = await menuRepository.getMenuItems(req.params.id, req.businessId);
  menu.items = items;
  
  res.json({
    success: true,
    data: { menu }
  });
}));

/**
 * Create menu
 * POST /api/menus
 */
router.post('/', [
  body('name').notEmpty().withMessage('Menu name required'),
  body('isShared').optional().isBoolean().withMessage('isShared must be boolean')
], upload.single('menuImage'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { name, description, isShared, isActive } = req.body;
  const menuImageUrl = req.file ? req.file.location : null;
  
  const menu = await menuRepository.create({
    businessId: req.businessId,
    name,
    description,
    isShared: isShared === 'true' || isShared === true,
    menuImageUrl,
    isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true
  });
  
  logger.info(`Menu created: ${menu.id} for business: ${req.businessId}`);
  
  res.status(201).json({
    success: true,
    data: { menu }
  });
}));

/**
 * Update menu
 * PUT /api/menus/:id
 */
router.put('/:id', requireOwnership('menus'), [
  body('name').optional().notEmpty().withMessage('Menu name cannot be empty')
], upload.single('menuImage'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const updateData = {};
  const { name, description, isShared, isActive } = req.body;
  
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (isShared !== undefined) updateData.isShared = isShared === 'true' || isShared === true;
  if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
  
  // Handle image upload
  if (req.file) {
    updateData.menuImageUrl = req.file.location;
  }
  
  const updatedMenu = await menuRepository.update(req.params.id, req.businessId, updateData);
  
  logger.info(`Menu updated: ${req.params.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    data: { menu: updatedMenu }
  });
}));

/**
 * Delete menu (soft delete)
 * DELETE /api/menus/:id
 */
router.delete('/:id', requireOwnership('menus'), asyncHandler(async (req, res) => {
  await menuRepository.softDelete(req.params.id, req.businessId);
  
  logger.info(`Menu deleted: ${req.params.id} for business: ${req.businessId}`);
  
  res.json({
    success: true,
    message: 'Menu deleted successfully'
  });
}));

/**
 * Attach menu to branches
 * POST /api/menus/:id/attach
 */
router.post('/:id/attach', requireOwnership('menus'), [
  body('branchIds').isArray().withMessage('branchIds must be an array'),
  body('branchIds.*').isUUID().withMessage('Each branchId must be a valid UUID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { branchIds } = req.body;
  
  await menuRepository.attachToBranches(req.params.id, req.businessId, branchIds);
  
  logger.info(`Menu ${req.params.id} attached to branches for business: ${req.businessId}`);
  
  res.json({
    success: true,
    message: 'Menu attached to branches successfully'
  });
}));

/**
 * Get menu items
 * GET /api/menus/:id/items
 */
router.get('/:id/items', requireOwnership('menus'), asyncHandler(async (req, res) => {
  const items = await menuRepository.getMenuItems(req.params.id, req.businessId);
  
  res.json({
    success: true,
    data: { items },
    count: items.length
  });
}));

module.exports = router;
