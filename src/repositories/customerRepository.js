// Customer Repository
// Handles customer user record creation and lookup
// Auto-creates customer records for proper foreign key relationships

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');
const logger = require('../utils/logger');

/**
 * Find or create customer by phone number
 * Auto-creates customer user record if doesn't exist
 * @param {string} businessId - Business user ID
 * @param {string} phoneNumber - Customer phone number (can include platform prefix like 'telegram:')
 * @param {string} platform - Platform ('whatsapp', 'telegram', etc.)
 * @returns {Promise<string>} Customer user ID
 */
async function findOrCreateCustomerByPhone(businessId, phoneNumber, platform = 'whatsapp') {
  try {
    // Extract clean phone number (remove platform prefix if present)
    const cleanPhone = phoneNumber.replace(/^(whatsapp|telegram|instagram|facebook|web):/, '');
    
    // Try to find existing customer by phone number
    const existingCustomers = await queryMySQL(`
      SELECT id FROM users
      WHERE user_type = 'customer'
        AND contact_phone_number = ?
        AND deleted_at IS NULL
      LIMIT 1
    `, [cleanPhone]);
    
    if (existingCustomers.length > 0) {
      return existingCustomers[0].id;
    }
    
    // Customer doesn't exist, create new customer record
    const customerId = generateUUID();
    const connection = await getMySQLConnection();
    
    try {
      await connection.beginTransaction();
      
      await connection.query(`
        INSERT INTO users (
          id, user_type, contact_phone_number, is_active, created_at, updated_at
        ) VALUES (?, 'customer', ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [customerId, cleanPhone]);
      
      await connection.commit();
      
      logger.info('Auto-created customer record', {
        customerId,
        phoneNumber: cleanPhone,
        platform,
        businessId
      });
      
      return customerId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error finding/creating customer:', error);
    throw error;
  }
}

/**
 * Get customer by ID
 * @param {string} customerId - Customer user ID
 * @returns {Promise<Object|null>} Customer object or null
 */
async function findById(customerId) {
  try {
    const customers = await queryMySQL(`
      SELECT * FROM users
      WHERE id = ? AND user_type = 'customer' AND deleted_at IS NULL
    `, [customerId]);
    
    return customers.length > 0 ? customers[0] : null;
  } catch (error) {
    logger.error('Error finding customer:', error);
    throw error;
  }
}

/**
 * Get customer by phone number
 * @param {string} phoneNumber - Customer phone number
 * @returns {Promise<Object|null>} Customer object or null
 */
async function findByPhone(phoneNumber) {
  try {
    const cleanPhone = phoneNumber.replace(/^(whatsapp|telegram|instagram|facebook|web):/, '');
    
    const customers = await queryMySQL(`
      SELECT * FROM users
      WHERE user_type = 'customer'
        AND contact_phone_number = ?
        AND deleted_at IS NULL
      LIMIT 1
    `, [cleanPhone]);
    
    return customers.length > 0 ? customers[0] : null;
  } catch (error) {
    logger.error('Error finding customer by phone:', error);
    throw error;
  }
}

module.exports = {
  findOrCreateCustomerByPhone,
  findById,
  findByPhone
};
