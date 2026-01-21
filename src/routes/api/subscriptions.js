// Subscriptions API Routes

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const subscriptionRepository = require('../../repositories/subscriptionRepository');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');

// All routes require authentication
router.use(authenticate);
router.use(tenantIsolation);

/**
 * Get all available subscriptions
 * GET /api/subscriptions
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const subscriptions = await subscriptionRepository.findAll();
    
    res.json({
      success: true,
      data: { subscriptions }
    });
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch subscriptions' }
    });
  }
}));

/**
 * Get user's active subscriptions
 * GET /api/subscriptions/my-subscriptions
 */
router.get('/my-subscriptions', asyncHandler(async (req, res) => {
  try {
    const subscriptions = await subscriptionRepository.findUserSubscriptions(req.businessId);
    
    res.json({
      success: true,
      data: { subscriptions }
    });
  } catch (error) {
    logger.error('Error fetching user subscriptions:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch user subscriptions' }
    });
  }
}));

/**
 * Get subscription by ID
 * GET /api/subscriptions/:id
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid subscription ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors.array() }
    });
  }

  try {
    const subscription = await subscriptionRepository.findById(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: { message: 'Subscription not found' }
      });
    }

    // Check if user has this subscription
    const userHasIt = await subscriptionRepository.userHasSubscription(
      req.businessId,
      subscription.id
    );

    res.json({
      success: true,
      data: { 
        subscription,
        userHasSubscription: userHasIt
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch subscription' }
    });
  }
}));

module.exports = router;
