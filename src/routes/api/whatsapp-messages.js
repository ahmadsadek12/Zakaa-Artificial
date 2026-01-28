// WhatsApp Messages API Routes
// Endpoint to retrieve WhatsApp messages from MongoDB

const express = require('express');
const router = express.Router();
const { tenantIsolation } = require('../../middleware/tenant');
const { authenticateToken } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { getMongoCollection } = require('../../config/database');
const logger = require('../../utils/logger');

// All routes require authentication and tenant isolation
router.use(authenticateToken);
router.use(tenantIsolation);

/**
 * GET /api/whatsapp-messages - Get WhatsApp messages for business
 * Query params: customerPhoneNumber, startDate, endDate, limit, page
 */
router.get('/', asyncHandler(async (req, res) => {
  const businessId = req.businessId;
  
  if (!businessId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Business ID is required' }
    });
  }
  
  const messageLogs = await getMongoCollection('message_logs');
  
  if (!messageLogs) {
    return res.status(503).json({
      success: false,
      error: { message: 'MongoDB is not available' }
    });
  }
  
  // Build query
  const query = {
    business_id: businessId,
    channel: 'whatsapp'
  };
  
  // Filter by customer phone number if provided
  if (req.query.customerPhoneNumber) {
    query.customer_phone_number = req.query.customerPhoneNumber;
  }
  
  // Filter by branch if provided
  if (req.query.branchId) {
    query.branch_id = req.query.branchId;
  }
  // Note: If no branch specified, we'll get messages for all branches
  // MongoDB query will match business_id regardless of branch_id
  
  // Date range filter
  if (req.query.startDate || req.query.endDate) {
    query.timestamp = {};
    if (req.query.startDate) {
      query.timestamp.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      const endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      query.timestamp.$lte = endDate;
    }
  }
  
  // Pagination
  const limit = parseInt(req.query.limit) || 50;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  
  try {
    // Get total count
    const totalCount = await messageLogs.countDocuments(query);
    
    // Get messages
    const messages = await messageLogs
      .find(query)
      .sort({ timestamp: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Group messages by customer for easier display
    const groupedMessages = {};
    messages.forEach(msg => {
      const phone = msg.customer_phone_number || 'unknown';
      if (!groupedMessages[phone]) {
        groupedMessages[phone] = {
          customerPhoneNumber: phone,
          messages: [],
          lastMessageAt: null
        };
      }
      groupedMessages[phone].messages.push({
        id: msg._id,
        direction: msg.direction,
        text: msg.text || '',
        messageType: msg.messageType || 'text',
        timestamp: msg.timestamp,
        metaMessageId: msg.metaMessageId
      });
      if (!groupedMessages[phone].lastMessageAt || 
          new Date(msg.timestamp) > new Date(groupedMessages[phone].lastMessageAt)) {
        groupedMessages[phone].lastMessageAt = msg.timestamp;
      }
    });
    
    // Convert to array and sort by last message time
    const conversations = Object.values(groupedMessages).sort((a, b) => {
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });
    
    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching WhatsApp messages:', error);
    throw error;
  }
}));

/**
 * GET /api/whatsapp-messages/:customerPhoneNumber - Get all messages for a specific customer
 */
router.get('/:customerPhoneNumber', asyncHandler(async (req, res) => {
  const businessId = req.businessId;
  const customerPhoneNumber = req.params.customerPhoneNumber;
  
  if (!businessId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Business ID is required' }
    });
  }
  
  const messageLogs = await getMongoCollection('message_logs');
  
  if (!messageLogs) {
    return res.status(503).json({
      success: false,
      error: { message: 'MongoDB is not available' }
    });
  }
  
  const query = {
    business_id: businessId,
    customer_phone_number: customerPhoneNumber,
    channel: 'whatsapp'
  };
  
  // Date range filter
  if (req.query.startDate || req.query.endDate) {
    query.timestamp = {};
    if (req.query.startDate) {
      query.timestamp.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      const endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999);
      query.timestamp.$lte = endDate;
    }
  }
  
  const limit = parseInt(req.query.limit) || 100;
  
  try {
    const messages = await messageLogs
      .find(query)
      .sort({ timestamp: 1 }) // Oldest first for conversation view
      .limit(limit)
      .toArray();
    
    res.json({
      success: true,
      data: {
        customerPhoneNumber,
        messages: messages.map(msg => ({
          id: msg._id,
          direction: msg.direction,
          text: msg.text || '',
          messageType: msg.messageType || 'text',
          timestamp: msg.timestamp,
          metaMessageId: msg.metaMessageId
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching customer WhatsApp messages:', error);
    throw error;
  }
}));

module.exports = router;
