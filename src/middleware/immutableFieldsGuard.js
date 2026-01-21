// Immutable Fields Guard Middleware
// Prevents changes to immutable fields after creation

const logger = require('../utils/logger');

/**
 * Immutable fields guard
 * Blocks changes to specified immutable fields
 * @param {Array<string>} fields - Array of field names to protect (can be camelCase or snake_case)
 */
function immutableFieldsGuard(fields = []) {
  return (req, res, next) => {
    // Default immutable fields if none specified
    const defaultFields = ['business_type', 'default_language', 'timezone', 'email', 'business_name', 'contract_file_url', 'contract_status'];
    const immutableFields = fields.length > 0 ? fields : defaultFields;
    
    // Create map for both camelCase and snake_case
    const fieldMap = {};
    immutableFields.forEach(field => {
      // Map snake_case to camelCase
      const camelCase = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      fieldMap[field] = field;
      fieldMap[camelCase] = field;
    });
    
    // Check if request tries to change immutable fields
    const attemptedChanges = [];
    
    for (const [key, dbKey] of Object.entries(fieldMap)) {
      if (req.body[key] !== undefined) {
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
  };
}

module.exports = {
  immutableFieldsGuard
};
