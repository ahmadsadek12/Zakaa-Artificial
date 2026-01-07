// Branch Repository
// Data access layer for branches

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find branch by ID
 */
async function findById(branchId, businessId = null) {
  let sql = 'SELECT b.*, l.city, l.street, l.building, l.floor, l.notes as location_notes, l.latitude, l.longitude FROM branches b LEFT JOIN locations l ON b.location_id = l.id WHERE b.id = ? AND b.deleted_at IS NULL';
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
    sql += ' AND b.deleted_at IS NULL';
  }
  
  sql += ' ORDER BY b.created_at DESC';
  
  return await queryMySQL(sql, [businessId]);
}

/**
 * Find branch by WhatsApp phone number ID
 */
async function findByWhatsAppPhoneId(whatsappPhoneNumberId) {
  const branches = await queryMySQL(
    'SELECT * FROM branches WHERE whatsapp_phone_number_id = ? AND deleted_at IS NULL',
    [whatsappPhoneNumberId]
  );
  return branches[0] || null;
}

/**
 * Create branch
 */
async function create(branchData) {
  const branchId = generateUUID();
  const connection = await getMySQLConnection();
  
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
    
    // Create branch
    await connection.query(`
      INSERT INTO branches (
        id, business_id, branch_name, location_id,
        contact_phone_number, whatsapp_phone_number, whatsapp_phone_number_id,
        whatsapp_access_token_encrypted, min_order_value, avg_preparation_time_minutes,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      branchId,
      branchData.businessId,
      branchData.branchName,
      locationId,
      branchData.contactPhoneNumber || null,
      branchData.whatsappPhoneNumber || null,
      branchData.whatsappPhoneNumberId || null,
      branchData.whatsappAccessTokenEncrypted || null,
      branchData.minOrderValue || null,
      branchData.avgPreparationTimeMinutes || null,
      branchData.isActive !== undefined ? branchData.isActive : true
    ]);
    
    await connection.commit();
    
    return await findById(branchId);
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
    
    // Update location if provided
    if (updateData.location) {
      const branch = await findById(branchId, businessId);
      if (!branch) {
        throw new Error('Branch not found');
      }
      
      let locationId = branch.location_id;
      
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
        
        updateData.locationId = locationId;
      }
      
      delete updateData.location;
    }
    
    // Update branch fields
    const fieldMap = {
      branchName: 'branch_name',
      locationId: 'location_id',
      contactPhoneNumber: 'contact_phone_number',
      whatsappPhoneNumber: 'whatsapp_phone_number',
      whatsappPhoneNumberId: 'whatsapp_phone_number_id',
      whatsappAccessTokenEncrypted: 'whatsapp_access_token_encrypted',
      minOrderValue: 'min_order_value',
      avgPreparationTimeMinutes: 'avg_preparation_time_minutes',
      isActive: 'is_active'
    };
    
    const updates = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = fieldMap[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (fieldMap[key] && value !== undefined) {
        updates.push(`${dbKey} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(branchId, businessId);
      
      await connection.query(
        `UPDATE branches SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
        values
      );
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
 * Soft delete branch
 */
async function softDelete(branchId, businessId) {
  await queryMySQL(
    'UPDATE branches SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = ? AND business_id = ?',
    [branchId, businessId]
  );
}

/**
 * Get branch menus
 */
async function getBranchMenus(branchId, businessId) {
  return await queryMySQL(`
    SELECT m.*, bm.created_at as attached_at
    FROM branch_menus bm
    JOIN menus m ON bm.menu_id = m.id
    WHERE bm.branch_id = ? AND m.business_id = ?
    ORDER BY m.created_at DESC
  `, [branchId, businessId]);
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
