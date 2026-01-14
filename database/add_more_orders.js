// Add More Orders and Data to Database
// Creates many orders with different statuses, dates, and variety

require('dotenv').config();
const { queryMySQL, getMySQLConnection } = require('../src/config/database');
const { generateUUID } = require('../src/utils/uuid');

async function addMoreOrders() {
  const connection = await getMySQLConnection();
  
  try {
    console.log('🌱 Adding more orders and data...\n');
    
    await connection.beginTransaction();
    
    // Get all businesses and their branches
    const [businesses] = await connection.query(`
      SELECT u.id, u.business_name, u.business_type
      FROM users u
      WHERE u.user_type = 'business'
    `);
    
    console.log(`Found ${businesses.length} businesses\n`);
    
    // Get all branches with their businesses
    const [branches] = await connection.query(`
      SELECT b.id, b.business_id, b.branch_name, u.business_name
      FROM branches b
      JOIN users u ON b.business_id = u.id
      WHERE b.is_active = true
    `);
    
    // Get all items grouped by business
    const [allItems] = await connection.query(`
      SELECT i.id, i.business_id, i.name, i.price, i.availability
      FROM items i
      WHERE i.availability = 'available'
      ORDER BY i.business_id
    `);
    
    const itemsByBusiness = {};
    allItems.forEach(item => {
      if (!itemsByBusiness[item.business_id]) {
        itemsByBusiness[item.business_id] = [];
      }
      itemsByBusiness[item.business_id].push(item);
    });
    
    // Customer names and phones for variety
    const customerNames = [
      'Ahmed Ali', 'Fatima Hassan', 'Mohammed Khoury', 'Layla Saad', 'Omar Fadel',
      'Nour Ibrahim', 'Khalil Mansour', 'Rania Taha', 'Youssef Nasser', 'Sara Moussa',
      'Tarek Jaber', 'Maya Farah', 'Bassam Rizk', 'Hala Daher', 'Walid Kanaan',
      'Dina Malek', 'Rami Salloum', 'Lina Bazzi', 'Karim Haddad', 'Rana Zein'
    ];
    
    const statuses = ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'];
    const deliveryTypes = ['takeaway', 'delivery', 'on_site'];
    const paymentMethods = ['cash', 'card', 'wallet'];
    const languages = ['arabic', 'arabizi', 'english', 'french'];
    
    let totalOrders = 0;
    
    // Create orders for each business
    for (const business of businesses) {
      const businessBranches = branches.filter(b => b.business_id === business.id);
      const businessItems = itemsByBusiness[business.id] || [];
      
      if (businessBranches.length === 0 || businessItems.length === 0) {
        console.log(`⚠️  Skipping ${business.business_name} - no branches or items`);
        continue;
      }
      
      console.log(`Creating orders for ${business.business_name}...`);
      
      // Create 15-25 orders per business
      const numOrders = Math.floor(Math.random() * 11) + 15;
      
      for (let i = 0; i < numOrders; i++) {
        const orderId = generateUUID();
        const branch = businessBranches[Math.floor(Math.random() * businessBranches.length)];
        
        // Random customer
        const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
        const customerPhone = `+961${Math.floor(Math.random() * 9000000) + 1000000}`;
        
        // Select 1-5 random items
        const numItems = Math.min(businessItems.length, Math.floor(Math.random() * 5) + 1);
        const selectedItems = [];
        const usedIndices = new Set();
        
        for (let j = 0; j < numItems; j++) {
          let idx;
          do {
            idx = Math.floor(Math.random() * businessItems.length);
          } while (usedIndices.has(idx));
          usedIndices.add(idx);
          selectedItems.push(businessItems[idx]);
        }
        
        // Calculate totals
        let subtotal = 0;
        for (const item of selectedItems) {
          const quantity = Math.floor(Math.random() * 3) + 1;
          subtotal += item.price * quantity;
        }
        
        const deliveryPrice = Math.random() > 0.6 ? (Math.random() * 10 + 3).toFixed(2) : 0;
        const total = (parseFloat(subtotal) + parseFloat(deliveryPrice)).toFixed(2);
        
        // Random status (weighted towards completed for analytics)
        const statusWeights = {
          'pending': 0.15,
          'accepted': 0.15,
          'preparing': 0.15,
          'ready': 0.10,
          'completed': 0.40,
          'cancelled': 0.05
        };
        const rand = Math.random();
        let cumulative = 0;
        let orderStatus = 'pending';
        for (const [status, weight] of Object.entries(statusWeights)) {
          cumulative += weight;
          if (rand <= cumulative) {
            orderStatus = status;
            break;
          }
        }
        
        // Random dates (some recent, some older)
        const daysAgo = Math.floor(Math.random() * 30); // Last 30 days
        const hoursAgo = Math.floor(Math.random() * 24);
        const minutesAgo = Math.floor(Math.random() * 60);
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - daysAgo);
        orderDate.setHours(orderDate.getHours() - hoursAgo);
        orderDate.setMinutes(orderDate.getMinutes() - minutesAgo);
        
        const completedDate = orderStatus === 'completed' 
          ? new Date(orderDate.getTime() + (Math.random() * 2 + 0.5) * 60 * 60 * 1000) // 30min to 2.5 hours later
          : null;
        
        // Create order
        await connection.query(`
          INSERT INTO orders (
            id, business_id, branch_id, customer_phone_number, customer_name,
            status, subtotal, delivery_price, total, delivery_type,
            payment_method, payment_status, language_used, order_source,
            created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          business.id,
          branch.id,
          customerPhone,
          customerName,
          orderStatus,
          subtotal,
          deliveryPrice,
          total,
          deliveryTypes[Math.floor(Math.random() * deliveryTypes.length)],
          paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          orderStatus === 'completed' ? 'paid' : (orderStatus === 'cancelled' ? 'unpaid' : (Math.random() > 0.5 ? 'paid' : 'unpaid')),
          languages[Math.floor(Math.random() * languages.length)],
          'whatsapp',
          orderDate,
          completedDate
        ]);
        
        // Create order items
        for (const item of selectedItems) {
          const quantity = Math.floor(Math.random() * 3) + 1;
          const orderItemId = generateUUID();
          await connection.query(`
            INSERT INTO order_items (
              id, order_id, item_id, quantity, price_at_time, name_at_time
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [orderItemId, orderId, item.id, quantity, item.price, item.name]);
        }
        
        // Create status history with timeline
        const statusTimeline = [];
        if (orderStatus === 'completed') {
          statusTimeline.push({ status: 'pending', time: orderDate });
          statusTimeline.push({ status: 'accepted', time: new Date(orderDate.getTime() + 5 * 60000) });
          statusTimeline.push({ status: 'preparing', time: new Date(orderDate.getTime() + 15 * 60000) });
          statusTimeline.push({ status: 'ready', time: new Date(orderDate.getTime() + 45 * 60000) });
          statusTimeline.push({ status: 'completed', time: completedDate });
        } else if (orderStatus === 'cancelled') {
          statusTimeline.push({ status: 'pending', time: orderDate });
          statusTimeline.push({ status: 'cancelled', time: new Date(orderDate.getTime() + 10 * 60000) });
        } else if (orderStatus === 'ready') {
          statusTimeline.push({ status: 'pending', time: orderDate });
          statusTimeline.push({ status: 'accepted', time: new Date(orderDate.getTime() + 5 * 60000) });
          statusTimeline.push({ status: 'preparing', time: new Date(orderDate.getTime() + 15 * 60000) });
          statusTimeline.push({ status: 'ready', time: new Date(orderDate.getTime() + 45 * 60000) });
        } else if (orderStatus === 'preparing') {
          statusTimeline.push({ status: 'pending', time: orderDate });
          statusTimeline.push({ status: 'accepted', time: new Date(orderDate.getTime() + 5 * 60000) });
          statusTimeline.push({ status: 'preparing', time: new Date(orderDate.getTime() + 15 * 60000) });
        } else if (orderStatus === 'accepted') {
          statusTimeline.push({ status: 'pending', time: orderDate });
          statusTimeline.push({ status: 'accepted', time: new Date(orderDate.getTime() + 5 * 60000) });
        } else {
          statusTimeline.push({ status: 'pending', time: orderDate });
        }
        
        for (const statusEntry of statusTimeline) {
          const statusHistoryId = generateUUID();
          await connection.query(`
            INSERT INTO order_status_history (id, order_id, status, changed_by, changed_at)
            VALUES (?, ?, ?, ?, ?)
          `, [statusHistoryId, orderId, statusEntry.status, 'system', statusEntry.time]);
        }
        
        totalOrders++;
      }
      
      console.log(`  ✓ Created ${numOrders} orders for ${business.business_name}`);
    }
    
    await connection.commit();
    
    console.log(`\n✅ Successfully added ${totalOrders} orders!`);
    console.log(`\nOrder Status Distribution:`);
    
    // Get status counts
    const [statusCounts] = await connection.query(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);
    
    statusCounts.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    
    console.log(`\n📊 Total orders in database: ${totalOrders + (await connection.query('SELECT COUNT(*) as count FROM orders'))[0][0].count}`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error adding orders:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  addMoreOrders()
    .then(() => {
      console.log('\n✨ Done! Refresh your dashboard to see the new orders.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { addMoreOrders };
