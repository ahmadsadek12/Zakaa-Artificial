// Customer Analytics
// All customer-related analytics functions

const { getMongoCollection, queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { buildFilterConditions } = require('./analyticsUtils');

/**
 * Get customer analytics (legacy)
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
 * Get top paying customers (most total spent) (legacy)
 */
async function getTopCustomers(businessId, limit = 10, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    // If MongoDB is unavailable, fallback to MySQL
    if (!orderLogs) {
      logger.warn('MongoDB unavailable - using MySQL for top customers');
      
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
      
      const safeLimit = parseInt(limit, 10) || 10;
      
      const customers = await queryMySQL(`
        SELECT 
          customer_phone_number,
          customer_name,
          SUM(total) as total_spent,
          COUNT(*) as order_count
        FROM orders
        WHERE business_id = ? AND status = 'completed' ${dateFilter}
        GROUP BY customer_phone_number, customer_name
        ORDER BY total_spent DESC
        LIMIT ${safeLimit}
      `, params);
      
      return customers.map(customer => ({
        customerPhoneNumber: customer.customer_phone_number,
        customerName: customer.customer_name || 'Unknown',
        totalSpent: parseFloat(customer.total_spent || 0),
        orderCount: parseInt(customer.order_count || 0),
        averageOrderValue: customer.order_count > 0 
          ? parseFloat(customer.total_spent) / parseInt(customer.order_count)
          : 0
      }));
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
 * Get most recurring customers (customers with most orders) (legacy)
 */
async function getRecurringCustomers(businessId, limit = 10, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    // If MongoDB is unavailable, fallback to MySQL
    if (!orderLogs) {
      logger.warn('MongoDB unavailable - using MySQL for recurring customers');
      
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
      
      const safeLimit = parseInt(limit, 10) || 10;
      
      const customers = await queryMySQL(`
        SELECT 
          customer_phone_number,
          customer_name,
          COUNT(*) as order_count,
          SUM(total) as total_spent,
          MAX(created_at) as last_order_date
        FROM orders
        WHERE business_id = ? AND status = 'completed' ${dateFilter}
        GROUP BY customer_phone_number, customer_name
        ORDER BY order_count DESC
        LIMIT ${safeLimit}
      `, params);
      
      return customers.map(customer => ({
        customerPhoneNumber: customer.customer_phone_number,
        customerName: customer.customer_name || 'Unknown',
        orderCount: parseInt(customer.order_count || 0),
        totalSpent: parseFloat(customer.total_spent || 0),
        lastOrderDate: customer.last_order_date ? new Date(customer.last_order_date) : null
      }));
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
 * Get customer lifetime value analysis (legacy)
 */
async function getCustomerLifetimeValue(businessId, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    // If MongoDB is unavailable, fallback to MySQL
    if (!orderLogs) {
      logger.warn('MongoDB unavailable - using MySQL for lifetime value data');
      
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
      
      const customers = await queryMySQL(`
        SELECT 
          customer_phone_number,
          customer_name,
          COUNT(*) as order_count,
          SUM(total) as total_spent,
          MIN(created_at) as first_order_date,
          MAX(created_at) as last_order_date
        FROM orders
        WHERE business_id = ? AND status = 'completed' ${dateFilter}
        GROUP BY customer_phone_number, customer_name
        ORDER BY total_spent DESC
      `, params);
      
      const customerList = customers.map(customer => {
        const totalSpent = parseFloat(customer.total_spent || 0);
        const orderCount = parseInt(customer.order_count || 0);
        const firstOrderDate = customer.first_order_date ? new Date(customer.first_order_date) : null;
        const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date) : null;
        
        let customerLifespanDays = 0;
        let ordersPerDay = 0;
        if (firstOrderDate && lastOrderDate) {
          customerLifespanDays = Math.ceil((lastOrderDate - firstOrderDate) / (1000 * 60 * 60 * 24));
          ordersPerDay = customerLifespanDays > 0 ? orderCount / customerLifespanDays : orderCount;
        }
        
        return {
          customerPhoneNumber: customer.customer_phone_number,
          customerName: customer.customer_name || 'Unknown',
          totalSpent: totalSpent,
          orderCount: orderCount,
          averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
          lifetimeValue: totalSpent,
          firstOrderDate: firstOrderDate,
          lastOrderDate: lastOrderDate,
          customerLifespanDays: customerLifespanDays,
          ordersPerDay: ordersPerDay
        };
      });
      
      const totalCustomers = customerList.length;
      const totalRevenue = customerList.reduce((sum, c) => sum + c.totalSpent, 0);
      const averageLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
      const averageOrdersPerCustomer = totalCustomers > 0 
        ? customerList.reduce((sum, c) => sum + c.orderCount, 0) / totalCustomers 
        : 0;
      
      return {
        totalCustomers: totalCustomers,
        totalRevenue: totalRevenue,
        averageLifetimeValue: averageLifetimeValue,
        averageOrdersPerCustomer: averageOrdersPerCustomer,
        customers: customerList.sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      };
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
 * Get loyal customer (most orders by customerPhoneNumber) - PAID ADDON (legacy)
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
 * Get most loyal customer (highest # of orders)
 */
async function getMostLoyalCustomer(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        o.customer_phone_number,
        COUNT(*) as order_count,
        SUM(o.total) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.customer_phone_number
      ORDER BY order_count DESC
      LIMIT 1
    `, params);
    
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error('Error getting most loyal customer:', error);
    throw error;
  }
}

/**
 * Get top spenders (highest total spent)
 */
async function getTopSpenders(businessId, limit = 10, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        o.customer_phone_number,
        o.customer_name,
        COUNT(*) as order_count,
        SUM(o.total) as total_spent,
        AVG(o.total) as avg_order_value
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.customer_phone_number, o.customer_name
      ORDER BY total_spent DESC
      LIMIT ?
    `, [...params, limit]);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting top spenders:', error);
    throw error;
  }
}

/**
 * Get highest profit customers (only if cost data exists)
 */
async function getHighestProfitCustomers(businessId, limit = 10, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    // Check if cost_at_time exists in order_items
    const [columnCheck] = await queryMySQL(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'order_items' 
        AND COLUMN_NAME = 'cost_at_time'
    `);
    
    if (!columnCheck || columnCheck.length === 0) {
      // cost_at_time doesn't exist, return empty
      return [];
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        o.customer_phone_number,
        o.customer_name,
        COUNT(DISTINCT o.id) as order_count,
        SUM((oi.price_at_time - COALESCE(oi.cost_at_time, 0)) * oi.quantity) as total_profit,
        SUM(o.total) as total_revenue
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.customer_phone_number, o.customer_name
      ORDER BY total_profit DESC
      LIMIT ?
    `, [...params, limit]);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting highest profit customers:', error);
    throw error;
  }
}

/**
 * Get most frequent customers (most active days)
 */
async function getMostFrequentCustomers(businessId, limit = 10, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        o.customer_phone_number,
        o.customer_name,
        COUNT(DISTINCT DATE(o.created_at)) as active_days,
        COUNT(*) as order_count,
        MIN(DATE(o.created_at)) as first_order_date,
        MAX(DATE(o.created_at)) as last_order_date
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.customer_phone_number, o.customer_name
      ORDER BY active_days DESC, order_count DESC
      LIMIT ?
    `, [...params, limit]);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting most frequent customers:', error);
    throw error;
  }
}

/**
 * Get new vs returning customers
 */
async function getNewVsReturningCustomers(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        o.customer_phone_number,
        COUNT(*) as order_count,
        MIN(o.created_at) as first_order_date
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.customer_phone_number
    `, params);
    
    let newCustomers = 0;
    let returningCustomers = 0;
    
    if (result) {
      for (const row of result) {
        // Check if this is their first order in the period
        const [firstOrderCheck] = await queryMySQL(`
          SELECT COUNT(*) as count
          FROM orders
          WHERE customer_phone_number = ?
            AND business_id = ?
            AND status = 'completed'
            AND created_at < ?
        `, [row.customer_phone_number, businessId, row.first_order_date]);
        
        if (firstOrderCheck && firstOrderCheck[0] && firstOrderCheck[0].count === 0) {
          newCustomers++;
        } else {
          returningCustomers++;
        }
      }
    }
    
    return {
      new: newCustomers,
      returning: returningCustomers,
      total: newCustomers + returningCustomers
    };
  } catch (error) {
    logger.error('Error getting new vs returning customers:', error);
    throw error;
  }
}

/**
 * Get cancelled orders count
 */
async function getCancelledOrdersCount(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'rejected'");
    
    const [result] = await queryMySQL(`
      SELECT COUNT(*) as count
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    return result && result[0] ? result[0].count : 0;
  } catch (error) {
    logger.error('Error getting cancelled orders count:', error);
    throw error;
  }
}

/**
 * Get customer retention (return rate in 7/14/30 days)
 */
async function getCustomerRetention(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    // Get all customers who ordered in the period
    const [customers] = await queryMySQL(`
      SELECT DISTINCT customer_phone_number
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (!customers || customers.length === 0) {
      return { retention7Days: 0, retention14Days: 0, retention30Days: 0 };
    }
    
    const customerPhones = customers.map(c => c.customer_phone_number);
    const placeholders = customerPhones.map(() => '?').join(',');
    
    let retention7Days = 0;
    let retention14Days = 0;
    let retention30Days = 0;
    
    for (const phone of customerPhones) {
      // Get first order date
      const [firstOrder] = await queryMySQL(`
        SELECT MIN(created_at) as first_order
        FROM orders
        WHERE customer_phone_number = ? AND business_id = ? AND status = 'completed'
      `, [phone, businessId]);
      
      if (!firstOrder || !firstOrder[0] || !firstOrder[0].first_order) continue;
      
      const firstOrderDate = new Date(firstOrder[0].first_order);
      
      // Check if they ordered again within 7/14/30 days
      const [returnOrders] = await queryMySQL(`
        SELECT 
          COUNT(CASE WHEN created_at <= DATE_ADD(?, INTERVAL 7 DAY) THEN 1 END) as within_7,
          COUNT(CASE WHEN created_at <= DATE_ADD(?, INTERVAL 14 DAY) THEN 1 END) as within_14,
          COUNT(CASE WHEN created_at <= DATE_ADD(?, INTERVAL 30 DAY) THEN 1 END) as within_30
        FROM orders
        WHERE customer_phone_number = ?
          AND business_id = ?
          AND status = 'completed'
          AND created_at > ?
      `, [firstOrderDate, firstOrderDate, firstOrderDate, phone, businessId, firstOrderDate]);
      
      if (returnOrders && returnOrders[0]) {
        if (returnOrders[0].within_7 > 0) retention7Days++;
        if (returnOrders[0].within_14 > 0) retention14Days++;
        if (returnOrders[0].within_30 > 0) retention30Days++;
      }
    }
    
    const total = customerPhones.length;
    
    return {
      retention7Days: total > 0 ? (retention7Days / total) * 100 : 0,
      retention14Days: total > 0 ? (retention14Days / total) * 100 : 0,
      retention30Days: total > 0 ? (retention30Days / total) * 100 : 0,
      totalCustomers: total
    };
  } catch (error) {
    logger.error('Error getting customer retention:', error);
    throw error;
  }
}

/**
 * Get churned customers (used to order, stopped - no order in 2 months)
 */
async function getChurnedCustomers(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    // Get all customers who have completed at least one order
    const [allCustomers] = await queryMySQL(`
      SELECT DISTINCT customer_phone_number
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (!allCustomers || allCustomers.length === 0) {
      return [];
    }
    
    const churned = [];
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    for (const customer of allCustomers) {
      // Check if they have any orders in the last 2 months
      const [recentOrders] = await queryMySQL(`
        SELECT COUNT(*) as count
        FROM orders
        WHERE customer_phone_number = ?
          AND business_id = ?
          AND status = 'completed'
          AND created_at >= ?
      `, [customer.customer_phone_number, businessId, twoMonthsAgo]);
      
      // Check if they had orders before (returning customer)
      const [previousOrders] = await queryMySQL(`
        SELECT COUNT(*) as count, MAX(created_at) as last_order
        FROM orders
        WHERE customer_phone_number = ?
          AND business_id = ?
          AND status = 'completed'
          AND created_at < ?
      `, [customer.customer_phone_number, businessId, twoMonthsAgo]);
      
      if (recentOrders && recentOrders[0] && recentOrders[0].count === 0 &&
          previousOrders && previousOrders[0] && previousOrders[0].count > 0) {
        churned.push({
          customer_phone_number: customer.customer_phone_number,
          last_order_date: previousOrders[0].last_order,
          days_since_last_order: Math.floor((Date.now() - new Date(previousOrders[0].last_order).getTime()) / (1000 * 60 * 60 * 24))
        });
      }
    }
    
    return churned.sort((a, b) => b.days_since_last_order - a.days_since_last_order);
  } catch (error) {
    logger.error('Error getting churned customers:', error);
    throw error;
  }
}

/**
 * Get average order value per customer
 */
async function getAvgOrderValuePerCustomer(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        o.customer_phone_number,
        COUNT(*) as order_count,
        AVG(o.total) as avg_order_value,
        SUM(o.total) as total_spent
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.customer_phone_number
    `, params);
    
    if (!result || result.length === 0) {
      return { overallAvg: 0, customerAverages: [] };
    }
    
    const totalAOV = result.reduce((sum, r) => sum + parseFloat(r.avg_order_value || 0), 0) / result.length;
    
    return {
      overallAvg: totalAOV,
      customerAverages: result.map(r => ({
        customer_phone_number: r.customer_phone_number,
        order_count: r.order_count,
        avg_order_value: parseFloat(r.avg_order_value || 0),
        total_spent: parseFloat(r.total_spent || 0)
      }))
    };
  } catch (error) {
    logger.error('Error getting avg order value per customer:', error);
    throw error;
  }
}

/**
 * Get customer response behavior (avg time to confirm, cancel rate)
 */
async function getCustomerResponseBehavior(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    
    // Get average time to confirm (created_at to first_response_at)
    const [responseTime] = await queryMySQL(`
      SELECT 
        AVG(TIMESTAMPDIFF(SECOND, o.created_at, o.first_response_at)) as avg_seconds
      FROM orders o
      WHERE ${conditions.join(' AND ')}
        AND o.first_response_at IS NOT NULL
    `, params);
    
    // Get cancel rate
    const [cancelStats] = await queryMySQL(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN o.status = 'rejected' THEN 1 ELSE 0 END) as cancelled
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    const total = cancelStats && cancelStats[0] ? cancelStats[0].total : 0;
    const cancelled = cancelStats && cancelStats[0] ? cancelStats[0].cancelled : 0;
    const cancelRate = total > 0 ? (cancelled / total) * 100 : 0;
    
    return {
      avgTimeToConfirmSeconds: responseTime && responseTime[0] ? Math.round(responseTime[0].avg_seconds || 0) : 0,
      cancelRate: cancelRate,
      totalOrders: total,
      cancelledOrders: cancelled
    };
  } catch (error) {
    logger.error('Error getting customer response behavior:', error);
    throw error;
  }
}

/**
 * Get customer location clusters (by delivery address text/area)
 */
async function getCustomerLocationClusters(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    conditions.push("o.delivery_type = 'delivery'");
    conditions.push("o.location_address IS NOT NULL AND o.location_address != ''");
    
    const [result] = await queryMySQL(`
      SELECT 
        o.location_address,
        COUNT(*) as order_count,
        COUNT(DISTINCT o.customer_phone_number) as unique_customers,
        SUM(o.total) as total_revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.location_address
      ORDER BY order_count DESC
      LIMIT 50
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting customer location clusters:', error);
    throw error;
  }
}

module.exports = {
  getCustomerAnalytics,
  getTopCustomers,
  getRecurringCustomers,
  getCustomerLifetimeValue,
  getLoyalCustomer,
  getMostLoyalCustomer,
  getTopSpenders,
  getHighestProfitCustomers,
  getMostFrequentCustomers,
  getNewVsReturningCustomers,
  getCancelledOrdersCount,
  getCustomerRetention,
  getChurnedCustomers,
  getAvgOrderValuePerCustomer,
  getCustomerResponseBehavior,
  getCustomerLocationClusters
};
