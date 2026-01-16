// Menu Routes
// Menu CRUD operations

const express = require('express');
const router = express.Router();
const multer = require('multer');
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

// All routes require authentication and business/admin/branch access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

// Configure multer - always use memory storage so we can compress images before S3 upload
// Supports images (multiple) and PDFs (single)
const upload = multer({
  storage: multer.memoryStorage(), // Always use memory to compress images before upload
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB (larger for PDFs, images will be compressed)
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDFs are allowed'));
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
          message: 'File too large. Maximum file size is 10MB. Please compress your file or choose a smaller one.',
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
 * Supports: PDF (menuPdf), multiple images (menuImages), link (menuLink), name, isActive
 */
router.post('/', upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'menuImages', maxCount: 10 }
]), handleMulterError, [
  body('name').trim().notEmpty().withMessage('Menu name required'),
  body('menuLink').optional().isURL().withMessage('Menu link must be a valid URL'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const { name, description, menuLink, isActive } = req.body;
  
  // Handle PDF upload (single file)
  let menuPdfUrl = null;
  if (req.files && req.files.menuPdf && req.files.menuPdf[0]) {
    const pdfFile = req.files.menuPdf[0];
    if (pdfFile.location) {
      menuPdfUrl = pdfFile.location;
    } else if (pdfFile.buffer && s3) {
      try {
        const fileName = `${generateUUID()}-${pdfFile.originalname}`;
        menuPdfUrl = await uploadToS3(pdfFile.buffer, fileName, pdfFile.mimetype, 'menus');
      } catch (error) {
        logger.warn('S3 PDF upload failed, skipping PDF:', error.message);
      }
    }
  }
  
  // Handle multiple image uploads - compress before uploading
  let menuImageUrls = [];
  if (req.files && req.files.menuImages && req.files.menuImages.length > 0) {
    if (s3) {
      const { compressImage } = require('../../utils/imageProcessor');
      for (const imageFile of req.files.menuImages) {
        if (imageFile.buffer) {
          try {
            // Compress image before uploading (typically reduces size by 60-80%)
            const compressedBuffer = await compressImage(imageFile.buffer, {
              maxWidth: 1200,
              maxHeight: 1200,
              quality: 85
            });
            
            // Generate filename with .jpg extension (compressed images are JPEG)
            const originalName = imageFile.originalname.replace(/\.[^/.]+$/, '');
            const fileName = `${generateUUID()}-${originalName}.jpg`;
            const imageUrl = await uploadToS3(compressedBuffer, fileName, 'image/jpeg', 'menus');
            menuImageUrls.push(imageUrl);
          } catch (error) {
            logger.warn('S3 image upload failed, skipping image:', error.message);
          }
        }
      }
    } else {
      logger.warn('S3 not configured, menu images skipped');
    }
  }
  
  const menu = await menuRepository.create({
    businessId: req.businessId,
    name,
    description: description || null,
    menuPdfUrl: menuPdfUrl || null,
    menuImageUrls: menuImageUrls.length > 0 ? menuImageUrls : null,
    menuLink: menuLink || null,
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
 * Supports: PDF (menuPdf), multiple images (menuImages), link (menuLink), name, isActive
 */
router.put('/:id', requireOwnership('menus'), upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'menuImages', maxCount: 10 }
]), handleMulterError, [
  body('name').optional().trim().notEmpty().withMessage('Menu name cannot be empty'),
  body('menuLink').optional().isURL().withMessage('Menu link must be a valid URL'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], asyncHandler(async (req, res) => {
  // Parse existingImageUrls from JSON string if it's a string (FormData sends it as JSON string)
  if (req.body.existingImageUrls && typeof req.body.existingImageUrls === 'string') {
    try {
      req.body.existingImageUrls = JSON.parse(req.body.existingImageUrls);
    } catch (e) {
      req.body.existingImageUrls = [];
    }
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }
  
  const updateData = {};
  const { name, description, menuLink, isActive, existingImageUrls } = req.body;
  
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (menuLink !== undefined) updateData.menuLink = menuLink;
  if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
  
  // Handle PDF upload (single file)
  if (req.files && req.files.menuPdf && req.files.menuPdf[0]) {
    const pdfFile = req.files.menuPdf[0];
    if (pdfFile.location) {
      updateData.menuPdfUrl = pdfFile.location;
    } else if (pdfFile.buffer && s3) {
      try {
        const fileName = `${generateUUID()}-${pdfFile.originalname}`;
        updateData.menuPdfUrl = await uploadToS3(pdfFile.buffer, fileName, pdfFile.mimetype, 'menus');
      } catch (error) {
        logger.warn('S3 PDF upload failed, skipping PDF update:', error.message);
      }
    }
  }
  
  // Handle multiple image uploads
  // Merge existing images (that user wants to keep) with new images
  let finalImageUrls = [];
  
  // Parse existing image URLs that user wants to keep
  if (existingImageUrls !== undefined) {
    try {
      const existingUrls = Array.isArray(existingImageUrls) ? existingImageUrls : [];
      finalImageUrls = [...existingUrls];
    } catch (error) {
      logger.warn('Error parsing existing image URLs:', error.message);
    }
  } else {
    // If existingImageUrls not provided, get from database (preserve all existing)
    const existingMenu = await menuRepository.findById(req.params.id, req.businessId);
    if (existingMenu && existingMenu.menu_image_urls) {
      try {
        const existingUrls = typeof existingMenu.menu_image_urls === 'string'
          ? JSON.parse(existingMenu.menu_image_urls)
          : existingMenu.menu_image_urls;
        finalImageUrls = Array.isArray(existingUrls) ? [...existingUrls] : [];
      } catch (error) {
        logger.warn('Error parsing existing menu images:', error.message);
      }
    }
  }
  
  // Add new uploaded images - compress before uploading
  if (req.files && req.files.menuImages && req.files.menuImages.length > 0) {
    if (s3) {
      const { compressImage } = require('../../utils/imageProcessor');
      for (const imageFile of req.files.menuImages) {
        if (imageFile.buffer) {
          try {
            // Compress image before uploading (typically reduces size by 60-80%)
            const compressedBuffer = await compressImage(imageFile.buffer, {
              maxWidth: 1200,
              maxHeight: 1200,
              quality: 85
            });
            
            // Generate filename with .jpg extension (compressed images are JPEG)
            const originalName = imageFile.originalname.replace(/\.[^/.]+$/, '');
            const fileName = `${generateUUID()}-${originalName}.jpg`;
            const imageUrl = await uploadToS3(compressedBuffer, fileName, 'image/jpeg', 'menus');
            finalImageUrls.push(imageUrl);
          } catch (error) {
            logger.warn('S3 image upload failed, skipping image:', error.message);
          }
        }
      }
    } else {
      logger.warn('S3 not configured, menu images skipped');
    }
    // Update with merged list (existing + new)
    updateData.menuImageUrls = finalImageUrls;
  } else if (existingImageUrls !== undefined) {
    // If no new images but existingImageUrls was provided (user removed some), update with kept images only
    updateData.menuImageUrls = finalImageUrls;
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
