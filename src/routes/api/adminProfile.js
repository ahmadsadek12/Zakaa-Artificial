// Admin Profile Management Routes
// Allows admin to manage their own account

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queryMySQL } = require('../../config/database');
const { asyncHandler } = require('../../middleware/errorHandler');
const { authenticate, requireUserType } = require('../../middleware/auth');
const CONSTANTS = require('../../config/constants');
const logger = require('../../utils/logger');

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN));

/**
 * Get admin profile
 * GET /api/admin/profile
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const users = await queryMySQL(
    `SELECT 
      id, user_type, email, contact_phone_number, 
      first_name, last_name, is_active, created_at, updated_at
    FROM users 
    WHERE id = ? AND user_type = 'admin' AND deleted_at IS NULL`,
    [req.user.id]
  );
  
  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Admin profile not found' }
    });
  }
  
  res.json({
    success: true,
    data: { profile: users[0] }
  });
}));

/**
 * Update admin profile
 * PUT /api/admin/profile
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const {
    email,
    first_name,
    last_name,
    contact_phone_number
  } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const params = [];
  
  if (email !== undefined) {
    // Check if email is already in use by another user
    const existingUsers = await queryMySQL(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, req.user.id]
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
  
  if (first_name !== undefined) {
    updates.push('first_name = ?');
    params.push(first_name);
  }
  
  if (last_name !== undefined) {
    updates.push('last_name = ?');
    params.push(last_name);
  }
  
  if (contact_phone_number !== undefined) {
    updates.push('contact_phone_number = ?');
    params.push(contact_phone_number);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'No fields to update' }
    });
  }
  
  params.push(req.user.id);
  
  await queryMySQL(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
    params
  );
  
  // Fetch updated profile
  const users = await queryMySQL(
    `SELECT 
      id, user_type, email, contact_phone_number, 
      first_name, last_name, is_active, created_at, updated_at
    FROM users 
    WHERE id = ?`,
    [req.user.id]
  );
  
  res.json({
    success: true,
    data: { profile: users[0] }
  });
}));

/**
 * Change admin password
 * PUT /api/admin/profile/password
 */
router.put('/profile/password', asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  
  if (!current_password || !new_password) {
    return res.status(400).json({
      success: false,
      error: { message: 'Current password and new password are required' }
    });
  }
  
  // Validate new password strength
  if (new_password.length < 8) {
    return res.status(400).json({
      success: false,
      error: { message: 'New password must be at least 8 characters long' }
    });
  }
  
  // Get current password hash
  const users = await queryMySQL(
    'SELECT password_hash FROM users WHERE id = ?',
    [req.user.id]
  );
  
  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' }
    });
  }
  
  // Verify current password
  const isValid = await bcrypt.compare(current_password, users[0].password_hash);
  
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: { message: 'Current password is incorrect' }
    });
  }
  
  // Hash new password
  const password_hash = await bcrypt.hash(new_password, 10);
  
  // Update password
  await queryMySQL(
    'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
    [password_hash, req.user.id]
  );
  
  logger.info(`Admin password changed: ${req.user.id}`);
  
  res.json({
    success: true,
    data: { message: 'Password updated successfully' }
  });
}));

module.exports = router;
