// Cart Manager
// Manages conversation state and shopping cart for WhatsApp conversations

const { getMongoCollection } = require('../../config/database');
const { generateUUID } = require('../../utils/uuid');
const logger = require('../../utils/logger');

/**
 * Get or create cart for customer
 */
async function getCart(businessId, branchId, customerPhoneNumber) {
  const carts = await getMongoCollection('carts');
  
  const cart = await carts.findOne({
    business_id: businessId,
    branch_id: branchId,
    customer_phone_number: customerPhoneNumber,
    status: 'active'
  });
  
  if (cart) {
    return cart;
  }
  
  // Create new cart
  const newCart = {
    _id: generateUUID(),
    business_id: businessId,
    branch_id: branchId,
    customer_phone_number: customerPhoneNumber,
    status: 'active',
    items: [],
    subtotal: 0,
    delivery_price: 0,
    total: 0,
    delivery_type: null,
    scheduled_for: null,
    delivery_address: null,
    customer_name: null,
    notes: null,
    language: null,
    created_at: new Date(),
    updated_at: new Date()
  };
  
  await carts.insertOne(newCart);
  
  return newCart;
}

/**
 * Update cart
 */
async function updateCart(businessId, branchId, customerPhoneNumber, updates) {
  const carts = await getMongoCollection('carts');
  
  const updateData = {
    ...updates,
    updated_at: new Date()
  };
  
  await carts.updateOne(
    {
      business_id: businessId,
      branch_id: branchId,
      customer_phone_number: customerPhoneNumber,
      status: 'active'
    },
    { $set: updateData }
  );
  
  return await getCart(businessId, branchId, customerPhoneNumber);
}

/**
 * Add item to cart
 */
async function addItemToCart(businessId, branchId, customerPhoneNumber, item) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  
  // Check if item already in cart
  const existingItemIndex = cart.items.findIndex(
    i => i.item_id === item.itemId
  );
  
  let newItems = [...cart.items];
  
  if (existingItemIndex >= 0) {
    // Update quantity
    newItems[existingItemIndex].quantity += item.quantity || 1;
  } else {
    // Add new item
    newItems.push({
      item_id: item.itemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      notes: item.notes || null
    });
  }
  
  // Recalculate totals
  const subtotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + (cart.delivery_price || 0);
  
  await updateCart(businessId, branchId, customerPhoneNumber, {
    items: newItems,
    subtotal,
    total
  });
  
  return await getCart(businessId, branchId, customerPhoneNumber);
}

/**
 * Remove item from cart
 */
async function removeItemFromCart(businessId, branchId, customerPhoneNumber, itemId) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  
  const newItems = cart.items.filter(item => item.item_id !== itemId);
  const subtotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + (cart.delivery_price || 0);
  
  await updateCart(businessId, branchId, customerPhoneNumber, {
    items: newItems,
    subtotal,
    total
  });
  
  return await getCart(businessId, branchId, customerPhoneNumber);
}

/**
 * Update item quantity in cart
 */
async function updateItemQuantity(businessId, branchId, customerPhoneNumber, itemId, quantity) {
  const cart = await getCart(businessId, branchId, customerPhoneNumber);
  
  if (quantity <= 0) {
    return await removeItemFromCart(businessId, branchId, customerPhoneNumber, itemId);
  }
  
  const newItems = cart.items.map(item => {
    if (item.item_id === itemId) {
      return { ...item, quantity };
    }
    return item;
  });
  
  const subtotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + (cart.delivery_price || 0);
  
  await updateCart(businessId, branchId, customerPhoneNumber, {
    items: newItems,
    subtotal,
    total
  });
  
  return await getCart(businessId, branchId, customerPhoneNumber);
}

/**
 * Clear cart
 */
async function clearCart(businessId, branchId, customerPhoneNumber) {
  await updateCart(businessId, branchId, customerPhoneNumber, {
    items: [],
    subtotal: 0,
    delivery_price: 0,
    total: 0
  });
}

/**
 * Complete cart (mark as ordered)
 */
async function completeCart(businessId, branchId, customerPhoneNumber) {
  const carts = await getMongoCollection('carts');
  
  await carts.updateOne(
    {
      business_id: businessId,
      branch_id: branchId,
      customer_phone_number: customerPhoneNumber,
      status: 'active'
    },
    {
      $set: {
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date()
      }
    }
  );
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
  completeCart,
  getCartSummary
};
