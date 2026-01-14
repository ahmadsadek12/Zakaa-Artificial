// Context Resolver
// Resolve business/branch from WhatsApp phone number ID

const branchRepository = require('../../repositories/branchRepository');
const userRepository = require('../../repositories/userRepository');
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
    // Try to find branch first (branches are in branches table)
    const branch = await branchRepository.findByWhatsAppPhoneId(phoneNumberId);
    if (branch) {
      // Branch has business_id pointing to business
      const businessId = branch.business_id;
      if (!businessId) {
        logger.warn('Branch found but has no business_id', { branchId: branch.id });
        return null;
      }
      
      const business = await userRepository.findById(businessId);
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
