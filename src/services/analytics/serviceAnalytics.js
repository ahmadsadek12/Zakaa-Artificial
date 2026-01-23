// Service Analytics
// All service/item-related analytics functions

const { getMongoCollection, queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { buildFilterConditions } = require('./analyticsUtils');

/**
 * Get top items analytics (legacy)
 */
async function getTopItems(businessId, limit = 10, startDate, endDate) {
  try {
    const orderLogs = await getMongoCollection('order_logs');
    
    // If MongoDB is unavailable, return empty array
    if (!orderLogs) {
      logger.warn('MongoDB unavailable - returning empty top items list');
      return [];
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
 * Get popular items (most ordered - using times_ordered from items table) (legacy)
 */
async function getPopularItems(businessId, limit = 10) {
  try {
    // Try to query with times_ordered - if column doesn't exist, return empty array
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
    // If error is about unknown column, return empty array
    if (error.message && error.message.includes('Unknown column')) {
      logger.warn('times_ordered column not found - returning empty popular items list');
      return [];
    }
    logger.error('Error getting popular items:', error);
    throw error;
  }
}

/**
 * Get most delivered items (most completed - using times_delivered from items table) (legacy)
 */
async function getMostDeliveredItems(businessId, limit = 10) {
  try {
    // Try to query with times_delivered - if column doesn't exist, return empty array
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
    // If error is about unknown column, return empty array
    if (error.message && error.message.includes('Unknown column')) {
      logger.warn('times_delivered column not found - returning empty delivered items list');
      return [];
    }
    logger.error('Error getting most delivered items:', error);
    throw error;
  }
}

/**
 * Get most ordered service (top service by sum(qty)) - PAID ADDON (legacy)
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
 * Get most rewarding service (max (priceAtTime - costAtTime) * qty per service) - PAID ADDON (legacy)
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
 * Get least ordered service
 */
async function getLeastOrderedService(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        oi.item_id,
        i.name,
        SUM(oi.quantity) as total_qty,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY oi.item_id, i.name
      HAVING total_qty > 0
      ORDER BY total_qty ASC
      LIMIT 1
    `, params);
    
    return result && result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error('Error getting least ordered service:', error);
    throw error;
  }
}

/**
 * Get revenue per service
 */
async function getRevenuePerService(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        oi.item_id,
        i.name,
        SUM(oi.price_at_time * oi.quantity) as total_revenue,
        SUM(oi.quantity) as total_quantity,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY oi.item_id, i.name
      ORDER BY total_revenue DESC
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting revenue per service:', error);
    throw error;
  }
}

/**
 * Get profit per service
 */
async function getProfitPerService(businessId, filters = {}) {
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
      return await getRevenuePerService(businessId, filters);
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        oi.item_id,
        i.name,
        SUM((oi.price_at_time - COALESCE(oi.cost_at_time, 0)) * oi.quantity) as total_profit,
        SUM(oi.price_at_time * oi.quantity) as total_revenue,
        SUM(oi.quantity) as total_quantity
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY oi.item_id, i.name
      ORDER BY total_profit DESC
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting profit per service:', error);
    throw error;
  }
}

/**
 * Get profit margin per service
 */
async function getProfitMarginPerService(businessId, filters = {}) {
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
      // Return 0 margin if cost not tracked
      return [];
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        oi.item_id,
        i.name,
        AVG((oi.price_at_time - COALESCE(oi.cost_at_time, 0)) / NULLIF(oi.price_at_time, 0)) * 100 as avg_margin_percent,
        SUM((oi.price_at_time - COALESCE(oi.cost_at_time, 0)) * oi.quantity) as total_profit,
        SUM(oi.price_at_time * oi.quantity) as total_revenue
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY oi.item_id, i.name
      ORDER BY avg_margin_percent DESC
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting profit margin per service:', error);
    throw error;
  }
}

/**
 * Get service popularity trend (up/down vs last period)
 */
async function getServicePopularityTrend(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    // Get current period data
    const [currentPeriod] = await queryMySQL(`
      SELECT 
        oi.item_id,
        i.name,
        SUM(oi.quantity) as total_qty
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY oi.item_id, i.name
    `, params);
    
    // Calculate period length to get previous period
    let periodDays = 30; // default
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    // Get previous period data
    const prevStartDate = filters.startDate ? new Date(new Date(filters.startDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;
    const prevEndDate = filters.startDate ? filters.startDate : null;
    
    const prevConditions = buildFilterConditions({ ...filters, businessId, startDate: prevStartDate, endDate: prevEndDate });
    prevConditions.conditions.push("o.status = 'completed'");
    
    const [previousPeriod] = await queryMySQL(`
      SELECT 
        oi.item_id,
        SUM(oi.quantity) as total_qty
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE ${prevConditions.conditions.join(' AND ')}
      GROUP BY oi.item_id
    `, prevConditions.params);
    
    const prevMap = {};
    if (previousPeriod) {
      previousPeriod.forEach(item => {
        prevMap[item.item_id] = item.total_qty;
      });
    }
    
    // Calculate trend
    const result = (currentPeriod || []).map(item => {
      const prevQty = prevMap[item.item_id] || 0;
      const currentQty = item.total_qty || 0;
      const change = currentQty - prevQty;
      const changePercent = prevQty > 0 ? ((change / prevQty) * 100) : (currentQty > 0 ? 100 : 0);
      
      return {
        item_id: item.item_id,
        name: item.name,
        current_quantity: currentQty,
        previous_quantity: prevQty,
        change: change,
        change_percent: changePercent,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    });
    
    return result.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));
  } catch (error) {
    logger.error('Error getting service popularity trend:', error);
    throw error;
  }
}

/**
 * Get top services by time of day
 */
async function getTopServicesByTimeOfDay(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        HOUR(o.completed_at) as hour,
        oi.item_id,
        i.name,
        SUM(oi.quantity) as total_qty,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN items i ON oi.item_id = i.id
      WHERE ${conditions.join(' AND ')}
        AND o.completed_at IS NOT NULL
      GROUP BY HOUR(o.completed_at), oi.item_id, i.name
      ORDER BY hour ASC, total_qty DESC
    `, params);
    
    // Group by hour
    const byHour = {};
    if (result) {
      result.forEach(row => {
        if (!byHour[row.hour]) {
          byHour[row.hour] = [];
        }
        byHour[row.hour].push({
          item_id: row.item_id,
          name: row.name,
          total_qty: row.total_qty,
          order_count: row.order_count
        });
      });
    }
    
    return byHour;
  } catch (error) {
    logger.error('Error getting top services by time of day:', error);
    throw error;
  }
}

/**
 * Get frequently bought together (pairs/combos)
 */
async function getFrequentlyBoughtTogether(businessId, limit = 10, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    const [result] = await queryMySQL(`
      SELECT 
        oi1.item_id as item1_id,
        i1.name as item1_name,
        oi2.item_id as item2_id,
        i2.name as item2_name,
        COUNT(*) as times_bought_together
      FROM order_items oi1
      INNER JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.item_id < oi2.item_id
      INNER JOIN orders o ON oi1.order_id = o.id
      LEFT JOIN items i1 ON oi1.item_id = i1.id
      LEFT JOIN items i2 ON oi2.item_id = i2.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY oi1.item_id, oi2.item_id, i1.name, i2.name
      ORDER BY times_bought_together DESC
      LIMIT ?
    `, [...params, limit]);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting frequently bought together:', error);
    throw error;
  }
}

/**
 * Get customization usage (most selected add-ons)
 */
async function getCustomizationUsage(businessId, limit = 20, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    
    // Check if order_item_customizations table exists
    const [tableCheck] = await queryMySQL(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'order_item_customizations'
    `);
    
    if (!tableCheck || tableCheck.length === 0) {
      return [];
    }
    
    const [result] = await queryMySQL(`
      SELECT 
        oic.customization_name,
        COUNT(*) as usage_count,
        SUM(oic.price_adjustment) as total_price_adjustment,
        COUNT(DISTINCT oic.order_item_id) as order_items_count
      FROM order_item_customizations oic
      INNER JOIN order_items oi ON oic.order_item_id = oi.id
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY oic.customization_name
      ORDER BY usage_count DESC
      LIMIT ?
    `, [...params, limit]);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting customization usage:', error);
    throw error;
  }
}

/**
 * Get out-of-stock impact (lost demand signals)
 * NOTE: Requires stock tracking system - returns placeholder for now
 */
async function getOutOfStockImpact(businessId, filters = {}) {
  try {
    // Placeholder - requires stock tracking system
    return {
      message: 'Out-of-stock impact tracking requires stock management system',
      data: []
    };
  } catch (error) {
    logger.error('Error getting out-of-stock impact:', error);
    throw error;
  }
}

module.exports = {
  getTopItems,
  getPopularItems,
  getMostDeliveredItems,
  getMostOrdered,
  getMostRewarding,
  getLeastOrderedService,
  getRevenuePerService,
  getProfitPerService,
  getProfitMarginPerService,
  getServicePopularityTrend,
  getTopServicesByTimeOfDay,
  getFrequentlyBoughtTogether,
  getCustomizationUsage,
  getOutOfStockImpact
};
