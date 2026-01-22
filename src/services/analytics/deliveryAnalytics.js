// Delivery/Logistics Analytics
// All delivery/logistics-related analytics functions

const { queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { buildFilterConditions } = require('./analyticsUtils');

/**
 * Get carrier usage (FRONTEND ONLY - placeholder)
 */
async function getCarrierUsage(businessId, filters = {}) {
  try {
    // Placeholder - returns empty data
    return {
      message: 'Carrier usage tracking coming soon',
      data: []
    };
  } catch (error) {
    logger.error('Error getting carrier usage:', error);
    throw error;
  }
}

/**
 * Get avg delivery time range (FRONTEND ONLY - placeholder)
 */
async function getAvgDeliveryTimeRange(businessId, filters = {}) {
  try {
    // Placeholder - returns empty data
    return {
      message: 'Delivery time tracking coming soon',
      avg_minutes: 0,
      min_minutes: 0,
      max_minutes: 0
    };
  } catch (error) {
    logger.error('Error getting avg delivery time range:', error);
    throw error;
  }
}

/**
 * Get busy delivery slots (peak scheduled times)
 */
async function getBusyDeliverySlots(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    conditions.push("o.scheduled_for IS NOT NULL");
    
    const [result] = await queryMySQL(`
      SELECT 
        HOUR(o.scheduled_for) as hour,
        COUNT(*) as order_count,
        SUM(o.total) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY HOUR(o.scheduled_for)
      ORDER BY order_count DESC
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting busy delivery slots:', error);
    throw error;
  }
}

/**
 * Get common delivery areas (district aggregation)
 */
async function getCommonDeliveryAreas(businessId, filters = {}) {
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
        SUM(o.total) as revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.location_address
      ORDER BY order_count DESC
      LIMIT 50
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting common delivery areas:', error);
    throw error;
  }
}

/**
 * Get delivery fee revenue
 */
async function getDeliveryFeeRevenue(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    conditions.push("o.status = 'completed'");
    conditions.push("o.delivery_type = 'delivery'");
    
    const [result] = await queryMySQL(`
      SELECT 
        SUM(o.delivery_price) as total_delivery_fees,
        COUNT(*) as delivery_order_count,
        SUM(o.total) as total_revenue
      FROM orders o
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (result && result[0]) {
      return {
        total_delivery_fees: parseFloat(result[0].total_delivery_fees || 0),
        delivery_order_count: result[0].delivery_order_count,
        total_revenue: parseFloat(result[0].total_revenue || 0)
      };
    }
    
    return { total_delivery_fees: 0, delivery_order_count: 0, total_revenue: 0 };
  } catch (error) {
    logger.error('Error getting delivery fee revenue:', error);
    throw error;
  }
}

module.exports = {
  getCarrierUsage,
  getAvgDeliveryTimeRange,
  getBusyDeliverySlots,
  getCommonDeliveryAreas,
  getDeliveryFeeRevenue
};
