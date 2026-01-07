// Analytics Service (Premium)
// Premium analytics for businesses

const { getMongoCollection } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Get overview analytics
 */
async function getOverview(businessId, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
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
    throw error;
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
  getBranchComparison
};
