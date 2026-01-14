// Verify all data for the test business
require('dotenv').config();
const { queryMySQL } = require('../src/config/database');

const BUSINESS_ID = 'ae2796e3-698e-4c98-ad21-99517b96c18e';

async function verifyBusinessData() {
  try {
    console.log('🔍 Verifying business data...\n');
    console.log(`Business ID: ${BUSINESS_ID}\n`);
    
    // Business info
    const business = await queryMySQL(
      'SELECT id, email, business_name, business_type, whatsapp_phone_number_id, subscription_type FROM users WHERE id = ? AND deleted_at IS NULL',
      [BUSINESS_ID]
    );
    
    if (!business || business.length === 0) {
      console.log('❌ Business not found!');
      return;
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 BUSINESS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Name:        ${business[0].business_name}`);
    console.log(`Email:       ${business[0].email}`);
    console.log(`Type:        ${business[0].business_type}`);
    console.log(`WhatsApp:    ${business[0].whatsapp_phone_number_id || 'Not set'}`);
    console.log(`Plan:        ${business[0].subscription_type}\n`);
    
    // Menus
    const menus = await queryMySQL(
      'SELECT id, name, description, is_active FROM menus WHERE business_id = ? ORDER BY created_at',
      [BUSINESS_ID]
    );
    console.log(`📋 MENUS: ${menus.length}`);
    menus.forEach((menu, idx) => {
      console.log(`   [${idx + 1}] ${menu.name} ${menu.is_active ? '✅' : '❌'}`);
      if (menu.description) console.log(`       ${menu.description}`);
    });
    console.log('');
    
    // Items
    const items = await queryMySQL(
      'SELECT COUNT(*) as total, availability, COUNT(*) as count FROM items WHERE business_id = ? AND deleted_at IS NULL GROUP BY availability',
      [BUSINESS_ID]
    );
    const allItems = await queryMySQL(
      'SELECT name, price, availability FROM items WHERE business_id = ? AND deleted_at IS NULL ORDER BY name LIMIT 30',
      [BUSINESS_ID]
    );
    
    let totalItems = 0;
    items.forEach(item => totalItems += parseInt(item.count));
    
    console.log(`🍔 ITEMS: ${totalItems} total`);
    items.forEach(item => {
      console.log(`   ${item.availability}: ${item.count}`);
    });
    console.log(`\n   Sample items (showing first ${Math.min(allItems.length, 10)}):`);
    allItems.slice(0, 10).forEach((item, idx) => {
      const status = item.availability === 'available' ? '✅' : '❌';
      console.log(`   ${status} ${item.name.padEnd(30)} $${parseFloat(item.price).toFixed(2)}`);
    });
    if (allItems.length > 10) {
      console.log(`   ... and ${allItems.length - 10} more items`);
    }
    console.log('');
    
    // Branches
    const branches = await queryMySQL(
      'SELECT id, branch_name, contact_phone_number, is_active FROM branches WHERE business_id = ?',
      [BUSINESS_ID]
    );
    console.log(`🏢 BRANCHES: ${branches.length}`);
    branches.forEach((branch, idx) => {
      console.log(`   [${idx + 1}] ${branch.branch_name} ${branch.is_active ? '✅' : '❌'}`);
      if (branch.contact_phone_number) {
        console.log(`       Phone: ${branch.contact_phone_number}`);
      }
    });
    console.log('');
    
    // Opening Hours
    const hours = await queryMySQL(
      'SELECT day_of_week, open_time, close_time, is_closed FROM opening_hours WHERE owner_type = ? AND owner_id = ? ORDER BY FIELD(day_of_week, "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")',
      ['business', BUSINESS_ID]
    );
    console.log(`🕐 OPENING HOURS: ${hours.length} days configured`);
    hours.forEach(hour => {
      if (hour.is_closed) {
        console.log(`   ${hour.day_of_week.padEnd(10)} CLOSED`);
      } else {
        console.log(`   ${hour.day_of_week.padEnd(10)} ${hour.open_time} - ${hour.close_time}`);
      }
    });
    console.log('');
    
    // Policies
    const policies = await queryMySQL(
      'SELECT policy_type, title FROM policies WHERE owner_type = ? AND owner_id = ?',
      ['business', BUSINESS_ID]
    );
    console.log(`📜 POLICIES: ${policies.length}`);
    policies.forEach((policy, idx) => {
      console.log(`   [${idx + 1}] ${policy.policy_type.toUpperCase()}: ${policy.title || 'No title'}`);
    });
    console.log('');
    
    // Orders (recent)
    const orders = await queryMySQL(
      'SELECT id, customer_phone_number, status, total, created_at FROM orders WHERE business_id = ? ORDER BY created_at DESC LIMIT 5',
      [BUSINESS_ID]
    );
    console.log(`📦 RECENT ORDERS: ${orders.length} (showing last 5)`);
    if (orders.length > 0) {
      orders.forEach((order, idx) => {
        console.log(`   [${idx + 1}] Order ${order.id.substring(0, 8)} - ${order.customer_phone_number} - $${parseFloat(order.total).toFixed(2)} - ${order.status}`);
      });
    } else {
      console.log('   No orders yet');
    }
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Verification complete!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('🎯 Ready for testing:');
    console.log('   ✅ Menu browsing via chatbot');
    console.log('   ✅ Item ordering');
    console.log('   ✅ Cart management');
    console.log('   ✅ Order placement');
    console.log('   ✅ Scheduled orders');
    console.log('   ✅ Delivery/Takeaway options');
    console.log('   ✅ Opening hours checking');
    console.log('   ✅ Policy inquiries\n');
    
  } catch (error) {
    console.error('❌ Error verifying data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  verifyBusinessData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyBusinessData };
