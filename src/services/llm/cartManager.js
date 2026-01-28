// Cart Manager
// Manages cart using the orders table (cart = order with status 'cart')

const { queryMySQL, getMySQLConnection } = require('../../config/database');
const { generateUUID } = require('../../utils/uuid');
const logger = require('../../utils/logger');

/**
 * Get or create cart (order with status 'cart') for customer
 * @param {string} businessId - Business user ID
 * @param {string} branchId - Branch user ID or business user ID (actually userId, kept name for compatibility)
 * @param {string} customerPhoneNumber - Customer phone number
 */
async function getCart(businessId, branchId, customerPhoneNumber) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:14',message:'getCart entry',data:{businessId,branchId,customerPhoneNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  // If branchId is not provided or is same as businessId, try to find a branch for this business
  let actualBranchId = branchId;
  if (!actualBranchId || actualBranchId === businessId) {
    try {
      const branches = await queryMySQL(
        `SELECT id FROM users 
         WHERE parent_user_id = ? 
           AND user_type = 'branch'
           AND is_active = true 
           AND deleted_at IS NULL 
         LIMIT 1`,
        [businessId]
      );
      if (branches.length > 0) {
        actualBranchId = branches[0].id;
        logger.debug('Found branch for business', { businessId, branchId: actualBranchId });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:25',message:'Found branch user ID',data:{businessId,actualBranchId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } else {
        // No branch found - we'll need to handle this in INSERT
        logger.debug('No branch found for business, will need to handle in INSERT', { businessId });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:28',message:'No branch found',data:{businessId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    } catch (error) {
      logger.debug('Error finding branch, continuing with businessId', { error: error.message });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:31',message:'Error finding branch',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  }
  
  // Find existing cart order
  // Note: branch_id in orders table is from branches table, not users table
  // We need to find a valid branch_id from branches table to match against
  let orders = [];
  try {
    // First, try to find a branch_id from branches table (same logic as cart creation)
    let lookupBranchId = null;
    if (actualBranchId && actualBranchId !== businessId) {
      // actualBranchId is a user ID, but we need a branch_id from branches table
      // Find any branch_id for this business to use for lookup
      const [branches] = await queryMySQL(
        `SELECT id FROM branches WHERE business_id = ? LIMIT 1`,
        [businessId]
      );
      if (branches.length > 0) {
        lookupBranchId = branches[0].id;
      }
    }
    
    // Query for existing cart - use business_id and customer_phone_number ONLY
    // Don't filter by branch_id to avoid multiple carts for same customer
    // This ensures we always find the same cart regardless of which branch context we're in
    orders = await queryMySQL(`
      SELECT * FROM orders 
      WHERE business_id = ? 
      AND customer_phone_number = ? 
      AND status = 'cart'
      AND notes = '__cart__'
      ORDER BY created_at DESC
      LIMIT 1
    `, [businessId, customerPhoneNumber]);
  } catch (error) {
    logger.error('Error getting cart:', error);
    // If query fails, return empty array (will create new cart)
    orders = [];
  }
  
  if (orders.length > 0) {
    const order = orders[0];
    
    // Get order items
    const items = await queryMySQL(`
      SELECT oi.*, i.name, i.description
      FROM order_items oi
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
    `, [order.id]);
    
    // If notes contains '__cart__', treat it as a cart (status='cart' for API)
    // Notes can be '__cart__' or '__cart__\nNOTES: {customer notes}'
    const isCart = order.notes && (order.notes === '__cart__' || order.notes.startsWith('__cart__'));
    
    // Extract customer notes if present (format: '__cart__\nNOTES: {notes}')
    let customerNotes = null;
    if (order.notes && order.notes.startsWith('__cart__\nNOTES: ')) {
      customerNotes = order.notes.replace('__cart__\nNOTES: ', '').trim();
    }
    
    return {
      id: order.id,
      business_id: order.business_id,
      user_id: order.user_id, // Use user_id instead of branch_id
      branch_id: order.branch_id || null, // Column removed - return null for compatibility
      customer_phone_number: order.customer_phone_number,
      status: isCart ? 'cart' : order.status, // Return 'cart' if notes='__cart__', otherwise actual status
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
      location_address: order.location_address,
      location_latitude: order.location_latitude,
      location_longitude: order.location_longitude,
      location_name: order.location_name,
      customer_name: order.customer_name,
      notes: customerNotes || (order.notes === '__cart__' ? null : order.notes), // Return customer notes or original notes if not cart
      created_at: order.created_at,
      updated_at: order.updated_at
    };
  }
  
  // Create new cart (order with status 'pending' and notes='__cart__')
  const orderId = generateUUID();
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Find branch if not already found (actualBranchId from earlier query)
    let insertBranchId = actualBranchId;
    let insertUserId = businessId; // Default to businessId for user_id
    if (!insertBranchId || insertBranchId === businessId) {
      // Use connection.query instead of queryMySQL when inside a transaction
      const [branchUsers] = await connection.query(
        `SELECT id FROM users 
         WHERE parent_user_id = ? 
           AND user_type = 'branch'
           AND is_active = true 
           AND deleted_at IS NULL 
         LIMIT 1`,
        [businessId]
      );
      if (branchUsers.length > 0) {
        insertUserId = branchUsers[0].id; // Use branch user ID for user_id
        // Find a valid branch_id from branches table for FK constraint (workaround for deprecated column)
        const [branches] = await connection.query(
          `SELECT id FROM branches WHERE business_id = ? LIMIT 1`,
          [businessId]
        );
        if (branches.length > 0) {
          insertBranchId = branches[0].id; // Use valid branch_id from branches table
        } else {
          // Fallback: use any branch_id from branches table
          const [anyBranch] = await connection.query(`SELECT id FROM branches LIMIT 1`);
          insertBranchId = anyBranch[0]?.id || null;
        }
        logger.debug('Found branch for cart creation', { businessId, userId: insertUserId, branchId: insertBranchId });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:143',message:'Found branch user ID and branch_id',data:{businessId,insertUserId,insertBranchId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      } else {
        // No branch user found - use businessId for user_id
        insertUserId = businessId;
        // Find a valid branch_id from branches table for FK constraint
        const [branches] = await connection.query(
          `SELECT id FROM branches WHERE business_id = ? LIMIT 1`,
          [businessId]
        );
        if (branches.length > 0) {
          insertBranchId = branches[0].id;
        } else {
          const [anyBranch] = await connection.query(`SELECT id FROM branches LIMIT 1`);
          insertBranchId = anyBranch[0]?.id || null;
        }
        logger.debug('No branch user found, using businessId for user_id', { businessId, branchId: insertBranchId });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:158',message:'No branch user, using businessId',data:{businessId,insertUserId,insertBranchId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }
    } else {
      // actualBranchId was found - it's a user ID from users table, use it for user_id
      insertUserId = insertBranchId; // actualBranchId is a user ID, use for user_id
      // Find a valid branch_id from branches table for FK constraint (actualBranchId is NOT a branch_id)
      const [branches] = await connection.query(
        `SELECT id FROM branches WHERE business_id = ? LIMIT 1`,
        [businessId]
      );
      if (branches.length > 0) {
        insertBranchId = branches[0].id; // Use valid branch_id from branches table
      } else {
        // Fallback: use any branch_id from branches table
        const [anyBranch] = await connection.query(`SELECT id FROM branches LIMIT 1`);
        insertBranchId = anyBranch[0]?.id || null;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:176',message:'Using actualBranchId as user_id, finding branch_id',data:{businessId,insertUserId,insertBranchId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    }
    
    // Note: branch_id column was removed from orders table
    // Businesses can create orders directly without requiring branches
    // insertBranchId logic kept for backward compatibility but not used in INSERT
    
    // Get business type to set default delivery type
    // F&B businesses default to 'delivery', others default to 'on_site'
    let defaultDeliveryType = 'on_site'; // Default for non-F&B
    try {
      const [businesses] = await connection.query(
        'SELECT business_type FROM users WHERE id = ?',
        [businessId]
      );
      if (businesses.length > 0) {
        const businessType = businesses[0].business_type;
        if (businessType === 'f & b' || businessType === 'f&b') {
          defaultDeliveryType = 'delivery'; // F&B defaults to delivery
        }
      }
    } catch (err) {
      logger.warn('Could not fetch business type for default delivery type', { error: err.message });
    }
    
    // Insert with user_id (branch_id column removed - no longer needed)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:202',message:'Before INSERT into orders',data:{orderId,businessId,insertUserId,customerPhoneNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Determine order source (check if customerPhoneNumber is telegram: format)
    const orderSource = customerPhoneNumber.startsWith('telegram:') ? 'telegram' : 'whatsapp';
    
    try {
      await connection.query(`
        INSERT INTO orders (
          id, business_id, user_id, customer_phone_number,
          status, subtotal, delivery_price, total, delivery_type, notes, order_source
        ) VALUES (?, ?, ?, ?, 'cart', 0, 0, 0, ?, '__cart__', ?)
      `, [orderId, businessId, insertUserId, customerPhoneNumber, defaultDeliveryType, orderSource]);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:173',message:'INSERT successful',data:{orderId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } catch (insertError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:175',message:'INSERT failed',data:{error:insertError.message,orderId,businessId,insertUserId,insertBranchId:insertBranchId||'NULL',customerPhoneNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw insertError;
    }
    
    await connection.commit();
    
    // Return cart object (status is 'cart' in DB)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/031c3f3a-8e12-4d7a-9e88-5f983560a92c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cartManager.js:176',message:'Cart created successfully',data:{orderId,businessId,insertUserId,insertBranchId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // orderSource already declared above, reuse it
    
    return {
      id: orderId,
      business_id: businessId,
      user_id: insertUserId, // user_id now used
      branch_id: null, // branch_id column removed from orders table
      customer_phone_number: customerPhoneNumber,
      status: 'cart', // Return 'cart' for API compatibility (DB has 'pending' with notes='__cart__')
      order_source: orderSource, // Include order_source in cart object
      items: [],
      subtotal: 0,
      delivery_price: 0,
      total: 0,
      delivery_type: defaultDeliveryType,
      scheduled_for: null,
      delivery_address_location_id: null,
      customer_name: null,
      notes: null,
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
      // CRITICAL: Keep '__cart__' marker to identify active carts
      // Append delivery info as a separate field or skip notes update
      // We use location_address field now, so don't update notes at all for carts
      updateFields.push('notes = ?');
      values.push('__cart__'); // Always keep the cart marker
    }
    
    // Deprecated: location_latitude, location_longitude - do not use
    
    if (updates.location_name !== undefined) {
      updateFields.push('location_name = ?');
      values.push(updates.location_name);
    }
    
    if (updates.location_address !== undefined) {
      updateFields.push('location_address = ?');
      values.push(updates.location_address);
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
      
      // Update cart (identified by notes='__cart__' and status='cart')
      await connection.query(`
        UPDATE orders 
        SET ${updateFields.join(', ')}
        WHERE id = ? AND status = 'cart' AND notes = '__cart__'
      `, values);
    }
    
    // If delivery_price was updated, recalculate total
    if (updates.delivery_price !== undefined) {
      const [items] = await connection.query(`
        SELECT quantity, price_at_time 
        FROM order_items 
        WHERE order_id = ?
      `, [cart.id]);
      
      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price_at_time) * item.quantity), 0);
      const deliveryPrice = parseFloat(updates.delivery_price);
      const total = subtotal + deliveryPrice;
      
      await connection.query(`
        UPDATE orders 
        SET subtotal = ?, total = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [subtotal, total, cart.id]);
      
      logger.info('Total recalculated after delivery price update', { 
        cartId: cart.id, 
        subtotal, 
        deliveryPrice, 
        total 
      });
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
/**
 * Add service to cart
 * Supports physical services (with stock) and time-based services (with booking)
 */
async function addItemToCart(businessId, branchId, customerPhoneNumber, item) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get item details to check service_type
    const [itemDetails] = await connection.query(
      'SELECT service_type, stock_quantity, only_scheduled FROM items WHERE id = ?',
      [item.itemId]
    );
    
    if (itemDetails.length === 0) {
      throw new Error('Item not found');
    }
    
    const itemDetail = itemDetails[0];
    const isTimeBased = itemDetail.service_type === 'time_based';
    const isPhysical = itemDetail.service_type === 'physical';
    
    // For time-based services, require booking fields
    if (isTimeBased && (!item.bookingDate || !item.bookingStartTime)) {
      throw new Error('Time-based services require booking_date and booking_start_time');
    }
    
    // For physical services, check stock_quantity if not NULL
    if (isPhysical && itemDetail.stock_quantity !== null) {
      const requestedQuantity = item.quantity || 1;
      if (itemDetail.stock_quantity < requestedQuantity) {
        throw new Error(`Insufficient stock. Available: ${itemDetail.stock_quantity}, Requested: ${requestedQuantity}`);
      }
    }
    
    // For time-based services, don't update existing - each booking is separate
    const isRentalBooking = isTimeBased && item.bookingDate && item.bookingStartTime;
    
    // Check if item already in cart (only for non-rental items)
    if (!isRentalBooking) {
      const [existingItems] = await connection.query(`
        SELECT * FROM order_items 
        WHERE order_id = ? AND item_id = ? AND booking_date IS NULL
      `, [cart.id, item.itemId]);
      
      if (existingItems.length > 0) {
        // Update quantity
        const existingItem = existingItems[0];
        const newQuantity = existingItem.quantity + (item.quantity || 1);
        
        await connection.query(`
          UPDATE order_items 
          SET quantity = ?
          WHERE id = ?
        `, [newQuantity, existingItem.id]);
        
        // Recalculate totals
        const [items] = await connection.query(`
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
      }
    }
    
    // Add new item (either first time or rental booking)
    const orderItemId = generateUUID();
    
    // Calculate booking end time for rental items
    let bookingEndTime = null;
    if (isRentalBooking && item.durationMinutes) {
      bookingEndTime = addMinutesToTime(item.bookingStartTime, item.durationMinutes);
    }
    
    await connection.query(`
      INSERT INTO order_items (
        id, order_id, item_id, quantity, price_at_time, name_at_time, notes,
        booking_date, booking_start_time, booking_end_time, duration_tier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderItemId,
      cart.id,
      item.itemId,
      item.quantity || 1,
      item.price,
      item.name,
      item.notes || null,
      item.bookingDate || null,
      item.bookingStartTime || null,
      bookingEndTime,
      item.durationTierId || null
    ]);
    
    // Recalculate totals (use connection.query to see items within transaction)
    const [items] = await connection.query(`
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

// Helper function to add minutes to time
function addMinutesToTime(timeString, minutesToAdd) {
  const [hours, minutes, seconds = '00'] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    
    // Recalculate totals (use connection.query to see items within transaction)
    const [items] = await connection.query(`
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
    
    // Recalculate totals (use connection.query to see items within transaction)
    const [items] = await connection.query(`
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
 * Confirm cart (remove cart marker, order is already 'pending')
 */
async function confirmCart(businessId, branchId, customerPhoneNumber) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    // Determine request_type: 'scheduled_request' if scheduled_for exists, else 'order'
    const requestType = cart.scheduled_for ? 'scheduled_request' : 'order';
    
    // Check if any items require scheduling (only_scheduled = true)
    const [cartItems] = await connection.query(`
      SELECT i.only_scheduled 
      FROM order_items oi
      INNER JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
    `, [cart.id]);
    
    const hasOnlyScheduledItems = cartItems.some(ci => ci.only_scheduled === true || ci.only_scheduled === 1);
    
    // If has only_scheduled items and no scheduled_for, require scheduling
    if (hasOnlyScheduledItems && !cart.scheduled_for) {
      throw new Error('Items that can only be scheduled require a scheduled time');
    }
    
    // For physical services, decrement stock_quantity
    const [physicalItems] = await connection.query(`
      SELECT oi.item_id, oi.quantity, i.service_type, i.stock_quantity
      FROM order_items oi
      INNER JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ? AND i.service_type = 'physical' AND i.stock_quantity IS NOT NULL
    `, [cart.id]);
    
    for (const physicalItem of physicalItems) {
      await connection.query(
        `UPDATE items 
         SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND stock_quantity >= ?`,
        [physicalItem.quantity, physicalItem.item_id, physicalItem.quantity]
      );
    }
    
    // Remove cart marker (notes='__cart__') and set status to 'accepted'
    // Set request_type based on scheduled_for
    await connection.query(`
      UPDATE orders 
      SET notes = NULL, status = 'accepted', request_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'cart' AND notes = '__cart__'
    `, [requestType, cart.id]);
    
    // Create initial status history entry
    await connection.query(`
      INSERT INTO order_status_history (id, order_id, status, changed_by)
      VALUES (?, ?, 'accepted', 'customer')
    `, [generateUUID(), cart.id]);
    
    await connection.commit();
    
    logger.info(`Cart confirmed as order: ${cart.id}, request_type: ${requestType}`);
    
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
    return 'Your ongoing order is empty.';
  }
  
  let summary = '📋 **Your Ongoing Order:**\n\n';
  
  for (const item of cart.items) {
    summary += `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`;
    
    // Add booking details for rental items
    if (item.booking_date && item.booking_start_time) {
      const bookingDate = new Date(item.booking_date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const startTime = item.booking_start_time.substring(0, 5); // HH:MM
      const endTime = item.booking_end_time ? item.booking_end_time.substring(0, 5) : '';
      summary += `\n  📅 ${bookingDate} at ${startTime}${endTime ? ` - ${endTime}` : ''}`;
    }
    
    summary += '\n';
  }
  
  summary += `\nSubtotal: $${parseFloat(cart.subtotal).toFixed(2)}\n`;
  
  // Add delivery type and price
  if (cart.delivery_type) {
    summary += `Delivery Type: ${cart.delivery_type === 'delivery' ? 'Delivery' : 
                                      cart.delivery_type === 'takeaway' ? 'Takeaway' : 
                                      'On-site'}\n`;
  }
  
  if (cart.delivery_price > 0) {
    summary += `Delivery Fee: $${parseFloat(cart.delivery_price).toFixed(2)}\n`;
  }
  
  // Add delivery address if available
  if (cart.location_address) {
    summary += `\nDelivery Address: ${cart.location_address}\n`;
  }
  
  // Add order notes if present
  if (cart.notes && cart.notes.trim().length > 0 && cart.notes !== '__cart__') {
    summary += `\n📝 **Notes:** ${cart.notes}\n`;
  }
  
  summary += `\n**Total: $${parseFloat(cart.total).toFixed(2)}**`;
  
  return summary;
}

/**
 * Get detailed cart summary with all modifiable fields clearly shown
 * Used for comprehensive cart display when customer wants to review/modify order
 */
function getDetailedCartSummary(cart) {
  if (!cart || !cart.items || cart.items.length === 0) {
    return 'Your cart is empty.';
  }
  
  let summary = '🛒 **Your Current Order:**\n\n';
  
  // Items with details
  for (const item of cart.items) {
    summary += `• ${item.quantity}x ${item.name} - $${parseFloat(item.price * item.quantity).toFixed(2)}`;
    
    // Add item-level notes if present
    if (item.notes) {
      summary += `\n  📝 ${item.notes}`;
    }
    
    // Add booking details for rental items
    if (item.booking_date && item.booking_start_time) {
      const bookingDate = new Date(item.booking_date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const startTime = item.booking_start_time.substring(0, 5); // HH:MM
      const endTime = item.booking_end_time ? item.booking_end_time.substring(0, 5) : '';
      summary += `\n  📅 ${bookingDate} at ${startTime}${endTime ? ` - ${endTime}` : ''}`;
    }
    
    summary += '\n';
  }
  
  summary += `\n**Subtotal:** $${parseFloat(cart.subtotal).toFixed(2)}\n`;
  
  // Delivery details
  if (cart.delivery_type) {
    const deliveryTypeName = cart.delivery_type === 'delivery' ? 'Delivery' : 
                             cart.delivery_type === 'takeaway' ? 'Takeaway (Pickup)' : 
                             'On-site (Dine-in)';
    summary += `**Delivery Type:** ${deliveryTypeName}\n`;
  } else {
    summary += `**Delivery Type:** Not selected yet\n`;
  }
  
  if (cart.delivery_type === 'delivery') {
    summary += `**Delivery Fee:** $${parseFloat(cart.delivery_price || 0).toFixed(2)}\n`;
    if (cart.location_address) {
      summary += `**Delivery Address:** ${cart.location_address}\n`;
    } else {
      summary += `**Delivery Address:** ⚠️ Not provided yet\n`;
    }
  }
  
  // Schedule
  if (cart.scheduled_for) {
    const scheduledDate = new Date(cart.scheduled_for);
    summary += `**Scheduled For:** ${scheduledDate.toLocaleString()}\n`;
  }
  
  // Order notes (special instructions)
  if (cart.notes && cart.notes.trim().length > 0 && cart.notes !== '__cart__') {
    summary += `**Special Instructions:** ${cart.notes}\n`;
  }
  
  summary += `\n**Total:** $${parseFloat(cart.total).toFixed(2)}`;
  
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
  getCartSummary,
  getDetailedCartSummary
};
