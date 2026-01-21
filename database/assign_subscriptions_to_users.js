// Assign Subscriptions to Users
// Run with: node database/assign_subscriptions_to_users.js

const mysql = require('mysql2/promise');
const { generateUUID } = require('../src/utils/uuid');
require('dotenv').config();

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

// User assignments
const userAssignments = {
  'ahmadsadek18@hotmail.com': ['Data and Analytics'],
  'milkstore@outlook.com': ['Instagram Messaging', 'Data and Analytics', 'Tables']
};

async function assignSubscriptions() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: MYSQL_HOST || '127.0.0.1',
      port: MYSQL_PORT || 3306,
      user: MYSQL_USER || 'root',
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE || 'zakaa_db'
    });

    console.log('✅ Connected to MySQL database');

    for (const [email, subscriptionNames] of Object.entries(userAssignments)) {
      // Find user
      const [users] = await connection.query(
        'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL',
        [email]
      );

      if (users.length === 0) {
        console.log(`⚠️  User ${email} not found. Skipping.`);
        continue;
      }

      const userId = users[0].id;
      console.log(`\n📧 Processing user: ${email} (${userId})`);

      for (const subscriptionName of subscriptionNames) {
        // Find subscription
        const [subscriptions] = await connection.query(
          'SELECT id, price, sale FROM subscriptions WHERE name = ? AND deleted_at IS NULL',
          [subscriptionName]
        );

        if (subscriptions.length === 0) {
          console.log(`  ⚠️  Subscription "${subscriptionName}" not found. Skipping.`);
          continue;
        }

        const subscription = subscriptions[0];

        // Check if user already has this subscription
        const [existing] = await connection.query(
          `SELECT id FROM user_subscriptions 
           WHERE user_id = ? AND subscription_id = ? AND deleted_at IS NULL`,
          [userId, subscription.id]
        );

        if (existing.length > 0) {
          console.log(`  ⚠️  User already has "${subscriptionName}". Skipping.`);
          continue;
        }

        // Calculate final price with sale
        const saleAmount = subscription.sale ? (subscription.price * subscription.sale / 100) : 0;
        const finalPrice = subscription.price - saleAmount;

        // Create user_subscription record
        const userSubscriptionId = generateUUID();
        await connection.query(
          `INSERT INTO user_subscriptions 
           (id, user_id, subscription_id, status, price_paid, sale_applied, started_at) 
           VALUES (?, ?, ?, 'active', ?, ?, NOW())`,
          [userSubscriptionId, userId, subscription.id, finalPrice, subscription.sale || 0]
        );

        console.log(`  ✅ Assigned "${subscriptionName}" ($${finalPrice.toFixed(2)})`);
      }
    }

    console.log('\n✅ All subscriptions assigned successfully');

  } catch (error) {
    console.error('❌ Error assigning subscriptions:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

assignSubscriptions()
  .then(() => {
    console.log('✅ Assignment completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Assignment failed:', error);
    process.exit(1);
  });
