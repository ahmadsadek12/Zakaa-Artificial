// Script to activate add-ons for a business
// Usage: node scripts/activate-addon.js <email> <addonKey>
// Example: node scripts/activate-addon.js milkstore@outlook.com table_reservations

require('dotenv').config();
const { queryMySQL, getMySQLConnection } = require('../src/config/database');

async function activateAddonForBusiness(email, addonKey) {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Find user by email
    const [users] = await connection.query(
      `SELECT id, business_type FROM users WHERE email = ? AND user_type = 'business'`,
      [email]
    );
    
    if (users.length === 0) {
      throw new Error(`Business user with email ${email} not found`);
    }
    
    const businessId = users[0].id;
    const businessType = users[0].business_type;
    
    console.log(`Found business: ${businessId}, type: ${businessType}`);
    
    // Find addon by key
    const [addons] = await connection.query(
      `SELECT id, name, addon_key FROM addons WHERE addon_key = ?`,
      [addonKey]
    );
    
    if (addons.length === 0) {
      throw new Error(`Addon with key "${addonKey}" not found`);
    }
    
    const addon = addons[0];
    console.log(`Found addon: ${addon.name} (${addon.addon_key})`);
    
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
      console.log(`✅ Updated existing addon activation`);
    } else {
      // Create new
      const id = require('../src/utils/uuid').generateUUID();
      await connection.query(
        `INSERT INTO business_addons 
         (id, business_id, addon_id, status) 
         VALUES (?, ?, ?, 'active')`,
        [id, businessId, addon.id]
      );
      console.log(`✅ Created new addon activation`);
    }
    
    await connection.commit();
    console.log(`\n✅ Successfully activated "${addon.name}" for ${email}`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

// Get command line arguments
const email = process.argv[2];
const addonKey = process.argv[3];

if (!email || !addonKey) {
  console.error('Usage: node scripts/activate-addon.js <email> <addonKey>');
  console.error('Example: node scripts/activate-addon.js milkstore@outlook.com table_reservations');
  process.exit(1);
}

activateAddonForBusiness(email, addonKey)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
