// Tenant Isolation Middleware
// Ensures business users can only access their own data

const { queryMySQL } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Tenant isolation middleware
 * Automatically filters queries by business_id/user_id for business and branch users
 * Admins bypass this restriction
 */
async function tenantIsolation(req, res, next) {
  try {
    // Admins can access everything
    if (req.user.userType === 'admin') {
      req.businessId = null; // Admins can access all businesses
      req.userId = null;
      req.isBusinessUser = false;
      req.isBranchUser = false;
      return next();
    }
    
    // Business users - can see their own data and their branches' data
    if (req.user.userType === 'business') {
      req.businessId = req.user.id;
      req.userId = req.user.id; // For backward compatibility
      req.parentBusinessId = req.user.id; // For businesses, their own ID is also their parent ID
      req.isBusinessUser = true;
      req.isBranchUser = false;
      return next();
    }
    
    // Customers shouldn't access dashboard routes
    if (req.user.userType === 'customer') {
      return res.status(403).json({
        success: false,
        error: { message: 'Customers cannot access this resource' }
      });
    }
    
    // Unknown user type - treat as business for backward compatibility
    req.businessId = req.user.id;
    req.userId = req.user.id;
    req.parentBusinessId = req.user.id;
    req.isBusinessUser = true;
    req.isBranchUser = false;
    
    next();
  } catch (error) {
    logger.error('Tenant isolation error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
}

/**
 * Verify that resource belongs to the business
 * Use this in routes to ensure business users can only access their own resources
 */
async function verifyBusinessOwnership(tableName, resourceId, businessId, businessIdField = 'business_id') {
  const resources = await queryMySQL(
    `SELECT ${businessIdField} FROM ${tableName} WHERE id = ? LIMIT 1`,
    [resourceId]
  );
  
  if (!resources || resources.length === 0) {
    return false;
  }
  
  return resources[0][businessIdField] === businessId;
}

/**
 * Verify resource ownership
 * Works with new structure: orders/items use user_id, branches are now users
 */
async function verifyOwnership(tableName, resourceId, businessId, userId = null) {
  // Special handling for branches (stored in users table)
  if (tableName === 'branches') {
    const resources = await queryMySQL(
      `SELECT parent_user_id FROM users WHERE id = ? AND user_type = 'branch' AND is_active = true AND deleted_at IS NULL LIMIT 1`,
      [resourceId]
    );
    
    if (!resources || resources.length === 0) {
      return false;
    }
    
    // Branch belongs to business if parent_user_id matches
    return resources[0].parent_user_id === businessId;
  }
  
  // For orders and items, check business_id field
  if (tableName === 'orders' || tableName === 'items') {
    const resources = await queryMySQL(
      `SELECT business_id FROM ${tableName} WHERE id = ? LIMIT 1`,
      [resourceId]
    );
    
    if (!resources || resources.length === 0) {
      return false;
    }
    
    // Resource belongs to business if business_id matches
    return resources[0].business_id === businessId;
  }
  
  // Default check for other tables (menus, policies, opening_hours, etc.)
  const resources = await queryMySQL(
    `SELECT business_id FROM ${tableName} WHERE id = ? LIMIT 1`,
    [resourceId]
  );
  
  if (!resources || resources.length === 0) {
    // For policies and opening_hours, check owner_id and owner_type
    if (tableName === 'policies' || tableName === 'opening_hours') {
      const ownerResources = await queryMySQL(
        `SELECT owner_id FROM ${tableName} WHERE id = ? AND owner_type = 'business' LIMIT 1`,
        [resourceId]
      );
      
      if (ownerResources && ownerResources.length > 0) {
        return ownerResources[0].owner_id === businessId;
      }
    }
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
    
    const userId = req.isBranchUser ? req.userId : null;
    const isOwner = await verifyOwnership(tableName, resourceId, req.businessId, userId);
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
