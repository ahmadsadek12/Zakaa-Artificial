// Context Resolver
// Resolve business/branch from WhatsApp phone number ID

const branchRepository = require('../../repositories/branchRepository');
const userRepository = require('../../repositories/userRepository');
const botIntegrationRepository = require('../../repositories/botIntegrationRepository');
const { decryptToken } = require('../../../utils/encryption');
const logger = require('../../utils/logger');

/**
 * Resolve business and branch context from phone number ID
 */
async function resolveContext(phoneNumberId) {
  if (!phoneNumberId) {
    return null;
  }
  
  try {
    // Find integration by phone_number_id (new bot_integrations table)
    const integration = await botIntegrationRepository.findByPhoneNumberId(phoneNumberId);
    
    if (integration) {
      // Get owner (business or branch)
      const owner = await userRepository.findById(integration.owner_id);
      
      if (!owner) {
        logger.warn('Integration found but owner not found', { ownerId: integration.owner_id });
        return null;
      }
      
      // If branch, get parent business
      if (integration.owner_type === 'branch') {
        const business = await userRepository.getParentBusiness(integration.owner_id);
        if (business) {
          return { business, branch: owner };
        }
      } else {
        // Business owner
        const branches = await branchRepository.findByBusinessId(owner.id);
        return { business: owner, branch: branches.length === 1 ? branches[0] : null };
      }
    }
    
    // Fallback: Try old method (for backward compatibility during migration)
    const branch = await branchRepository.findByWhatsAppPhoneId(phoneNumberId);
    if (branch) {
      const businessId = branch.business_id;
      if (!businessId) {
        logger.warn('Branch found but has no business_id', { branchId: branch.id });
        return null;
      }
      
      const business = await userRepository.findById(businessId);
      if (business) {
        return { business, branch };
      }
    }
    
    const business = await userRepository.findByWhatsAppPhoneId(phoneNumberId);
    if (business) {
      const branches = await branchRepository.findByBusinessId(business.id);
      return { business, branch: branches.length === 1 ? branches[0] : null };
    }
    
    return null;
  } catch (error) {
    logger.error('Error resolving context:', error);
    return null;
  }
}

/**
 * Resolve business/branch context from Twilio phone number
 * For Twilio, we can match by:
 * 1. Twilio phone number stored in whatsapp_phone_number field
 * 2. Twilio Account SID stored somewhere (optional, for future)
 */
async function resolveContextFromTwilioNumber(twilioNumber, accountSid = null) {
  if (!twilioNumber) {
    return null;
  }
  
  try {
    // Remove whatsapp: prefix if present for database lookup
    const phoneNumber = twilioNumber.replace('whatsapp:', '');
    
    // Try to find branch by Twilio number
    // Note: For Twilio sandbox, you might store the Twilio number in whatsapp_phone_number_id
    // Or use a specific format to identify it
    const branch = await branchRepository.findByWhatsAppPhoneId(phoneNumber);
    if (branch) {
      const businessId = branch.business_id;
      if (!businessId) {
        logger.warn('Branch found but has no business_id', { branchId: branch.id });
        return null;
      }
      
      const business = await userRepository.findById(businessId);
      if (business) {
        return { business, branch };
      }
    }
    
    // Try to find business by Twilio number
    const business = await userRepository.findByWhatsAppPhoneId(phoneNumber);
    if (business) {
      // Check if business has multiple branches
      const branches = await branchRepository.findByBusinessId(business.id);
      
      return { business, branch: branches.length === 1 ? branches[0] : null };
    }
    
    // For sandbox testing: if no match found, you might want to return a default test business
    // Or create one automatically
    logger.warn('Could not resolve context from Twilio number', { 
      twilioNumber, 
      accountSid 
    });
    
    return null;
  } catch (error) {
    logger.error('Error resolving Twilio context:', error);
    return null;
  }
}

module.exports = {
  resolveContext,
  resolveContextFromTwilioNumber
};
