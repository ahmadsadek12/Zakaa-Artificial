// Complete Business Setup - Fill everything for testing
require('dotenv').config();
const { getMySQLConnection } = require('../src/config/database');
const { generateUUID } = require('../src/utils/uuid');

const BUSINESS_ID = 'ae2796e3-698e-4c98-ad21-99517b96c18e';

// Comprehensive menu items
const menuItems = [
  // Burgers & Sandwiches
  { name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, special sauce', price: 12.99, cost: 5.00, prepTime: 15, category: 'Burgers' },
  { name: 'Cheese Burger', description: 'Beef patty, cheese, pickles, onions', price: 14.99, cost: 6.00, prepTime: 15, category: 'Burgers' },
  { name: 'Bacon Burger', description: 'Beef patty, bacon, cheese, BBQ sauce', price: 16.99, cost: 7.00, prepTime: 18, category: 'Burgers' },
  { name: 'Chicken Burger', description: 'Grilled chicken, lettuce, mayo', price: 13.99, cost: 5.50, prepTime: 12, category: 'Burgers' },
  { name: 'Veggie Burger', description: 'Vegetarian patty, avocado, sprouts', price: 11.99, cost: 4.50, prepTime: 10, category: 'Burgers' },
  
  // Sides
  { name: 'French Fries', description: 'Crispy golden fries', price: 4.99, cost: 1.50, prepTime: 8, category: 'Sides' },
  { name: 'Onion Rings', description: 'Battered onion rings', price: 5.99, cost: 2.00, prepTime: 10, category: 'Sides' },
  { name: 'Sweet Potato Fries', description: 'Crispy sweet potato fries', price: 5.99, cost: 2.20, prepTime: 10, category: 'Sides' },
  { name: 'Nachos', description: 'Tortilla chips with cheese and jalapeños', price: 8.99, cost: 3.50, prepTime: 12, category: 'Sides' },
  
  // Salads
  { name: 'Caesar Salad', description: 'Romaine lettuce, croutons, parmesan, caesar dressing', price: 11.99, cost: 4.00, prepTime: 10, category: 'Salads' },
  { name: 'Greek Salad', description: 'Mixed greens, feta, olives, tomatoes, cucumber', price: 12.99, cost: 4.50, prepTime: 10, category: 'Salads' },
  { name: 'Garden Salad', description: 'Fresh mixed vegetables with house dressing', price: 9.99, cost: 3.50, prepTime: 8, category: 'Salads' },
  
  // Beverages
  { name: 'Soft Drink', description: 'Coca Cola, Pepsi, or Sprite (500ml)', price: 2.99, cost: 0.50, prepTime: 1, category: 'Beverages' },
  { name: 'Fresh Juice', description: 'Orange, Apple, or Mango juice', price: 4.99, cost: 1.50, prepTime: 3, category: 'Beverages' },
  { name: 'Milkshake', description: 'Vanilla, chocolate, or strawberry', price: 6.99, cost: 2.50, prepTime: 5, category: 'Beverages' },
  { name: 'Bottled Water', description: '500ml bottled water', price: 1.99, cost: 0.30, prepTime: 1, category: 'Beverages' },
  { name: 'Hot Tea', description: 'Black tea, Green tea, or Herbal tea', price: 2.99, cost: 0.50, prepTime: 2, category: 'Beverages' },
  { name: 'Coffee', description: 'Espresso, Americano, or Cappuccino', price: 3.99, cost: 1.00, prepTime: 3, category: 'Beverages' },
  
  // Desserts
  { name: 'Chocolate Cake', description: 'Rich chocolate layer cake', price: 7.99, cost: 3.00, prepTime: 2, category: 'Desserts' },
  { name: 'Cheesecake', description: 'New York style cheesecake', price: 8.99, cost: 3.50, prepTime: 2, category: 'Desserts' },
  { name: 'Ice Cream', description: 'Vanilla, Chocolate, or Strawberry (2 scoops)', price: 5.99, cost: 2.00, prepTime: 2, category: 'Desserts' },
  { name: 'Apple Pie', description: 'Warm apple pie with cinnamon', price: 6.99, cost: 2.50, prepTime: 3, category: 'Desserts' },
  
  // Specials
  { name: 'Daily Special', description: 'Chef\'s special of the day', price: 15.99, cost: 6.50, prepTime: 20, category: 'Specials' },
  { name: 'Combo Meal', description: 'Burger, fries, and soft drink', price: 18.99, cost: 8.00, prepTime: 18, category: 'Specials' },
];

// Opening hours for all days
const openingHours = [
  { day: 'monday', open: '09:00', close: '22:00', closed: false },
  { day: 'tuesday', open: '09:00', close: '22:00', closed: false },
  { day: 'wednesday', open: '09:00', close: '22:00', closed: false },
  { day: 'thursday', open: '09:00', close: '22:00', closed: false },
  { day: 'friday', open: '09:00', close: '23:00', closed: false },
  { day: 'saturday', open: '10:00', close: '23:00', closed: false },
  { day: 'sunday', open: '10:00', close: '21:00', closed: false },
];

// Business policies
const policies = [
  {
    type: 'delivery',
    title: 'Delivery Policy',
    description: 'Free delivery for orders above $25. Delivery fee of $3 for orders below $25. Delivery time: 30-45 minutes.'
  },
  {
    type: 'refund',
    title: 'Refund Policy',
    description: 'Full refund for cancelled orders within 10 minutes of placement. After 10 minutes, store credit will be provided for cancellations.'
  },
  {
    type: 'cancellation',
    title: 'Cancellation Policy',
    description: 'Orders can be cancelled within 10 minutes of placement for a full refund. After that, cancellation is subject to store policy.'
  },
  {
    type: 'custom',
    title: 'Minimum Order',
    description: 'Minimum order value: $10 for delivery and $5 for takeaway.'
  }
];

async function completeBusinessSetup() {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🚀 Starting complete business setup...\n');
    console.log(`Business ID: ${BUSINESS_ID}\n`);
    
    // 1. Verify business exists
    const [businesses] = await connection.query(
      'SELECT id, email, business_name, business_type FROM users WHERE id = ? AND deleted_at IS NULL',
      [BUSINESS_ID]
    );
    
    if (businesses.length === 0) {
      throw new Error(`Business with ID ${BUSINESS_ID} not found!`);
    }
    
    const business = businesses[0];
    console.log(`✅ Found business: ${business.business_name} (${business.email})`);
    console.log(`   Type: ${business.business_type}\n`);
    
    // 2. Create menus
    console.log('📋 Creating menus...');
    const mainMenuId = generateUUID();
    await connection.query(`
      INSERT INTO menus (id, business_id, name, description, is_shared, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [mainMenuId, BUSINESS_ID, 'Main Menu', 'Our complete selection of delicious items', true, true]);
    console.log(`   ✅ Created: Main Menu (${mainMenuId.substring(0, 8)})`);
    
    const lunchMenuId = generateUUID();
    await connection.query(`
      INSERT INTO menus (id, business_id, name, description, is_shared, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [lunchMenuId, BUSINESS_ID, 'Lunch Specials', 'Quick lunch options available 11 AM - 3 PM', false, true]);
    console.log(`   ✅ Created: Lunch Specials (${lunchMenuId.substring(0, 8)})`);
    
    // 3. Create items
    console.log('\n🍔 Creating menu items...');
    let itemsCreated = 0;
    const createdItems = [];
    
    for (const item of menuItems) {
      const itemId = generateUUID();
      
      // Assign items to main menu, specials to lunch menu
      const menuId = item.category === 'Specials' ? lunchMenuId : mainMenuId;
      
      await connection.query(`
        INSERT INTO items (
          id, business_id, menu_id, name, description, price, cost,
          preparation_time_minutes, availability, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', NOW())
      `, [
        itemId,
        BUSINESS_ID,
        menuId,
        item.name,
        item.description,
        item.price,
        item.cost,
        item.prepTime
      ]);
      
      createdItems.push({ id: itemId, name: item.name, category: item.category });
      itemsCreated++;
    }
    
    console.log(`   ✅ Created ${itemsCreated} items`);
    console.log(`   Categories: ${[...new Set(menuItems.map(i => i.category))].join(', ')}\n`);
    
    // 4. Create a branch for testing
    console.log('🏢 Creating branch...');
    const branchId = generateUUID();
    const branchLocationId = generateUUID();
    
    // Create branch location
    await connection.query(`
      INSERT INTO locations (id, city, street, building, floor, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [branchLocationId, 'Beirut', 'Hamra Street', 'Building 123', 'Ground Floor']);
    
    // Create branch in branches table (for compatibility)
    await connection.query(`
      INSERT INTO branches (id, business_id, branch_name, address, latitude, longitude, contact_phone_number, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      branchId,
      BUSINESS_ID,
      'Test Restaurant - Main Branch',
      'Hamra Street, Building 123, Beirut',
      33.8938,
      35.5018,
      '+9611234567',
      true
    ]);
    
    console.log(`   ✅ Created branch: Main Branch (${branchId.substring(0, 8)})\n`);
    
    // 5. Create opening hours
    console.log('🕐 Setting up opening hours...');
    let hoursCreated = 0;
    
    for (const hour of openingHours) {
      const hourId = generateUUID();
      await connection.query(`
        INSERT INTO opening_hours (
          id, owner_type, owner_id, day_of_week, open_time, close_time, is_closed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        hourId,
        'business',
        BUSINESS_ID,
        hour.day,
        hour.closed ? null : hour.open,
        hour.closed ? null : hour.close,
        hour.closed
      ]);
      hoursCreated++;
    }
    
    console.log(`   ✅ Created opening hours for ${hoursCreated} days\n`);
    
    // 6. Create policies
    console.log('📜 Creating policies...');
    let policiesCreated = 0;
    
    for (const policy of policies) {
      const policyId = generateUUID();
      await connection.query(`
        INSERT INTO policies (
          id, owner_type, owner_id, policy_type, title, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        policyId,
        'business',
        BUSINESS_ID,
        policy.type,
        policy.title,
        policy.description
      ]);
      policiesCreated++;
    }
    
    console.log(`   ✅ Created ${policiesCreated} policies\n`);
    
    // 7. Create tables (for on-site dining) - Only if table exists
    console.log('🪑 Creating tables...');
    let tablesCreated = 0;
    
    try {
      // Check if tables table exists
      const [tableCheck] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = 'tables'
      `);
      
      if (tableCheck[0].count > 0) {
        for (let i = 1; i <= 10; i++) {
          const tableId = generateUUID();
          const seats = i <= 5 ? 4 : i <= 8 ? 6 : 8; // Mix of 4, 6, and 8 seat tables
          
          await connection.query(`
            INSERT INTO tables (id, user_id, seats, number, reserved, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
          `, [tableId, BUSINESS_ID, seats, `T${i.toString().padStart(2, '0')}`, false]);
          
          tablesCreated++;
        }
        console.log(`   ✅ Created ${tablesCreated} tables (4-8 seats each)\n`);
      } else {
        console.log(`   ⏭️  Skipped (tables table not found - not needed for this business type)\n`);
      }
    } catch (error) {
      console.log(`   ⏭️  Skipped tables (${error.message})\n`);
    }
    
    await connection.commit();
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✨ SETUP COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 Summary:');
    console.log(`   Business: ${business.business_name}`);
    console.log(`   Menus: 2 (Main Menu, Lunch Specials)`);
    console.log(`   Items: ${itemsCreated}`);
    console.log(`   Branches: 1`);
    console.log(`   Opening Hours: ${hoursCreated} days`);
    console.log(`   Policies: ${policiesCreated}`);
    console.log(`   Tables: ${tablesCreated}`);
    console.log('\n🎯 Ready for full testing!');
    console.log('   - Ordering items');
    console.log('   - Scheduling orders');
    console.log('   - Table reservations');
    console.log('   - Delivery/Takeaway/On-site orders');
    console.log('   - Menu browsing via chatbot\n');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error during setup:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if executed directly
if (require.main === module) {
  completeBusinessSetup()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

module.exports = { completeBusinessSetup };
