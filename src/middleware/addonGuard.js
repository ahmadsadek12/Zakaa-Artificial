// Addon Guard Middleware
// Replaces premium.js - gates features based on addon activation

const { queryMySQL } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Require specific addon to be active
 * @param {string} addonKey - Addon key (e.g., 'analytics_paid_loyal_customer', 'table_reservations')
 * @param {Object} options - Optional configuration
 * @param {boolean} options.requireFoodAndBeverage - If true, also checks business_type == 'food and beverage'
 * @returns {Function} Express middleware
 */
function addonGuard(addonKey, options = {}) {
  return async (req, res, next) => {
    try {
      // Admins bypass
      if (req.user && req.user.userType === 'admin') {
        return next();
      }
      
      // Get business ID from request
      const businessId = req.businessId || req.user?.id;
      
      if (!businessId) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Business context required',
            code: 'ERROR_BUSINESS_REQUIRED'
          }
        });
      }
      
      // Check business type if required (for table_reservations addon)
      if (options.requireFoodAndBeverage || addonKey === 'table_reservations') {
        const [business] = await queryMySQL(
          `SELECT business_type FROM users WHERE id = ? AND user_type = 'business'`,
          [businessId]
        );
        
        if (!business || business.length === 0) {
          return res.status(403).json({
            success: false,
            error: {
              message: 'Business not found',
              code: 'ERROR_BUSINESS_NOT_FOUND'
            }
          });
        }
        
        const businessType = business[0].business_type?.toLowerCase();
        if (businessType !== 'food and beverage' && businessType !== 'f & b' && businessType !== 'f&b') {
          logger.warn('Addon guard blocked access - not F&B business', {
            businessId,
            addonKey,
            businessType
          });
          
          return res.status(403).json({
            success: false,
            error: {
              message: 'Table reservations are only available for Food & Beverage businesses',
              code: 'NOT_ELIGIBLE_BUSINESS_TYPE',
              addonKey
            }
          });
        }
      }
      
      // Check if addon is active for this business
      try {
        // First check if business_addons table exists
        const [tableCheck] = await queryMySQL(
          `SELECT COUNT(*) as count 
           FROM INFORMATION_SCHEMA.TABLES 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'business_addons'`
        );
        
        if (!tableCheck || tableCheck.length === 0 || tableCheck[0].count === 0) {
          // Table doesn't exist, check if addons table exists and use alternative check
          const [addonsTableCheck] = await queryMySQL(
            `SELECT COUNT(*) as count 
             FROM INFORMATION_SCHEMA.TABLES 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'addons'`
          );
          
          if (!addonsTableCheck || addonsTableCheck.length === 0 || addonsTableCheck[0].count === 0) {
            // No addons system, allow access (backward compatibility)
            return next();
          }
          
          // Addons table exists but business_addons doesn't - deny access
          return res.status(403).json({
            success: false,
            error: {
              message: 'Addon system not configured',
              code: 'ADDON_SYSTEM_NOT_CONFIGURED',
              addonKey
            }
          });
        }
        
        const [addons] = await queryMySQL(
          `SELECT ba.status, a.addon_key, a.name
           FROM business_addons ba
           INNER JOIN addons a ON ba.addon_id = a.id
           WHERE ba.business_id = ? 
           AND a.addon_key = ?
           AND ba.status = 'active'`,
          [businessId, addonKey]
        );
        
        if (!addons || addons.length === 0) {
          logger.warn('Addon guard blocked access', {
            businessId,
            addonKey,
            userId: req.user?.id
          });
          
          return res.status(403).json({
            success: false,
            error: {
              message: `Addon "${addonKey}" is required but not active`,
              code: 'ADDON_NOT_ACTIVE',
              addonKey
            }
          });
        }
      } catch (queryError) {
        // If query fails (e.g., table doesn't exist), log and allow through for now
        // This prevents 500 errors during development/migration
        logger.error('Addon guard query error (allowing through):', {
          error: queryError.message,
          businessId,
          addonKey
        });
        // Allow through if query fails - this is a safety measure
        // In production, you might want to return 500 instead
        return next();
      }
      
      next();
    } catch (error) {
      logger.error('Addon guard error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to verify addon status',
          code: 'ERROR_ADDON_CHECK_FAILED'
        }
      });
    }
  };
}

module.exports = {
  addonGuard
};
