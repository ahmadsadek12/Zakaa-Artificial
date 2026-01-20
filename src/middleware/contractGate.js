// Contract Gate Middleware
// CRITICAL: Blocks bot operations if contract is not approved

const { queryMySQL } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Require contract to be approved
 * Blocks: webhooks, outbound messages, dashboard actions (except profile/contract viewing)
 */
async function requireContractApproved(req, res, next) {
  try {
    // Get business ID from request
    const businessId = req.businessId || req.user?.id;
    
    if (!businessId) {
      // If no business context, allow through (might be auth route)
      return next();
    }
    
    // Check contract status
    const [users] = await queryMySQL(
      `SELECT contract_status, business_name 
       FROM users 
       WHERE id = ? AND user_type IN ('business', 'branch')`,
      [businessId]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Business not found',
          code: 'ERROR_BUSINESS_NOT_FOUND'
        }
      });
    }
    
    const user = users[0];
    
    // If branch, check parent business contract
    if (req.user?.userType === 'branch') {
      const [parentBusiness] = await queryMySQL(
        `SELECT contract_status FROM users WHERE id = (
          SELECT parent_user_id FROM users WHERE id = ?
        )`,
        [businessId]
      );
      
      if (parentBusiness && parentBusiness.length > 0) {
        if (parentBusiness[0].contract_status !== 'approved') {
          logger.warn('Contract gate blocked branch operation', {
            branchId: businessId,
            parentContractStatus: parentBusiness[0].contract_status
          });
          
          return res.status(403).json({
            success: false,
            error: {
              message: 'Business contract is not approved. Please contact support.',
              code: 'ERROR_CONTRACT_NOT_APPROVED',
              contractStatus: parentBusiness[0].contract_status
            }
          });
        }
      }
    } else {
      // Business user - check their own contract
      if (user.contract_status !== 'approved') {
        logger.warn('Contract gate blocked operation', {
          businessId,
          contractStatus: user.contract_status,
          businessName: user.business_name
        });
        
        return res.status(403).json({
          success: false,
          error: {
            message: 'Business contract is not approved. Please contact support.',
            code: 'ERROR_CONTRACT_NOT_APPROVED',
            contractStatus: user.contract_status
          }
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Contract gate error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify contract status',
        code: 'ERROR_CONTRACT_CHECK_FAILED'
      }
    });
  }
}

module.exports = {
  requireContractApproved
};
