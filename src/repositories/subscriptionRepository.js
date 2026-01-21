// Subscription Repository
// Data access layer for subscriptions and user_subscriptions

const { queryMySQL, getMySQLConnection } = require('../config/database');
const { generateUUID } = require('../utils/uuid');

/**
 * Find subscription by ID
 */
async function findById(subscriptionId) {
  const subscriptions = await queryMySQL(
    'SELECT * FROM subscriptions WHERE id = ? AND deleted_at IS NULL',
    [subscriptionId]
  );
  return subscriptions[0] || null;
}

/**
 * Find all subscriptions
 */
async function findAll() {
  return await queryMySQL(
    'SELECT * FROM subscriptions WHERE deleted_at IS NULL ORDER BY name'
  );
}

/**
 * Find user's active subscriptions
 */
async function findUserSubscriptions(userId) {
  return await queryMySQL(
    `SELECT 
      us.*,
      s.name,
      s.description,
      s.price as current_price,
      s.sale as current_sale
    FROM user_subscriptions us
    INNER JOIN subscriptions s ON us.subscription_id = s.id
    WHERE us.user_id = ? 
      AND us.deleted_at IS NULL 
      AND s.deleted_at IS NULL
      AND us.status = 'active'
    ORDER BY us.started_at DESC`,
    [userId]
  );
}

/**
 * Find all user subscriptions (including inactive)
 */
async function findUserAllSubscriptions(userId) {
  return await queryMySQL(
    `SELECT 
      us.*,
      s.name,
      s.description,
      s.price as current_price,
      s.sale as current_sale
    FROM user_subscriptions us
    INNER JOIN subscriptions s ON us.subscription_id = s.id
    WHERE us.user_id = ? 
      AND us.deleted_at IS NULL 
      AND s.deleted_at IS NULL
    ORDER BY us.started_at DESC`,
    [userId]
  );
}

/**
 * Check if user has a specific subscription
 */
async function userHasSubscription(userId, subscriptionId) {
  const subscriptions = await queryMySQL(
    `SELECT id FROM user_subscriptions 
     WHERE user_id = ? 
       AND subscription_id = ? 
       AND status = 'active'
       AND deleted_at IS NULL`,
    [userId, subscriptionId]
  );
  return subscriptions.length > 0;
}

/**
 * Create user subscription
 */
async function createUserSubscription(userId, subscriptionId, pricePaid, saleApplied = 0) {
  const id = generateUUID();
  await queryMySQL(
    `INSERT INTO user_subscriptions 
     (id, user_id, subscription_id, status, price_paid, sale_applied, started_at) 
     VALUES (?, ?, ?, 'active', ?, ?, NOW())`,
    [id, userId, subscriptionId, pricePaid, saleApplied]
  );
  return id;
}

/**
 * Update user subscription status
 */
async function updateUserSubscriptionStatus(userSubscriptionId, status) {
  await queryMySQL(
    `UPDATE user_subscriptions 
     SET status = ?, updated_at = NOW() 
     WHERE id = ?`,
    [status, userSubscriptionId]
  );
}

/**
 * Soft delete user subscription
 */
async function deleteUserSubscription(userSubscriptionId) {
  await queryMySQL(
    `UPDATE user_subscriptions 
     SET deleted_at = NOW(), updated_at = NOW() 
     WHERE id = ?`,
    [userSubscriptionId]
  );
}

module.exports = {
  findById,
  findAll,
  findUserSubscriptions,
  findUserAllSubscriptions,
  userHasSubscription,
  createUserSubscription,
  updateUserSubscriptionStatus,
  deleteUserSubscription
};
