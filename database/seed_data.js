// Seed Database with Sample Data
// Creates business profiles, branches, menus, items, and sample orders

require('dotenv').config();
const { queryMySQL, getMySQLConnection } = require('../src/config/database');
const { generateUUID } = require('../src/utils/uuid');
const bcrypt = require('bcryptjs');

// Sample business data
const businesses = [
  {
    email: 'burgerking@example.com',
    password: 'password123',
    businessName: 'Burger King',
    businessType: 'food and beverage',
    contactPhoneNumber: '+9611234567',
    subscriptionType: 'premium',
    branches: [
      {
        name: 'Burger King - Hamra',
        city: 'Beirut',
        street: 'Hamra Street',
        building: 'Building 123',
        latitude: 33.8938,
        longitude: 35.5018,
        phone: '+9611234568'
      },
      {
        name: 'Burger King - Downtown',
        city: 'Beirut',
        street: 'Downtown',
        building: 'Building 456',
        latitude: 33.8969,
        longitude: 35.5008,
        phone: '+9611234569'
      }
    ]
  },
  {
    email: 'pizzahut@example.com',
    password: 'password123',
    businessName: 'Pizza Hut',
    businessType: 'food and beverage',
    contactPhoneNumber: '+9612345678',
    subscriptionType: 'premium',
    branches: [
      {
        name: 'Pizza Hut - Verdun',
        city: 'Beirut',
        street: 'Verdun Street',
        building: 'Building 789',
        latitude: 33.8886,
        longitude: 35.4954,
        phone: '+9612345679'
      }
    ]
  },
  {
    email: 'sportscourt@example.com',
    password: 'password123',
    businessName: 'Elite Sports Court',
    businessType: 'sports',
    contactPhoneNumber: '+9613456789',
    subscriptionType: 'standard',
    branches: [
      {
        name: 'Elite Sports - Main Court',
        city: 'Beirut',
        street: 'Sports Avenue',
        building: 'Court Complex',
        latitude: 33.8543,
        longitude: 35.5013,
        phone: '+9613456790'
      }
    ]
  },
  {
    email: 'hairsalon@example.com',
    password: 'password123',
    businessName: 'Glamour Hair Salon',
    businessType: 'salons',
    contactPhoneNumber: '+9614567890',
    subscriptionType: 'standard',
    branches: [
      {
        name: 'Glamour Salon - Main Branch',
        city: 'Beirut',
        street: 'Fashion Street',
        building: 'Salon Building',
        latitude: 33.8938,
        longitude: 35.5018,
        phone: '+9614567891'
      }
    ]
  },
  {
    email: 'cafedelmar@example.com',
    password: 'password123',
    businessName: 'Café Del Mar',
    businessType: 'food and beverage',
    contactPhoneNumber: '+9615678901',
    subscriptionType: 'premium',
    branches: [
      {
        name: 'Café Del Mar - Seaside',
        city: 'Beirut',
        street: 'Seaside Promenade',
        building: 'Beach Building',
        latitude: 33.9025,
        longitude: 35.4822,
        phone: '+9615678902'
      },
      {
        name: 'Café Del Mar - Downtown',
        city: 'Beirut',
        street: 'Downtown Square',
        building: 'Plaza Building',
        latitude: 33.8969,
        longitude: 35.5008,
        phone: '+9615678903'
      }
    ]
  }
];

// Menu items for restaurants
const restaurantItems = [
  { name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, special sauce', price: 12.99, cost: 5.00, prepTime: 15 },
  { name: 'Cheese Burger', description: 'Beef patty, cheese, pickles, onions', price: 14.99, cost: 6.00, prepTime: 15 },
  { name: 'Bacon Burger', description: 'Beef patty, bacon, cheese, BBQ sauce', price: 16.99, cost: 7.00, prepTime: 18 },
  { name: 'Chicken Burger', description: 'Grilled chicken, lettuce, mayo', price: 13.99, cost: 5.50, prepTime: 12 },
  { name: 'French Fries', description: 'Crispy golden fries', price: 4.99, cost: 1.50, prepTime: 8 },
  { name: 'Onion Rings', description: 'Battered onion rings', price: 5.99, cost: 2.00, prepTime: 10 },
  { name: 'Soft Drink', description: 'Coca Cola, Pepsi, or Sprite', price: 2.99, cost: 0.50, prepTime: 1 },
  { name: 'Milkshake', description: 'Vanilla, chocolate, or strawberry', price: 6.99, cost: 2.50, prepTime: 5 },
  { name: 'Margherita Pizza', description: 'Tomato sauce, mozzarella, basil', price: 18.99, cost: 7.00, prepTime: 20 },
  { name: 'Pepperoni Pizza', description: 'Tomato sauce, mozzarella, pepperoni', price: 21.99, cost: 8.00, prepTime: 20 },
  { name: 'Hawaiian Pizza', description: 'Tomato sauce, mozzarella, ham, pineapple', price: 22.99, cost: 8.50, prepTime: 22 },
  { name: 'Caesar Salad', description: 'Romaine lettuce, croutons, parmesan, caesar dressing', price: 11.99, cost: 4.00, prepTime: 10 },
  { name: 'Cappuccino', description: 'Espresso with steamed milk foam', price: 4.99, cost: 1.50, prepTime: 5 },
  { name: 'Latte', description: 'Espresso with steamed milk', price: 5.99, cost: 1.80, prepTime: 5 },
  { name: 'Espresso', description: 'Strong Italian coffee', price: 3.99, cost: 1.00, prepTime: 3 },
  { name: 'Croissant', description: 'Buttery French pastry', price: 3.99, cost: 1.20, prepTime: 2 },
  { name: 'Chocolate Cake', description: 'Rich chocolate layer cake', price: 7.99, cost: 3.00, prepTime: 2 }
];

// Menu items for sports court
const sportsCourtItems = [
  { name: 'Football Field - 1 Hour', description: 'Rent football field for 1 hour', price: 50.00, cost: 10.00, prepTime: 0 },
  { name: 'Basketball Court - 1 Hour', description: 'Rent basketball court for 1 hour', price: 40.00, cost: 8.00, prepTime: 0 },
  { name: 'Tennis Court - 1 Hour', description: 'Rent tennis court for 1 hour', price: 45.00, cost: 9.00, prepTime: 0 },
  { name: 'Equipment Rental', description: 'Sports equipment rental', price: 15.00, cost: 5.00, prepTime: 0 }
];

// Menu items for salon
const salonItems = [
  { name: 'Haircut - Men', description: 'Professional men\'s haircut', price: 25.00, cost: 8.00, prepTime: 30 },
  { name: 'Haircut - Women', description: 'Professional women\'s haircut', price: 35.00, cost: 12.00, prepTime: 45 },
  { name: 'Hair Color', description: 'Full hair coloring service', price: 80.00, cost: 30.00, prepTime: 120 },
  { name: 'Hair Styling', description: 'Professional hair styling', price: 40.00, cost: 15.00, prepTime: 60 },
  { name: 'Beard Trim', description: 'Professional beard trimming', price: 15.00, cost: 5.00, prepTime: 20 }
];

async function seedDatabase() {
  const connection = await getMySQLConnection();
  
  try {
    console.log('🌱 Starting database seeding...\n');
    
    await connection.beginTransaction();
    
    const createdBusinesses = [];
    
    // Create businesses
    for (const businessData of businesses) {
      console.log(`Creating business: ${businessData.businessName}...`);
      
      const businessId = generateUUID();
      const hashedPassword = await bcrypt.hash(businessData.password, 10);
      
      // Create location for business
      const locationId = generateUUID();
      await connection.query(`
        INSERT INTO locations (id, city, street, building, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [locationId, businessData.branches[0].city, businessData.branches[0].street, businessData.branches[0].building]);
      
      // Create business user
      await connection.query(`
        INSERT INTO users (
          id, user_type, user_role, parent_user_id, email, contact_phone_number, is_active,
          business_name, business_type, default_language, timezone,
          subscription_type, subscription_price, subscription_status,
          allow_scheduled_orders, allow_delivery, allow_takeaway, allow_on_site,
          location_id, password_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        businessId,
        'business',
        'business',
        null,
        businessData.email,
        businessData.contactPhoneNumber,
        true,
        businessData.businessName,
        businessData.businessType,
        'arabic',
        'Asia/Beirut',
        businessData.subscriptionType,
        businessData.subscriptionType === 'premium' ? 99.99 : 0,
        'active',
        true,
        true,
        true,
        true,
        locationId,
        hashedPassword
      ]);
      
      console.log(`  ✓ Created business: ${businessData.businessName} (${businessId})`);
      
      // Create branches as users
      const createdBranches = [];
      for (const branchData of businessData.branches) {
        const branchUserId = generateUUID();
        const branchPassword = await bcrypt.hash('password123', 10);
        const branchLocationId = generateUUID();
        
        // Create location for branch
        await connection.query(`
          INSERT INTO locations (id, city, street, building, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [branchLocationId, branchData.city, branchData.street, branchData.building]);
        
        // Create branch as user
        await connection.query(`
          INSERT INTO users (
            id, user_type, user_role, parent_user_id, email, contact_phone_number, is_active,
            business_name, business_type, default_language, timezone,
            subscription_type, subscription_price, subscription_status,
            allow_scheduled_orders, allow_delivery, allow_takeaway, allow_on_site,
            location_id, password_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          branchUserId,
          'branch',
          'branch',
          businessId,
          `branch_${branchUserId.substring(0, 8)}@${businessData.email.split('@')[1]}`,
          branchData.phone,
          true,
          branchData.name,
          businessData.businessType,
          'arabic',
          'Asia/Beirut',
          'standard',
          0,
          'active',
          true,
          true,
          true,
          true,
          branchLocationId,
          branchPassword
        ]);
        
        createdBranches.push({ id: branchUserId, ...branchData });
        console.log(`  ✓ Created branch user: ${branchData.name} (${branchUserId})`);
      }
      
      // Create menu
      const menuId = generateUUID();
      await connection.query(`
        INSERT INTO menus (
          id, business_id, name, description, is_shared, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        menuId,
        businessId,
        `${businessData.businessName} Main Menu`,
        `Main menu for ${businessData.businessName}`,
        true,
        true
      ]);
      
      console.log(`  ✓ Created menu: ${businessData.businessName} Main Menu`);
      
      // Note: branch_menus table removed - menus are shared via business_id
      
      // Create items based on business type
      let itemsToCreate = [];
      if (businessData.businessType === 'food and beverage') {
        if (businessData.businessName.includes('Burger') || businessData.businessName.includes('Pizza')) {
          itemsToCreate = restaurantItems.filter(item => 
            businessData.businessName.includes('Burger') ? 
              !item.name.includes('Pizza') : 
              item.name.includes('Pizza') || item.name.includes('Salad')
          );
        } else {
          itemsToCreate = restaurantItems.filter(item => 
            item.name.includes('Coffee') || item.name.includes('Cappuccino') || 
            item.name.includes('Latte') || item.name.includes('Espresso') ||
            item.name.includes('Croissant') || item.name.includes('Cake')
          );
        }
      } else if (businessData.businessType === 'sports') {
        itemsToCreate = sportsCourtItems;
      } else if (businessData.businessType === 'salons') {
        itemsToCreate = salonItems;
      }
      
      // Use first branch or business itself for user_id
      const targetUserId = createdBranches.length > 0 ? createdBranches[0].id : businessId;
      
      for (const itemData of itemsToCreate) {
        const itemId = generateUUID();
        // For food and beverage: use preparation_time_minutes, for others: use duration_minutes
        const isFoodAndBeverage = businessData.businessType === 'food and beverage';
        
        await connection.query(`
          INSERT INTO items (
            id, business_id, menu_id, user_id, name, description, ingredients, price, cost,
            preparation_time_minutes, duration_minutes, availability, 
            times_ordered, times_delivered, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          itemId,
          businessId,
          menuId,
          targetUserId,
          itemData.name,
          itemData.description,
          itemData.description, // Use description as ingredients for now
          itemData.price,
          itemData.cost,
          isFoodAndBeverage ? itemData.prepTime : null,
          !isFoodAndBeverage ? itemData.prepTime : null,
          'available',
          0, // times_ordered starts at 0
          0  // times_delivered starts at 0
        ]);
        console.log(`  ✓ Created item: ${itemData.name} ($${itemData.price})`);
      }
      
      // Create opening hours for business
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of days) {
        const hoursId = generateUUID();
        if (day === 'friday') {
          // Closed on Friday
          await connection.query(`
            INSERT INTO opening_hours (id, owner_type, owner_id, day_of_week, is_closed, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
          `, [hoursId, 'business', businessId, day, true]);
        } else {
          // Open 9 AM to 10 PM
          await connection.query(`
            INSERT INTO opening_hours (id, owner_type, owner_id, day_of_week, open_time, close_time, is_closed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          `, [hoursId, 'business', businessId, day, '09:00:00', '22:00:00', false]);
        }
      }
      console.log(`  ✓ Created opening hours`);
      
      // Create policies
      const policies = [
        {
          type: 'delivery',
          title: 'Delivery Policy',
          description: 'Free delivery for orders over $30. Delivery fee of $5 for orders under $30.'
        },
        {
          type: 'cancellation',
          title: 'Cancellation Policy',
          description: 'Orders can be cancelled within 10 minutes of placement. No refunds after preparation starts.'
        },
        {
          type: 'refund',
          title: 'Refund Policy',
          description: 'Full refund available for incorrect orders. Partial refund for quality issues.'
        }
      ];
      
      for (const policyData of policies) {
        const policyId = generateUUID();
        await connection.query(`
          INSERT INTO policies (id, owner_type, owner_id, policy_type, title, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [policyId, 'business', businessId, policyData.type, policyData.title, policyData.description]);
      }
      console.log(`  ✓ Created policies`);
      
      createdBusinesses.push({
        id: businessId,
        name: businessData.businessName,
        branches: createdBranches
      });
      
      console.log('');
    }
    
    // Create some sample orders
    console.log('Creating sample orders...');
    for (let i = 0; i < createdBusinesses.length; i++) {
      const business = createdBusinesses[i];
      if (business.branches.length === 0) continue;
      
      const branch = business.branches[0];
      
      // Get items for this business
      const [items] = await connection.query(`
        SELECT id, name, price FROM items WHERE business_id = ? LIMIT 3
      `, [business.id]);
      
      if (items.length === 0) continue;
      
      // Create 2-3 sample orders per business
      const numOrders = Math.floor(Math.random() * 2) + 2;
      for (let j = 0; j < numOrders; j++) {
        const orderId = generateUUID();
        const customerPhone = `+961${Math.floor(Math.random() * 9000000) + 1000000}`;
        const customerName = `Customer ${Math.floor(Math.random() * 1000)}`;
        
        // Select random items
        const selectedItems = items.slice(0, Math.min(items.length, Math.floor(Math.random() * 3) + 1));
        let subtotal = 0;
        
        // Use new statuses: accepted, ongoing, completed (no pending, preparing)
        // For scheduled orders: accepted -> ongoing -> completed, for non-scheduled: accepted -> completed
        const hasScheduled = Math.random() > 0.7;
        const orderStatuses = hasScheduled 
          ? ['accepted', 'ongoing', 'completed']
          : ['accepted', 'completed'];
        const orderStatus = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
        
        // Use user_id (branch user ID) instead of branch_id
        const userId = branch.id;
        
        // Create order
        await connection.query(`
          INSERT INTO orders (
            id, business_id, user_id, customer_phone_number, customer_name,
            status, subtotal, delivery_price, total, delivery_type,
            payment_method, payment_status, language_used, order_source, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          orderId,
          business.id,
          userId,
          customerPhone,
          customerName,
          orderStatus,
          0, // Will update after items
          0,
          0, // Will update after items
          ['takeaway', 'delivery', 'on_site'][Math.floor(Math.random() * 3)],
          ['cash', 'card'][Math.floor(Math.random() * 2)],
          orderStatus === 'completed' ? 'paid' : 'unpaid',
          ['arabic', 'english'][Math.floor(Math.random() * 2)],
          'whatsapp'
        ]);
        
        // Create order items and increment times_ordered
        for (const item of selectedItems) {
          const quantity = Math.floor(Math.random() * 3) + 1;
          const orderItemId = generateUUID();
          await connection.query(`
            INSERT INTO order_items (
              id, order_id, item_id, quantity, price_at_time, name_at_time
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [orderItemId, orderId, item.id, quantity, item.price, item.name]);
          subtotal += item.price * quantity;
          
          // Increment times_ordered
          await connection.query(`
            UPDATE items SET times_ordered = times_ordered + ? WHERE id = ?
          `, [quantity, item.id]);
          
          // If order is completed, increment times_delivered
          if (orderStatus === 'completed') {
            await connection.query(`
              UPDATE items SET times_delivered = times_delivered + ? WHERE id = ?
            `, [quantity, item.id]);
          }
        }
        
        // Update order totals
        const deliveryPrice = Math.random() > 0.5 ? 5.00 : 0;
        const total = subtotal + deliveryPrice;
        await connection.query(`
          UPDATE orders SET subtotal = ?, delivery_price = ?, total = ?, completed_at = ? WHERE id = ?
        `, [
          subtotal, 
          deliveryPrice, 
          total, 
          orderStatus === 'completed' ? new Date() : null, 
          orderId
        ]);
        
        // Create status history with proper flow
        const statusTimeline = [];
        if (orderStatus === 'completed') {
          if (hasScheduled) {
            statusTimeline.push({ status: 'accepted', time: new Date(Date.now() - 2 * 60 * 60 * 1000) });
            statusTimeline.push({ status: 'ongoing', time: new Date(Date.now() - 1 * 60 * 60 * 1000) });
            statusTimeline.push({ status: 'completed', time: new Date() });
          } else {
            statusTimeline.push({ status: 'accepted', time: new Date(Date.now() - 1 * 60 * 60 * 1000) });
            statusTimeline.push({ status: 'completed', time: new Date() });
          }
        } else if (orderStatus === 'ongoing') {
          statusTimeline.push({ status: 'accepted', time: new Date(Date.now() - 30 * 60 * 1000) });
          statusTimeline.push({ status: 'ongoing', time: new Date() });
        } else {
          statusTimeline.push({ status: 'accepted', time: new Date() });
        }
        
        for (const statusEntry of statusTimeline) {
          const statusHistoryId = generateUUID();
          await connection.query(`
            INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
            VALUES (?, ?, ?, ?, ?)
          `, [statusHistoryId, orderId, statusEntry.status, 'system', statusEntry.time]);
        }
        
        console.log(`  ✓ Created order #${j + 1} for ${business.name} - Status: ${orderStatus} - Total: $${total.toFixed(2)}`);
      }
    }
    
    // Create sample tables for F&B businesses
    console.log('\nCreating sample tables for F&B businesses...');
    for (const business of createdBusinesses) {
      const businessData = businesses.find(b => b.businessName === business.name);
      if (businessData && businessData.businessType === 'food and beverage') {
        // Get first branch user for this business
        const [branches] = await connection.query(`
          SELECT id FROM users WHERE parent_user_id = ? AND user_role = 'branch' LIMIT 1
        `, [business.id]);
        
        if (branches.length > 0) {
          const branchUserId = branches[0].id;
          // Create 5-10 tables per F&B branch
          const numTables = Math.floor(Math.random() * 6) + 5;
          for (let t = 1; t <= numTables; t++) {
            const tableId = generateUUID();
            await connection.query(`
              INSERT INTO tables (id, user_id, seats, number, reserved, created_at)
              VALUES (?, ?, ?, ?, ?, NOW())
            `, [
              tableId,
              branchUserId,
              Math.floor(Math.random() * 6) + 2, // 2-8 seats
              `T${t}`,
              false
            ]);
          }
          console.log(`  ✓ Created ${numTables} tables for ${business.name}`);
        }
      }
    }
    
    // Create sample reservations
    console.log('\nCreating sample reservations...');
    for (const business of createdBusinesses) {
      // Get branches for this business
      const [branches] = await connection.query(`
        SELECT id FROM users WHERE parent_user_id = ? AND user_role = 'branch'
      `, [business.id]);
      
      if (branches.length === 0) continue;
      
      const branchUserId = branches[0].id;
      const businessData = businesses.find(b => b.businessName === business.name);
      
      // Get tables if F&B business
      let tables = [];
      if (businessData && businessData.businessType === 'food and beverage') {
        const [tablesResult] = await connection.query(`
          SELECT id FROM tables WHERE user_id = ? LIMIT 3
        `, [branchUserId]);
        tables = tablesResult;
      }
      
      // Create 2-4 reservations
      const numReservations = Math.floor(Math.random() * 3) + 2;
      for (let r = 0; r < numReservations; r++) {
        const reservationId = generateUUID();
        const reservationDate = new Date();
        reservationDate.setDate(reservationDate.getDate() + Math.floor(Math.random() * 7)); // Next 7 days
        const reservationTime = `${String(Math.floor(Math.random() * 10) + 10).padStart(2, '0')}:${String(Math.floor(Math.random() * 4) * 15).padStart(2, '0')}`;
        
        await connection.query(`
          INSERT INTO reservations (
            id, business_user_id, table_id, customer_phone_number, customer_name,
            reservation_date, reservation_time, number_of_guests, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          reservationId,
          branchUserId,
          tables.length > 0 && Math.random() > 0.3 ? tables[Math.floor(Math.random() * tables.length)].id : null,
          `+961${Math.floor(Math.random() * 9000000) + 1000000}`,
          `Guest ${Math.floor(Math.random() * 1000)}`,
          reservationDate.toISOString().split('T')[0],
          reservationTime,
          Math.floor(Math.random() * 6) + 2,
          'confirmed'
        ]);
        
        // If table assigned, mark as reserved
        if (tables.length > 0 && Math.random() > 0.3) {
          const selectedTable = tables[Math.floor(Math.random() * tables.length)];
          await connection.query(`
            UPDATE tables SET reserved = true WHERE id = ?
          `, [selectedTable.id]);
        }
      }
      console.log(`  ✓ Created ${numReservations} reservations for ${business.name}`);
    }
    
    await connection.commit();
    console.log('\n✅ Database seeding completed successfully!');
    console.log(`\nCreated:`);
    console.log(`  - ${businesses.length} businesses`);
    console.log(`  - ${businesses.reduce((sum, b) => sum + b.branches.length, 0)} branch users`);
    console.log(`  - ${businesses.length} menus`);
    console.log(`  - Multiple items per business`);
    console.log(`  - Opening hours for all businesses`);
    console.log(`  - Policies for all businesses`);
    console.log(`  - Sample orders (with new status flow)`);
    console.log(`  - Sample tables (for F&B businesses)`);
    console.log(`  - Sample reservations`);
    console.log(`\n📧 Login credentials (all use password: password123):`);
    businesses.forEach(b => {
      console.log(`  - ${b.email}`);
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('\n✨ Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
