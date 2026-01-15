// Admin Routes
// Full system access for admin users

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { queryMySQL, getMongoCollection } = require('../../config/database');
const { asyncHandler } = require('../../middleware/errorHandler');
const { authenticate, requireUserType } = require('../../middleware/auth');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');
const { encryptToken } = require('../../../utils/encryption');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN));

/**
 * Get dashboard statistics
 * GET /api/admin/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
  // Run all queries in parallel for faster response
  const [businesses, branches, orders] = await Promise.all([
    queryMySQL(
      `SELECT COUNT(*) as count FROM users WHERE user_type = 'business' AND is_active = true`
    ),
    queryMySQL(
      `SELECT COUNT(*) as count FROM users WHERE user_type = 'branch' AND is_active = true`
    ),
    queryMySQL(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM orders`
    )
  ]);
  
  // Message count - skipped for now (MongoDB not configured)
  const messageCount = 0;
  
  res.json({
    success: true,
    data: {
      businesses: businesses[0].count,
      branches: branches[0].count,
      orders: {
        total: orders[0].total || 0,
        accepted: orders[0].accepted || 0,
        completed: orders[0].completed || 0,
        rejected: orders[0].rejected || 0
      },
      messages: messageCount
    }
  });
}));

/**
 * Get all businesses with statistics
 * GET /api/admin/businesses
 */
router.get('/businesses', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  
  let whereClause = `WHERE user_type = 'business' AND is_active = true`;
  const params = [];
  
  if (search) {
    whereClause += ` AND (business_name LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  
  // Get businesses with stats
  const businesses = await queryMySQL(
    `SELECT 
      u.id,
      u.email,
      u.business_name,
      u.business_type,
      u.business_description,
      u.contact_phone_number,
      u.whatsapp_phone_number,
      u.whatsapp_phone_number_id,
      u.subscription_type,
      u.subscription_status,
      u.is_active,
      u.created_at,
      (SELECT COUNT(*) FROM users WHERE parent_user_id = u.id AND user_type = 'branch' AND is_active = true) as branches_count,
      (SELECT COUNT(*) FROM orders WHERE business_id = u.id) as orders_count,
      (SELECT COUNT(*) FROM orders WHERE business_id = u.id AND status = 'accepted') as accepted_orders_count,
      (SELECT COUNT(*) FROM orders WHERE business_id = u.id AND status = 'completed') as completed_orders_count
    FROM users u
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  // Get total count for pagination
  const totalResult = await queryMySQL(
    `SELECT COUNT(*) as total FROM users ${whereClause}`,
    params
  );
  
  // Get message counts from MongoDB
  try {
    const messageLogs = await getMongoCollection('message_logs');
    for (const business of businesses) {
      const messageCount = await messageLogs.countDocuments({ business_id: business.id });
      business.messages_count = messageCount;
    }
  } catch (error) {
    logger.warn('Could not get message counts from MongoDB:', error.message);
    businesses.forEach(b => b.messages_count = 0);
  }
  
  res.json({
    success: true,
    data: {
      businesses,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        pages: Math.ceil(totalResult[0].total / limit)
      }
    }
  });
}));

/**
 * Get single business with details
 * GET /api/admin/businesses/:id
 */
router.get('/businesses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const businesses = await queryMySQL(
    `SELECT * FROM users WHERE id = ? AND user_type = 'business' AND is_active = true`,
    [id]
  );
  
  if (businesses.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  const business = businesses[0];
  
  // Get branches
  const branches = await queryMySQL(
    `SELECT * FROM users WHERE parent_user_id = ? AND user_type = 'branch' AND is_active = true`,
    [id]
  );
  
  // Get orders stats
  const orderStats = await queryMySQL(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as total_revenue
    FROM orders WHERE business_id = ?`,
    [id]
  );
  
  // Get message count
  let messageCount = 0;
  try {
    const messageLogs = await getMongoCollection('message_logs');
    messageCount = await messageLogs.countDocuments({ business_id: id });
  } catch (error) {
    logger.warn('Could not get message count from MongoDB:', error.message);
  }
  
  // Remove sensitive data
  delete business.password_hash;
  delete business.whatsapp_access_token_encrypted;
  
  res.json({
    success: true,
    data: {
      business,
      branches,
      stats: {
        orders: orderStats[0],
        messages: messageCount
      }
    }
  });
}));

/**
 * Create new business
 * POST /api/admin/businesses
 */
router.post('/businesses', asyncHandler(async (req, res) => {
  const {
    email,
    password,
    business_name,
    business_type,
    business_description,
    contact_phone_number,
    whatsapp_phone_number,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    subscription_type = 'standard',
    default_language = 'arabic',
    timezone = 'Asia/Beirut'
  } = req.body;
  
  // Validate required fields
  if (!email || !password || !business_name || !business_type) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email, password, business name, and business type are required' }
    });
  }
  
  // Check if email already exists
  const existingUsers = await queryMySQL(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  
  if (existingUsers.length > 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email already in use' }
    });
  }
  
  // Hash password
  const password_hash = await bcrypt.hash(password, 10);
  
  // Encrypt WhatsApp token if provided
  let whatsapp_token_encrypted = null;
  if (whatsapp_access_token) {
    whatsapp_token_encrypted = encryptToken(whatsapp_access_token);
  }
  
  const businessId = uuidv4();
  
  await queryMySQL(
    `INSERT INTO users (
      id, user_type, email, password_hash, business_name, business_type,
      business_description, contact_phone_number, whatsapp_phone_number,
      whatsapp_phone_number_id, whatsapp_access_token_encrypted,
      subscription_type, subscription_status, subscription_started_at,
      default_language, timezone, is_active
    ) VALUES (?, 'business', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), ?, ?, true)`,
    [
      businessId,
      email,
      password_hash,
      business_name,
      business_type,
      business_description || null,
      contact_phone_number || null,
      whatsapp_phone_number || null,
      whatsapp_phone_number_id || null,
      whatsapp_token_encrypted,
      subscription_type,
      default_language,
      timezone
    ]
  );
  
  // Fetch the created business
  const businesses = await queryMySQL(
    'SELECT id, email, business_name, business_type, subscription_type, created_at FROM users WHERE id = ?',
    [businessId]
  );
  
  res.status(201).json({
    success: true,
    data: { business: businesses[0] }
  });
}));

/**
 * Update business
 * PUT /api/admin/businesses/:id
 */
router.put('/businesses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    email,
    business_name,
    business_type,
    business_description,
    contact_phone_number,
    whatsapp_phone_number,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    subscription_type,
    subscription_status,
    is_active,
    default_language,
    timezone
  } = req.body;
  
  // Check if business exists
  const businesses = await queryMySQL(
    'SELECT id FROM users WHERE id = ? AND user_type = "business" AND is_active = true',
    [id]
  );
  
  if (businesses.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  // Build update query dynamically
  const updates = [];
  const params = [];
  
  if (email !== undefined) {
    // Check if email is already in use by another user
    const existingUsers = await queryMySQL(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email already in use' }
      });
    }
    
    updates.push('email = ?');
    params.push(email);
  }
  
  if (business_name !== undefined) {
    updates.push('business_name = ?');
    params.push(business_name);
  }
  
  if (business_type !== undefined) {
    updates.push('business_type = ?');
    params.push(business_type);
  }
  
  if (business_description !== undefined) {
    updates.push('business_description = ?');
    params.push(business_description);
  }
  
  if (contact_phone_number !== undefined) {
    updates.push('contact_phone_number = ?');
    params.push(contact_phone_number);
  }
  
  if (whatsapp_phone_number !== undefined) {
    updates.push('whatsapp_phone_number = ?');
    params.push(whatsapp_phone_number);
  }
  
  if (whatsapp_phone_number_id !== undefined) {
    updates.push('whatsapp_phone_number_id = ?');
    params.push(whatsapp_phone_number_id);
  }
  
  if (whatsapp_access_token !== undefined) {
    const whatsapp_token_encrypted = whatsapp_access_token ? encryptToken(whatsapp_access_token) : null;
    updates.push('whatsapp_access_token_encrypted = ?');
    params.push(whatsapp_token_encrypted);
  }
  
  if (subscription_type !== undefined) {
    updates.push('subscription_type = ?');
    params.push(subscription_type);
  }
  
  if (subscription_status !== undefined) {
    updates.push('subscription_status = ?');
    params.push(subscription_status);
  }
  
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active);
  }
  
  if (default_language !== undefined) {
    updates.push('default_language = ?');
    params.push(default_language);
  }
  
  if (timezone !== undefined) {
    updates.push('timezone = ?');
    params.push(timezone);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'No fields to update' }
    });
  }
  
  params.push(id);
  
  await queryMySQL(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
    params
  );
  
  // Fetch updated business
  const updatedBusinesses = await queryMySQL(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
  
  const business = updatedBusinesses[0];
  delete business.password_hash;
  delete business.whatsapp_access_token_encrypted;
  
  res.json({
    success: true,
    data: { business }
  });
}));

/**
 * Delete business (soft delete)
 * DELETE /api/admin/businesses/:id
 */
router.delete('/businesses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if business exists
  const businesses = await queryMySQL(
    'SELECT id FROM users WHERE id = ? AND user_type = "business" AND is_active = true',
    [id]
  );
  
  if (businesses.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  // Soft delete business and all its branches
  await queryMySQL(
    'UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = ? OR parent_user_id = ?',
    [id, id]
  );
  
  res.json({
    success: true,
    data: { message: 'Business deleted successfully' }
  });
}));

/**
 * Get branches for a business
 * GET /api/admin/businesses/:businessId/branches
 */
router.get('/businesses/:businessId/branches', asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  
  // Verify business exists
  const businesses = await queryMySQL(
    'SELECT id FROM users WHERE id = ? AND user_type = "business" AND is_active = true',
    [businessId]
  );
  
  if (businesses.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  const branches = await queryMySQL(
    `SELECT 
      u.*,
      l.city, l.street, l.building, l.floor, l.notes as location_notes,
      (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count,
      (SELECT COUNT(*) FROM orders WHERE user_id = u.id AND status = 'accepted') as accepted_orders_count
    FROM users u
    LEFT JOIN locations l ON u.location_id = l.id
    WHERE u.parent_user_id = ? AND u.user_type = 'branch' AND u.is_active = true
    ORDER BY u.created_at DESC`,
    [businessId]
  );
  
  // Get message counts for each branch
  try {
    const messageLogs = await getMongoCollection('message_logs');
    for (const branch of branches) {
      const messageCount = await messageLogs.countDocuments({ branch_id: branch.id });
      branch.messages_count = messageCount;
    }
  } catch (error) {
    logger.warn('Could not get message counts from MongoDB:', error.message);
    branches.forEach(b => b.messages_count = 0);
  }
  
  // Remove sensitive data
  branches.forEach(branch => {
    delete branch.password_hash;
    delete branch.whatsapp_access_token_encrypted;
  });
  
  res.json({
    success: true,
    data: { branches }
  });
}));

/**
 * Create branch for a business
 * POST /api/admin/businesses/:businessId/branches
 */
router.post('/businesses/:businessId/branches', asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const {
    email,
    password,
    business_name,
    business_description,
    contact_phone_number,
    whatsapp_phone_number,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    location,
    default_language,
    timezone
  } = req.body;
  
  // Verify business exists
  const businesses = await queryMySQL(
    'SELECT id, business_type FROM users WHERE id = ? AND user_type = "business" AND is_active = true',
    [businessId]
  );
  
  if (businesses.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Business not found' }
    });
  }
  
  const parentBusiness = businesses[0];
  
  // Validate required fields
  if (!email || !password || !business_name) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email, password, and branch name are required' }
    });
  }
  
  // Check if email already exists
  const existingUsers = await queryMySQL(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  
  if (existingUsers.length > 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email already in use' }
    });
  }
  
  // Hash password
  const password_hash = await bcrypt.hash(password, 10);
  
  // Encrypt WhatsApp token if provided
  let whatsapp_token_encrypted = null;
  if (whatsapp_access_token) {
    whatsapp_token_encrypted = encryptToken(whatsapp_access_token);
  }
  
  // Create location if provided
  let locationId = null;
  if (location && location.city && location.street) {
    locationId = uuidv4();
    await queryMySQL(
      `INSERT INTO locations (id, city, street, building, floor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        locationId,
        location.city,
        location.street,
        location.building || null,
        location.floor || null,
        location.notes || null
      ]
    );
  }
  
  const branchId = uuidv4();
  
  await queryMySQL(
    `INSERT INTO users (
      id, user_type, parent_user_id, email, password_hash, business_name,
      business_type, business_description, contact_phone_number,
      whatsapp_phone_number, whatsapp_phone_number_id, whatsapp_access_token_encrypted,
      location_id, location_latitude, location_longitude,
      default_language, timezone, is_active
    ) VALUES (?, 'branch', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
    [
      branchId,
      businessId,
      email,
      password_hash,
      business_name,
      parentBusiness.business_type,
      business_description || null,
      contact_phone_number || null,
      whatsapp_phone_number || null,
      whatsapp_phone_number_id || null,
      whatsapp_token_encrypted,
      locationId,
      location?.latitude || null,
      location?.longitude || null,
      default_language || 'arabic',
      timezone || 'Asia/Beirut'
    ]
  );
  
  // Fetch the created branch
  const branches = await queryMySQL(
    `SELECT u.*, l.city, l.street, l.building, l.floor
    FROM users u
    LEFT JOIN locations l ON u.location_id = l.id
    WHERE u.id = ?`,
    [branchId]
  );
  
  const branch = branches[0];
  delete branch.password_hash;
  delete branch.whatsapp_access_token_encrypted;
  
  res.status(201).json({
    success: true,
    data: { branch }
  });
}));

/**
 * Update branch
 * PUT /api/admin/branches/:id
 */
router.put('/branches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    email,
    business_name,
    business_description,
    contact_phone_number,
    whatsapp_phone_number,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    is_active,
    location,
    default_language,
    timezone
  } = req.body;
  
  // Check if branch exists
  const branches = await queryMySQL(
    'SELECT id, location_id FROM users WHERE id = ? AND user_type = "branch" AND is_active = true',
    [id]
  );
  
  if (branches.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Branch not found' }
    });
  }
  
  const branch = branches[0];
  
  // Build update query dynamically
  const updates = [];
  const params = [];
  
  if (email !== undefined) {
    // Check if email is already in use by another user
    const existingUsers = await queryMySQL(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email already in use' }
      });
    }
    
    updates.push('email = ?');
    params.push(email);
  }
  
  if (business_name !== undefined) {
    updates.push('business_name = ?');
    params.push(business_name);
  }
  
  if (business_description !== undefined) {
    updates.push('business_description = ?');
    params.push(business_description);
  }
  
  if (contact_phone_number !== undefined) {
    updates.push('contact_phone_number = ?');
    params.push(contact_phone_number);
  }
  
  if (whatsapp_phone_number !== undefined) {
    updates.push('whatsapp_phone_number = ?');
    params.push(whatsapp_phone_number);
  }
  
  if (whatsapp_phone_number_id !== undefined) {
    updates.push('whatsapp_phone_number_id = ?');
    params.push(whatsapp_phone_number_id);
  }
  
  if (whatsapp_access_token !== undefined) {
    const whatsapp_token_encrypted = whatsapp_access_token ? encryptToken(whatsapp_access_token) : null;
    updates.push('whatsapp_access_token_encrypted = ?');
    params.push(whatsapp_token_encrypted);
  }
  
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active);
  }
  
  if (default_language !== undefined) {
    updates.push('default_language = ?');
    params.push(default_language);
  }
  
  if (timezone !== undefined) {
    updates.push('timezone = ?');
    params.push(timezone);
  }
  
  // Update or create location
  if (location) {
    if (branch.location_id) {
      // Update existing location
      await queryMySQL(
        `UPDATE locations SET city = ?, street = ?, building = ?, floor = ?, notes = ? WHERE id = ?`,
        [
          location.city,
          location.street,
          location.building || null,
          location.floor || null,
          location.notes || null,
          branch.location_id
        ]
      );
    } else if (location.city && location.street) {
      // Create new location
      const locationId = uuidv4();
      await queryMySQL(
        `INSERT INTO locations (id, city, street, building, floor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          locationId,
          location.city,
          location.street,
          location.building || null,
          location.floor || null,
          location.notes || null
        ]
      );
      updates.push('location_id = ?');
      params.push(locationId);
    }
    
    if (location.latitude !== undefined) {
      updates.push('location_latitude = ?');
      params.push(location.latitude);
    }
    
    if (location.longitude !== undefined) {
      updates.push('location_longitude = ?');
      params.push(location.longitude);
    }
  }
  
  if (updates.length > 0) {
    params.push(id);
    await queryMySQL(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }
  
  // Fetch updated branch
  const updatedBranches = await queryMySQL(
    `SELECT u.*, l.city, l.street, l.building, l.floor, l.notes as location_notes
    FROM users u
    LEFT JOIN locations l ON u.location_id = l.id
    WHERE u.id = ?`,
    [id]
  );
  
  const updatedBranch = updatedBranches[0];
  delete updatedBranch.password_hash;
  delete updatedBranch.whatsapp_access_token_encrypted;
  
  res.json({
    success: true,
    data: { branch: updatedBranch }
  });
}));

/**
 * Delete branch (soft delete)
 * DELETE /api/admin/branches/:id
 */
router.delete('/branches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if branch exists
  const branches = await queryMySQL(
    'SELECT id FROM users WHERE id = ? AND user_type = "branch" AND is_active = true',
    [id]
  );
  
  if (branches.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Branch not found' }
    });
  }
  
  // Soft delete branch
  await queryMySQL(
    'UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = ?',
    [id]
  );
  
  res.json({
    success: true,
    data: { message: 'Branch deleted successfully' }
  });
}));

/**
 * Get all branches (across all businesses)
 * GET /api/admin/branches
 */
router.get('/branches', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const businessId = req.query.businessId || null;
  
  let whereClause = `WHERE u.user_type = 'branch' AND u.is_active = true`;
  const params = [];
  
  if (businessId) {
    whereClause += ` AND u.parent_user_id = ?`;
    params.push(businessId);
  }
  
  if (search) {
    whereClause += ` AND (u.business_name LIKE ? OR u.email LIKE ? OR b.business_name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  // Get branches with parent business info
  const branches = await queryMySQL(
    `SELECT 
      u.*,
      b.business_name as parent_business_name,
      l.city, l.street, l.building, l.floor,
      (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count,
      (SELECT COUNT(*) FROM orders WHERE user_id = u.id AND status = 'accepted') as accepted_orders_count
    FROM users u
    LEFT JOIN users b ON u.parent_user_id = b.id
    LEFT JOIN locations l ON u.location_id = l.id
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  // Get total count for pagination
  const totalResult = await queryMySQL(
    `SELECT COUNT(*) as total FROM users u 
    LEFT JOIN users b ON u.parent_user_id = b.id
    ${whereClause}`,
    params
  );
  
  // Get message counts
  try {
    const messageLogs = await getMongoCollection('message_logs');
    for (const branch of branches) {
      const messageCount = await messageLogs.countDocuments({ branch_id: branch.id });
      branch.messages_count = messageCount;
    }
  } catch (error) {
    logger.warn('Could not get message counts from MongoDB:', error.message);
    branches.forEach(b => b.messages_count = 0);
  }
  
  // Remove sensitive data
  branches.forEach(branch => {
    delete branch.password_hash;
    delete branch.whatsapp_access_token_encrypted;
  });
  
  res.json({
    success: true,
    data: {
      branches,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        pages: Math.ceil(totalResult[0].total / limit)
      }
    }
  });
}));

/**
 * Get all orders (system-wide)
 * GET /api/admin/orders
 */
router.get('/orders', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const status = req.query.status || null;
  const businessId = req.query.businessId || null;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (status) {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }
  
  if (businessId) {
    whereClause += ' AND o.business_id = ?';
    params.push(businessId);
  }
  
  const orders = await queryMySQL(
    `SELECT 
      o.*,
      b.business_name,
      u.business_name as branch_name
    FROM orders o
    LEFT JOIN users b ON o.business_id = b.id
    LEFT JOIN users u ON o.user_id = u.id
    ${whereClause}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = await queryMySQL(
    `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
    params
  );
  
  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        pages: Math.ceil(totalResult[0].total / limit)
      }
    }
  });
}));

/**
 * Get single order details
 * GET /api/admin/orders/:id
 */
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const orders = await queryMySQL(
    `SELECT 
      o.*,
      b.business_name,
      u.business_name as branch_name
    FROM orders o
    LEFT JOIN users b ON o.business_id = b.id
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.id = ?`,
    [id]
  );
  
  if (orders.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Order not found' }
    });
  }
  
  // Get order items
  const items = await queryMySQL(
    `SELECT * FROM order_items WHERE order_id = ?`,
    [id]
  );
  
  const order = { ...orders[0], items };
  
  res.json({
    success: true,
    data: { order }
  });
}));

/**
 * Update order status
 * PUT /api/admin/orders/:id/status
 */
router.put('/orders/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['cart', 'accepted', 'delivering', 'completed', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid status' }
    });
  }
  
  await queryMySQL(
    'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, id]
  );
  
  // Log status change
  await queryMySQL(
    `INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at) 
     VALUES (?, ?, ?, 'system', NOW())`,
    [uuidv4(), id, status]
  );
  
  logger.info(`Admin updated order ${id} status to ${status}`);
  
  res.json({
    success: true,
    data: { message: 'Order status updated' }
  });
}));

/**
 * Delete order
 * DELETE /api/admin/orders/:id
 */
router.delete('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await queryMySQL('DELETE FROM orders WHERE id = ?', [id]);
  
  logger.info(`Admin deleted order ${id}`);
  
  res.json({
    success: true,
    data: { message: 'Order deleted successfully' }
  });
}));

/**
 * Get all items (system-wide)
 * GET /api/admin/items
 */
router.get('/items', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const businessId = req.query.businessId || null;
  const search = req.query.search || '';
  
  let whereClause = 'WHERE i.is_active = true';
  const params = [];
  
  if (businessId) {
    whereClause += ' AND i.business_id = ?';
    params.push(businessId);
  }
  
  if (search) {
    whereClause += ' AND (i.name LIKE ? OR i.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  const items = await queryMySQL(
    `SELECT 
      i.*,
      b.business_name,
      u.business_name as branch_name
    FROM items i
    LEFT JOIN users b ON i.business_id = b.id
    LEFT JOIN users u ON i.user_id = u.id
    ${whereClause}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = await queryMySQL(
    `SELECT COUNT(*) as total FROM items i ${whereClause}`,
    params
  );
  
  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        pages: Math.ceil(totalResult[0].total / limit)
      }
    }
  });
}));

/**
 * Delete item
 * DELETE /api/admin/items/:id
 */
router.delete('/items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await queryMySQL(
    'UPDATE items SET deleted_at = NOW() WHERE id = ?',
    [id]
  );
  
  logger.info(`Admin deleted item ${id}`);
  
  res.json({
    success: true,
    data: { message: 'Item deleted successfully' }
  });
}));

/**
 * Get all menus (system-wide)
 * GET /api/admin/menus
 */
router.get('/menus', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const businessId = req.query.businessId || null;
  
  let whereClause = 'WHERE m.is_active = true';
  const params = [];
  
  if (businessId) {
    whereClause += ' AND m.business_id = ?';
    params.push(businessId);
  }
  
  const menus = await queryMySQL(
    `SELECT 
      m.*,
      b.business_name,
      (SELECT COUNT(*) FROM items WHERE menu_id = m.id AND is_active = true) as items_count
    FROM menus m
    LEFT JOIN users b ON m.business_id = b.id
    ${whereClause}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = await queryMySQL(
    `SELECT COUNT(*) as total FROM menus m ${whereClause}`,
    params
  );
  
  res.json({
    success: true,
    data: {
      menus,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        pages: Math.ceil(totalResult[0].total / limit)
      }
    }
  });
}));

/**
 * Delete menu
 * DELETE /api/admin/menus/:id
 */
router.delete('/menus/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await queryMySQL(
    'UPDATE menus SET deleted_at = NOW() WHERE id = ?',
    [id]
  );
  
  logger.info(`Admin deleted menu ${id}`);
  
  res.json({
    success: true,
    data: { message: 'Menu deleted successfully' }
  });
}));

/**
 * Get all customers
 * GET /api/admin/customers
 */
router.get('/customers', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  
  let whereClause = `WHERE user_type = 'customer' AND is_active = true`;
  const params = [];
  
  if (search) {
    whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR contact_phone_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  const customers = await queryMySQL(
    `SELECT 
      u.id, u.email, u.first_name, u.last_name, u.contact_phone_number,
      u.is_active, u.created_at,
      (SELECT COUNT(*) FROM orders WHERE customer_id = u.id) as orders_count
    FROM users u
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = await queryMySQL(
    `SELECT COUNT(*) as total FROM users ${whereClause}`,
    params
  );
  
  res.json({
    success: true,
    data: {
      customers,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        pages: Math.ceil(totalResult[0].total / limit)
      }
    }
  });
}));

/**
 * Get customer details
 * GET /api/admin/customers/:id
 */
router.get('/customers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const customers = await queryMySQL(
    `SELECT 
      u.id, u.email, u.first_name, u.last_name, u.contact_phone_number,
      u.is_active, u.created_at, u.updated_at
    FROM users u
    WHERE u.id = ? AND u.user_type = 'customer' AND u.is_active = true`,
    [id]
  );
  
  if (customers.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Customer not found' }
    });
  }
  
  // Get customer orders
  const orders = await queryMySQL(
    `SELECT o.*, b.business_name 
     FROM orders o
     LEFT JOIN users b ON o.business_id = b.id
     WHERE o.customer_id = ?
     ORDER BY o.created_at DESC
     LIMIT 50`,
    [id]
  );
  
  res.json({
    success: true,
    data: {
      customer: customers[0],
      orders
    }
  });
}));

/**
 * Update customer status
 * PUT /api/admin/customers/:id
 */
router.put('/customers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  
  await queryMySQL(
    'UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ? AND user_type = "customer"',
    [is_active, id]
  );
  
  logger.info(`Admin updated customer ${id} status`);
  
  res.json({
    success: true,
    data: { message: 'Customer updated successfully' }
  });
}));

/**
 * Get system logs (recent activity)
 * GET /api/admin/logs
 */
router.get('/logs', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  
  // Get audit logs from MongoDB if available
  let logs = [];
  try {
    const auditLogs = await getMongoCollection('audit_logs');
    logs = await auditLogs
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    logger.warn('Could not get audit logs from MongoDB:', error.message);
    logs = [];
  }
  
  res.json({
    success: true,
    data: { logs }
  });
}));

/**
 * Get all admins
 * GET /api/admin/admins
 */
router.get('/admins', asyncHandler(async (req, res) => {
  const admins = await queryMySQL(
    `SELECT 
      id, email, first_name, last_name, contact_phone_number,
      is_active, created_at, updated_at
    FROM users 
    WHERE user_type = 'admin' AND is_active = true
    ORDER BY created_at DESC`
  );
  
  res.json({
    success: true,
    data: { admins }
  });
}));

/**
 * Create new admin user
 * POST /api/admin/admins
 */
router.post('/admins', asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name, contact_phone_number } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email and password are required' }
    });
  }
  
  // Check if email already exists
  const existing = await queryMySQL(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  
  if (existing.length > 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email already in use' }
    });
  }
  
  // Hash password
  const password_hash = await bcrypt.hash(password, 10);
  
  const adminId = uuidv4();
  await queryMySQL(
    `INSERT INTO users (
      id, user_type, email, password_hash, first_name, last_name,
      contact_phone_number, is_active, created_at
    ) VALUES (?, 'admin', ?, ?, ?, ?, ?, true, NOW())`,
    [adminId, email, password_hash, first_name || null, last_name || null, contact_phone_number || null]
  );
  
  logger.info(`Admin created new admin user: ${email}`);
  
  res.status(201).json({
    success: true,
    data: { message: 'Admin user created successfully', adminId }
  });
}));

/**
 * Delete admin user
 * DELETE /api/admin/admins/:id
 */
router.delete('/admins/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Prevent deleting yourself
  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      error: { message: 'Cannot delete your own admin account' }
    });
  }
  
  await queryMySQL(
    'UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = ? AND user_type = "admin"',
    [id]
  );
  
  logger.info(`Admin deleted admin user: ${id}`);
  
  res.json({
    success: true,
    data: { message: 'Admin user deleted successfully' }
  });
}));

module.exports = router;
