// Financial Analytics
// All financial summary-related analytics functions

const { getMongoCollection, queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { buildFilterConditions, getWeekNumber } = require('./analyticsUtils');
const { getTotalRevenue, getTotalOrders, getPeakOrderingHours } = require('./orderAnalytics');

/**
 * Get revenue analytics (legacy)
 */
async function getRevenue(businessId, period = 'daily', startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    // If MongoDB is unavailable, fallback to MySQL
    if (!orderLogs) {
      logger.warn('MongoDB unavailable - using MySQL for revenue data');
      
      let dateFilter = '';
      const params = [businessId];
      if (startDate) {
        dateFilter += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        dateFilter += ' AND created_at <= ?';
        params.push(endDate + ' 23:59:59');
      }
      // If no endDate, include today's orders up to current time
      if (!endDate) {
        dateFilter += ' AND created_at <= NOW()';
      }
      
      const orders = await queryMySQL(`
        SELECT 
          DATE(created_at) as order_date,
          DATE_FORMAT(created_at, '%Y-%m') as order_month,
          total
        FROM orders
        WHERE business_id = ? AND status = 'completed' ${dateFilter}
        ORDER BY created_at ASC
      `, params);
      
      const revenueMap = {};
      
      for (const order of orders) {
        let key;
        // MySQL DATE() returns a string in format 'YYYY-MM-DD'
        const orderDateStr = order.order_date instanceof Date 
          ? order.order_date.toISOString().split('T')[0]
          : String(order.order_date).split('T')[0];
        const orderDate = new Date(orderDateStr);
        
        if (period === 'daily') {
          key = orderDateStr;
        } else if (period === 'weekly') {
          const week = getWeekNumber(orderDate);
          key = `${orderDate.getFullYear()}-W${week}`;
        } else if (period === 'monthly') {
          key = order.order_month || `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
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
    }
    
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
 * Get daily sales report (completed orders only)
 */
async function getDailySalesReport(businessId, date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startDate = `${targetDate} 00:00:00`;
    const endDate = `${targetDate} 23:59:59`;
    
    const filters = { businessId, startDate, endDate };
    const { conditions, params } = buildFilterConditions(filters);
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        COUNT(*) as order_count,
        SUM(o.total) as total_revenue,
        AVG(o.total) as avg_order_value,
        SUM(o.delivery_price) as delivery_fees
      FROM orders o
      WHERE ${conditions.join(' AND ')}
        AND o.completed_at IS NOT NULL
    `, params);
    
    // Get profit if cost data exists
    const [columnCheck] = await queryMySQL(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'order_items' 
        AND COLUMN_NAME = 'cost_at_time'
    `);
    
    let totalProfit = 0;
    if (columnCheck && columnCheck.length > 0) {
      const [profitResult] = await queryMySQL(`
        SELECT SUM((oi.price_at_time - COALESCE(oi.cost_at_time, 0)) * oi.quantity) as total_profit
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE ${conditions.join(' AND ')}
          AND o.completed_at IS NOT NULL
      `, params);
      
      totalProfit = profitResult && profitResult[0] ? parseFloat(profitResult[0].total_profit || 0) : 0;
    }
    
    if (result && result[0]) {
      return {
        date: targetDate,
        order_count: result[0].order_count,
        total_revenue: parseFloat(result[0].total_revenue || 0),
        avg_order_value: parseFloat(result[0].avg_order_value || 0),
        delivery_fees: parseFloat(result[0].delivery_fees || 0),
        total_profit: totalProfit
      };
    }
    
    return {
      date: targetDate,
      order_count: 0,
      total_revenue: 0,
      avg_order_value: 0,
      delivery_fees: 0,
      total_profit: 0
    };
  } catch (error) {
    logger.error('Error getting daily sales report:', error);
    throw error;
  }
}

/**
 * Get weekly summary
 */
async function getWeeklySummary(businessId, weekStartDate = null) {
  try {
    let startDate, endDate;
    if (weekStartDate) {
      startDate = new Date(weekStartDate);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      // Current week
      const today = new Date();
      const dayOfWeek = today.getDay();
      startDate = new Date(today);
      startDate.setDate(today.getDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    }
    
    const filters = {
      businessId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
    
    const revenue = await getTotalRevenue(businessId, 'day', filters);
    const orders = await getTotalOrders(businessId, 'day', filters);
    
    const totalRevenue = revenue.reduce((sum, r) => sum + r.total_revenue, 0);
    const totalOrders = orders.reduce((sum, o) => sum + o.order_count, 0);
    
    return {
      week_start: startDate.toISOString().split('T')[0],
      week_end: endDate.toISOString().split('T')[0],
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      avg_daily_revenue: totalRevenue / 7,
      daily_breakdown: revenue
    };
  } catch (error) {
    logger.error('Error getting weekly summary:', error);
    throw error;
  }
}

/**
 * Get monthly performance
 */
async function getMonthlyPerformance(businessId, year = null, month = null) {
  try {
    const today = new Date();
    const targetYear = year || today.getFullYear();
    const targetMonth = month || (today.getMonth() + 1);
    
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const filters = { businessId, startDate, endDate };
    const revenue = await getTotalRevenue(businessId, 'day', filters);
    const orders = await getTotalOrders(businessId, 'day', filters);
    
    const totalRevenue = revenue.reduce((sum, r) => sum + r.total_revenue, 0);
    const totalOrders = orders.reduce((sum, o) => sum + o.order_count, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    return {
      year: targetYear,
      month: targetMonth,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      avg_order_value: avgOrderValue,
      daily_breakdown: revenue
    };
  } catch (error) {
    logger.error('Error getting monthly performance:', error);
    throw error;
  }
}

/**
 * Get month-over-month growth
 */
async function getMonthOverMonthGrowth(businessId) {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Current month
    const current = await getMonthlyPerformance(businessId, currentYear, currentMonth);
    
    // Previous month
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }
    const previous = await getMonthlyPerformance(businessId, prevYear, prevMonth);
    
    const revenueGrowth = previous.total_revenue > 0 
      ? ((current.total_revenue - previous.total_revenue) / previous.total_revenue) * 100 
      : (current.total_revenue > 0 ? 100 : 0);
    
    const orderGrowth = previous.total_orders > 0
      ? ((current.total_orders - previous.total_orders) / previous.total_orders) * 100
      : (current.total_orders > 0 ? 100 : 0);
    
    return {
      current_month: current,
      previous_month: previous,
      revenue_growth_percent: revenueGrowth,
      order_growth_percent: orderGrowth
    };
  } catch (error) {
    logger.error('Error getting month-over-month growth:', error);
    throw error;
  }
}

/**
 * Get best day this month
 */
async function getBestDayThisMonth(businessId) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const filters = { businessId, startDate, endDate };
    const revenue = await getTotalRevenue(businessId, 'day', filters);
    
    if (revenue.length === 0) {
      return null;
    }
    
    const bestDay = revenue.reduce((best, day) => 
      day.total_revenue > best.total_revenue ? day : best
    , revenue[0]);
    
    return bestDay;
  } catch (error) {
    logger.error('Error getting best day this month:', error);
    throw error;
  }
}

/**
 * Get best hour this month
 */
async function getBestHourThisMonth(businessId) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const filters = { businessId, startDate, endDate };
    const peakHours = await getPeakOrderingHours(businessId, filters);
    
    if (peakHours.length === 0) {
      return null;
    }
    
    return peakHours[0]; // Already sorted by order_count DESC
  } catch (error) {
    logger.error('Error getting best hour this month:', error);
    throw error;
  }
}

module.exports = {
  getRevenue,
  getDailySalesReport,
  getWeeklySummary,
  getMonthlyPerformance,
  getMonthOverMonthGrowth,
  getBestDayThisMonth,
  getBestHourThisMonth
};
