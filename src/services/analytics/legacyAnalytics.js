// Legacy/General Analytics
// General/legacy analytics functions that don't fit cleanly into categories

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

module.exports = {
  getOverview,
  getBranchComparison,
  getFreeMetrics
};
