// Cart Manager
// Manages cart using the orders table (cart = order with status 'cart')

const { queryMySQL, getMySQLConnection } = require('../../config/database');
const { generateUUID } = require('../../utils/uuid');
const logger = require('../../utils/logger');

/**
 * Get or create cart (order with status 'cart') for customer
 */
async function getCart(businessId, branchId, customerPhoneNumber) {
  // Find existing cart order
  const orders = await queryMySQL(`
    SELECT * FROM orders 
    WHERE business_id = ? 
    AND branch_id = ? 
    AND customer_phone_number = ? 
    AND status = 'cart'
    ORDER BY created_at DESC
    LIMIT 1
  `, [businessId, branchId, customerPhoneNumber]);
  
  if (orders.length > 0) {
    const order = orders[0];
    
    // Get order items
    const items = await queryMySQL(`
      SELECT oi.*, i.name, i.description
      FROM order_items oi
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
    `, [order.id]);
    
    return {
      id: order.id,
      business_id: order.business_id,
      branch_id: order.branch_id,
      customer_phone_number: order.customer_phone_number,
      status: order.status,
      items: items.map(item => ({
        item_id: item.item_id,
        name: item.name_at_time || item.name,
        price: parseFloat(item.price_at_time),
        quantity: item.quantity,
        notes: item.notes
      })),
      subtotal: parseFloat(order.subtotal),
      delivery_price: parseFloat(order.delivery_price || 0),
      total: parseFloat(order.total),
      delivery_type: order.delivery_type,
      scheduled_for: order.scheduled_for,
      delivery_address_location_id: order.delivery_address_location_id,
      customer_name: order.customer_name,
      notes: order.notes,
      language: order.language_used,
      created_at: order.created_at,
      updated_at: order.updated_at
    };
  }
  
  // Create new cart (order with status 'cart')
  const orderId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    await connection.query(`
      INSERT INTO orders (
        id, business_id, branch_id, customer_phone_number,
        status, subtotal, delivery_price, total, delivery_type
      ) VALUES (?, ?, ?, ?, 'cart', 0, 0, 0, 'takeaway')
    `, [orderId, businessId, branchId, customerPhoneNumber]);
    
    await connection.commit();
    
    return {
      id: orderId,
      business_id: businessId,
      branch_id: branchId,
      customer_phone_number: customerPhoneNumber,
      status: 'cart',
      items: [],
      subtotal: 0,
      delivery_price: 0,
      total: 0,
      delivery_type: 'takeaway',
      scheduled_for: null,
      delivery_address_location_id: null,
      customer_name: null,
      notes: null,
      language: null,
      created_at: new Date(),
      updated_at: new Date()
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update cart (order)
 */
async function updateCart(businessId, branchId, customerPhoneNumber, updates) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    const updateFields = [];
    const values = [];
    
    // Build update query dynamically
    if (updates.delivery_type !== undefined) {
      updateFields.push('delivery_type = ?');
      values.push(updates.delivery_type);
    }
    
    if (updates.scheduled_for !== undefined) {
      updateFields.push('scheduled_for = ?');
      values.push(updates.scheduled_for);
    }
    
    if (updates.delivery_address_location_id !== undefined) {
      updateFields.push('delivery_address_location_id = ?');
      values.push(updates.delivery_address_location_id);
    }
    
    if (updates.customer_name !== undefined) {
      updateFields.push('customer_name = ?');
      values.push(updates.customer_name);
    }
    
    if (updates.notes !== undefined) {
      updateFields.push('notes = ?');
      values.push(updates.notes);
    }
    
    if (updates.language !== undefined) {
      updateFields.push('language_used = ?');
      values.push(updates.language);
    }
    
    if (updates.subtotal !== undefined) {
      updateFields.push('subtotal = ?');
      values.push(updates.subtotal);
    }
    
    if (updates.delivery_price !== undefined) {
      updateFields.push('delivery_price = ?');
      values.push(updates.delivery_price);
    }
    
    if (updates.total !== undefined) {
      updateFields.push('total = ?');
      values.push(updates.total);
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(cart.id);
      
      await connection.query(`
        UPDATE orders 
        SET ${updateFields.join(', ')}
        WHERE id = ? AND status = 'cart'
      `, values);
    }
    
    await connection.commit();
    
    return await getCart(businessId, branchId, customerPhoneNumber);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Add item to cart
 */
async function addItemToCart(businessId, branchId, customerPhoneNumber, item) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if item already in cart
    const existingItems = await queryMySQL(`
      SELECT * FROM order_items 
      WHERE order_id = ? AND item_id = ?
    `, [cart.id, item.itemId]);
    
    if (existingItems.length > 0) {
      // Update quantity
      const existingItem = existingItems[0];
      const newQuantity = existingItem.quantity + (item.quantity || 1);
      
      await connection.query(`
        UPDATE order_items 
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newQuantity, existingItem.id]);
    } else {
      // Add new item
      const orderItemId = generateUUID();
      await connection.query(`
        INSERT INTO order_items (
          id, order_id, item_id, quantity, price_at_time, name_at_time, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        orderItemId,
        cart.id,
        item.itemId,
        item.quantity || 1,
        item.price,
        item.name,
        item.notes || null
      ]);
    }
    
    // Recalculate totals
    const items = await queryMySQL(`
      SELECT quantity, price_at_time 
      FROM order_items 
      WHERE order_id = ?
    `, [cart.id]);
    
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price_at_time) * item.quantity), 0);
    const deliveryPrice = parseFloat(cart.delivery_price || 0);
    const total = subtotal + deliveryPrice;
    
    await connection.query(`
      UPDATE orders 
      SET subtotal = ?, total = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [subtotal, total, cart.id]);
    
    await connection.commit();
    
    return await getCart(businessId, branchId, customerPhoneNumber);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Remove item from cart
 */
async function removeItemFromCart(businessId, branchId, customerPhoneNumber, itemId) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Delete item
    await connection.query(`
      DELETE FROM order_items 
      WHERE order_id = ? AND item_id = ?
    `, [cart.id, itemId]);
    
    // Recalculate totals
    const items = await queryMySQL(`
      SELECT quantity, price_at_time 
      FROM order_items 
      WHERE order_id = ?
    `, [cart.id]);
    
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price_at_time) * item.quantity), 0);
    const deliveryPrice = parseFloat(cart.delivery_price || 0);
    const total = subtotal + deliveryPrice;
    
    await connection.query(`
      UPDATE orders 
      SET subtotal = ?, total = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [subtotal, total, cart.id]);
    
    await connection.commit();
    
    return await getCart(businessId, branchId, customerPhoneNumber);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update item quantity in cart
 */
async function updateItemQuantity(businessId, branchId, customerPhoneNumber, itemId, quantity) {
  if (quantity <= 0) {
    return await removeItemFromCart(businessId, branchId, customerPhoneNumber, itemId);
  }
  
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    await connection.query(`
      UPDATE order_items 
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND item_id = ?
    `, [quantity, cart.id, itemId]);
    
    // Recalculate totals
    const items = await queryMySQL(`
      SELECT quantity, price_at_time 
      FROM order_items 
      WHERE order_id = ?
    `, [cart.id]);
    
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price_at_time) * item.quantity), 0);
    const deliveryPrice = parseFloat(cart.delivery_price || 0);
    const total = subtotal + deliveryPrice;
    
    await connection.query(`
      UPDATE orders 
      SET subtotal = ?, total = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [subtotal, total, cart.id]);
    
    await connection.commit();
    
    return await getCart(businessId, branchId, customerPhoneNumber);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Clear cart (delete all items, reset totals)
 */
async function clearCart(businessId, branchId, customerPhoneNumber) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Delete all items
    await connection.query(`
      DELETE FROM order_items 
      WHERE order_id = ?
    `, [cart.id]);
    
    // Reset totals
    await connection.query(`
      UPDATE orders 
      SET subtotal = 0, delivery_price = 0, total = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [cart.id]);
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Confirm cart (change status from 'cart' to 'pending')
 */
async function confirmCart(businessId, branchId, customerPhoneNumber) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Update status to 'pending'
    await connection.query(`
      UPDATE orders 
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'cart'
    `, [cart.id]);
    
    // Create initial status history entry
    await connection.query(`
      INSERT INTO order_status_history (id, order_id, status, changed_by)
      VALUES (?, ?, 'pending', 'customer')
    `, [generateUUID(), cart.id]);
    
    await connection.commit();
    
    logger.info(`Cart confirmed as order: ${cart.id}`);
    
    return await queryMySQL('SELECT * FROM orders WHERE id = ?', [cart.id]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Complete cart (mark as ordered) - Legacy function, use confirmCart instead
 */
async function completeCart(businessId, branchId, customerPhoneNumber) {
  return await confirmCart(businessId, branchId, customerPhoneNumber);
}

/**
 * Get cart summary for display
 */
function getCartSummary(cart) {
  if (!cart || !cart.items || cart.items.length === 0) {
    return 'Your cart is empty.';
  }
  
  let summary = '📋 **Your Cart:**\n\n';
  
  for (const item of cart.items) {
    summary += `• ${item.name} x${item.quantity} - ${item.price * item.quantity}\n`;
  }
  
  summary += `\nSubtotal: ${cart.subtotal}\n`;
  
  if (cart.delivery_price > 0) {
    summary += `Delivery: ${cart.delivery_price}\n`;
  }
  
  summary += `**Total: ${cart.total}**`;
  
  return summary;
}

module.exports = {
  getCart,
  updateCart,
  addItemToCart,
  removeItemFromCart,
  updateItemQuantity,
  clearCart,
  confirmCart,
  completeCart,
  getCartSummary
};
