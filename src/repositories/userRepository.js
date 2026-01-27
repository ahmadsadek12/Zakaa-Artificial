// User Repository
// Data access layer for users

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');
const bcrypt = require('bcryptjs');

/**
 * Find user by ID
 */
async function findById(userId) {
  const users = await queryMySQL(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
    [userId]
  );
  return users[0] || null;
}

/**
 * Find user by email
 */
async function findByEmail(email) {
  const users = await queryMySQL(
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
    [email]
  );
  return users[0] || null;
}

/**
 * Find user by WhatsApp phone number ID
 */
async function findByWhatsAppPhoneId(whatsappPhoneNumberId) {
  const users = await queryMySQL(
    'SELECT * FROM users WHERE whatsapp_phone_number_id = ? AND deleted_at IS NULL',
    [whatsappPhoneNumberId]
  );
  return users[0] || null;
}

/**
 * Find user by username (for branch login)
 */
async function findByUsername(username) {
  const users = await queryMySQL(
    'SELECT * FROM users WHERE username = ? AND deleted_at IS NULL',
    [username]
  );
  return users[0] || null;
}

/**
 * Create new user
 */
async function create(userData) {
  const userId = generateUUID();
  const hashedPassword = userData.password 
    ? await bcrypt.hash(userData.password, 10) 
    : null;
  
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    await connection.query(`
      INSERT INTO users (
        id, user_type, email, contact_phone_number, is_active,
        business_name, business_type, default_language, timezone,
        subscription_type, subscription_price, subscription_status,
        allow_scheduled_orders, allow_delivery, allow_takeaway, allow_on_site,
        password_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      userData.userType || 'business',
      userData.email || null,
      userData.contactPhoneNumber || null,
      userData.isActive !== undefined ? userData.isActive : true,
      userData.businessName || null,
      userData.businessType || null,
      userData.defaultLanguage || 'arabic',
      userData.timezone || 'Asia/Beirut',
      userData.subscriptionType || 'standard',
      userData.subscriptionPrice || 0,
      userData.subscriptionStatus || 'active',
      userData.allowScheduledOrders !== undefined ? userData.allowScheduledOrders : true,
      userData.allowDelivery !== undefined ? userData.allowDelivery : true,
      userData.allowTakeaway !== undefined ? userData.allowTakeaway : true,
      userData.allowOnSite !== undefined ? userData.allowOnSite : true,
      hashedPassword
    ]);
    
    await connection.commit();
    
    // Return user without password
    const user = await findById(userId);
    delete user.password_hash;
    return user;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update user
 */
async function update(userId, updateData) {
  // Map camelCase to snake_case
  const fieldMap = {
    email: 'email',
    contactPhoneNumber: 'contact_phone_number',
    businessName: 'business_name',
    businessType: 'business_type',
    businessDescription: 'business_description',
    defaultLanguage: 'default_language',
    // languages field removed - column doesn't exist, language preferences no longer stored
    timezone: 'timezone',
    // Deprecated fields (keep in map but don't use): location_latitude, location_longitude, delivery_radius_km
    deliveryPrice: 'delivery_price',
    lastOrderBeforeClosingMinutes: 'last_order_before_closing_minutes',
    googleMapsLink: 'google_maps_link',
    carrierPhoneNumber: 'carrier_phone_number',
    estimatedDeliveryTimeMin: 'estimated_delivery_time_min',
    estimatedDeliveryTimeMax: 'estimated_delivery_time_max',
    googleCalendarIntegrationJson: 'google_calendar_integration_json',
    username: 'username',
    subscriptionType: 'subscription_type',
    subscriptionPrice: 'subscription_price',
    subscriptionStatus: 'subscription_status',
    subscriptionStartedAt: 'subscription_started_at',
    subscriptionEndsAt: 'subscription_ends_at',
    allowScheduledOrders: 'allow_scheduled_orders',
    allowDelivery: 'allow_delivery',
    allowTakeaway: 'allow_takeaway',
    allowOnSite: 'allow_on_site',
    chatbotEnabled: 'chatbot_enabled',
    whatsappPhoneNumber: 'whatsapp_phone_number',
    whatsappPhoneNumberId: 'whatsapp_phone_number_id',
    whatsappBusinessAccountId: 'whatsapp_business_account_id',
    whatsappAccessTokenEncrypted: 'whatsapp_access_token_encrypted',
    telegramBotToken: 'telegram_bot_token',
    isActive: 'is_active',
    locationId: 'location_id',
    // Deprecated: locationLatitude, locationLongitude, deliveryRadiusKm
    deliveryPrice: 'delivery_price',
    googleMapsLink: 'google_maps_link',
    contractFileUrl: 'contract_file_url',
    contractStatus: 'contract_status',
    contractApprovedAt: 'contract_approved_at',
    carrierPhoneNumber: 'carrier_phone_number',
    estimatedDeliveryTimeMin: 'estimated_delivery_time_min',
    estimatedDeliveryTimeMax: 'estimated_delivery_time_max',
    googleCalendarIntegrationJson: 'google_calendar_integration_json',
    username: 'username',
    contractFileUrl: 'contract_file_url',
    contractStatus: 'contract_status',
    contractApprovedAt: 'contract_approved_at'
  };
  
  const allowedFields = Object.values(fieldMap);
  
  const updates = [];
  const values = [];
  
  const logger = require('../utils/logger');
  logger.info('UserRepository.update called:', { userId, updateData });
  
  for (const [key, value] of Object.entries(updateData)) {
    // Skip languages field - column doesn't exist, language preferences no longer stored
    if (key === 'languages') {
      continue;
    }
    
    const dbKey = fieldMap[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
    logger.info(`Processing field: ${key} -> ${dbKey}`, { 
      key, 
      dbKey, 
      value, 
      valueType: typeof value,
      isAllowed: allowedFields.includes(dbKey),
      isUndefined: value === undefined 
    });
    
    if (allowedFields.includes(dbKey) && value !== undefined) {
      updates.push(`${dbKey} = ?`);
      values.push(value);
      logger.info(`Added to update: ${dbKey} = ${value}`);
    } else {
      logger.warn(`Field skipped: ${key} (dbKey: ${dbKey}, allowed: ${allowedFields.includes(dbKey)}, undefined: ${value === undefined})`);
    }
  }
  
  if (updates.length === 0) {
    logger.warn('No updates to perform');
    return await findById(userId);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);
  
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  logger.info('Executing SQL update:', { sql, values });
  
  try {
    await queryMySQL(sql, values);
  } catch (error) {
    // Check if error is about unknown column
    if (error.code === 'ER_BAD_FIELD_ERROR' || error.message?.includes('Unknown column')) {
      logger.error('Database column does not exist. Migration may be required:', {
        error: error.message,
        sql,
        updates
      });
      throw new Error(`Database column missing. Please run migration: ${error.message}`);
    }
    throw error;
  }
  
  const updatedUser = await findById(userId);
  logger.info('User after update:', { 
    userId, 
    business_name: updatedUser.business_name,
    delivery_price: updatedUser.delivery_price,
    last_order_before_closing_minutes: updatedUser.last_order_before_closing_minutes
  });
  
  return updatedUser;
}

/**
 * Update password
 */
async function updatePassword(userId, newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length === 0) {
    throw new Error('New password is required and must be a non-empty string');
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  if (!hashedPassword || hashedPassword.length === 0) {
    throw new Error('Failed to hash password');
  }
  
  const result = await queryMySQL(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [hashedPassword, userId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('No user found with the provided ID');
  }
  
  return result;
}

/**
 * Verify password
 */
async function verifyPassword(userId, password) {
  const users = await queryMySQL(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );
  
  if (!users || users.length === 0 || !users[0].password_hash) {
    return false;
  }
  
  return await bcrypt.compare(password, users[0].password_hash);
}

/**
 * Verify password by email
 */
async function verifyPasswordByEmail(email, password) {
  const users = await queryMySQL(
    'SELECT id, password_hash FROM users WHERE email = ?',
    [email]
  );
  
  if (!users || users.length === 0 || !users[0].password_hash) {
    return null;
  }
  
  const isValid = await bcrypt.compare(password, users[0].password_hash);
  return isValid ? users[0].id : null;
}

/**
 * Soft delete user
 */
async function softDelete(userId) {
  await queryMySQL(
    'UPDATE users SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = ?',
    [userId]
  );
}

/**
 * Find branches by parent business ID (branches are in users table)
 */
async function findBranchesByParent(parentUserId) {
  // Branches are stored in users table with user_type='branch'
  return await queryMySQL(
    `SELECT u.*, l.city, l.street, l.building, l.floor, l.notes as location_notes, l.latitude, l.longitude
     FROM users u
     LEFT JOIN locations l ON u.location_id = l.id
     WHERE u.user_type = 'branch' 
       AND u.parent_user_id = ?
       AND u.deleted_at IS NULL
       AND u.is_active = true
     ORDER BY u.created_at DESC`,
    [parentUserId]
  );
}

/**
 * Create branch user (branches are stored in users table)
 * Creates a user account with user_type='branch' and parent_user_id pointing to the business
 */
async function createBranchUser(parentUserId, branchData) {
  const connection = await getMySQLConnection();
  const branchUserId = generateUUID();
  const hashedPassword = branchData.password 
    ? await bcrypt.hash(branchData.password, 10) 
    : null;
  
  if (!hashedPassword) {
    throw new Error('Password is required for branch users');
  }
  
  try {
    await connection.beginTransaction();
    
    // Get parent business to inherit business_type
    const parentBusiness = await findById(parentUserId);
    if (!parentBusiness) {
      throw new Error('Parent business not found');
    }
    
    // Create location if provided
    let locationId = branchData.locationId;
    if (branchData.location && !locationId) {
      locationId = generateUUID();
      await connection.query(`
        INSERT INTO locations (id, city, street, building, floor, notes, latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        locationId,
        branchData.location.city,
        branchData.location.street,
        branchData.location.building || null,
        branchData.location.floor || null,
        branchData.location.notes || null,
        branchData.location.latitude || null,
        branchData.location.longitude || null
      ]);
    }
    
    // Create branch user in users table
    await connection.query(`
      INSERT INTO users (
        id, user_type, user_role, parent_user_id, email, contact_phone_number, is_active,
        business_name, business_type, default_language, timezone,
        subscription_type, subscription_price, subscription_status,
        allow_scheduled_orders, allow_delivery, allow_takeaway, allow_on_site,
        location_id, password_hash, whatsapp_phone_number, whatsapp_phone_number_id,
        whatsapp_access_token_encrypted, created_at
      ) VALUES (?, 'branch', 'branch', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      branchUserId,
      parentUserId,
      branchData.email,
      branchData.contactPhoneNumber || null,
      branchData.isActive !== undefined ? branchData.isActive : true,
      branchData.branchName,
      parentBusiness.business_type || null,
      branchData.defaultLanguage || 'arabic',
      branchData.timezone || 'Asia/Beirut',
      'standard',
      0,
      'active',
      true,
      true,
      true,
      true,
      locationId,
      hashedPassword,
      branchData.whatsappPhoneNumber || null,
      branchData.whatsappPhoneNumberId || null,
      branchData.whatsappAccessTokenEncrypted || null
    ]);
    
    await connection.commit();
    
    // Return user without password
    const user = await findById(branchUserId);
    if (user) {
      delete user.password_hash;
    }
    return user;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Create branch (branches are stored in branches table, not users table)
 * This method is kept for backward compatibility but should use branchRepository instead
 */
async function createBranch(parentUserId, branchData) {
  // Redirect to branchRepository which handles branches table correctly
  const branchRepository = require('./branchRepository');
  return await branchRepository.create({
    businessId: parentUserId,
    branchName: branchData.businessName || branchData.branchName,
    location: branchData.location,
    contactPhoneNumber: branchData.contactPhoneNumber,
    whatsappPhoneNumber: branchData.whatsappPhoneNumber,
    whatsappPhoneNumberId: branchData.whatsappPhoneNumberId,
    whatsappAccessTokenEncrypted: branchData.whatsappAccessTokenEncrypted,
    isActive: branchData.isActive !== undefined ? branchData.isActive : true
  });
}

/**
 * Check if user is a branch (branches are in users table)
 * This method checks if a user exists with user_type='branch'
 */
async function isBranch(userId) {
  const users = await queryMySQL(
    `SELECT id FROM users 
     WHERE id = ? 
       AND (role_scope = 'branch_operator' OR user_type = 'branch')
       AND is_active = true 
       AND deleted_at IS NULL`,
    [userId]
  );
  return users && users.length > 0;
}

/**
 * Get parent business for a branch (branches are in users table)
 */
async function getParentBusiness(userId) {
  const users = await queryMySQL(
    `SELECT parent_user_id FROM users 
     WHERE id = ? 
       AND (role_scope = 'branch_operator' OR user_type = 'branch')
       AND is_active = true 
       AND deleted_at IS NULL`,
    [userId]
  );
  if (!users || users.length === 0 || !users[0].parent_user_id) {
    return null;
  }
  return await findById(users[0].parent_user_id);
}

/**
 * Update contract status (admin only)
 */
async function updateContractStatus(businessId, status, approvedAt = null) {
  const updates = ['contract_status = ?'];
  const values = [status];
  
  if (status === 'approved' && approvedAt) {
    updates.push('contract_approved_at = ?');
    values.push(approvedAt);
  } else if (status === 'approved') {
    updates.push('contract_approved_at = CURRENT_TIMESTAMP');
  } else {
    updates.push('contract_approved_at = NULL');
  }
  
  values.push(businessId);
  
  await queryMySQL(
    `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    values
  );
  
  return await findById(businessId);
}

/**
 * Update contract file URL
 */
async function updateContractFile(businessId, contractFileUrl) {
  await queryMySQL(
    'UPDATE users SET contract_file_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [contractFileUrl, businessId]
  );
  
  return await findById(businessId);
}

/**
 * Check if user is an employee
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user is an employee
 */
async function isEmployee(userId) {
  const users = await queryMySQL(
    `SELECT id FROM users 
     WHERE id = ? 
       AND (role_scope = 'employee' OR (employee_role IS NOT NULL AND parent_user_id IS NOT NULL))
       AND is_active = true 
       AND deleted_at IS NULL`,
    [userId]
  );
  return users && users.length > 0;
}

/**
 * Get employee's parent business ID
 * @param {string} employeeId - Employee user ID
 * @returns {Promise<string|null>} Parent business ID or null
 */
async function getEmployeeBusinessId(employeeId) {
  const users = await queryMySQL(
    `SELECT parent_user_id FROM users 
     WHERE id = ? 
       AND (role_scope = 'employee' OR (employee_role IS NOT NULL AND parent_user_id IS NOT NULL))
       AND is_active = true 
       AND deleted_at IS NULL`,
    [employeeId]
  );
  if (!users || users.length === 0 || !users[0].parent_user_id) {
    return null;
  }
  return users[0].parent_user_id;
}

/**
 * Check if employee can access a business
 * @param {string} employeeId - Employee user ID
 * @param {string} businessId - Business ID to check
 * @returns {Promise<boolean>} True if employee can access the business
 */
async function canEmployeeAccessBusiness(employeeId, businessId) {
  const employeeBusinessId = await getEmployeeBusinessId(employeeId);
  return employeeBusinessId === businessId;
}

module.exports = {
  findById,
  findByEmail,
  findByWhatsAppPhoneId,
  findByUsername,
  create,
  update,
  updatePassword,
  verifyPassword,
  verifyPasswordByEmail,
  softDelete,
  findBranchesByParent,
  createBranch,
  createBranchUser,
  isBranch,
  getParentBusiness,
  updateContractStatus,
  updateContractFile,
  isEmployee,
  getEmployeeBusinessId,
  canEmployeeAccessBusiness
};
