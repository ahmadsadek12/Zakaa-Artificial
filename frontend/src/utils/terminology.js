/**
 * Terminology utility - Returns appropriate labels based on business type
 * For non-F&B businesses, uses request/service terminology
 */

/**
 * Get terminology labels based on business type
 * @param {string} businessType - Business type from user object
 * @returns {Object} Object with terminology labels
 */
export function getTerminology(businessType) {
  const isFnb = businessType?.toLowerCase() === 'food and beverage' || 
                businessType?.toLowerCase() === 'f & b' ||
                businessType?.toLowerCase() === 'f&b'
  
  if (isFnb) {
    return {
      order: 'Order',
      orders: 'Orders',
      item: 'Item',
      items: 'Items',
      menu: 'Menu',
      menus: 'Menus',
      cart: 'Cart',
      carts: 'Carts',
      activeRequest: 'Cart',
      activeRequests: 'Carts',
      orderItem: 'Order Item',
      orderItems: 'Order Items',
      selectItem: 'Select item...',
      noItems: 'No items found',
      itemName: 'Item',
      // Placeholders
      addItem: 'Add Item',
      editItem: 'Edit Item',
      deleteItem: 'Delete Item',
      createItem: 'Create Item',
      itemDetails: 'Item Details',
      itemNamePlaceholder: 'Item name',
      itemDescriptionPlaceholder: 'Item description',
    }
  } else {
    return {
      order: 'Request',
      orders: 'Requests',
      item: 'Service',
      items: 'Services',
      menu: 'Menu',
      menus: 'Menus',
      cart: 'Active Request',
      carts: 'Active Requests',
      activeRequest: 'Active Request',
      activeRequests: 'Active Requests',
      orderItem: 'Request Service',
      orderItems: 'Request Services',
      selectItem: 'Select service...',
      noItems: 'No services found',
      itemName: 'Service',
      // Placeholders
      addItem: 'Add Service',
      editItem: 'Edit Service',
      deleteItem: 'Delete Service',
      createItem: 'Create Service',
      itemDetails: 'Service Details',
      itemNamePlaceholder: 'Service name',
      itemDescriptionPlaceholder: 'Service description',
    }
  }
}

/**
 * Get navigation labels (for all businesses)
 */
export function getNavTerminology() {
  return {
    analytics: 'Add-ons',
    premium: 'Unlock Add-ons',
    upgradeToPremium: 'Unlock Add-ons',
  }
}
