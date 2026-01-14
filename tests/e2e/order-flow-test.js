// End-to-End Order Flow Test
// Test complete order flow from cart creation to frontend display

const { getMySQLConnection, getMongoCollection } = require('../../src/config/database');
const chatbotService = require('../../src/services/llm/chatbot');
const axios = require('axios');
const logger = require('../../src/utils/logger');

const TEST_CUSTOMER = 'telegram:test_e2e_' + Date.now();
const API_BASE_URL = 'http://localhost:3000';

// Test business credentials (from README_START.md)
const TEST_BUSINESS_EMAIL = 'test@zakaa.com';
const TEST_BUSINESS_PASSWORD = 'test123';

let authToken = null;
let testBusinessId = null;
let testOrderId = null;

/**
 * Login to get auth token
 */
async function login() {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: TEST_BUSINESS_EMAIL,
      password: TEST_BUSINESS_PASSWORD
    });
    
    authToken = response.data.token;
    testBusinessId = response.data.user.id;
    
    logger.info('✅ Login successful', { businessId: testBusinessId });
    return true;
  } catch (error) {
    logger.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test 1: Create cart and add items
 */
async function testCreateCartAndAddItems() {
  logger.info('\n--- Test 1: Create Cart and Add Items ---');
  
  try {
    const connection = await getMySQLConnection();
    
    // Get test business
    const [businesses] = await connection.query(
      'SELECT * FROM users WHERE email = ? AND user_type = "business"',
      [TEST_BUSINESS_EMAIL]
    );
    
    if (businesses.length === 0) {
      throw new Error('Test business not found');
    }
    
    const business = businesses[0];
    
    // Simulate customer messages
    logger.info('Simulating: Customer selects language (3 = Lebanese)');
    await chatbotService.handleMessage({
      business,
      branch: null,
      customerPhoneNumber: TEST_CUSTOMER,
      message: 'hello',
      messageType: 'text',
      messageId: 'test_msg_1'
    });
    
    await chatbotService.handleMessage({
      business,
      branch: null,
      customerPhoneNumber: TEST_CUSTOMER,
      message: '3',
      messageType: 'text',
      messageId: 'test_msg_2'
    });
    
    logger.info('Simulating: Customer requests menu');
    await chatbotService.handleMessage({
      business,
      branch: null,
      customerPhoneNumber: TEST_CUSTOMER,
      message: 'show me the menu',
      messageType: 'text',
      messageId: 'test_msg_3'
    });
    
    logger.info('Simulating: Customer orders items');
    const orderResponse = await chatbotService.handleMessage({
      business,
      branch: null,
      customerPhoneNumber: TEST_CUSTOMER,
      message: 'I want a burger and fries',
      messageType: 'text',
      messageId: 'test_msg_4'
    });
    
    // Check cart exists
    const [carts] = await connection.query(`
      SELECT * FROM orders 
      WHERE customer_phone_number = ? AND notes = '__cart__'
    `, [TEST_CUSTOMER]);
    
    if (carts.length === 0) {
      throw new Error('Cart not created');
    }
    
    const cart = carts[0];
    
    // Check items
    const [items] = await connection.query(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [cart.id]);
    
    if (items.length === 0) {
      throw new Error('No items in cart');
    }
    
    connection.release();
    
    logger.info(`✅ Cart created with ${items.length} item(s)`, { cartId: cart.id });
    return true;
  } catch (error) {
    logger.error('❌ Test 1 failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Set delivery details
 */
async function testSetDeliveryDetails() {
  logger.info('\n--- Test 2: Set Delivery Details ---');
  
  try {
    const connection = await getMySQLConnection();
    
    const [businesses] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      [TEST_BUSINESS_EMAIL]
    );
    const business = businesses[0];
    
    logger.info('Simulating: Customer selects delivery type');
    await chatbotService.handleMessage({
      business,
      branch: null,
      customerPhoneNumber: TEST_CUSTOMER,
      message: 'delivery please',
      messageType: 'text',
      messageId: 'test_msg_5'
    });
    
    logger.info('Simulating: Customer provides Lebanese address');
    await chatbotService.handleMessage({
      business,
      branch: null,
      customerPhoneNumber: TEST_CUSTOMER,
      message: 'Salim Salam, Abraj Beirut, Block B2, 21, 7ad LIU',
      messageType: 'text',
      messageId: 'test_msg_6'
    });
    
    // Check cart has delivery details
    const [carts] = await connection.query(`
      SELECT * FROM orders 
      WHERE customer_phone_number = ? AND notes LIKE '%__cart__%'
    `, [TEST_CUSTOMER]);
    
    if (carts.length === 0) {
      throw new Error('Cart not found');
    }
    
    const cart = carts[0];
    
    if (cart.delivery_type !== 'delivery') {
      throw new Error('Delivery type not set');
    }
    
    if (!cart.notes || !cart.notes.includes('Delivery Address:')) {
      throw new Error('Delivery address not saved');
    }
    
    if (!cart.notes.includes('7ad LIU')) {
      throw new Error('Lebanese address not preserved correctly');
    }
    
    connection.release();
    
    logger.info('✅ Delivery details set correctly', { 
      deliveryType: cart.delivery_type,
      hasAddress: true
    });
    return true;
  } catch (error) {
    logger.error('❌ Test 2 failed:', error.message);
    return false;
  }
}

/**
 * Test 3: Confirm order
 */
async function testConfirmOrder() {
  logger.info('\n--- Test 3: Confirm Order ---');
  
  try {
    const connection = await getMySQLConnection();
    
    const [businesses] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      [TEST_BUSINESS_EMAIL]
    );
    const business = businesses[0];
    
    logger.info('Simulating: Customer confirms order');
    await chatbotService.handleMessage({
      business,
      branch: null,
      customerPhoneNumber: TEST_CUSTOMER,
      message: 'yes, confirm my order',
      messageType: 'text',
      messageId: 'test_msg_7'
    });
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check order exists (no longer a cart)
    const [orders] = await connection.query(`
      SELECT * FROM orders 
      WHERE customer_phone_number = ? 
        AND status = 'pending'
        AND (notes IS NULL OR notes NOT LIKE '%__cart__%')
      ORDER BY created_at DESC
      LIMIT 1
    `, [TEST_CUSTOMER]);
    
    if (orders.length === 0) {
      throw new Error('Order not created');
    }
    
    const order = orders[0];
    testOrderId = order.id;
    
    // Check order items
    const [items] = await connection.query(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [order.id]);
    
    if (items.length === 0) {
      throw new Error('Order has no items');
    }
    
    // Check status history
    const [history] = await connection.query(`
      SELECT * FROM order_status_history WHERE order_id = ?
    `, [order.id]);
    
    if (history.length === 0) {
      throw new Error('No status history');
    }
    
    connection.release();
    
    logger.info('✅ Order confirmed successfully', {
      orderId: order.id,
      status: order.status,
      itemCount: items.length,
      total: order.total
    });
    return true;
  } catch (error) {
    logger.error('❌ Test 3 failed:', error.message);
    return false;
  }
}

/**
 * Test 4: Verify order in frontend API
 */
async function testFrontendAPI() {
  logger.info('\n--- Test 4: Verify Frontend API ---');
  
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    // Get orders from API
    const response = await axios.get(`${API_BASE_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { status: 'pending' }
    });
    
    const orders = response.data.data.orders;
    
    // Find our test order
    const testOrder = orders.find(o => o.customer_phone_number === TEST_CUSTOMER);
    
    if (!testOrder) {
      throw new Error('Test order not found in API response');
    }
    
    // Get order details
    const detailResponse = await axios.get(`${API_BASE_URL}/api/orders/${testOrder.id}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const orderDetails = detailResponse.data.data;
    
    if (!orderDetails.items || orderDetails.items.length === 0) {
      throw new Error('Order details missing items');
    }
    
    logger.info('✅ Order visible in frontend API', {
      orderId: testOrder.id,
      status: testOrder.status,
      itemCount: orderDetails.items.length
    });
    return true;
  } catch (error) {
    logger.error('❌ Test 4 failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test 5: Cart timeout (create abandoned cart)
 */
async function testCartTimeout() {
  logger.info('\n--- Test 5: Cart Timeout ---');
  
  try {
    const connection = await getMySQLConnection();
    
    // Create an abandoned cart (backdated by 6 minutes)
    const { generateUUID } = require('../../src/utils/uuid');
    const abandonedCartId = generateUUID();
    const abandonedCustomer = 'telegram:abandoned_' + Date.now();
    
    const [businesses] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      [TEST_BUSINESS_EMAIL]
    );
    const business = businesses[0];
    
    // Create cart
    await connection.query(`
      INSERT INTO orders (
        id, business_id, user_id, customer_phone_number, 
        status, delivery_type, notes, subtotal, total,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', 'delivery', '__cart__', 10.00, 10.00, 
                NOW() - INTERVAL 6 MINUTE, NOW() - INTERVAL 6 MINUTE)
    `, [abandonedCartId, business.id, business.id, abandonedCustomer]);
    
    // Add item
    await connection.query(`
      INSERT INTO order_items (id, order_id, item_id, quantity, price_at_time, name_at_time)
      SELECT ?, ?, id, 1, price, name
      FROM items WHERE business_id = ? LIMIT 1
    `, [generateUUID(), abandonedCartId, business.id]);
    
    // Add delivery address to notes
    await connection.query(`
      UPDATE orders SET notes = 'Delivery Address: Test Address | __cart__'
      WHERE id = ?
    `, [abandonedCartId]);
    
    logger.info('Created abandoned cart', { cartId: abandonedCartId });
    
    // Run timeout job manually
    const cartTimeoutJob = require('../../src/jobs/cartTimeoutJob');
    await cartTimeoutJob.processTimedOutCarts();
    
    // Check if cart was converted to incomplete
    const [orders] = await connection.query(`
      SELECT * FROM orders WHERE id = ?
    `, [abandonedCartId]);
    
    if (orders.length === 0) {
      throw new Error('Abandoned cart not found');
    }
    
    const order = orders[0];
    
    if (order.status !== 'incomplete') {
      throw new Error(`Cart status is ${order.status}, expected incomplete`);
    }
    
    if (!order.notes.includes('Customer did not respond')) {
      throw new Error('Timeout note not added');
    }
    
    // Check status history
    const [history] = await connection.query(`
      SELECT * FROM order_status_history 
      WHERE order_id = ? AND status = 'incomplete'
    `, [abandonedCartId]);
    
    if (history.length === 0) {
      throw new Error('No incomplete status history entry');
    }
    
    connection.release();
    
    logger.info('✅ Cart timeout working correctly', {
      cartId: abandonedCartId,
      newStatus: order.status
    });
    return true;
  } catch (error) {
    logger.error('❌ Test 5 failed:', error.message);
    return false;
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  logger.info('\n--- Cleanup ---');
  
  try {
    const connection = await getMySQLConnection();
    
    // Delete test orders and related data
    await connection.query(`
      DELETE FROM order_status_history 
      WHERE order_id IN (
        SELECT id FROM orders WHERE customer_phone_number LIKE 'telegram:test_e2e_%' OR customer_phone_number LIKE 'telegram:abandoned_%'
      )
    `);
    
    await connection.query(`
      DELETE FROM order_items 
      WHERE order_id IN (
        SELECT id FROM orders WHERE customer_phone_number LIKE 'telegram:test_e2e_%' OR customer_phone_number LIKE 'telegram:abandoned_%'
      )
    `);
    
    await connection.query(`
      DELETE FROM orders 
      WHERE customer_phone_number LIKE 'telegram:test_e2e_%' OR customer_phone_number LIKE 'telegram:abandoned_%'
    `);
    
    // Delete test messages from MongoDB
    try {
      const messageLogs = await getMongoCollection('message_logs');
      if (messageLogs) {
        await messageLogs.deleteMany({
          customer_phone_number: { $regex: /^telegram:(test_e2e_|abandoned_)/ }
        });
      }
    } catch (mongoError) {
      logger.warn('Could not clean MongoDB:', mongoError.message);
    }
    
    connection.release();
    
    logger.info('✅ Cleanup completed');
  } catch (error) {
    logger.error('❌ Cleanup failed:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  logger.info('='.repeat(60));
  logger.info('STARTING END-TO-END ORDER FLOW TESTS');
  logger.info('='.repeat(60));
  
  const results = {
    login: false,
    createCart: false,
    setDelivery: false,
    confirmOrder: false,
    frontendAPI: false,
    cartTimeout: false
  };
  
  try {
    results.login = await login();
    if (!results.login) {
      throw new Error('Login failed, cannot continue tests');
    }
    
    results.createCart = await testCreateCartAndAddItems();
    results.setDelivery = await testSetDeliveryDetails();
    results.confirmOrder = await testConfirmOrder();
    results.frontendAPI = await testFrontendAPI();
    results.cartTimeout = await testCartTimeout();
    
  } catch (error) {
    logger.error('Test suite error:', error.message);
  } finally {
    await cleanup();
  }
  
  // Print summary
  logger.info('\n' + '='.repeat(60));
  logger.info('TEST RESULTS SUMMARY');
  logger.info('='.repeat(60));
  
  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    logger.info(`${passed ? '✅' : '❌'} ${test}`);
  });
  
  logger.info(`\nTotal: ${passed}/${total} tests passed`);
  logger.info('='.repeat(60));
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
