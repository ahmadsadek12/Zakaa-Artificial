// Subscription Guard Middleware
// Checks if user has active "Data and Analytics" subscription

const subscriptionRepository = require('../repositories/subscriptionRepository');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has "Data and Analytics" subscription
 * Returns 403 if not subscribed
 */
async function requireDataAnalyticsSubscription(req, res, next) {
  try {
    const businessId = req.businessId || req.user?.id;
    
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
    }

    // Find "Data and Analytics" subscription
    const subscriptions = await subscriptionRepository.findAll();
    const dataAnalyticsSubscription = subscriptions.find(
      sub => sub.name === 'Data and Analytics'
    );

    if (!dataAnalyticsSubscription) {
      logger.warn('Data and Analytics subscription not found in database');
      return res.status(403).json({
        success: false,
        error: { 
          message: 'Data and Analytics subscription not available',
          code: 'SUBSCRIPTION_NOT_FOUND'
        }
      });
    }

    // Check if user has active subscription
    const hasSubscription = await subscriptionRepository.userHasSubscription(
      businessId,
      dataAnalyticsSubscription.id
    );

    if (!hasSubscription) {
      return res.status(403).json({
        success: false,
        error: { 
          message: 'Data and Analytics subscription required. Please subscribe to access this feature.',
          code: 'SUBSCRIPTION_REQUIRED'
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking subscription:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to verify subscription' }
    });
  }
}

module.exports = {
  requireDataAnalyticsSubscription
};
