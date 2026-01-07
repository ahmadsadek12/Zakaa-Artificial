// Premium Middleware
// Gate premium features for analytics

const userRepository = require('../repositories/userRepository');
const logger = require('../utils/logger');

/**
 * Require premium subscription
 */
async function requirePremium(req, res, next) {
  try {
    const user = await userRepository.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }
    
    // Admins bypass
    if (req.user.userType === 'admin') {
      return next();
    }
    
    // Check subscription
    const isPremium = user.subscription_type === 'premium' && user.subscription_status === 'active';
    
    if (!isPremium) {
      return res.status(403).json({
        success: false,
        error: { 
          message: 'Premium subscription required',
          currentSubscription: user.subscription_type,
          subscriptionStatus: user.subscription_status
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error('Premium middleware error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to verify subscription' }
    });
  }
}

module.exports = {
  requirePremium
};
