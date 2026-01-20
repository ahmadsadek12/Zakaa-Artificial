// Immutable Fields Guard Middleware
// Prevents changes to immutable fields after creation

const logger = require('../utils/logger');

/**
 * Immutable fields guard
 * Blocks changes to: business_type, default_language, timezone
 */
function immutableFieldsGuard(req, res, next) {
  const immutableFields = ['business_type', 'default_language', 'timezone'];
  const camelCaseMap = {
    businessType: 'business_type',
    defaultLanguage: 'default_language',
    timezone: 'timezone'
  };
  
  // Check if request tries to change immutable fields
  const attemptedChanges = [];
  
  for (const [camelKey, dbKey] of Object.entries(camelCaseMap)) {
    if (req.body[camelKey] !== undefined || req.body[dbKey] !== undefined) {
      attemptedChanges.push(dbKey);
    }
  }
  
  if (attemptedChanges.length > 0) {
    logger.warn('Attempted to change immutable fields', {
      userId: req.user?.id,
      businessId: req.businessId,
      fields: attemptedChanges
    });
    
    return res.status(400).json({
      success: false,
      error: {
        message: `Cannot change immutable fields: ${attemptedChanges.join(', ')}`,
        code: 'ERROR_IMMUTABLE_FIELD',
        fields: attemptedChanges
      }
    });
  }
  
  next();
}

module.exports = {
  immutableFieldsGuard
};
