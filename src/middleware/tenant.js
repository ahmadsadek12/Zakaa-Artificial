// Tenant Isolation Middleware
// Ensures business users can only access their own data

const { queryMySQL } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Tenant isolation middleware
 * Automatically filters queries by business_id for business users
 * Admins bypass this restriction
 */
function tenantIsolation(req, res, next) {
  // Admins can access everything
  if (req.user.userType === 'admin') {
    return next();
  }
  
  // Business users - attach their business_id to request
  if (req.user.userType === 'business') {
    req.businessId = req.user.id;
    req.isBusinessUser = true;
  }
  
  // Customers shouldn't access dashboard routes (this middleware shouldn't be used for customer routes)
  if (req.user.userType === 'customer') {
    return res.status(403).json({
      success: false,
      error: { message: 'Customers cannot access this resource' }
    });
  }
  
  next();
}

/**
 * Verify that resource belongs to the business
 * Use this in routes to ensure business users can only access their own resources
 */
async function verifyBusinessOwnership(tableName, resourceId, businessIdField = 'business_id') {
  const resources = await queryMySQL(
    `SELECT ${businessIdField} FROM ${tableName} WHERE id = ? LIMIT 1`,
    [resourceId]
  );
  
  if (!resources || resources.length === 0) {
    return false;
  }
  
  return resources[0][businessIdField] === resourceId; // Wait, this is wrong. Let me fix it.
}

/**
 * Verify resource ownership
 */
async function verifyOwnership(tableName, resourceId, businessId) {
  const resources = await queryMySQL(
    `SELECT business_id FROM ${tableName} WHERE id = ? LIMIT 1`,
    [resourceId]
  );
  
  if (!resources || resources.length === 0) {
    return false;
  }
  
  return resources[0].business_id === businessId;
}

/**
 * Middleware to verify resource ownership
 * @param {string} tableName - Table name to check
 * @param {string} paramName - Route parameter name (default: 'id')
 */
function requireOwnership(tableName, paramName = 'id') {
  return async (req, res, next) => {
    // Admins bypass
    if (req.user.userType === 'admin') {
      return next();
    }
    
    const resourceId = req.params[paramName];
    if (!resourceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Resource ID required' }
      });
    }
    
    const isOwner = await verifyOwnership(tableName, resourceId, req.businessId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: Resource does not belong to your business' }
      });
    }
    
    next();
  };
}

module.exports = {
  tenantIsolation,
  verifyOwnership,
  requireOwnership
};
