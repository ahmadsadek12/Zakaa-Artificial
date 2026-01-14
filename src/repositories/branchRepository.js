// Branch Repository
// Data access layer for branches (now using users table)

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');
const userRepository = require('./userRepository');

/**
 * Find branch by ID (branches are stored in branches table)
 */
async function findById(branchId, businessId = null) {
  let sql = `
    SELECT b.*, l.city, l.street, l.building, l.floor, l.notes as location_notes, l.latitude, l.longitude 
    FROM branches b 
    LEFT JOIN locations l ON b.location_id = l.id 
    WHERE b.id = ? AND b.is_active = true
  `;
  const params = [branchId];
  
  if (businessId) {
    sql += ' AND b.business_id = ?';
    params.push(businessId);
  }
  
  const branches = await queryMySQL(sql, params);
  return branches[0] || null;
}

/**
 * Find all branches for a business
 */
async function findByBusinessId(businessId, includeDeleted = false) {
  let sql = `
    SELECT b.*, l.city, l.street, l.building, l.floor, l.notes as location_notes, l.latitude, l.longitude 
    FROM branches b 
    LEFT JOIN locations l ON b.location_id = l.id 
    WHERE b.business_id = ?
  `;
  
  if (!includeDeleted) {
    sql += ' AND b.is_active = true';
  }
  
  sql += ' ORDER BY b.created_at DESC';
  
  return await queryMySQL(sql, [businessId]);
}

/**
 * Find branch by WhatsApp phone number ID
 */
async function findByWhatsAppPhoneId(whatsappPhoneNumberId) {
  const branches = await queryMySQL(
    'SELECT * FROM branches WHERE whatsapp_phone_number_id = ? AND is_active = true',
    [whatsappPhoneNumberId]
  );
  return branches[0] || null;
}

/**
 * Create branch (creates a branch in branches table)
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
        INSERT INTO locations (id, city, street, building, floor, notes, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
    
    // Create branch in branches table
    await connection.query(`
      INSERT INTO branches (
        id, business_id, branch_name, address, latitude, longitude,
        contact_phone_number, whatsapp_phone_number, whatsapp_phone_number_id,
        whatsapp_access_token_encrypted, location_id, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      branchId,
      branchData.businessId,
      branchData.branchName,
      branchData.location ? `${branchData.location.street}, ${branchData.location.city}` : null,
      branchData.location?.latitude || null,
      branchData.location?.longitude || null,
      branchData.contactPhoneNumber || null,
      branchData.whatsappPhoneNumber || null,
      branchData.whatsappPhoneNumberId || null,
      branchData.whatsappAccessTokenEncrypted || null,
      locationId,
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
    
    // Build update query for branch
    const updates = [];
    const values = [];
    
    if (updateData.branchName !== undefined) {
      updates.push('branch_name = ?');
      values.push(updateData.branchName);
    }
    if (updateData.address !== undefined) {
      updates.push('address = ?');
      values.push(updateData.address);
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
        UPDATE branches 
        SET ${updates.join(', ')} 
        WHERE id = ? AND business_id = ?
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
 * Soft delete branch (mark as inactive)
 */
async function softDelete(branchId, businessId) {
  // Verify branch belongs to business
  const branch = await findById(branchId, businessId);
  if (!branch) {
    throw new Error('Branch not found');
  }
  
  await queryMySQL(
    'UPDATE branches SET is_active = false WHERE id = ? AND business_id = ?',
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
