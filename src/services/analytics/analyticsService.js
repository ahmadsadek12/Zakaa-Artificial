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

/**
 * Get FREE metrics (available to all businesses)
 * Returns: milestones, requests_handled, avg_response_time_ms
 */
async function getFreeMetrics(businessId, startDate, endDate) {
  try {
    // 1. Milestones: Max completed orders per minute (last 7 days)
    const [milestoneResult] = await queryMySQL(`
      SELECT 
        DATE_FORMAT(completed_at, '%Y-%m-%d %H:%i') as minute,
        COUNT(*) as count
      FROM orders
      WHERE business_id = ? 
        AND status = 'completed' 
        AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND completed_at IS NOT NULL
      GROUP BY minute
      ORDER BY count DESC
      LIMIT 1
    `, [businessId]);
    
    const milestones = milestoneResult && milestoneResult.length > 0 ? {
      minute: milestoneResult[0].minute,
      count: milestoneResult[0].count
    } : { minute: null, count: 0 };
    
    // 2. Requests handled: Count inbound message_logs from MongoDB
    let requestsHandled = 0;
    try {
      const messageLogs = await getMongoCollection('message_logs');
      const query = {
        business_id: businessId,
        direction: 'inbound'
      };
      
      if (startDate || endDate) {
        query.created_at = {};
        if (startDate) query.created_at.$gte = new Date(startDate);
        if (endDate) query.created_at.$lte = new Date(endDate);
      }
      
      requestsHandled = await messageLogs.countDocuments(query);
    } catch (mongoError) {
      logger.warn('MongoDB not available for requests_handled metric:', mongoError.message);
      // Fallback: count from orders (less accurate)
      const [orderCount] = await queryMySQL(`
        SELECT COUNT(*) as count
        FROM orders
        WHERE business_id = ?
          ${startDate ? 'AND created_at >= ?' : ''}
          ${endDate ? 'AND created_at <= ?' : ''}
      `, [businessId, startDate, endDate].filter(Boolean));
      requestsHandled = orderCount[0]?.count || 0;
    }
    
    // 3. Average response time: Average latency from inbound to first outbound
    let avgResponseTimeMs = 0;
    try {
      const messageLogs = await getMongoCollection('message_logs');
      const query = {
        business_id: businessId,
        direction: 'inbound'
      };
      
      if (startDate || endDate) {
        query.created_at = {};
        if (startDate) query.created_at.$gte = new Date(startDate);
        if (endDate) query.created_at.$lte = new Date(endDate);
      }
      
      const inboundMessages = await messageLogs.find(query).sort({ created_at: 1 }).toArray();
      
      let totalResponseTime = 0;
      let responseCount = 0;
      
      for (const inbound of inboundMessages) {
        // Find next outbound message within 5 minutes
        const outbound = await messageLogs.findOne({
          business_id: businessId,
          customer_phone_number: inbound.customer_phone_number,
          direction: 'outbound',
          created_at: {
            $gte: inbound.created_at,
            $lte: new Date(inbound.created_at.getTime() + 5 * 60 * 1000) // 5 minutes
          }
        });
        
        if (outbound) {
          const responseTime = outbound.created_at.getTime() - inbound.created_at.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
      
      avgResponseTimeMs = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
    } catch (mongoError) {
      logger.warn('MongoDB not available for avg_response_time_ms metric:', mongoError.message);
      // Fallback: use first_response_at from orders
      const [responseTimeResult] = await queryMySQL(`
        SELECT AVG(TIMESTAMPDIFF(MILLISECOND, created_at, first_response_at)) as avg_ms
        FROM orders
        WHERE business_id = ?
          AND first_response_at IS NOT NULL
          ${startDate ? 'AND created_at >= ?' : ''}
          ${endDate ? 'AND created_at <= ?' : ''}
      `, [businessId, startDate, endDate].filter(Boolean));
      
      avgResponseTimeMs = responseTimeResult && responseTimeResult[0]?.avg_ms 
        ? Math.round(responseTimeResult[0].avg_ms) 
        : 0;
    }
    
    return {
      milestones,
      requests_handled: requestsHandled,
      avg_response_time_ms: avgResponseTimeMs
    };
  } catch (error) {
    logger.error('Error getting FREE metrics:', error);
    return {
      milestones: { minute: null, count: 0 },
      requests_handled: 0,
      avg_response_time_ms: 0
    };
  }
}

/**
 * Get loyal customer (most orders by customerPhoneNumber) - PAID ADDON
 */
async function getLoyalCustomer(businessId, startDate, endDate) {
  try {
    const [result] = await queryMySQL(`
      SELECT 
        customer_phone_number,
        COUNT(*) as order_count,
        SUM(total) as total_spent
      FROM orders
      WHERE business_id = ?
        AND status = 'completed'
        ${startDate ? 'AND created_at >= ?' : ''}
        ${endDate ? 'AND created_at <= ?' : ''}
      GROUP BY customer_phone_number
      ORDER BY order_count DESC
      LIMIT 1
    `, [businessId, startDate, endDate].filter(Boolean));
    
    if (result && result.length > 0) {
      return {
        customer_phone_number: result[0].customer_phone_number,
        order_count: result[0].order_count,
        total_spent: parseFloat(result[0].total_spent || 0)
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting loyal customer:', error);
    throw error;
  }
}

/**
 * Get most ordered service (top service by sum(qty)) - PAID ADDON
 */
async function getMostOrdered(businessId, startDate, endDate) {
  try {
    const [result] = await queryMySQL(`
      SELECT 
        oi.item_id,
        i.name,
        SUM(oi.quantity) as total_qty,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE o.business_id = ?
        AND o.status = 'completed'
        ${startDate ? 'AND o.created_at >= ?' : ''}
        ${endDate ? 'AND o.created_at <= ?' : ''}
      GROUP BY oi.item_id, i.name
      ORDER BY total_qty DESC
      LIMIT 1
    `, [businessId, startDate, endDate].filter(Boolean));
    
    if (result && result.length > 0) {
      return {
        item_id: result[0].item_id,
        name: result[0].name,
        total_quantity: result[0].total_qty,
        order_count: result[0].order_count
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting most ordered:', error);
    throw error;
  }
}

/**
 * Get most rewarding service (max (priceAtTime - costAtTime) * qty per service) - PAID ADDON
 */
async function getMostRewarding(businessId, startDate, endDate) {
  try {
    const [result] = await queryMySQL(`
      SELECT 
        oi.item_id,
        i.name,
        SUM((oi.price_at_time - COALESCE(oi.cost_at_time, 0)) * oi.quantity) as total_profit,
        SUM(oi.quantity) as total_qty
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE o.business_id = ?
        AND o.status = 'completed'
        ${startDate ? 'AND o.created_at >= ?' : ''}
        ${endDate ? 'AND o.created_at <= ?' : ''}
      GROUP BY oi.item_id, i.name
      ORDER BY total_profit DESC
      LIMIT 1
    `, [businessId, startDate, endDate].filter(Boolean));
    
    if (result && result.length > 0) {
      return {
        item_id: result[0].item_id,
        name: result[0].name,
        total_profit: parseFloat(result[0].total_profit || 0),
        total_quantity: result[0].total_qty
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting most rewarding:', error);
    throw error;
  }
}

/**
 * Get time breakdown (group stats per hour/day/month) - PAID ADDON
 */
async function getTimeBreakdown(businessId, period, startDate, endDate) {
  try {
    let dateFormat, groupBy;
    
    switch (period) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00:00';
        groupBy = 'DATE_FORMAT(completed_at, "%Y-%m-%d %H:00:00")';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        groupBy = 'DATE(completed_at)';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        groupBy = 'DATE_FORMAT(completed_at, "%Y-%m")';
        break;
      default:
        dateFormat = '%Y-%m-%d';
        groupBy = 'DATE(completed_at)';
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        ${groupBy} as period,
        COUNT(*) as order_count,
        SUM(total) as total_revenue,
        AVG(total) as avg_order_value
      FROM orders
      WHERE business_id = ?
        AND status = 'completed'
        AND completed_at IS NOT NULL
        ${startDate ? 'AND completed_at >= ?' : ''}
        ${endDate ? 'AND completed_at <= ?' : ''}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, [businessId, startDate, endDate].filter(Boolean));
    
    return result.map(row => ({
      period: row.period,
      order_count: row.order_count,
      total_revenue: parseFloat(row.total_revenue || 0),
      avg_order_value: parseFloat(row.avg_order_value || 0)
    }));
  } catch (error) {
    logger.error('Error getting time breakdown:', error);
    throw error;
  }
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
  getMostDeliveredItems,
  getFreeMetrics,
  getLoyalCustomer,
  getMostOrdered,
  getMostRewarding,
  getTimeBreakdown
};
