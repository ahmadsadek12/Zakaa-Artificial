// Analytics Service (Premium)
// Premium analytics for businesses

const { getMongoCollection, queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Get overview analytics
 */
async function getOverview(businessId, startDate, endDate) {
  try {
    // Try to get MongoDB collection, but fallback to MySQL if MongoDB not available
    let orderLogs;
    try {
      orderLogs = await getMongoCollection('order_logs');
    } catch (mongoError) {
      logger.warn('MongoDB not available, using MySQL for analytics:', mongoError.message);
      // Fallback to MySQL orders table
      const orders = await queryMySQL(
        `SELECT * FROM orders 
         WHERE business_id = ? AND status = 'completed' 
         ${startDate ? 'AND created_at >= ?' : ''} 
         ${endDate ? 'AND created_at <= ?' : ''}
         ORDER BY created_at DESC`,
        [businessId, startDate, endDate].filter(Boolean)
      );
      
      return {
        totalOrders: orders.length,
        completedOrders: orders.length,
        cancelledOrders: 0,
        totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0),
        averageOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) / orders.length : 0,
        totalItemsSold: 0 // Would need to join order_items for accurate count
      };
    }
    
    const query = {
      business_id: businessId
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const overview = {
      totalOrders: orders.length,
      completedOrders: orders.filter(o => o.final_status === 'completed').length,
      cancelledOrders: orders.filter(o => o.final_status === 'cancelled').length,
      totalRevenue: 0,
      averageOrderValue: 0,
      totalItemsSold: 0
    };
    
    for (const order of orders) {
      if (order.final_status === 'completed') {
        overview.totalRevenue += parseFloat(order.total || 0);
        overview.totalItemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);
      }
    }
    
    if (overview.completedOrders > 0) {
      overview.averageOrderValue = overview.totalRevenue / overview.completedOrders;
    }
    
    return overview;
  } catch (error) {
    logger.error('Error getting overview analytics:', error);
    // Return empty overview instead of throwing
    return {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      totalItemsSold: 0
    };
  }
}

/**
 * Get revenue analytics
 */
async function getRevenue(businessId, period = 'daily', startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    const query = {
      business_id: businessId,
      final_status: 'completed'
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const revenueMap = {};
    
    for (const order of orders) {
      const date = new Date(order.created_at);
      let key;
      
      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const week = getWeekNumber(date);
        key = `${date.getFullYear()}-W${week}`;
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!revenueMap[key]) {
        revenueMap[key] = {
          period: key,
          revenue: 0,
          orders: 0
        };
      }
      
      revenueMap[key].revenue += parseFloat(order.total || 0);
      revenueMap[key].orders += 1;
    }
    
    return Object.values(revenueMap).sort((a, b) => a.period.localeCompare(b.period));
  } catch (error) {
    logger.error('Error getting revenue analytics:', error);
    throw error;
  }
}

/**
 * Get top items analytics
 */
async function getTopItems(businessId, limit = 10, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    const query = {
      business_id: businessId,
      final_status: 'completed'
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const itemMap = {};
    
    for (const order of orders) {
      for (const item of order.items || []) {
        const itemId = item.item_id || item.name;
        if (!itemMap[itemId]) {
          itemMap[itemId] = {
            itemId,
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }
        
        itemMap[itemId].quantity += item.quantity;
        itemMap[itemId].revenue += parseFloat(item.price) * item.quantity;
      }
    }
    
    return Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  } catch (error) {
    logger.error('Error getting top items analytics:', error);
    throw error;
  }
}

/**
 * Get customer analytics
 */
async function getCustomerAnalytics(businessId, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    const query = {
      business_id: businessId,
      final_status: 'completed'
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const customerMap = {};
    
    for (const order of orders) {
      const phone = order.customer_phone_number;
      if (!customerMap[phone]) {
        customerMap[phone] = {
          phoneNumber: phone,
          orders: 0,
          totalSpent: 0
        };
      }
      
      customerMap[phone].orders += 1;
      customerMap[phone].totalSpent += parseFloat(order.total || 0);
    }
    
    return Object.values(customerMap)
      .sort((a, b) => b.totalSpent - a.totalSpent);
  } catch (error) {
    logger.error('Error getting customer analytics:', error);
    throw error;
  }
}

/**
 * Get branch comparison analytics
 */
async function getBranchComparison(businessId, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    const query = {
      business_id: businessId,
      final_status: 'completed'
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const branchMap = {};
    
    for (const order of orders) {
      const branchId = order.branch_id;
      if (!branchMap[branchId]) {
        branchMap[branchId] = {
          branchId,
          orders: 0,
          revenue: 0
        };
      }
      
      branchMap[branchId].orders += 1;
      branchMap[branchId].revenue += parseFloat(order.total || 0);
    }
    
    return Object.values(branchMap);
  } catch (error) {
    logger.error('Error getting branch comparison:', error);
    throw error;
  }
}

/**
 * Get top paying customers (most total spent)
 */
async function getTopCustomers(businessId, limit = 10, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    const query = {
      business_id: businessId,
      final_status: 'completed'
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const customerMap = {};
    
    for (const order of orders) {
      const phone = order.customer_phone_number;
      const name = order.customer_name || 'Unknown';
      
      if (!customerMap[phone]) {
        customerMap[phone] = {
          customerPhoneNumber: phone,
          customerName: name,
          totalSpent: 0,
          orderCount: 0,
          averageOrderValue: 0
        };
      }
      
      customerMap[phone].totalSpent += parseFloat(order.total || 0);
      customerMap[phone].orderCount += 1;
    }
    
    // Calculate average order value
    Object.values(customerMap).forEach(customer => {
      customer.averageOrderValue = customer.totalSpent / customer.orderCount;
    });
    
    return Object.values(customerMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  } catch (error) {
    logger.error('Error getting top customers:', error);
    throw error;
  }
}

/**
 * Get most recurring customers (customers with most orders)
 */
async function getRecurringCustomers(businessId, limit = 10, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    const query = {
      business_id: businessId,
      final_status: 'completed'
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const customerMap = {};
    
    for (const order of orders) {
      const phone = order.customer_phone_number;
      const name = order.customer_name || 'Unknown';
      
      if (!customerMap[phone]) {
        customerMap[phone] = {
          customerPhoneNumber: phone,
          customerName: name,
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: null
        };
      }
      
      customerMap[phone].orderCount += 1;
      customerMap[phone].totalSpent += parseFloat(order.total || 0);
      
      const orderDate = new Date(order.created_at);
      if (!customerMap[phone].lastOrderDate || orderDate > customerMap[phone].lastOrderDate) {
        customerMap[phone].lastOrderDate = orderDate;
      }
    }
    
    return Object.values(customerMap)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, limit);
  } catch (error) {
    logger.error('Error getting recurring customers:', error);
    throw error;
  }
}

/**
 * Get customer lifetime value analysis
 */
async function getCustomerLifetimeValue(businessId, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    const query = {
      business_id: businessId,
      final_status: 'completed'
    };
    
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }
    
    const orders = await orderLogs.find(query).toArray();
    
    const customerMap = {};
    
    for (const order of orders) {
      const phone = order.customer_phone_number;
      const name = order.customer_name || 'Unknown';
      
      if (!customerMap[phone]) {
        customerMap[phone] = {
          customerPhoneNumber: phone,
          customerName: name,
          totalSpent: 0,
          orderCount: 0,
          firstOrderDate: null,
          lastOrderDate: null,
          averageOrderValue: 0,
          lifetimeValue: 0
        };
      }
      
      customerMap[phone].orderCount += 1;
      customerMap[phone].totalSpent += parseFloat(order.total || 0);
      
      const orderDate = new Date(order.created_at);
      if (!customerMap[phone].firstOrderDate || orderDate < customerMap[phone].firstOrderDate) {
        customerMap[phone].firstOrderDate = orderDate;
      }
      if (!customerMap[phone].lastOrderDate || orderDate > customerMap[phone].lastOrderDate) {
        customerMap[phone].lastOrderDate = orderDate;
      }
    }
    
    // Calculate metrics
    const customers = Object.values(customerMap);
    customers.forEach(customer => {
      customer.averageOrderValue = customer.totalSpent / customer.orderCount;
      customer.lifetimeValue = customer.totalSpent;
      
      // Calculate days between first and last order
      if (customer.firstOrderDate && customer.lastOrderDate) {
        const daysDiff = Math.ceil((customer.lastOrderDate - customer.firstOrderDate) / (1000 * 60 * 60 * 24));
        customer.customerLifespanDays = daysDiff || 0;
        customer.ordersPerDay = daysDiff > 0 ? customer.orderCount / daysDiff : customer.orderCount;
      }
    });
    
    // Aggregate statistics
    const totalCustomers = customers.length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    const averageOrdersPerCustomer = totalCustomers > 0 
      ? customers.reduce((sum, c) => sum + c.orderCount, 0) / totalCustomers 
      : 0;
    
    return {
      summary: {
        totalCustomers,
        totalRevenue,
        averageLifetimeValue,
        averageOrdersPerCustomer
      },
      customers: customers.sort((a, b) => b.lifetimeValue - a.lifetimeValue)
    };
  } catch (error) {
    logger.error('Error getting customer lifetime value:', error);
    throw error;
  }
}

/**
 * Get popular items (most ordered - using times_ordered from items table)
 */
async function getPopularItems(businessId, limit = 10) {
  try {
    // Query MySQL items table using times_ordered
    const items = await queryMySQL(`
      SELECT id, name, description, price, times_ordered, times_delivered
      FROM items
      WHERE business_id = ? AND deleted_at IS NULL
      ORDER BY times_ordered DESC
      LIMIT ?
    `, [businessId, limit]);
    
    return items.map(item => ({
      itemId: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price || 0),
      timesOrdered: item.times_ordered || 0,
      timesDelivered: item.times_delivered || 0
    }));
  } catch (error) {
    logger.error('Error getting popular items:', error);
    throw error;
  }
}

/**
 * Get most delivered items (most completed - using times_delivered from items table)
 */
async function getMostDeliveredItems(businessId, limit = 10) {
  try {
    // Query MySQL items table using times_delivered
    const items = await queryMySQL(`
      SELECT id, name, description, price, times_ordered, times_delivered
      FROM items
      WHERE business_id = ? AND deleted_at IS NULL
      ORDER BY times_delivered DESC
      LIMIT ?
    `, [businessId, limit]);
    
    return items.map(item => ({
      itemId: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price || 0),
      timesOrdered: item.times_ordered || 0,
      timesDelivered: item.times_delivered || 0,
      completionRate: item.times_ordered > 0 
        ? ((item.times_delivered || 0) / item.times_ordered) * 100 
        : 0
    }));
  } catch (error) {
    logger.error('Error getting most delivered items:', error);
    throw error;
  }
}

/**
 * Helper: Get week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {
  getOverview,
  getRevenue,
  getTopItems,
  getCustomerAnalytics,
  getBranchComparison,
  getTopCustomers,
  getRecurringCustomers,
  getCustomerLifetimeValue,
  getPopularItems,
  getMostDeliveredItems
};
