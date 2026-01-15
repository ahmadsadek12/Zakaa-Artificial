// Branch Repository
// Data access layer for branches (now using users table)

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');
const userRepository = require('./userRepository');

/**
 * Find branch by ID (branches are stored in users table with user_type='branch')
 */
async function findById(branchId, businessId = null) {
  let sql = `
    SELECT u.*, l.city, l.street, l.building, l.floor, l.notes as location_notes, l.latitude, l.longitude 
    FROM users u 
    LEFT JOIN locations l ON u.location_id = l.id 
    WHERE u.id = ? AND u.user_type = 'branch' AND u.is_active = true
  `;
  const params = [branchId];
  
  if (businessId) {
    sql += ' AND u.parent_user_id = ?';
    params.push(businessId);
  }
  
  const branches = await queryMySQL(sql, params);
  return branches[0] || null;
}

/**
 * Find all branches for a business (from users table where user_type='branch')
 */
async function findByBusinessId(businessId, includeDeleted = false) {
  let sql = `
    SELECT u.*, l.city, l.street, l.building, l.floor, l.notes as location_notes, l.latitude, l.longitude 
    FROM users u 
    LEFT JOIN locations l ON u.location_id = l.id 
    WHERE u.parent_user_id = ? AND u.user_type = 'branch'
  `;
  
  if (!includeDeleted) {
    sql += ' AND u.is_active = true';
  }
  
  sql += ' ORDER BY u.created_at DESC';
  
  return await queryMySQL(sql, [businessId]);
}

/**
 * Find branch by WhatsApp phone number ID (from users table)
 */
async function findByWhatsAppPhoneId(whatsappPhoneNumberId) {
  const branches = await queryMySQL(
    'SELECT * FROM users WHERE whatsapp_phone_number_id = ? AND user_type = \'branch\' AND is_active = true',
    [whatsappPhoneNumberId]
  );
  return branches[0] || null;
}

/**
 * Create branch (creates a branch in users table with user_type='branch')
 */
async function create(branchData) {
  const connection = await getMySQLConnection();
  const branchId = generateUUID();
  
  try {
    await connection.beginTransaction();
    
    // Create location if provided
    let locationId = branchData.locationId;
    if (branchData.location && !locationId) {
      locationId = generateUUID();
      await connection.query(`
        INSERT INTO locations (id, city, street, building, floor, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        locationId,
        branchData.location.city,
        branchData.location.street,
        branchData.location.building || null,
        branchData.location.floor || null,
        branchData.location.notes || null
      ]);
    }
    
    // Create branch in users table
    await connection.query(`
      INSERT INTO users (
        id, user_type, parent_user_id, business_name, email,
        contact_phone_number, whatsapp_phone_number, whatsapp_phone_number_id,
        whatsapp_access_token_encrypted, location_id, location_latitude, location_longitude,
        is_active, created_at
      ) VALUES (?, 'branch', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      branchId,
      branchData.businessId,
      branchData.branchName || branchData.business_name,
      branchData.email || null,
      branchData.contactPhoneNumber || null,
      branchData.whatsappPhoneNumber || null,
      branchData.whatsappPhoneNumberId || null,
      branchData.whatsappAccessTokenEncrypted || null,
      locationId,
      branchData.location?.latitude || null,
      branchData.location?.longitude || null,
      branchData.isActive !== undefined ? branchData.isActive : true
    ]);
    
    await connection.commit();
    
    return await findById(branchId, branchData.businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update branch
 */
async function update(branchId, businessId, updateData) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Verify branch exists and belongs to business
    const branch = await findById(branchId, businessId);
    if (!branch) {
      throw new Error('Branch not found');
    }
    
    // Update location if provided
    let locationId = branch.location_id;
    if (updateData.location) {
      if (locationId) {
        // Update existing location
        await connection.query(`
          UPDATE locations 
          SET city = ?, street = ?, building = ?, floor = ?, notes = ?, 
              latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          updateData.location.city,
          updateData.location.street,
          updateData.location.building || null,
          updateData.location.floor || null,
          updateData.location.notes || null,
          updateData.location.latitude || null,
          updateData.location.longitude || null,
          locationId
        ]);
      } else {
        // Create new location
        locationId = generateUUID();
        await connection.query(`
          INSERT INTO locations (id, city, street, building, floor, notes, latitude, longitude)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          locationId,
          updateData.location.city,
          updateData.location.street,
          updateData.location.building || null,
          updateData.location.floor || null,
          updateData.location.notes || null,
          updateData.location.latitude || null,
          updateData.location.longitude || null
        ]);
      }
      
      delete updateData.location;
    }
    
    // Build update query for branch (in users table)
    const updates = [];
    const values = [];
    
    if (updateData.branchName !== undefined || updateData.business_name !== undefined) {
      updates.push('business_name = ?');
      values.push(updateData.branchName || updateData.business_name);
    }
    if (updateData.email !== undefined) {
      updates.push('email = ?');
      values.push(updateData.email);
    }
    if (updateData.contactPhoneNumber !== undefined) {
      updates.push('contact_phone_number = ?');
      values.push(updateData.contactPhoneNumber);
    }
    if (updateData.whatsappPhoneNumber !== undefined) {
      updates.push('whatsapp_phone_number = ?');
      values.push(updateData.whatsappPhoneNumber);
    }
    if (updateData.whatsappPhoneNumberId !== undefined) {
      updates.push('whatsapp_phone_number_id = ?');
      values.push(updateData.whatsappPhoneNumberId);
    }
    if (updateData.whatsappAccessTokenEncrypted !== undefined) {
      updates.push('whatsapp_access_token_encrypted = ?');
      values.push(updateData.whatsappAccessTokenEncrypted);
    }
    if (locationId !== branch.location_id) {
      updates.push('location_id = ?');
      values.push(locationId);
    }
    if (updateData.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(updateData.isActive);
    }
    
    if (updates.length > 0) {
      values.push(branchId, businessId);
      await connection.query(`
        UPDATE users 
        SET ${updates.join(', ')} 
        WHERE id = ? AND parent_user_id = ? AND user_type = 'branch'
      `, values);
    }
    
    await connection.commit();
    
    return await findById(branchId, businessId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Soft delete branch (mark as inactive in users table)
 */
async function softDelete(branchId, businessId) {
  // Verify branch belongs to business
  const branch = await findById(branchId, businessId);
  if (!branch) {
    throw new Error('Branch not found');
  }
  
  await queryMySQL(
    'UPDATE users SET is_active = false WHERE id = ? AND parent_user_id = ? AND user_type = \'branch\'',
    [branchId, businessId]
  );
}

/**
 * Get branch menus (branches share menus with their business)
 */
async function getBranchMenus(branchId, businessId) {
  // Get branch to verify it belongs to business
  const branch = await findById(branchId, businessId);
  if (!branch) {
    throw new Error('Branch not found');
  }
  
  // Get all menus for the parent business
  return await queryMySQL(`
    SELECT * FROM menus 
    WHERE business_id = ? AND is_active = true
    ORDER BY created_at DESC
  `, [businessId]);
}

module.exports = {
  findById,
  findByBusinessId,
  findByWhatsAppPhoneId,
  create,
  update,
  softDelete,
  getBranchMenus
};
