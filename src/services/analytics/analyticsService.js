// Analytics Service (Premium)
// Premium analytics for businesses
// Main entry point that imports and re-exports all analytics functions

// Import all category modules
const customerAnalytics = require('./customerAnalytics');
const serviceAnalytics = require('./serviceAnalytics');
const orderAnalytics = require('./orderAnalytics');
const chatbotAnalytics = require('./chatbotAnalytics');
const deliveryAnalytics = require('./deliveryAnalytics');
const reservationAnalytics = require('./reservationAnalytics');
const financialAnalytics = require('./financialAnalytics');
const legacyAnalytics = require('./legacyAnalytics');

// Re-export all functions to maintain backward compatibility
module.exports = {
  // Legacy/General Analytics
  getOverview: legacyAnalytics.getOverview,
  getBranchComparison: legacyAnalytics.getBranchComparison,
  getFreeMetrics: legacyAnalytics.getFreeMetrics,
  
  // Revenue (legacy - moved to financial)
  getRevenue: financialAnalytics.getRevenue,
  
  // Service Analytics (legacy)
  getTopItems: serviceAnalytics.getTopItems,
  getPopularItems: serviceAnalytics.getPopularItems,
  getMostDeliveredItems: serviceAnalytics.getMostDeliveredItems,
  getMostOrdered: serviceAnalytics.getMostOrdered,
  getMostRewarding: serviceAnalytics.getMostRewarding,
  
  // Customer Analytics (legacy)
  getCustomerAnalytics: customerAnalytics.getCustomerAnalytics,
  getTopCustomers: customerAnalytics.getTopCustomers,
  getRecurringCustomers: customerAnalytics.getRecurringCustomers,
  getCustomerLifetimeValue: customerAnalytics.getCustomerLifetimeValue,
  getLoyalCustomer: customerAnalytics.getLoyalCustomer,
  
  // Order Analytics (legacy)
  getTimeBreakdown: orderAnalytics.getTimeBreakdown,
  
  // New customer analytics methods
  getMostLoyalCustomer: customerAnalytics.getMostLoyalCustomer,
  getTopSpenders: customerAnalytics.getTopSpenders,
  getHighestProfitCustomers: customerAnalytics.getHighestProfitCustomers,
  getMostFrequentCustomers: customerAnalytics.getMostFrequentCustomers,
  getNewVsReturningCustomers: customerAnalytics.getNewVsReturningCustomers,
  getCancelledOrdersCount: customerAnalytics.getCancelledOrdersCount,
  getCustomerRetention: customerAnalytics.getCustomerRetention,
  getChurnedCustomers: customerAnalytics.getChurnedCustomers,
  getAvgOrderValuePerCustomer: customerAnalytics.getAvgOrderValuePerCustomer,
  getCustomerResponseBehavior: customerAnalytics.getCustomerResponseBehavior,
  getCustomerLocationClusters: customerAnalytics.getCustomerLocationClusters,
  
  // Service Analytics Methods
  getLeastOrderedService: serviceAnalytics.getLeastOrderedService,
  getRevenuePerService: serviceAnalytics.getRevenuePerService,
  getProfitPerService: serviceAnalytics.getProfitPerService,
  getProfitMarginPerService: serviceAnalytics.getProfitMarginPerService,
  getServicePopularityTrend: serviceAnalytics.getServicePopularityTrend,
  getTopServicesByTimeOfDay: serviceAnalytics.getTopServicesByTimeOfDay,
  getFrequentlyBoughtTogether: serviceAnalytics.getFrequentlyBoughtTogether,
  getCustomizationUsage: serviceAnalytics.getCustomizationUsage,
  getOutOfStockImpact: serviceAnalytics.getOutOfStockImpact,
  
  // Order/Sales Analytics Methods
  getTotalOrders: orderAnalytics.getTotalOrders,
  getTotalRevenue: orderAnalytics.getTotalRevenue,
  getTotalProfit: orderAnalytics.getTotalProfit,
  getAverageOrderValue: orderAnalytics.getAverageOrderValue,
  getOrderStatusBreakdown: orderAnalytics.getOrderStatusBreakdown,
  getCancellationRate: orderAnalytics.getCancellationRate,
  getRejectionRate: orderAnalytics.getRejectionRate,
  getScheduledVsImmediateRequests: orderAnalytics.getScheduledVsImmediateRequests,
  getDeliveryTypeSplit: orderAnalytics.getDeliveryTypeSplit,
  getPeakOrderingHours: orderAnalytics.getPeakOrderingHours,
  getPeakOrderingDays: orderAnalytics.getPeakOrderingDays,
  getTimeToComplete: orderAnalytics.getTimeToComplete,
  getSalesHeatmap: orderAnalytics.getSalesHeatmap,
  
  // Chatbot + Ops Analytics Methods
  getRequestsHandled: chatbotAnalytics.getRequestsHandled,
  getConversationsCount: chatbotAnalytics.getConversationsCount,
  getAverageResponseTime: chatbotAnalytics.getAverageResponseTime,
  getResolutionRate: chatbotAnalytics.getResolutionRate,
  getConversionRate: chatbotAnalytics.getConversionRate,
  getDropOffPoints: chatbotAnalytics.getDropOffPoints,
  getMostAskedQuestions: chatbotAnalytics.getMostAskedQuestions,
  getFallbackRate: chatbotAnalytics.getFallbackRate,
  
  // Delivery/Logistics Analytics Methods
  getCarrierUsage: deliveryAnalytics.getCarrierUsage,
  getAvgDeliveryTimeRange: deliveryAnalytics.getAvgDeliveryTimeRange,
  getBusyDeliverySlots: deliveryAnalytics.getBusyDeliverySlots,
  getCommonDeliveryAreas: deliveryAnalytics.getCommonDeliveryAreas,
  getDeliveryFeeRevenue: deliveryAnalytics.getDeliveryFeeRevenue,
  
  // Reservations Analytics Methods (placeholders)
  getTotalReservations: reservationAnalytics.getTotalReservations,
  getReservationCompletionRate: reservationAnalytics.getReservationCompletionRate,
  getNoShowRate: reservationAnalytics.getNoShowRate,
  getPeakReservationHours: reservationAnalytics.getPeakReservationHours,
  getPeakReservationDays: reservationAnalytics.getPeakReservationDays,
  getTableUtilization: reservationAnalytics.getTableUtilization,
  getAvgGuestsPerReservation: reservationAnalytics.getAvgGuestsPerReservation,
  
  // Financial Summaries Methods
  getDailySalesReport: financialAnalytics.getDailySalesReport,
  getWeeklySummary: financialAnalytics.getWeeklySummary,
  getMonthlyPerformance: financialAnalytics.getMonthlyPerformance,
  getMonthOverMonthGrowth: financialAnalytics.getMonthOverMonthGrowth,
  getBestDayThisMonth: financialAnalytics.getBestDayThisMonth,
  getBestHourThisMonth: financialAnalytics.getBestHourThisMonth
};
