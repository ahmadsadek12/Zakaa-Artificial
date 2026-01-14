// Setup Test Business with Menu Items for Twilio Testing
require('dotenv').config();
const { getMySQLConnection } = require('../src/config/database');
const { generateUUID } = require('../src/utils/uuid');

const TEST_BUSINESS_ID = 'ae2796e3-698e-4c98-ad21-99517b96c18e';
const TWILIO_NUMBER = '+14155238886';

// Sample menu items for testing
const testItems = [
  { name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, special sauce', price: 12.99, prepTime: 15 },
  { name: 'Cheese Burger', description: 'Beef patty, cheese, pickles, onions', price: 14.99, prepTime: 15 },
  { name: 'Chicken Burger', description: 'Grilled chicken, lettuce, mayo', price: 13.99, prepTime: 12 },
  { name: 'French Fries', description: 'Crispy golden fries', price: 4.99, prepTime: 8 },
  { name: 'Onion Rings', description: 'Battered onion rings', price: 5.99, prepTime: 10 },
  { name: 'Soft Drink', description: 'Coca Cola, Pepsi, or Sprite', price: 2.99, prepTime: 1 },
  { name: 'Milkshake', description: 'Vanilla, chocolate, or strawberry', price: 6.99, prepTime: 5 },
  { name: 'Caesar Salad', description: 'Romaine lettuce, croutons, parmesan, caesar dressing', price: 11.99, prepTime: 10 }
];

async function setupTestBusinessItems() {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🔧 Setting up test business items...\n');
    console.log(`Business ID: ${TEST_BUSINESS_ID}`);
    console.log(`Twilio Number: ${TWILIO_NUMBER}\n`);
    
    // Check if business exists
    const [businesses] = await connection.query(
      'SELECT id, email, business_name, whatsapp_phone_number_id FROM users WHERE id = ? AND deleted_at IS NULL',
      [TEST_BUSINESS_ID]
    );
    
    if (businesses.length === 0) {
      throw new Error(`Business with ID ${TEST_BUSINESS_ID} not found!`);
    }
    
    const business = businesses[0];
    console.log(`✅ Found business: ${business.business_name} (${business.email})`);
    console.log(`   WhatsApp: ${business.whatsapp_phone_number_id || 'Not set'}\n`);
    
    // Check existing items
    const [existingItems] = await connection.query(
      'SELECT id, name, price FROM items WHERE business_id = ? AND deleted_at IS NULL',
      [TEST_BUSINESS_ID]
    );
    
    console.log(`📋 Found ${existingItems.length} existing items`);
    
    if (existingItems.length > 0) {
      console.log('\nExisting items:');
      existingItems.forEach(item => {
        console.log(`   - ${item.name} ($${item.price})`);
      });
      console.log('');
    }
    
    // Add new items if they don't exist
    let addedCount = 0;
    for (const item of testItems) {
      // Check if item already exists
      const [existing] = await connection.query(
        'SELECT id FROM items WHERE business_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL',
        [TEST_BUSINESS_ID, item.name]
      );
      
      if (existing.length === 0) {
        const itemId = generateUUID();
        await connection.query(`
          INSERT INTO items (
            id, business_id, name, description, price, 
            preparation_time_minutes, availability, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'available', NOW())
        `, [
          itemId,
          TEST_BUSINESS_ID,
          item.name,
          item.description,
          item.price,
          item.prepTime
        ]);
        
        console.log(`   ✅ Added: ${item.name} - $${item.price}`);
        addedCount++;
      } else {
        console.log(`   ⏭️  Skipped (exists): ${item.name}`);
      }
    }
    
    await connection.commit();
    
    console.log(`\n✨ Setup complete! Added ${addedCount} new items.\n`);
    
    // List all items
    const [allItems] = await connection.query(
      'SELECT name, price, availability FROM items WHERE business_id = ? AND deleted_at IS NULL ORDER BY name',
      [TEST_BUSINESS_ID]
    );
    
    console.log('📋 All available items:');
    console.log('─'.repeat(60));
    allItems.forEach(item => {
      const status = item.availability === 'available' ? '✅' : '❌';
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      console.log(`${status} ${item.name.padEnd(30)} $${price.toFixed(2)}`);
    });
    console.log('─'.repeat(60));
    console.log(`\nTotal: ${allItems.length} items\n`);
    
    console.log('🚀 Ready for testing!');
    console.log(`   Webhook URL: http://localhost:3000/webhook/whatsapp`);
    console.log(`   (Use ngrok for public access: ngrok http 3000)\n`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error setting up test items:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if executed directly
if (require.main === module) {
  setupTestBusinessItems()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

module.exports = { setupTestBusinessItems };
