// Script to grant full access to a user
// This includes:
// 1. Premium subscription (subscription_type = 'premium', subscription_status = 'active')
// 2. All available addons activated
// Usage: node scripts/grant-full-access.js <email>

require('dotenv').config();
const { getMySQLConnection } = require('../src/config/database');
const { generateUUID } = require('../src/utils/uuid');

async function grantFullAccess(email) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Step 1: Find user by email
    const [users] = await connection.query(
      `SELECT id, user_type, subscription_type, subscription_status 
       FROM users WHERE email = ?`,
      [email]
    );
    
    if (users.length === 0) {
      throw new Error(`User with email ${email} not found`);
    }
    
    const user = users[0];
    const userId = user.id;
    
    console.log(`\n📧 Found user: ${email}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   User Type: ${user.user_type}`);
    console.log(`   Current Subscription: ${user.subscription_type || 'none'} (${user.subscription_status || 'none'})`);
    
    // Step 2: Grant premium subscription
    await connection.query(
      `UPDATE users 
       SET subscription_type = 'premium',
           subscription_status = 'active',
           subscription_started_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId]
    );
    console.log(`\n✅ Granted premium subscription`);
    
    // Step 3: Get all available addons
    const [addons] = await connection.query(
      `SELECT id, addon_key, name FROM addons WHERE is_active = true`
    );
    
    if (addons.length === 0) {
      console.log(`\n⚠️  No addons found in database. Skipping addon activation.`);
    } else {
      console.log(`\n📦 Found ${addons.length} addon(s):`);
      addons.forEach(addon => {
        console.log(`   - ${addon.name} (${addon.addon_key})`);
      });
      
      // Step 4: Determine business_id (for business users, it's their own id; for branches, it's parent_business_id)
    let businessId = userId;
    if (user.user_type === 'branch') {
      const [branchInfo] = await connection.query(
        `SELECT parent_business_id FROM users WHERE id = ?`,
        [userId]
      );
      if (branchInfo.length > 0 && branchInfo[0].parent_business_id) {
        businessId = branchInfo[0].parent_business_id;
        console.log(`   Branch detected - using parent business ID: ${businessId}`);
      }
    }
    
    // Step 5: Activate all addons for this business
    for (const addon of addons) {
      // Check if business_addon already exists
      const [existing] = await connection.query(
        `SELECT id, status FROM business_addons 
         WHERE business_id = ? AND addon_id = ?`,
        [businessId, addon.id]
      );
      
      if (existing.length > 0) {
        // Update existing
        await connection.query(
          `UPDATE business_addons 
           SET status = 'active', 
               updated_at = CURRENT_TIMESTAMP
           WHERE business_id = ? AND addon_id = ?`,
          [businessId, addon.id]
        );
        console.log(`   ✅ Updated: ${addon.name}`);
      } else {
        // Create new
        const id = generateUUID();
        await connection.query(
          `INSERT INTO business_addons 
           (id, business_id, addon_id, status) 
           VALUES (?, ?, ?, 'active')`,
          [id, businessId, addon.id]
        );
        console.log(`   ✅ Activated: ${addon.name}`);
      }
    }
    }
    
    await connection.commit();
    console.log(`\n🎉 Successfully granted full access to ${email}`);
    console.log(`   - Premium subscription: ✅ Active`);
    console.log(`   - Addons activated: ${addons.length}`);
    
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Get command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/grant-full-access.js <email>');
  console.error('Example: node scripts/grant-full-access.js milkstore@outlook.com');
  process.exit(1);
}

grantFullAccess(email)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
