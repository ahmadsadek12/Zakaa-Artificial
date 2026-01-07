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
    defaultLanguage: 'default_language',
    timezone: 'timezone',
    subscriptionType: 'subscription_type',
    subscriptionPrice: 'subscription_price',
    subscriptionStatus: 'subscription_status',
    subscriptionStartedAt: 'subscription_started_at',
    subscriptionEndsAt: 'subscription_ends_at',
    allowScheduledOrders: 'allow_scheduled_orders',
    allowDelivery: 'allow_delivery',
    allowTakeaway: 'allow_takeaway',
    allowOnSite: 'allow_on_site',
    whatsappPhoneNumber: 'whatsapp_phone_number',
    whatsappPhoneNumberId: 'whatsapp_phone_number_id',
    whatsappAccessTokenEncrypted: 'whatsapp_access_token_encrypted',
    isActive: 'is_active'
  };
  
  const allowedFields = Object.values(fieldMap);
  
  const updates = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updateData)) {
    const dbKey = fieldMap[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(dbKey) && value !== undefined) {
      updates.push(`${dbKey} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) {
    return await findById(userId);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);
  
  await queryMySQL(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await findById(userId);
}

/**
 * Update password
 */
async function updatePassword(userId, newPassword) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await queryMySQL(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [hashedPassword, userId]
  );
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

module.exports = {
  findById,
  findByEmail,
  findByWhatsAppPhoneId,
  create,
  update,
  updatePassword,
  verifyPassword,
  verifyPasswordByEmail,
  softDelete
};
