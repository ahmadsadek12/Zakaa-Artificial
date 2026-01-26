// Reservations API Routes
// Handle reservation management endpoints

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const reservationRepository = require('../../repositories/reservationRepository');
const tableRepository = require('../../repositories/tableRepository');
const { tenantIsolation } = require('../../middleware/tenant');
const { authenticate } = require('../../middleware/auth');
const { addonGuard } = require('../../middleware/addonGuard');
const { queryMySQL } = require('../../config/database');

/**
 * GET /api/reservations - List reservations
 */
router.get('/',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  query('status').optional().isIn(['confirmed', 'cancelled', 'completed', 'no_show']),
  query('type').optional().isIn(['table', 'appointment', 'other']),
  query('ownerUserId').optional().isUUID(),
  query('reservationDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('reservationDate must be in YYYY-MM-DD format'),
  query('tableId').optional().isUUID(),
  query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('startDate must be in YYYY-MM-DD format'),
  query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('endDate must be in YYYY-MM-DD format'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid query parameters', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      const ownerUserId = req.query.ownerUserId || (req.isBranchUser ? req.userId : null);
      
      if (!businessUserId) {
        return res.status(400).json({ 
          success: false, 
          error: { message: 'Business user ID is required. Authentication may have failed.' } 
        });
      }
      
      const filters = {
        status: req.query.status,
        type: req.query.type,
        reservationType: req.query.type,
        ownerUserId: ownerUserId,
        reservationDate: req.query.reservationDate || undefined,
        tableId: req.query.tableId,
        startDate: req.query.startDate || undefined,
        endDate: req.query.endDate || undefined,
        limit: req.query.limit
      };
      
      const reservations = await reservationRepository.findByBusiness(businessUserId, filters);
      
      res.json({
        success: true,
        data: { reservations }
      });
    } catch (error) {
      console.error('Error fetching reservations:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: { 
          message: 'Failed to fetch reservations',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });
    }
  }
);

/**
 * GET /api/reservations/by-date/:date - Get reservations by date
 */
router.get('/by-date/:date',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid date', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      const date = req.params.date;
      
      const reservations = await reservationRepository.findByDate(businessUserId, date);
      
      res.json({
        success: true,
        data: { reservations }
      });
    } catch (error) {
      console.error('Error fetching reservations by date:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch reservations' }
      });
    }
  }
);

/**
 * POST /api/reservations - Create reservation
 */
router.post('/',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  body('customerPhoneNumber').notEmpty().withMessage('Customer phone number is required'),
  body('customerName').notEmpty().withMessage('Customer name is required'),
  body('reservationDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Valid reservation date is required (YYYY-MM-DD format)'),
  body('reservationTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid reservation time is required (HH:MM)'),
  body('numberOfGuests').optional().isInt({ min: 1 }),
  body('tableId').optional().isUUID(),
  body('ownerUserId').optional().isUUID(),
  body('itemId').optional().isUUID(),
  body('status').optional().isIn(['confirmed', 'cancelled', 'completed']),
  body('reservation_kind').optional().isIn(['table', 'appointment']),
  body('reservation_type').optional().isIn(['table', 'appointment', 'other']),
  body('start_at').optional().isISO8601().withMessage('start_at must be a valid ISO 8601 date'),
  body('source').optional().isIn(['whatsapp', 'telegram', 'instagram', 'facebook', 'dashboard']),
  body('platform').optional().isIn(['whatsapp', 'telegram', 'instagram', 'facebook', 'dashboard']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      const ownerUserId = req.body.ownerUserId || (req.isBranchUser ? req.userId : req.businessId);
      const reservationType = req.body.reservation_type || req.body.reservation_kind || 'table';
      
      // Validate table exists and belongs to same owner_user_id and business_id if tableId provided
      if (req.body.tableId) {
        const table = await tableRepository.findById(req.body.tableId, ownerUserId, req.businessId);
        if (!table) {
          return res.status(404).json({
            success: false,
            error: { message: 'Table not found or does not belong to this business/branch' }
          });
        }
        
        if (!table.is_active) {
          return res.status(400).json({
            success: false,
            error: { message: 'Table is not active' }
          });
        }
      }
      
      // Double-booking prevention is handled in repository.create()
      
      const reservation = await reservationRepository.create({
        businessUserId,
        ownerUserId,
        userId: req.body.userId || null,
        tableId: req.body.tableId || null,
        itemId: req.body.itemId || null,
        customerPhoneNumber: req.body.customerPhoneNumber,
        customerName: req.body.customerName,
        reservationDate: req.body.reservationDate,
        reservationTime: req.body.reservationTime,
        numberOfGuests: req.body.numberOfGuests || null,
        notes: req.body.notes || null,
        status: req.body.status || 'confirmed',
        reservationKind: req.body.reservation_kind || 'table',
        reservationType: reservationType,
        startAt: req.body.start_at || null,
        source: req.body.source || 'dashboard',
        platform: req.body.platform || req.body.source || 'dashboard'
      });
      
      res.status(201).json({
        success: true,
        data: reservation
      });
    } catch (error) {
      console.error('Error creating reservation:', error);
      
      // Handle double-booking error
      if (error.message.includes('already reserved')) {
        return res.status(409).json({
          success: false,
          error: { message: error.message }
        });
      }
      
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create reservation', details: error.message }
      });
    }
  }
);

/**
 * GET /api/reservations/:id - Get reservation details
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid reservation ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid reservation ID', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      const reservation = await reservationRepository.findByIdWithItems(req.params.id, businessUserId);
      
      if (!reservation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Reservation not found' }
        });
      }
      
      res.json({
        success: true,
        data: reservation
      });
    } catch (error) {
      console.error('Error fetching reservation:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch reservation' }
      });
    }
  }
);

/**
 * PUT /api/reservations/:id - Update reservation
 */
router.put('/:id',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid reservation ID'),
  body('customerPhoneNumber').optional().notEmpty(),
  body('customerName').optional().notEmpty(),
  body('reservationDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  body('reservationTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('numberOfGuests').optional().isInt({ min: 1 }),
  body('tableId').optional().isUUID(),
  body('itemId').optional().isUUID(),
  body('notes').optional().isString(),
  body('reservation_kind').optional().isIn(['table', 'appointment']),
  body('start_at').optional().isISO8601().withMessage('start_at must be a valid ISO 8601 date'),
  body('source').optional().isIn(['whatsapp', 'telegram', 'instagram', 'facebook', 'dashboard']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      
      const updateData = {};
      if (req.body.customerPhoneNumber !== undefined) updateData.customerPhoneNumber = req.body.customerPhoneNumber;
      if (req.body.customerName !== undefined) updateData.customerName = req.body.customerName;
      if (req.body.reservationDate !== undefined) updateData.reservationDate = req.body.reservationDate;
      if (req.body.reservationTime !== undefined) updateData.reservationTime = req.body.reservationTime;
      if (req.body.numberOfGuests !== undefined) updateData.numberOfGuests = req.body.numberOfGuests;
      if (req.body.tableId !== undefined) updateData.tableId = req.body.tableId;
      if (req.body.itemId !== undefined) updateData.itemId = req.body.itemId;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.reservation_kind !== undefined) updateData.reservationKind = req.body.reservation_kind;
      if (req.body.start_at !== undefined) updateData.startAt = req.body.start_at;
      if (req.body.source !== undefined) updateData.source = req.body.source;
      
      const reservation = await reservationRepository.update(req.params.id, businessUserId, updateData);
      
      if (!reservation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Reservation not found' }
        });
      }
      
      res.json({
        success: true,
        data: reservation
      });
    } catch (error) {
      console.error('Error updating reservation:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update reservation', details: error.message }
      });
    }
  }
);

/**
 * PUT /api/reservations/:id/status - Update reservation status
 */
router.put('/:id/status',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid reservation ID'),
  body('status').isIn(['confirmed', 'cancelled', 'completed', 'no_show']).withMessage('Valid status is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      
      const reservation = await reservationRepository.updateStatus(req.params.id, businessUserId, req.body.status);
      
      if (!reservation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Reservation not found' }
        });
      }
      
      res.json({
        success: true,
        data: reservation
      });
    } catch (error) {
      console.error('Error updating reservation status:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update reservation status', details: error.message }
      });
    }
  }
);

/**
 * DELETE /api/reservations/:id - Cancel/delete reservation
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid reservation ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Invalid reservation ID', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      
      const reservation = await reservationRepository.findById(req.params.id, businessUserId);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Reservation not found' }
        });
      }
      
      await reservationRepository.deleteReservation(req.params.id, businessUserId);
      
      res.json({
        success: true,
        message: 'Reservation cancelled successfully'
      });
    } catch (error) {
      console.error('Error deleting reservation:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to cancel reservation', details: error.message }
      });
    }
  }
);

/**
 * POST /api/reservations/:id/items - Add item to reservation
 */
router.post('/:id/items',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid reservation ID'),
  body('itemId').notEmpty().withMessage('Item ID is required').isUUID().withMessage('Valid item ID is required'),
  body('quantity').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('notes').optional({ nullable: true }).isString().withMessage('Notes must be a string'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        console.error('Request body:', req.body);
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      
      // Verify reservation exists
      const reservation = await reservationRepository.findById(req.params.id, businessUserId);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Reservation not found' }
        });
      }
      
      const items = await reservationRepository.addItemToReservation(req.params.id, {
        itemId: req.body.itemId,
        quantity: req.body.quantity || 1,
        notes: req.body.notes || null
      });
      
      res.json({
        success: true,
        data: { items }
      });
    } catch (error) {
      console.error('Error adding item to reservation:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to add item to reservation', details: error.message }
      });
    }
  }
);

/**
 * DELETE /api/reservations/:id/items/:itemId - Remove item from reservation
 */
router.delete('/:id/items/:itemId',
  authenticate,
  tenantIsolation,
  addonGuard('table_reservations'),
  param('id').isUUID().withMessage('Invalid reservation ID'),
  param('itemId').isUUID().withMessage('Invalid item ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { message: 'Validation failed', details: errors.array() } });
      }
      
      const businessUserId = req.isBranchUser ? req.userId : req.businessId;
      
      // Verify reservation exists
      const reservation = await reservationRepository.findById(req.params.id, businessUserId);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Reservation not found' }
        });
      }
      
      const items = await reservationRepository.removeItemFromReservation(req.params.id, req.params.itemId);
      
      res.json({
        success: true,
        data: { items }
      });
    } catch (error) {
      console.error('Error removing item from reservation:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to remove item from reservation', details: error.message }
      });
    }
  }
);

module.exports = router;
