// Item Routes
// Item CRUD operations with S3 image upload

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const itemRepository = require('../../repositories/itemRepository');
const { s3, S3_CONFIG } = require('../../config/aws');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');
const { generateUUID } = require('../../utils/uuid');

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

// Configure multer - always use memory storage so we can compress before S3 upload
const upload = multer({
  storage: multer.memoryStorage(), // Always use memory to compress before upload
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB (will be compressed before upload to ~500KB-1MB)
  },
  fileFilter: (req, file, cb) => {
    // Allow all image types including HEIC/HEIF (Apple device photos)
    const allowedMimeTypes = [
      'image/heic',
      'image/heif',
      'image/heic-sequence',
      'image/heif-sequence'
    ];
    
    if (file.mimetype.startsWith('image/') || allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP, HEIC, etc.)'));
    }
  }
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'File too large. Maximum file size is 10MB. Please compress your image or choose a smaller file.',
          code: 'FILE_TOO_LARGE'
        }
      });
    }
    return res.status(400).json({
      success: false,
      error: {
        message: `Upload error: ${err.message}`,
        code: 'UPLOAD_ERROR'
      }
    });
  }
  if (err) {
    // Handle fileFilter errors
    return res.status(400).json({
      success: false,
      error: {
        message: err.message || 'File upload error',
        code: 'FILE_UPLOAD_ERROR'
      }
    });
  }
  next();
};

/**
 * List items with filters
 * GET /api/items?menuId=&branchId=&availability=&groupByCategory=true
 */
router.get('/', asyncHandler(async (req, res) => {
  const filters = {
    businessId: req.businessId,
    menuId: req.query.menuId || null,
    userId: req.query.userId || req.query.branchId || (req.isBranchUser ? req.userId : null),
    availability: req.query.availability || null,
    categoryId: req.query.categoryId || null
  };
  
  const items = await itemRepository.find(filters);
  
  // If groupByCategory is requested, group items by category
  if (req.query.groupByCategory === 'true') {
    const categoryRepository = require('../../repositories/serviceCategoryRepository');
    const categories = await categoryRepository.findByBusiness(req.businessId);
    
    // Create a map of category_id -> category
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.id] = { ...cat, items: [] };
    });
    
    // Add "Uncategorized" category for items without category
    categoryMap['uncategorized'] = {
      id: null,
      name: 'Uncategorized',
      sort_order: 9999,
      items: []
    };
    
    // Group items by category
    items.forEach(item => {
      const categoryId = item.category_id || 'uncategorized';
      if (categoryMap[categoryId]) {
        categoryMap[categoryId].items.push(item);
      } else {
        categoryMap['uncategorized'].items.push(item);
      }
    });
    
    // Convert to array and sort by sort_order
    const groupedCategories = Object.values(categoryMap)
      .filter(cat => cat.items.length > 0) // Only include categories with items
      .sort((a, b) => a.sort_order - b.sort_order);
    
    return res.json({
      success: true,
      data: { 
        items,
        categories: groupedCategories,
        grouped: true
      },
      count: items.length
    });
  }
  
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
router.post('/', upload.single('itemImage'), handleMulterError, [
  body('name').trim().notEmpty().withMessage('Item name required'),
  body('price').notEmpty().withMessage('Price is required').bail().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('menuId').optional().isUUID().withMessage('menuId must be a valid UUID'),
  body('availability').optional().isIn(['available', 'out_of_stock', 'hidden']).withMessage('Invalid availability'),
  body('durationMinutes').optional().isInt({ min: 0 }).withMessage('Duration must be a non-negative integer'),
  body('preparationTimeMinutes').optional().isInt({ min: 0 }).withMessage('Preparation time must be a non-negative integer'),
  body('quantity').optional().custom((value) => {
    // Allow empty string, null, or undefined for unlimited
    if (value === '' || value === null || value === undefined) return true;
    const numValue = parseInt(value);
    if (isNaN(numValue)) return false;
    return numValue >= 1;
  }).withMessage('Quantity must be 1 or greater, or empty for unlimited'),
  body('isReusable').optional().isBoolean().withMessage('isReusable must be a boolean'),
  body('availableFrom').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/).withMessage('Available from must be a valid time (HH:MM or HH:MM:SS)'),
  body('availableTo').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/).withMessage('Available to must be a valid time (HH:MM or HH:MM:SS)'),
  body('daysAvailable').optional().custom((value) => {
    // Allow array or JSON string that can be parsed to array
    if (Array.isArray(value)) return true;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed);
      } catch (e) {
        return false;
      }
    }
    return false;
  }).withMessage('Days available must be an array or JSON string'),
  body('daysAvailable.*').optional().isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).withMessage('Invalid day name'),
  body('ingredients').optional().isString().withMessage('Ingredients must be a string')
], asyncHandler(async (req, res) => {
  // Parse daysAvailable from JSON string if it's a string (FormData sends it as JSON string)
  if (req.body.daysAvailable && typeof req.body.daysAvailable === 'string') {
    try {
      req.body.daysAvailable = JSON.parse(req.body.daysAvailable);
    } catch (e) {
      // If parsing fails, treat as empty array
      req.body.daysAvailable = [];
    }
  }
  
  // Parse isReusable from string to boolean if it's a string (FormData sends booleans as strings)
  if (req.body.isReusable !== undefined && typeof req.body.isReusable === 'string') {
    req.body.isReusable = req.body.isReusable === 'true';
  }
  
  // Parse isSchedulable from string to boolean if it's a string
  if (req.body.isSchedulable !== undefined && typeof req.body.isSchedulable === 'string') {
    req.body.isSchedulable = req.body.isSchedulable === 'true';
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { name, description, menuId, userId, branchId, price, cost, preparationTimeMinutes, durationMinutes, quantity, isReusable, itemType, isSchedulable, minScheduleHours, availableFrom, availableTo, daysAvailable, ingredients, availability, categoryId } = req.body;
  
  // Validate categoryId if provided
  if (categoryId) {
    const categoryRepository = require('../../repositories/serviceCategoryRepository');
    const category = await categoryRepository.findById(categoryId, req.businessId);
    if (!category) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid category ID' }
      });
    }
  }
  
  // Handle file upload - compress and upload to S3
  let itemImageUrl = null;
  if (req.file && req.file.buffer) {
    if (s3) {
      // Compress and upload to S3
      try {
        const { uploadToS3 } = require('../../config/aws');
        const { compressImage } = require('../../utils/imageProcessor');
        
        // Compress image before uploading (typically reduces size by 60-80%)
        const compressedBuffer = await compressImage(req.file.buffer, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 85
        });
        
        // Generate filename with .jpg extension (compressed images are JPEG)
        const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');
        const fileName = `${generateUUID()}-${originalName}.jpg`;
        itemImageUrl = await uploadToS3(compressedBuffer, fileName, 'image/jpeg', 'items', req.businessId);
        logger.info('Item image uploaded successfully', { 
          itemImageUrl, 
          fileName,
          originalSize: req.file.buffer.length,
          compressedSize: compressedBuffer.length
        });
      } catch (error) {
        logger.error('S3 upload failed, skipping image:', { 
          error: error.message, 
          stack: error.stack,
          fileName: req.file.originalname
        });
        // Continue without image if S3 upload fails
      }
    } else {
      logger.warn('S3 not configured, image upload skipped');
    }
  }
  
  const item = await itemRepository.create({
    businessId: req.businessId,
    menuId: menuId || null,
    userId: userId || branchId || (req.isBranchUser ? req.userId : req.businessId),
    name,
    description: description || null,
    itemType: itemType || 'good',
    isSchedulable: isSchedulable !== undefined ? (isSchedulable === true || isSchedulable === 'true') : false,
    minScheduleHours: minScheduleHours ? parseInt(minScheduleHours, 10) : 0,
    price: parseFloat(price),
    cost: cost ? parseFloat(cost) : null,
    preparationTimeMinutes: preparationTimeMinutes ? parseInt(preparationTimeMinutes) : null,
    durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
    quantity: quantity && quantity !== '' ? parseInt(quantity, 10) : null,
    isReusable: isReusable !== undefined ? (isReusable === true || isReusable === 'true') : true,
    availableFrom: availableFrom || null,
    availableTo: availableTo || null,
    daysAvailable: daysAvailable || null,
    ingredients: ingredients || null,
    availability: availability || 'available',
    itemImageUrl,
    categoryId: categoryId || null
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
router.put('/:id', requireOwnership('items'), upload.single('itemImage'), handleMulterError, [
  body('name').optional().notEmpty().withMessage('Item name cannot be empty'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('availability').optional().isIn(['available', 'out_of_stock', 'hidden']).withMessage('Invalid availability'),
  body('durationMinutes').optional().isInt({ min: 0 }).withMessage('Duration must be a non-negative integer'),
  body('preparationTimeMinutes').optional().isInt({ min: 0 }).withMessage('Preparation time must be a non-negative integer'),
  body('quantity').optional().custom((value) => {
    // Allow empty string, null, or undefined for unlimited
    if (value === '' || value === null || value === undefined) return true;
    const numValue = parseInt(value);
    if (isNaN(numValue)) return false;
    return numValue >= 1;
  }).withMessage('Quantity must be 1 or greater, or empty for unlimited'),
  body('isReusable').optional().isBoolean().withMessage('isReusable must be a boolean'),
  body('itemType').optional().isIn(['service', 'good']).withMessage('Item type must be service or good'),
  body('isSchedulable').optional().isBoolean().withMessage('isSchedulable must be a boolean'),
  body('minScheduleHours').optional().isInt({ min: 0, max: 168 }).withMessage('Min schedule hours must be between 0 and 168'),
  body('availableFrom').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/).withMessage('Available from must be a valid time (HH:MM or HH:MM:SS)'),
  body('availableTo').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/).withMessage('Available to must be a valid time (HH:MM or HH:MM:SS)'),
  body('daysAvailable').optional().custom((value) => {
    // Allow array or JSON string that can be parsed to array
    if (Array.isArray(value)) return true;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed);
      } catch (e) {
        return false;
      }
    }
    return false;
  }).withMessage('Days available must be an array or JSON string'),
  body('daysAvailable.*').optional().isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).withMessage('Invalid day name'),
  body('ingredients').optional().isString().withMessage('Ingredients must be a string'),
  body('categoryId').optional().isUUID().withMessage('categoryId must be a valid UUID')
], asyncHandler(async (req, res) => {
  // Parse daysAvailable from JSON string if it's a string (FormData sends it as JSON string)
  if (req.body.daysAvailable && typeof req.body.daysAvailable === 'string') {
    try {
      req.body.daysAvailable = JSON.parse(req.body.daysAvailable);
    } catch (e) {
      // If parsing fails, treat as empty array
      req.body.daysAvailable = [];
    }
  }
  
  // Parse isReusable from string to boolean if it's a string (FormData sends booleans as strings)
  if (req.body.isReusable !== undefined && typeof req.body.isReusable === 'string') {
    req.body.isReusable = req.body.isReusable === 'true';
  }
  
  // Parse isSchedulable from string to boolean if it's a string
  if (req.body.isSchedulable !== undefined && typeof req.body.isSchedulable === 'string') {
    req.body.isSchedulable = req.body.isSchedulable === 'true';
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  // Validate categoryId if provided
  if (req.body.categoryId) {
    const categoryRepository = require('../../repositories/serviceCategoryRepository');
    const category = await categoryRepository.findById(req.body.categoryId, req.businessId);
    if (!category) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid category ID' }
      });
    }
  }
  
  const updateData = {};
  const { name, description, menuId, userId, branchId, price, cost, preparationTimeMinutes, durationMinutes, quantity, isReusable, itemType, isSchedulable, minScheduleHours, availableFrom, availableTo, daysAvailable, ingredients, availability, categoryId } = req.body;
  
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (menuId !== undefined) updateData.menuId = menuId;
  if (userId !== undefined || branchId !== undefined) updateData.userId = userId || branchId;
  if (price !== undefined) updateData.price = parseFloat(price);
  if (cost !== undefined) updateData.cost = cost ? parseFloat(cost) : null;
    if (preparationTimeMinutes !== undefined) updateData.preparationTimeMinutes = preparationTimeMinutes ? parseInt(preparationTimeMinutes) : null;
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes ? parseInt(durationMinutes) : null;
    if (quantity !== undefined) updateData.quantity = quantity && quantity !== '' ? parseInt(quantity, 10) : null;
    if (isReusable !== undefined) updateData.isReusable = isReusable === true || isReusable === 'true';
    if (itemType !== undefined) updateData.itemType = itemType;
    if (isSchedulable !== undefined) updateData.isSchedulable = isSchedulable === true || isSchedulable === 'true';
    if (minScheduleHours !== undefined) updateData.minScheduleHours = minScheduleHours ? parseInt(minScheduleHours, 10) : 0;
    if (availableFrom !== undefined) updateData.availableFrom = availableFrom;
  if (availableTo !== undefined) updateData.availableTo = availableTo;
  if (daysAvailable !== undefined) updateData.daysAvailable = daysAvailable;
  if (ingredients !== undefined) updateData.ingredients = ingredients;
  if (availability !== undefined) updateData.availability = availability;
  if (categoryId !== undefined) updateData.categoryId = categoryId || null; // Allow setting to null to remove category
  
  // Handle image upload - compress and upload to S3
  if (req.file && req.file.buffer) {
    if (s3) {
      // Compress and upload to S3
      try {
        const { uploadToS3 } = require('../../config/aws');
        const { compressImage } = require('../../utils/imageProcessor');
        
        // Compress image before uploading (typically reduces size by 60-80%)
        const compressedBuffer = await compressImage(req.file.buffer, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 85
        });
        
        // Generate filename with .jpg extension (compressed images are JPEG)
        const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');
            const fileName = `${generateUUID()}-${originalName}.jpg`;
            updateData.itemImageUrl = await uploadToS3(compressedBuffer, fileName, 'image/jpeg', 'items', req.businessId);
      } catch (error) {
        logger.warn('S3 upload failed, skipping image update:', error.message);
        // Continue without image if S3 upload fails
      }
    } else {
      logger.warn('S3 not configured, image update skipped');
    }
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
