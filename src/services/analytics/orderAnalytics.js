// Order/Sales Analytics
// All order/sales-related analytics functions

const { queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { buildFilterConditions } = require('./analyticsUtils');

/**
 * Get time breakdown (group stats per hour/day/month) - PAID ADDON (legacy)
 */
async function getTimeBreakdown(businessId, period, startDate, endDate) {
  try {
    // Check if completed_at column exists, fallback to created_at
    let dateColumn = 'completed_at';
    try {
      const columnCheck = await queryMySQL(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'orders' 
          AND COLUMN_NAME = 'completed_at'
      `);
      // queryMySQL returns results array directly
      if (!columnCheck || !Array.isArray(columnCheck) || columnCheck.length === 0) {
        dateColumn = 'created_at';
      }
    } catch (err) {
      // If check fails, use created_at as fallback
      logger.warn('Could not check for completed_at column, using created_at:', err.message);
      dateColumn = 'created_at';
    }
    
    let dateFormat, groupBy;
    
    switch (period) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00:00';
        groupBy = `DATE_FORMAT(${dateColumn}, "%Y-%m-%d %H:00:00")`;
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        groupBy = `DATE(${dateColumn})`;
        break;
      case 'month':
        dateFormat = '%Y-%m';
        groupBy = `DATE_FORMAT(${dateColumn}, "%Y-%m")`;
        break;
      default:
        dateFormat = '%Y-%m-%d';
        groupBy = `DATE(${dateColumn})`;
    }
    
    const params = [businessId];
    let dateFilter = '';
    if (startDate) {
      dateFilter += ` AND ${dateColumn} >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND ${dateColumn} <= ?`;
      params.push(endDate + ' 23:59:59');
    }
    
    const result = await queryMySQL(`
      SELECT 
        ${groupBy} as period,
        COUNT(*) as order_count,
        SUM(total) as total_revenue,
        AVG(total) as avg_order_value
      FROM orders
      WHERE business_id = ?
        AND status = 'completed'
        ${dateColumn === 'completed_at' ? `AND ${dateColumn} IS NOT NULL` : ''}
        ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, params);
    
    return (result || []).map(row => ({
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

/**
 * Get total orders (per day/week/month)
 */
async function getTotalOrders(businessId, period = 'day', filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    let dateFormat, groupBy;
    switch (period) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00:00';
        groupBy = 'DATE_FORMAT(o.completed_at, "%Y-%m-%d %H:00:00")';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        groupBy = 'DATE(o.completed_at)';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        groupBy = 'YEARWEEK(o.completed_at)';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        groupBy = 'DATE_FORMAT(o.completed_at, "%Y-%m")';
        break;
      default:
        groupBy = 'DATE(o.completed_at)';
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        ${groupBy} as period,
        COUNT(*) as order_count
      FROM orders o
      WHERE ${conditions.join(' AND ')}
        AND o.completed_at IS NOT NULL
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting total orders:', error);
    throw error;
  }
}

/**
 * Get total revenue (per day/week/month, completed only)
 */
async function getTotalRevenue(businessId, period = 'day', filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    let groupBy;
    switch (period) {
      case 'hour':
        groupBy = 'DATE_FORMAT(o.completed_at, "%Y-%m-%d %H:00:00")';
        break;
      case 'day':
        groupBy = 'DATE(o.completed_at)';
        break;
      case 'week':
        groupBy = 'YEARWEEK(o.completed_at)';
        break;
      case 'month':
        groupBy = 'DATE_FORMAT(o.completed_at, "%Y-%m")';
        break;
      default:
        groupBy = 'DATE(o.completed_at)';
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        ${groupBy} as period,
        SUM(o.total) as total_revenue,
        COUNT(*) as order_count
      FROM orders o
      WHERE ${conditions.join(' AND ')}
        AND o.completed_at IS NOT NULL
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, params);
    
    return (result || []).map(r => ({
      period: r.period,
      total_revenue: parseFloat(r.total_revenue || 0),
      order_count: r.order_count
    }));
  } catch (error) {
    logger.error('Error getting total revenue:', error);
    throw error;
  }
}

/**
 * Get total profit (per day/week/month, completed only)
 */
async function getTotalProfit(businessId, period = 'day', filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    // Check if cost_at_time exists
    const [columnCheck] = await queryMySQL(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'order_items' 
        AND COLUMN_NAME = 'cost_at_time'
    `);
    
    if (!columnCheck || columnCheck.length === 0) {
      // Return revenue as profit if cost not tracked
      return await getTotalRevenue(businessId, period, filters);
    }
    
    let groupBy;
    switch (period) {
      case 'hour':
        groupBy = 'DATE_FORMAT(o.completed_at, "%Y-%m-%d %H:00:00")';
        break;
      case 'day':
        groupBy = 'DATE(o.completed_at)';
        break;
      case 'week':
        groupBy = 'YEARWEEK(o.completed_at)';
        break;
      case 'month':
        groupBy = 'DATE_FORMAT(o.completed_at, "%Y-%m")';
        break;
      default:
        groupBy = 'DATE(o.completed_at)';
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        ${groupBy} as period,
        SUM((oi.price_at_time - COALESCE(oi.cost_at_time, 0)) * oi.quantity) as total_profit,
        SUM(oi.price_at_time * oi.quantity) as total_revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE ${conditions.join(' AND ')}
        AND o.completed_at IS NOT NULL
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, params);
    
    return (result || []).map(r => ({
      period: r.period,
      total_profit: parseFloat(r.total_profit || 0),
      total_revenue: parseFloat(r.total_revenue || 0),
      order_count: r.order_count
    }));
  } catch (error) {
    logger.error('Error getting total profit:', error);
    throw error;
  }
}

/**
 * Get average order value (AOV)
 */
async function getAverageOrderValue(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        AVG(o.total) as avg_order_value,
        COUNT(*) as order_count,
        SUM(o.total) as total_revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (result && result[0]) {
      return {
        avg_order_value: parseFloat(result[0].avg_order_value || 0),
        order_count: result[0].order_count,
        total_revenue: parseFloat(result[0].total_revenue || 0)
      };
    }
    
    return { avg_order_value: 0, order_count: 0, total_revenue: 0 };
  } catch (error) {
    logger.error('Error getting average order value:', error);
    throw error;
  }
}

/**
 * Get order status breakdown
 */
async function getOrderStatusBreakdown(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    // Remove status condition to get all statuses
    
    const result = await queryMySQL(`
      SELECT 
        o.status,
        COUNT(*) as count,
        SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.status
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting order status breakdown:', error);
    throw error;
  }
}

/**
 * Get cancellation rate
 */
async function getCancellationRate(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    
    const [result] = await queryMySQL(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN o.status = 'rejected' THEN 1 ELSE 0 END) as cancelled
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (result && result[0]) {
      const total = result[0].total || 0;
      const cancelled = result[0].cancelled || 0;
      return {
        cancellation_rate: total > 0 ? (cancelled / total) * 100 : 0,
        total_orders: total,
        cancelled_orders: cancelled
      };
    }
    
    return { cancellation_rate: 0, total_orders: 0, cancelled_orders: 0 };
  } catch (error) {
    logger.error('Error getting cancellation rate:', error);
    throw error;
  }
}

/**
 * Get rejection rate (business rejected)
 */
async function getRejectionRate(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    
    // Check order_status_history for business rejections
    const [result] = await queryMySQL(`
      SELECT 
        COUNT(DISTINCT o.id) as total,
        SUM(CASE WHEN o.status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (result && result[0]) {
      const total = result[0].total || 0;
      const rejected = result[0].rejected || 0;
      return {
        rejection_rate: total > 0 ? (rejected / total) * 100 : 0,
        total_orders: total,
        rejected_orders: rejected
      };
    }
    
    return { rejection_rate: 0, total_orders: 0, rejected_orders: 0 };
  } catch (error) {
    logger.error('Error getting rejection rate:', error);
    throw error;
  }
}

/**
 * Get scheduled vs immediate requests
 */
async function getScheduledVsImmediateRequests(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    
    const [result] = await queryMySQL(`
      SELECT 
        o.request_type,
        COUNT(*) as count,
        SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.request_type
    `, params);
    
    const scheduled = result?.find(r => r.request_type === 'scheduled_request') || { count: 0, revenue: 0 };
    const immediate = result?.find(r => r.request_type === 'order') || { count: 0, revenue: 0 };
    
    return {
      scheduled: {
        count: scheduled.count || 0,
        revenue: parseFloat(scheduled.revenue || 0)
      },
      immediate: {
        count: immediate.count || 0,
        revenue: parseFloat(immediate.revenue || 0)
      },
      total: {
        count: (scheduled.count || 0) + (immediate.count || 0),
        revenue: parseFloat(scheduled.revenue || 0) + parseFloat(immediate.revenue || 0)
      }
    };
  } catch (error) {
    logger.error('Error getting scheduled vs immediate requests:', error);
    throw error;
  }
}

/**
 * Get delivery type split
 */
async function getDeliveryTypeSplit(businessId, filters = {}) {
  try {
    // Check if delivery_type column exists
    let hasDeliveryType = false;
    try {
      const columnCheck = await queryMySQL(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'orders' 
          AND COLUMN_NAME = 'delivery_type'
      `);
      hasDeliveryType = columnCheck && columnCheck.length > 0;
    } catch (err) {
      hasDeliveryType = false;
    }
    
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    if (!hasDeliveryType) {
      // Return empty array if column doesn't exist
      return [];
    }
    
    const result = await queryMySQL(`
      SELECT 
        COALESCE(o.delivery_type, 'unknown') as type,
        COUNT(*) as count,
        SUM(o.total) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.delivery_type
    `, params);
    
    return (result || []).map(row => ({
      type: row.type || 'unknown',
      count: row.count,
      revenue: parseFloat(row.revenue || 0)
    }));
  } catch (error) {
    logger.error('Error getting delivery type split:', error);
    // Return empty array on error instead of throwing
    return [];
  }
}

/**
 * Get peak ordering hours
 */
async function getPeakOrderingHours(businessId, filters = {}) {
  try {
    // Check if completed_at column exists, fallback to created_at
    let dateColumn = 'completed_at';
    try {
      const columnCheck = await queryMySQL(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'orders' 
          AND COLUMN_NAME = 'completed_at'
      `);
      if (!columnCheck || columnCheck.length === 0) {
        dateColumn = 'created_at';
      }
    } catch (err) {
      dateColumn = 'created_at';
    }
    
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    if (dateColumn === 'completed_at') {
      conditions.push("o.completed_at IS NOT NULL");
    }
    
    const result = await queryMySQL(`
      SELECT 
        HOUR(o.${dateColumn}) as hour,
        COUNT(*) as order_count,
        SUM(o.total) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY HOUR(o.${dateColumn})
      ORDER BY order_count DESC
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting peak ordering hours:', error);
    throw error;
  }
}

/**
 * Get peak ordering days
 */
async function getPeakOrderingDays(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    conditions.push("o.completed_at IS NOT NULL");
    
    const [result] = await queryMySQL(`
      SELECT 
        DAYNAME(o.completed_at) as day_name,
        DAYOFWEEK(o.completed_at) as day_of_week,
        COUNT(*) as order_count,
        SUM(o.total) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY DAYNAME(o.completed_at), DAYOFWEEK(o.completed_at)
      ORDER BY order_count DESC
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting peak ordering days:', error);
    throw error;
  }
}

/**
 * Get time to complete (accept → complete)
 */
async function getTimeToComplete(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    conditions.push("o.completed_at IS NOT NULL");
    
    const [result] = await queryMySQL(`
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.completed_at)) as avg_minutes,
        MIN(TIMESTAMPDIFF(MINUTE, o.created_at, o.completed_at)) as min_minutes,
        MAX(TIMESTAMPDIFF(MINUTE, o.created_at, o.completed_at)) as max_minutes,
        COUNT(*) as order_count
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (result && result[0]) {
      return {
        avg_minutes: Math.round(result[0].avg_minutes || 0),
        min_minutes: result[0].min_minutes || 0,
        max_minutes: result[0].max_minutes || 0,
        order_count: result[0].order_count
      };
    }
    
    return { avg_minutes: 0, min_minutes: 0, max_minutes: 0, order_count: 0 };
  } catch (error) {
    logger.error('Error getting time to complete:', error);
    throw error;
  }
}

/**
 * Get sales heatmap (day-of-week × hour)
 */
async function getSalesHeatmap(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    conditions.push("o.completed_at IS NOT NULL");
    
    const [result] = await queryMySQL(`
      SELECT 
        DAYOFWEEK(o.completed_at) as day_of_week,
        DAYNAME(o.completed_at) as day_name,
        HOUR(o.completed_at) as hour,
        COUNT(*) as order_count,
        SUM(o.total) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY DAYOFWEEK(o.completed_at), DAYNAME(o.completed_at), HOUR(o.completed_at)
      ORDER BY day_of_week ASC, hour ASC
    `, params);
    
    // Organize into heatmap structure
    const heatmap = {};
    if (result) {
      result.forEach(row => {
        const key = `${row.day_of_week}_${row.hour}`;
        heatmap[key] = {
          day_of_week: row.day_of_week,
          day_name: row.day_name,
          hour: row.hour,
          order_count: row.order_count,
          revenue: parseFloat(row.revenue || 0)
        };
      });
    }
    
    return heatmap;
  } catch (error) {
    logger.error('Error getting sales heatmap:', error);
    throw error;
  }
}

module.exports = {
  getTimeBreakdown,
  getTotalOrders,
  getTotalRevenue,
  getTotalProfit,
  getAverageOrderValue,
  getOrderStatusBreakdown,
  getCancellationRate,
  getRejectionRate,
  getScheduledVsImmediateRequests,
  getDeliveryTypeSplit,
  getPeakOrderingHours,
  getPeakOrderingDays,
  getTimeToComplete,
  getSalesHeatmap
};
