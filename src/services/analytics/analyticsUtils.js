// Analytics Utilities
// Shared helper functions for analytics services

const { queryMySQL } = require('../../config/database');

/**
 * Helper: Build filter conditions for analytics queries
 */
function buildFilterConditions(filters = {}) {
  const conditions = [];
  const params = [];
  
  if (filters.businessId) {
    conditions.push('o.business_id = ?');
    params.push(filters.businessId);
  }
  
  if (filters.branchId) {
    conditions.push('o.user_id = ?');
    params.push(filters.branchId);
  }
  
  if (filters.startDate) {
    conditions.push('o.created_at >= ?');
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    conditions.push('o.created_at <= ?');
    params.push(filters.endDate);
  }
  
  if (filters.deliveryType) {
    conditions.push('o.delivery_type = ?');
    params.push(filters.deliveryType);
  }
  
  if (filters.platform) {
    conditions.push('o.order_source = ?');
    params.push(filters.platform);
  }
  
  if (filters.categoryId) {
    conditions.push('i.category_id = ?');
    params.push(filters.categoryId);
  }
  
  if (filters.menuId) {
    conditions.push('i.menu_id = ?');
    params.push(filters.menuId);
  }
  
  return { conditions, params };
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
  buildFilterConditions,
  getWeekNumber
};
