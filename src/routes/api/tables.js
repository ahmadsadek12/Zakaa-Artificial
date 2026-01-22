// Tables API Routes
// Handle table management endpoints

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const tableRepository = require('../../repositories/tableRepository');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { authenticate } = require('../../middleware/auth');
const { requirePremium } = require('../../middleware/premium');
const { addonGuard } = require('../../middleware/addonGuard');

// Update all routes to use 'table_reservations' addon key

/**
 * GET /api/tables - List tables with optional reservation status for a specific date
 * Query params:
 *   - ownerUserId: Optional owner user ID (branch filter)
 *   - includeInactive: Include inactive tables (default: false)
 *   - date: Optional date (YYYY-MM-DD) to show reservation status for each table
 */
router.get('/', 
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  query('ownerUserId').optional().isUUID(),
  query('includeInactive').optional().isBoolean().toBoolean(),
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid query parameters', details: errors.array() } });
      }
      
      const ownerUserId = req.query.ownerUserId || (req.isBranchUser ? req.userId : req.businessId);
      const businessId = req.businessId;
      const includeInactive = req.query.includeInactive === true;
      const date = req.query.date || null;
      
      if (!ownerUserId) {
        return res.status(400).json({ 
          success: false, 
          error: { message: 'Owner user ID is required. Authentication may have failed.' } 
        });
      }
      
      const tables = await tableRepository.findByBusiness(ownerUserId, businessId, includeInactive, date);
      
      res.json({
        success: true,
        data: { 
          tables,
          date: date || null // Include the date in response for frontend reference
        }
      });
    } catch (error) {
      console.error('Error fetching tables:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: { 
          message: 'Failed to fetch tables',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });
    }
  }
);

/**
 * GET /api/tables/available - Get available tables for a specific slot
 */
router.get('/available',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  query('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  query('numberOfGuests').optional().isInt({ min: 1 }).toInt(),
  query('positionPreference').optional().isString().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid query parameters', details: errors.array() } });
      }
      
      const ownerUserId = req.isBranchUser ? req.userId : req.businessId;
      const date = req.query.date || null;
      const time = req.query.time || null;
      const numberOfGuests = req.query.numberOfGuests ? parseInt(req.query.numberOfGuests) : null;
      const positionPreference = req.query.positionPreference || null;
      
      let tables;
      if (date && time) {
        tables = await tableRepository.findAvailableForSlot(ownerUserId, date, time, numberOfGuests, positionPreference);
      } else {
        tables = await tableRepository.findAvailable(ownerUserId, date, time);
      }
      
      res.json({
        success: true,
        data: { tables }
      });
    } catch (error) {
      console.error('Error fetching available tables:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch available tables', details: error.message }
      });
    }
  }
);

/**
 * POST /api/tables - Create table
 */
router.post('/',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  body('table_number').notEmpty().withMessage('Table number is required').optional(),
  body('number').notEmpty().withMessage('Table number is required').optional(), // Backward compatibility
  body('min_seats').isInt({ min: 1 }).withMessage('Min seats must be at least 1').optional(),
  body('max_seats').isInt({ min: 1 }).withMessage('Max seats must be at least 1').optional(),
  body('seats').isInt({ min: 1 }).withMessage('Seats must be at least 1').optional(), // Backward compatibility
  body('owner_user_id').optional().isUUID(),
  body('position_label').optional().isString().trim(),
  body('position_notes').optional().isString().trim(),
  body('is_active').optional().isBoolean().toBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const ownerUserId = req.body.owner_user_id || (req.isBranchUser ? req.userId : req.businessId);
      const tableNumber = req.body.table_number || req.body.number;
      const minSeats = req.body.min_seats || req.body.seats || 1;
      const maxSeats = req.body.max_seats || req.body.seats || 1;
      
      // Validate min_seats <= max_seats
      if (minSeats > maxSeats) {
        return res.status(400).json({
          success: false,
          error: { message: 'Min seats cannot be greater than max seats' }
        });
      }
      
      if (!tableNumber) {
        return res.status(400).json({
          success: false,
          error: { message: 'Table number is required' }
        });
      }
      
      const table = await tableRepository.create({
        ownerUserId,
        businessId: req.businessId,
        tableNumber,
        minSeats,
        maxSeats,
        positionLabel: req.body.position_label || req.body.label || null,
        positionNotes: req.body.position_notes || null,
        isActive: req.body.is_active !== undefined ? req.body.is_active : true
      });
      
      res.status(201).json({
        success: true,
        data: table
      });
    } catch (error) {
      console.error('Error creating table:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create table', details: error.message }
      });
    }
  }
);

/**
 * GET /api/tables/:id - Get table details
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid table ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid table ID', details: errors.array() } });
      }
      
      const ownerUserId = req.isBranchUser ? req.userId : req.businessId;
      const businessId = req.businessId;
      const table = await tableRepository.findById(req.params.id, ownerUserId, businessId);
      
      if (!table) {
        return res.status(404).json({
          success: false,
          error: { message: 'Table not found' }
        });
      }
      
      res.json({
        success: true,
        data: table
      });
    } catch (error) {
      console.error('Error fetching table:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch table' }
      });
    }
  }
);

/**
 * PUT /api/tables/:id - Update table
 */
router.put('/:id',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid table ID'),
  body('table_number').optional().notEmpty(),
  body('number').optional().notEmpty(), // Backward compatibility
  body('min_seats').optional().isInt({ min: 1 }),
  body('max_seats').optional().isInt({ min: 1 }),
  body('seats').optional().isInt({ min: 1 }), // Backward compatibility
  body('position_label').optional().isString().trim(),
  body('position_notes').optional().isString().trim(),
  body('is_active').optional().isBoolean().toBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const ownerUserId = req.isBranchUser ? req.userId : req.businessId;
      
      const updateData = {};
      if (req.body.table_number !== undefined) updateData.tableNumber = req.body.table_number;
      if (req.body.number !== undefined) updateData.number = req.body.number; // Backward compatibility
      if (req.body.min_seats !== undefined) updateData.minSeats = req.body.min_seats;
      if (req.body.max_seats !== undefined) updateData.maxSeats = req.body.max_seats;
      if (req.body.seats !== undefined) updateData.seats = req.body.seats; // Backward compatibility
      if (req.body.position_label !== undefined) updateData.positionLabel = req.body.position_label;
      if (req.body.position_notes !== undefined) updateData.positionNotes = req.body.position_notes;
      if (req.body.is_active !== undefined) updateData.isActive = req.body.is_active;
      
      // Validate min_seats <= max_seats if both are being updated
      if (updateData.minSeats !== undefined && updateData.maxSeats !== undefined) {
        if (updateData.minSeats > updateData.maxSeats) {
          return res.status(400).json({
            success: false,
            error: { message: 'Min seats cannot be greater than max seats' }
          });
        }
      }
      
      const table = await tableRepository.update(req.params.id, ownerUserId, updateData);
      
      if (!table) {
        return res.status(404).json({
          success: false,
          error: { message: 'Table not found' }
        });
      }
      
      res.json({
        success: true,
        data: table
      });
    } catch (error) {
      console.error('Error updating table:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update table', details: error.message }
      });
    }
  }
);

/**
 * PATCH /api/tables/:id/toggle - Toggle table active status
 */
router.patch('/:id/toggle',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid table ID'),
  body('is_active').isBoolean().toBoolean().withMessage('is_active status is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const ownerUserId = req.isBranchUser ? req.userId : req.businessId;
      
      const table = await tableRepository.update(req.params.id, ownerUserId, { isActive: req.body.is_active });
      
      if (!table) {
        return res.status(404).json({
          success: false,
          error: { message: 'Table not found' }
        });
      }
      
      res.json({
        success: true,
        data: table
      });
    } catch (error) {
      console.error('Error toggling table status:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to toggle table status', details: error.message }
      });
    }
  }
);

/**
 * DELETE /api/tables/:id - Delete table (soft delete)
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid table ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid table ID', details: errors.array() } });
      }
      
      const ownerUserId = req.isBranchUser ? req.userId : req.businessId;
      
      const table = await tableRepository.findById(req.params.id, ownerUserId);
      if (!table) {
        return res.status(404).json({
          success: false,
          error: { message: 'Table not found' }
        });
      }
      
      await tableRepository.deleteTable(req.params.id, ownerUserId);
      
      res.json({
        success: true,
        message: 'Table deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting table:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to delete table', details: error.message }
      });
    }
  }
);

module.exports = router;
