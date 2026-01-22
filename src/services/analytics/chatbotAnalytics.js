// Chatbot + Ops Analytics
// All chatbot/ops-related analytics functions

const { getMongoCollection, queryMySQL } = require('../../config/database');
const logger = require('../../utils/logger');
const { buildFilterConditions } = require('./analyticsUtils');

/**
 * Get requests handled (inbound messages count)
 */
async function getRequestsHandled(businessId, filters = {}) {
  try {
    let messageLogs;
    try {
      messageLogs = await getMongoCollection('message_logs');
    } catch (mongoError) {
      logger.warn('MongoDB not available for requests handled:', mongoError.message);
      return { count: 0, period: filters.period || 'all' };
    }
    
    const query = {
      business_id: businessId,
      direction: 'inbound'
    };
    
    if (filters.startDate || filters.endDate) {
      query.created_at = {};
      if (filters.startDate) query.created_at.$gte = new Date(filters.startDate);
      if (filters.endDate) query.created_at.$lte = new Date(filters.endDate);
    }
    
    const count = await messageLogs.countDocuments(query);
    
    return { count, period: filters.period || 'all' };
  } catch (error) {
    logger.error('Error getting requests handled:', error);
    throw error;
  }
}

/**
 * Get conversations count (unique customers per day)
 */
async function getConversationsCount(businessId, filters = {}) {
  try {
    let messageLogs;
    try {
      messageLogs = await getMongoCollection('message_logs');
    } catch (mongoError) {
      logger.warn('MongoDB not available for conversations count:', mongoError.message);
      return { count: 0, unique_customers: 0 };
    }
    
    const query = {
      business_id: businessId,
      direction: 'inbound'
    };
    
    if (filters.startDate || filters.endDate) {
      query.created_at = {};
      if (filters.startDate) query.created_at.$gte = new Date(filters.startDate);
      if (filters.endDate) query.created_at.$lte = new Date(filters.endDate);
    }
    
    const uniqueCustomers = await messageLogs.distinct('customer_phone_number', query);
    const totalMessages = await messageLogs.countDocuments(query);
    
    return {
      count: totalMessages,
      unique_customers: uniqueCustomers.length
    };
  } catch (error) {
    logger.error('Error getting conversations count:', error);
    throw error;
  }
}

/**
 * Get average response time (first response + overall)
 */
async function getAverageResponseTime(businessId, filters = {}) {
  try {
    // Try MongoDB first
    let messageLogs;
    try {
      messageLogs = await getMongoCollection('message_logs');
      
      const query = {
        business_id: businessId,
        direction: 'inbound'
      };
      
      if (filters.startDate || filters.endDate) {
        query.created_at = {};
        if (filters.startDate) query.created_at.$gte = new Date(filters.startDate);
        if (filters.endDate) query.created_at.$lte = new Date(filters.endDate);
      }
      
      const inboundMessages = await messageLogs.find(query).sort({ created_at: 1 }).toArray();
      
      let totalResponseTime = 0;
      let responseCount = 0;
      
      for (const inbound of inboundMessages) {
        const outbound = await messageLogs.findOne({
          business_id: businessId,
          customer_phone_number: inbound.customer_phone_number,
          direction: 'outbound',
          created_at: {
            $gte: inbound.created_at,
            $lte: new Date(inbound.created_at.getTime() + 5 * 60 * 1000)
          }
        });
        
        if (outbound) {
          const responseTime = outbound.created_at.getTime() - inbound.created_at.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
      
      const avgMs = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
      
      return {
        first_response_ms: avgMs,
        overall_avg_ms: avgMs
      };
    } catch (mongoError) {
      logger.warn('MongoDB not available, using MySQL for response time:', mongoError.message);
    }
    
    // Fallback to MySQL
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    
    const [result] = await queryMySQL(`
      SELECT 
        AVG(TIMESTAMPDIFF(MILLISECOND, o.created_at, o.first_response_at)) as avg_first_response_ms
      FROM orders o
      WHERE ${conditions.join(' AND ')}
        AND o.first_response_at IS NOT NULL
    `, params);
    
    const avgMs = result && result[0] ? Math.round(result[0].avg_first_response_ms || 0) : 0;
    
    return {
      first_response_ms: avgMs,
      overall_avg_ms: avgMs
    };
  } catch (error) {
    logger.error('Error getting average response time:', error);
    throw error;
  }
}

/**
 * Get resolution rate (orders created vs chats)
 */
async function getResolutionRate(businessId, filters = {}) {
  try {
    // Get chats count from MongoDB
    let chatCount = 0;
    try {
      const messageLogs = await getMongoCollection('message_logs');
      const query = {
        business_id: businessId,
        direction: 'inbound'
      };
      
      if (filters.startDate || filters.endDate) {
        query.created_at = {};
        if (filters.startDate) query.created_at.$gte = new Date(filters.startDate);
        if (filters.endDate) query.created_at.$lte = new Date(filters.endDate);
      }
      
      chatCount = await messageLogs.countDocuments(query);
    } catch (mongoError) {
      logger.warn('MongoDB not available for resolution rate:', mongoError.message);
    }
    
    // Get orders count
    const { conditions, params } = buildFilterConditions({ ...filters, businessId });
    
    const [orderResult] = await queryMySQL(`
      SELECT COUNT(*) as count
      FROM orders o
      WHERE ${conditions.join(' AND ')}
        AND o.status != 'cart'
    `, params);
    
    const orderCount = orderResult && orderResult[0] ? orderResult[0].count : 0;
    
    return {
      resolution_rate: chatCount > 0 ? (orderCount / chatCount) * 100 : 0,
      chats_count: chatCount,
      orders_count: orderCount
    };
  } catch (error) {
    logger.error('Error getting resolution rate:', error);
    throw error;
  }
}

/**
 * Get conversion rate (chat → order)
 */
async function getConversionRate(businessId, filters = {}) {
  try {
    // Similar to resolution rate
    return await getResolutionRate(businessId, filters);
  } catch (error) {
    logger.error('Error getting conversion rate:', error);
    throw error;
  }
}

/**
 * Get drop-off points (where users stop replying)
 */
async function getDropOffPoints(businessId, filters = {}) {
  try {
    let messageLogs;
    try {
      messageLogs = await getMongoCollection('message_logs');
    } catch (mongoError) {
      logger.warn('MongoDB not available for drop-off points:', mongoError.message);
      return [];
    }
    
    const query = {
      business_id: businessId
    };
    
    if (filters.startDate || filters.endDate) {
      query.created_at = {};
      if (filters.startDate) query.created_at.$gte = new Date(filters.startDate);
      if (filters.endDate) query.created_at.$lte = new Date(filters.endDate);
    }
    
    // Get conversations that ended with inbound (no response)
    const conversations = await messageLogs.find(query).sort({ created_at: 1 }).toArray();
    
    const dropOffs = {};
    
    for (const msg of conversations) {
      if (msg.direction === 'inbound') {
        // Check if there's a response within 5 minutes
        const response = await messageLogs.findOne({
          business_id: businessId,
          customer_phone_number: msg.customer_phone_number,
          direction: 'outbound',
          created_at: {
            $gte: msg.created_at,
            $lte: new Date(msg.created_at.getTime() + 5 * 60 * 1000)
          }
        });
        
        if (!response) {
          // This is a drop-off point
          const key = msg.message_type || 'text';
          dropOffs[key] = (dropOffs[key] || 0) + 1;
        }
      }
    }
    
    return Object.entries(dropOffs).map(([type, count]) => ({
      message_type: type,
      drop_off_count: count
    })).sort((a, b) => b.drop_off_count - a.drop_off_count);
  } catch (error) {
    logger.error('Error getting drop-off points:', error);
    throw error;
  }
}

/**
 * Get most asked questions (intent/topic frequency)
 */
async function getMostAskedQuestions(businessId, limit = 20, filters = {}) {
  try {
    let messageLogs;
    try {
      messageLogs = await getMongoCollection('message_logs');
    } catch (mongoError) {
      logger.warn('MongoDB not available for most asked questions:', mongoError.message);
      return [];
    }
    
    const query = {
      business_id: businessId,
      direction: 'inbound'
    };
    
    if (filters.startDate || filters.endDate) {
      query.created_at = {};
      if (filters.startDate) query.created_at.$gte = new Date(filters.startDate);
      if (filters.endDate) query.created_at.$lte = new Date(filters.endDate);
    }
    
    const messages = await messageLogs.find(query).toArray();
    
    // Group by text content (simplified - in production would use intent classification)
    const questionMap = {};
    messages.forEach(msg => {
      const text = (msg.text || msg.content || '').substring(0, 100).toLowerCase();
      if (text) {
        questionMap[text] = (questionMap[text] || 0) + 1;
      }
    });
    
    return Object.entries(questionMap)
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    logger.error('Error getting most asked questions:', error);
    throw error;
  }
}

/**
 * Get fallback rate (LLM didn't understand)
 */
async function getFallbackRate(businessId, filters = {}) {
  try {
    let messageLogs;
    try {
      messageLogs = await getMongoCollection('message_logs');
    } catch (mongoError) {
      logger.warn('MongoDB not available for fallback rate:', mongoError.message);
      return { fallback_rate: 0, total_messages: 0, fallback_count: 0 };
    }
    
    const query = {
      business_id: businessId,
      direction: 'inbound'
    };
    
    if (filters.startDate || filters.endDate) {
      query.created_at = {};
      if (filters.startDate) query.created_at.$gte = new Date(filters.startDate);
      if (filters.endDate) query.created_at.$lte = new Date(filters.endDate);
    }
    
    const totalMessages = await messageLogs.countDocuments(query);
    
    // Check for fallback indicators (messages with "fallback" or "didn't understand" in response)
    query.fallback_used = true;
    const fallbackCount = await messageLogs.countDocuments(query);
    
    return {
      fallback_rate: totalMessages > 0 ? (fallbackCount / totalMessages) * 100 : 0,
      total_messages: totalMessages,
      fallback_count: fallbackCount
    };
  } catch (error) {
    logger.error('Error getting fallback rate:', error);
    throw error;
  }
}

module.exports = {
  getRequestsHandled,
  getConversationsCount,
  getAverageResponseTime,
  getResolutionRate,
  getConversionRate,
  getDropOffPoints,
  getMostAskedQuestions,
  getFallbackRate
};
