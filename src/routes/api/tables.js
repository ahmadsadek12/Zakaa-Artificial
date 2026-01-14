// Tables API Routes
// Handle table management endpoints

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const tableRepository = require('../../repositories/tableRepository');
const { tenantIsolation, requireOwnership } = require('../../middleware/tenant');
const { authenticate } = require('../../middleware/auth');
const { requirePremium } = require('../../middleware/premium');

/**
 * GET /api/tables - List tables
 */
router.get('/', 
  authenticate,
  tenantIsolation,
  query('includeReserved').optional().isBoolean().toBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid query parameters', details: errors.array() } });
      }
      
      const includeReserved = req.query.includeReserved !== false;
      const userId = req.isBranchUser ? req.userId : req.businessId;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: { message: 'Business user ID is required. Authentication may have failed.' } 
        });
      }
      
      const tables = await tableRepository.findByBusiness(userId, includeReserved);
      
      res.json({
        success: true,
        data: { tables }
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
 * GET /api/tables/available - Get available (non-reserved) tables
 */
router.get('/available',
  authenticate,
  tenantIsolation,
  async (req, res) => {
    try {
      const userId = req.isBranchUser ? req.userId : req.businessId;
      
      const tables = await tableRepository.findAvailable(userId);
      
      res.json({
        success: true,
        data: { tables }
      });
    } catch (error) {
      console.error('Error fetching available tables:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch available tables' }
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
  body('seats').isInt({ min: 1 }).withMessage('Seats must be at least 1'),
  body('number').notEmpty().withMessage('Table number is required'),
  body('reserved').optional().isBoolean().toBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const userId = req.isBranchUser ? req.userId : req.businessId;
      
      const table = await tableRepository.create({
        userId,
        seats: req.body.seats,
        number: req.body.number,
        reserved: req.body.reserved || false
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
  param('id').isUUID().withMessage('Invalid table ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid table ID', details: errors.array() } });
      }
      
      const userId = req.isBranchUser ? req.userId : req.businessId;
      const table = await tableRepository.findById(req.params.id, userId);
      
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
  param('id').isUUID().withMessage('Invalid table ID'),
  body('seats').optional().isInt({ min: 1 }),
  body('number').optional().notEmpty(),
  body('reserved').optional().isBoolean().toBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const userId = req.isBranchUser ? req.userId : req.businessId;
      
      const updateData = {};
      if (req.body.seats !== undefined) updateData.seats = req.body.seats;
      if (req.body.number !== undefined) updateData.number = req.body.number;
      if (req.body.reserved !== undefined) updateData.reserved = req.body.reserved;
      
      const table = await tableRepository.update(req.params.id, userId, updateData);
      
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
 * PUT /api/tables/:id/reserved - Update reserved status
 */
router.put('/:id/reserved',
  authenticate,
  tenantIsolation,
  param('id').isUUID().withMessage('Invalid table ID'),
  body('reserved').isBoolean().toBoolean().withMessage('Reserved status is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const userId = req.isBranchUser ? req.userId : req.businessId;
      
      const table = await tableRepository.updateReservedStatus(req.params.id, userId, req.body.reserved);
      
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
      console.error('Error updating table reserved status:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update table reserved status', details: error.message }
      });
    }
  }
);

/**
 * DELETE /api/tables/:id - Delete table
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  param('id').isUUID().withMessage('Invalid table ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid table ID', details: errors.array() } });
      }
      
      const userId = req.isBranchUser ? req.userId : req.businessId;
      
      const table = await tableRepository.findById(req.params.id, userId);
      if (!table) {
        return res.status(404).json({
          success: false,
          error: { message: 'Table not found' }
        });
      }
      
      await tableRepository.deleteTable(req.params.id, userId);
      
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
