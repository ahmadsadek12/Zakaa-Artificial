// Context Resolver
// Resolve business/branch from WhatsApp phone number ID

const branchRepository = require('../../repositories/branchRepository');
const userRepository = require('../../repositories/userRepository');
const { decryptToken } = require('../../utils/encryption');
const logger = require('../../utils/logger');

/**
 * Resolve business and branch context from phone number ID
 */
async function resolveContext(phoneNumberId) {
  if (!phoneNumberId) {
    return null;
  }
  
  try {
    // Try to find branch first
    const branch = await branchRepository.findByWhatsAppPhoneId(phoneNumberId);
    if (branch) {
      const business = await userRepository.findById(branch.business_id);
      if (business) {
        // Decrypt WhatsApp token
        if (branch.whatsapp_access_token_encrypted) {
          try {
            branch.whatsapp_access_token = decryptToken(branch.whatsapp_access_token_encrypted);
          } catch (error) {
            logger.error('Failed to decrypt branch WhatsApp token:', error);
          }
        }
        
        return { business, branch };
      }
    }
    
    // Try to find business
    const business = await userRepository.findByWhatsAppPhoneId(phoneNumberId);
    if (business) {
      // Decrypt WhatsApp token
      if (business.whatsapp_access_token_encrypted) {
        try {
          business.whatsapp_access_token = decryptToken(business.whatsapp_access_token_encrypted);
        } catch (error) {
          logger.error('Failed to decrypt business WhatsApp token:', error);
        }
      }
      
      // Check if business has multiple branches - might need branch selection
      const branches = await branchRepository.findByBusinessId(business.id);
      
      return { business, branch: branches.length === 1 ? branches[0] : null };
    }
    
    return null;
  } catch (error) {
    logger.error('Error resolving context:', error);
    return null;
  }
}

module.exports = {
  resolveContext
};
