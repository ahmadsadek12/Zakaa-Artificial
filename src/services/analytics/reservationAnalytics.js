// Reservations Analytics
// All reservation-related analytics functions

const { queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { buildFilterConditions } = require('./analyticsUtils');

/**
 * Get total reservations
 */
async function getTotalReservations(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    // Map businessId to business_user_id for reservations table
    const businessIdIndex = conditions.findIndex(c => c.includes('business_id'));
    if (businessIdIndex >= 0) {
      conditions[businessIdIndex] = conditions[businessIdIndex].replace('business_id', 'business_user_id');
    } else {
      conditions.push('r.business_user_id = ?');
      params.unshift(businessId);
    }
    
    const result = await queryMySQL(`
      SELECT COUNT(*) as total
      FROM reservations r
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    return {
      total: result && result.length > 0 ? result[0].total : 0
    };
  } catch (error) {
    logger.error('Error getting total reservations:', error);
    // Return default values instead of throwing
    return { total: 0 };
  }
}

/**
 * Get reservation completion rate
 */
async function getReservationCompletionRate(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    const businessIdIndex = conditions.findIndex(c => c.includes('business_id'));
    if (businessIdIndex >= 0) {
      conditions[businessIdIndex] = conditions[businessIdIndex].replace('business_id', 'business_user_id');
    } else {
      conditions.push('r.business_user_id = ?');
      params.unshift(businessId);
    }
    
    const result = await queryMySQL(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM reservations r
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (result && result.length > 0 && result[0].total > 0) {
      return {
        completion_rate: (result[0].completed / result[0].total) * 100,
        total: result[0].total,
        completed: result[0].completed
      };
    }
    
    return { completion_rate: 0, total: 0, completed: 0 };
  } catch (error) {
    logger.error('Error getting reservation completion rate:', error);
    return { completion_rate: 0, total: 0, completed: 0 };
  }
}

/**
 * Get no-show rate
 */
async function getNoShowRate(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    const businessIdIndex = conditions.findIndex(c => c.includes('business_id'));
    if (businessIdIndex >= 0) {
      conditions[businessIdIndex] = conditions[businessIdIndex].replace('business_id', 'business_user_id');
    } else {
      conditions.push('r.business_user_id = ?');
      params.unshift(businessId);
    }
    
    // Check if no_show column exists
    let hasNoShow = false;
    try {
      const columnCheck = await queryMySQL(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'reservations' 
          AND COLUMN_NAME = 'no_show'
      `);
      hasNoShow = columnCheck && columnCheck.length > 0;
    } catch (err) {
      hasNoShow = false;
    }
    
    if (!hasNoShow) {
      // Fallback: check status = 'no_show' if status enum includes it
      const result = await queryMySQL(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN r.status = 'no_show' THEN 1 ELSE 0 END) as no_shows
        FROM reservations r
        WHERE ${conditions.join(' AND ')}
      `, params);
      
      if (result && result.length > 0 && result[0].total > 0) {
        return {
          no_show_rate: (result[0].no_shows / result[0].total) * 100,
          total: result[0].total,
          no_shows: result[0].no_shows
        };
      }
      return { no_show_rate: 0, total: 0, no_shows: 0 };
    }
    
    const result = await queryMySQL(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN r.no_show = 1 THEN 1 ELSE 0 END) as no_shows
      FROM reservations r
      WHERE ${conditions.join(' AND ')}
    `, params);
    
    if (result && result.length > 0 && result[0].total > 0) {
      return {
        no_show_rate: (result[0].no_shows / result[0].total) * 100,
        total: result[0].total,
        no_shows: result[0].no_shows
      };
    }
    
    return { no_show_rate: 0, total: 0, no_shows: 0 };
  } catch (error) {
    logger.error('Error getting no-show rate:', error);
    return { no_show_rate: 0, total: 0, no_shows: 0 };
  }
}

/**
 * Get peak reservation hours
 */
async function getPeakReservationHours(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    const businessIdIndex = conditions.findIndex(c => c.includes('business_id'));
    if (businessIdIndex >= 0) {
      conditions[businessIdIndex] = conditions[businessIdIndex].replace('business_id', 'business_user_id');
    } else {
      conditions.push('r.business_user_id = ?');
      params.unshift(businessId);
    }
    
    const result = await queryMySQL(`
      SELECT 
        HOUR(r.reservation_time) as hour,
        COUNT(*) as count
      FROM reservations r
      WHERE ${conditions.join(' AND ')}
      GROUP BY HOUR(r.reservation_time)
      ORDER BY count DESC
      LIMIT 24
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting peak reservation hours:', error);
    return [];
  }
}

/**
 * Get peak reservation days
 */
async function getPeakReservationDays(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    const businessIdIndex = conditions.findIndex(c => c.includes('business_id'));
    if (businessIdIndex >= 0) {
      conditions[businessIdIndex] = conditions[businessIdIndex].replace('business_id', 'business_user_id');
    } else {
      conditions.push('r.business_user_id = ?');
      params.unshift(businessId);
    }
    
    const result = await queryMySQL(`
      SELECT 
        DAYNAME(r.reservation_date) as day,
        COUNT(*) as count
      FROM reservations r
      WHERE ${conditions.join(' AND ')}
      GROUP BY DAYNAME(r.reservation_date)
      ORDER BY 
        FIELD(DAYNAME(r.reservation_date), 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    `, params);
    
    return result || [];
  } catch (error) {
    logger.error('Error getting peak reservation days:', error);
    return [];
  }
}

/**
 * Get table utilization
 */
async function getTableUtilization(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    const businessIdIndex = conditions.findIndex(c => c.includes('business_id'));
    if (businessIdIndex >= 0) {
      conditions[businessIdIndex] = conditions[businessIdIndex].replace('business_id', 'business_user_id');
    } else {
      conditions.push('r.business_user_id = ?');
      params.unshift(businessId);
    }
    
    // Get reservations per table
    const result = await queryMySQL(`
      SELECT 
        r.table_id,
        t.number as table_number,
        COUNT(*) as reservation_count,
        COUNT(DISTINCT DATE(r.reservation_date)) as days_used
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      WHERE ${conditions.join(' AND ')}
        AND r.table_id IS NOT NULL
      GROUP BY r.table_id, t.number
      ORDER BY reservation_count DESC
    `, params);
    
    // Calculate utilization percentage (simplified: based on reservation count)
    return (result || []).map(row => ({
      table_id: row.table_id,
      table: row.table_number || row.table_id || 'N/A',
      utilization: row.reservation_count > 0 ? Math.min((row.reservation_count / 30) * 100, 100) : 0, // Rough estimate
      reservation_count: row.reservation_count,
      days_used: row.days_used
    }));
  } catch (error) {
    logger.error('Error getting table utilization:', error);
    return [];
  }
}

/**
 * Get avg guests per reservation
 */
async function getAvgGuestsPerReservation(businessId, filters = {}) {
  try {
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    const businessIdIndex = conditions.findIndex(c => c.includes('business_id'));
    if (businessIdIndex >= 0) {
      conditions[businessIdIndex] = conditions[businessIdIndex].replace('business_id', 'business_user_id');
    } else {
      conditions.push('r.business_user_id = ?');
      params.unshift(businessId);
    }
    
    const result = await queryMySQL(`
      SELECT 
        AVG(r.number_of_guests) as avg_guests,
        COUNT(*) as total_reservations
      FROM reservations r
      WHERE ${conditions.join(' AND ')}
        AND r.number_of_guests IS NOT NULL
    `, params);
    
    if (result && result.length > 0 && result[0].total_reservations > 0) {
      return {
        avg_guests: parseFloat(result[0].avg_guests || 0),
        total_reservations: result[0].total_reservations
      };
    }
    
    return { avg_guests: 0, total_reservations: 0 };
  } catch (error) {
    logger.error('Error getting avg guests per reservation:', error);
    return { avg_guests: 0, total_reservations: 0 };
  }
}

module.exports = {
  getTotalReservations,
  getReservationCompletionRate,
  getNoShowRate,
  getPeakReservationHours,
  getPeakReservationDays,
  getTableUtilization,
  getAvgGuestsPerReservation
};
