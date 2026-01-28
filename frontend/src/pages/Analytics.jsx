import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Users, Package, Clock, Menu, X, Award, Star, Calendar, PieChart, MapPin, RefreshCw, MessageSquare, Lock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import { getNavTerminology } from '../utils/terminology'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const REQUIRED_ADDON_KEY = 'analytics_free' // Analytics add-on key

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

// Helper function to get default date range (first day of current month to today)
const getDefaultDateRange = () => {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    startDate: firstDayOfMonth.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0]
  }
}

// Helper function to fill missing days in revenue data
const fillMissingDays = (revenueData, startDate, endDate) => {
  try {
    if (!revenueData || !Array.isArray(revenueData)) return []
    if (!startDate || !endDate) return revenueData
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return revenueData
    }
    
    const revenueMap = new Map()
    
    // Create a map of existing revenue data
    revenueData.forEach(item => {
      if (item && item.period) {
        revenueMap.set(item.period, item)
      }
    })
    
    // Fill in missing days
    const filledData = []
    const current = new Date(start)
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      if (revenueMap.has(dateStr)) {
        filledData.push(revenueMap.get(dateStr))
      } else {
        filledData.push({
          period: dateStr,
          revenue: 0,
          orders: 0
        })
      }
      current.setDate(current.getDate() + 1)
    }
    
    return filledData
  } catch (error) {
    console.error('Error in fillMissingDays:', error)
    return revenueData || []
  }
}

export default function Analytics() {
  const { user } = useAuth()
  const navTerms = getNavTerminology()
  const [addonActive, setAddonActive] = useState(true) // Default to true to avoid flicker
  const [checkingAddon, setCheckingAddon] = useState(true)
  const [overview, setOverview] = useState(null)
  const [burgerMenuOpen, setBurgerMenuOpen] = useState(false)
  const [selectedAnalyticsType, setSelectedAnalyticsType] = useState('order') // Default: Order/Sales Analytics
  
  // Debug: log overview state changes
  useEffect(() => {
    console.log('Overview state changed:', overview)
  }, [overview])
  const [revenue, setRevenue] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [recurringCustomers, setRecurringCustomers] = useState([])
  const [popularItems, setPopularItems] = useState([])
  const [deliveredItems, setDeliveredItems] = useState([])
  const [lifetimeValue, setLifetimeValue] = useState(null)
  const [loyalCustomer, setLoyalCustomer] = useState(null)
  const [mostOrdered, setMostOrdered] = useState([])
  const [mostRewarding, setMostRewarding] = useState([])
  const [timeBreakdown, setTimeBreakdown] = useState([])
  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState([])
  const [peakOrderingHours, setPeakOrderingHours] = useState([])
  const [deliveryTypeSplit, setDeliveryTypeSplit] = useState([])
  const [newVsReturning, setNewVsReturning] = useState(null)
  // Financial Analytics
  const [dailyReport, setDailyReport] = useState(null)
  const [weeklySummary, setWeeklySummary] = useState(null)
  const [monthlyPerformance, setMonthlyPerformance] = useState(null)
  const [monthOverMonthGrowth, setMonthOverMonthGrowth] = useState(null)
  const [bestDay, setBestDay] = useState(null)
  const [bestHour, setBestHour] = useState(null)
  // Chatbot Analytics
  const [requestsHandled, setRequestsHandled] = useState(null)
  const [conversations, setConversations] = useState(null)
  const [responseTime, setResponseTime] = useState(null)
  const [resolutionRate, setResolutionRate] = useState(null)
  const [conversionRate, setConversionRate] = useState(null)
  const [dropOffPoints, setDropOffPoints] = useState([])
  const [mostAskedQuestions, setMostAskedQuestions] = useState([])
  const [fallbackRate, setFallbackRate] = useState(null)
  // Delivery Analytics
  const [busySlots, setBusySlots] = useState([])
  const [commonAreas, setCommonAreas] = useState([])
  const [deliveryFeeRevenue, setDeliveryFeeRevenue] = useState(null)
  // Reservations Analytics
  const [totalReservations, setTotalReservations] = useState(null)
  const [reservationCompletionRate, setReservationCompletionRate] = useState(null)
  const [noShowRate, setNoShowRate] = useState(null)
  const [peakReservationHours, setPeakReservationHours] = useState([])
  const [peakReservationDays, setPeakReservationDays] = useState([])
  const [tableUtilization, setTableUtilization] = useState([])
  const [avgGuests, setAvgGuests] = useState(null)
  // Legacy/General Analytics
  const [branchComparison, setBranchComparison] = useState([])
  const [freeMetrics, setFreeMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(getDefaultDateRange())

  useEffect(() => {
    checkAddonStatus()
  }, [])

  useEffect(() => {
    if (addonActive) {
      fetchAnalytics()
    }
  }, [dateRange, addonActive])

  const checkAddonStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No token found in localStorage')
        setAddonActive(false)
        setCheckingAddon(false)
        return
      }
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(`${API_URL}/api/addons`, { headers })
      const addons = response.data.data.addons || []
      const requiredAddon = addons.find(a => a.addon_key === REQUIRED_ADDON_KEY)
      
      setAddonActive(requiredAddon?.isActive || false)
    } catch (error) {
      console.error('Error checking addon status:', error)
      // If we can't check, assume it's active to avoid blocking access
      setAddonActive(true)
    } finally {
      setCheckingAddon(false)
    }
  }

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const params = {}
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      // Try to fetch basic overview (no premium required)
      const basicOverviewRes = await axios.get(`${API_URL}/api/analytics/basic-overview`, { headers, params }).catch((err) => {
        console.error('Error fetching basic overview:', err)
        return { data: { data: { overview: null } } }
      })
      
      // Try to fetch premium metrics (will fail gracefully if not premium or 403)
      const allResults = await Promise.allSettled([
        axios.get(`${API_URL}/api/analytics/overview`, { headers, params }).catch(err => {
          if (err.response?.status === 403) return { data: { data: { overview: null } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/revenue?period=daily`, { headers, params }).catch(err => {
          if (err.response?.status === 403) return { data: { data: { revenue: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/customers/top?limit=10`, { headers, params }).catch(err => {
          if (err.response?.status === 403) return { data: { data: { customers: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/customers/recurring?limit=10`, { headers, params }).catch(err => {
          if (err.response?.status === 403) return { data: { data: { customers: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/items/popular?limit=10`, { headers, params }).catch(err => {
          if (err.response?.status === 403) return { data: { data: { items: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/items/delivered?limit=10`, { headers, params }).catch(err => {
          if (err.response?.status === 403) return { data: { data: { items: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/customers/lifetime-value`, { headers, params }).catch(err => {
          if (err.response?.status === 403) return { data: { data: {} } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/loyal-customer`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: { loyalCustomer: null } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/most-ordered`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: { mostOrdered: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/most-rewarding`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: { mostRewarding: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/time-breakdown?period=day`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: { timeBreakdown: [] } } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/orders/status-breakdown`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/orders/peak-hours`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/orders/delivery-type-split`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/customers/new-vs-returning`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: { newVsReturning: null } } }
          throw err
        }),
        // Financial Analytics
        axios.get(`${API_URL}/api/analytics/data/financial/daily-report`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/financial/weekly-summary`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/financial/monthly-performance`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/financial/month-over-month-growth`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/financial/best-day-this-month`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/financial/best-hour-this-month`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        // Chatbot Analytics
        axios.get(`${API_URL}/api/analytics/data/chatbot/requests-handled`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/chatbot/conversations`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/chatbot/response-time`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/chatbot/resolution-rate`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/chatbot/conversion-rate`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/chatbot/drop-off-points`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/chatbot/most-asked-questions`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/chatbot/fallback-rate`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        // Delivery Analytics
        axios.get(`${API_URL}/api/analytics/data/delivery/busy-slots`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/delivery/common-areas`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/delivery/fee-revenue`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        // Reservations Analytics
        axios.get(`${API_URL}/api/analytics/data/reservations/total`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/reservations/completion-rate`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/reservations/no-show-rate`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/reservations/peak-hours`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/reservations/peak-days`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/reservations/table-utilization`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/data/reservations/avg-guests`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: null } }
          throw err
        }),
        // Legacy/General Analytics
        axios.get(`${API_URL}/api/analytics/branches`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: [] } }
          throw err
        }),
        axios.get(`${API_URL}/api/analytics/free`, { headers, params }).catch(err => {
          if (err.response?.status === 403 || err.response?.status === 500) return { data: { data: { freeMetrics: null } } }
          throw err
        })
      ])
      
      // Extract results
      const [
        overviewRes,
        revenueRes,
        topCustomersRes,
        recurringCustomersRes,
        popularItemsRes,
        deliveredItemsRes,
        lifetimeValueRes,
        loyalCustomerRes,
        mostOrderedRes,
        mostRewardingRes,
        timeBreakdownRes,
        orderStatusBreakdownRes,
        peakOrderingHoursRes,
        deliveryTypeSplitRes,
        newVsReturningRes,
        dailyReportRes,
        weeklySummaryRes,
        monthlyPerformanceRes,
        monthOverMonthGrowthRes,
        bestDayRes,
        bestHourRes,
        requestsHandledRes,
        conversationsRes,
        responseTimeRes,
        resolutionRateRes,
        conversionRateRes,
        dropOffPointsRes,
        mostAskedQuestionsRes,
        fallbackRateRes,
        busySlotsRes,
        commonAreasRes,
        deliveryFeeRevenueRes,
        totalReservationsRes,
        reservationCompletionRateRes,
        noShowRateRes,
        peakReservationHoursRes,
        peakReservationDaysRes,
        tableUtilizationRes,
        avgGuestsRes,
        branchComparisonRes,
        freeMetricsRes
      ] = allResults
      
      // Use premium overview if available, otherwise use basic overview
      const premiumOverview = overviewRes.status === 'fulfilled' ? overviewRes.value.data?.data?.overview : null
      
      // Extract basic overview - handle different possible response structures
      let basicOverview = null
      if (basicOverviewRes?.data) {
        // Try different possible structures
        basicOverview = basicOverviewRes.data?.data?.overview || 
                       basicOverviewRes.data?.overview || 
                       basicOverviewRes.data?.data ||
                       null
      }
      
      // Log for debugging
      console.log('Basic Overview Response (full):', basicOverviewRes)
      console.log('Basic Overview Response (data):', basicOverviewRes?.data)
      console.log('Basic Overview (extracted):', basicOverview)
      console.log('Premium Overview:', premiumOverview)
      
      // Set overview - use premium if it has actual data (not all zeros), otherwise use basic
      // Check if premium overview has meaningful data (totalOrders > 0)
      const hasPremiumData = premiumOverview && premiumOverview.totalOrders > 0
      const finalOverview = hasPremiumData ? premiumOverview : basicOverview
      console.log('Final Overview (setting state):', finalOverview)
      
      if (finalOverview) {
        setOverview(finalOverview)
        console.log('State set successfully')
      } else {
        console.warn('No overview data available - both premium and basic are null')
        setOverview(null)
      }
      
      // Store raw revenue data
      const rawRevenue = revenueRes.status === 'fulfilled' ? revenueRes.value.data.data.revenue || [] : []
      setRevenue(rawRevenue)
      setTopCustomers(topCustomersRes.status === 'fulfilled' ? topCustomersRes.value.data.data.customers || [] : [])
      setRecurringCustomers(recurringCustomersRes.status === 'fulfilled' ? recurringCustomersRes.value.data.data.customers || [] : [])
      setPopularItems(popularItemsRes.status === 'fulfilled' ? popularItemsRes.value.data.data.items || [] : [])
      setDeliveredItems(deliveredItemsRes.status === 'fulfilled' ? deliveredItemsRes.value.data.data.items || [] : [])
      setLifetimeValue(lifetimeValueRes.status === 'fulfilled' ? lifetimeValueRes.value.data.data || {} : {})
      setLoyalCustomer(loyalCustomerRes.status === 'fulfilled' ? loyalCustomerRes.value.data.data.loyalCustomer || null : null)
      setMostOrdered(mostOrderedRes.status === 'fulfilled' ? mostOrderedRes.value.data.data.mostOrdered || [] : [])
      setMostRewarding(mostRewardingRes.status === 'fulfilled' ? mostRewardingRes.value.data.data.mostRewarding || [] : [])
      setTimeBreakdown(timeBreakdownRes.status === 'fulfilled' ? timeBreakdownRes.value.data.data.timeBreakdown || [] : [])
      setOrderStatusBreakdown(orderStatusBreakdownRes.status === 'fulfilled' ? orderStatusBreakdownRes.value.data.data || [] : [])
      setPeakOrderingHours(peakOrderingHoursRes.status === 'fulfilled' ? peakOrderingHoursRes.value.data.data || [] : [])
      setDeliveryTypeSplit(deliveryTypeSplitRes.status === 'fulfilled' ? deliveryTypeSplitRes.value.data.data || [] : [])
      setNewVsReturning(newVsReturningRes.status === 'fulfilled' ? newVsReturningRes.value.data.data || null : null)
      
      // Financial Analytics
      setDailyReport(dailyReportRes.status === 'fulfilled' ? dailyReportRes.value.data.data || null : null)
      setWeeklySummary(weeklySummaryRes.status === 'fulfilled' ? weeklySummaryRes.value.data.data || null : null)
      setMonthlyPerformance(monthlyPerformanceRes.status === 'fulfilled' ? monthlyPerformanceRes.value.data.data || null : null)
      setMonthOverMonthGrowth(monthOverMonthGrowthRes.status === 'fulfilled' ? monthOverMonthGrowthRes.value.data.data || null : null)
      setBestDay(bestDayRes.status === 'fulfilled' ? bestDayRes.value.data.data || null : null)
      setBestHour(bestHourRes.status === 'fulfilled' ? bestHourRes.value.data.data || null : null)
      
      // Chatbot Analytics
      setRequestsHandled(requestsHandledRes.status === 'fulfilled' ? requestsHandledRes.value.data.data || null : null)
      setConversations(conversationsRes.status === 'fulfilled' ? conversationsRes.value.data.data || null : null)
      setResponseTime(responseTimeRes.status === 'fulfilled' ? responseTimeRes.value.data.data || null : null)
      setResolutionRate(resolutionRateRes.status === 'fulfilled' ? resolutionRateRes.value.data.data || null : null)
      setConversionRate(conversionRateRes.status === 'fulfilled' ? conversionRateRes.value.data.data || null : null)
      setDropOffPoints(dropOffPointsRes.status === 'fulfilled' ? dropOffPointsRes.value.data.data || [] : [])
      setMostAskedQuestions(mostAskedQuestionsRes.status === 'fulfilled' ? mostAskedQuestionsRes.value.data.data || [] : [])
      setFallbackRate(fallbackRateRes.status === 'fulfilled' ? fallbackRateRes.value.data.data || null : null)
      
      // Delivery Analytics
      setBusySlots(busySlotsRes.status === 'fulfilled' ? busySlotsRes.value.data.data || [] : [])
      setCommonAreas(commonAreasRes.status === 'fulfilled' ? commonAreasRes.value.data.data || [] : [])
      setDeliveryFeeRevenue(deliveryFeeRevenueRes.status === 'fulfilled' ? deliveryFeeRevenueRes.value.data.data || null : null)
      
      // Reservations Analytics
      setTotalReservations(totalReservationsRes.status === 'fulfilled' ? totalReservationsRes.value.data.data || null : null)
      setReservationCompletionRate(reservationCompletionRateRes.status === 'fulfilled' ? reservationCompletionRateRes.value.data.data || null : null)
      setNoShowRate(noShowRateRes.status === 'fulfilled' ? noShowRateRes.value.data.data || null : null)
      setPeakReservationHours(peakReservationHoursRes.status === 'fulfilled' ? peakReservationHoursRes.value.data.data || [] : [])
      setPeakReservationDays(peakReservationDaysRes.status === 'fulfilled' ? peakReservationDaysRes.value.data.data || [] : [])
      setTableUtilization(tableUtilizationRes.status === 'fulfilled' ? tableUtilizationRes.value.data.data || [] : [])
      setAvgGuests(avgGuestsRes.status === 'fulfilled' ? avgGuestsRes.value.data.data || null : null)
      
      // Legacy/General Analytics
      setBranchComparison(branchComparisonRes.status === 'fulfilled' ? branchComparisonRes.value.data.data || [] : [])
      setFreeMetrics(freeMetricsRes.status === 'fulfilled' ? freeMetricsRes.value.data.data?.freeMetrics || null : null)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  // Show analytics regardless of subscription - some metrics are free

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Mapping of section IDs to analytics types
  const sectionTypeMap = {
    'overview': 'order',
    'revenue': 'order',
    'top-customers': 'customer',
    'recurring-customers': 'customer',
    'popular-items': 'service',
    'delivered-items': 'service',
    'lifetime-value': 'customer',
    'loyal-customer': 'customer',
    'most-ordered': 'service',
    'most-rewarding': 'service',
    'time-breakdown': 'order',
    'order-status': 'order',
    'peak-hours': 'order',
    'delivery-split': 'order',
    'new-vs-returning': 'customer'
  }

  // Analytics types for burger menu
  const analyticsTypes = [
    { id: 'customer', label: 'Customer Analytics', icon: Users },
    { id: 'service', label: 'Service Analytics', icon: Package },
    { id: 'order', label: 'Order/Sales Analytics', icon: ShoppingCart },
    { id: 'financial', label: 'Financial Analytics', icon: DollarSign },
    { id: 'chatbot', label: 'Chatbot/Ops Analytics', icon: MessageSquare },
    { id: 'delivery', label: 'Delivery/Logistics Analytics', icon: MapPin },
    { id: 'reservations', label: 'Reservations Analytics', icon: Calendar },
    { id: 'legacy', label: 'Legacy/General Analytics', icon: BarChart3 }
  ]

  const handleTypeSelect = (typeId) => {
    setSelectedAnalyticsType(typeId)
    setBurgerMenuOpen(false)
    // Scroll to top when switching types
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Process revenue data to fill missing days - process directly instead of useMemo
  const getProcessedRevenue = () => {
    try {
      if (!revenue || !Array.isArray(revenue) || revenue.length === 0) {
        return []
      }
      if (dateRange?.startDate && dateRange?.endDate) {
        return fillMissingDays(revenue, dateRange.startDate, dateRange.endDate)
      }
      return revenue
    } catch (error) {
      console.error('Error processing revenue:', error)
      return revenue || []
    }
  }
  
  const processedRevenue = getProcessedRevenue()

  if (checkingAddon) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // If add-on is not active, show unlock button
  if (!addonActive) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex justify-center">
            <div className="p-6 bg-gray-100 rounded-full">
              <Lock size={64} className="text-gray-400" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add-on Required</h2>
            <p className="text-gray-600">
              This feature requires an active add-on. Please unlock the add-on to access analytics.
            </p>
          </div>
          <button
            onClick={() => {
              // Navigate to addons page or handle unlock logic
              window.location.href = '/addons'
            }}
            className="btn btn-primary px-8 py-3 text-lg flex items-center gap-2 mx-auto"
          >
            <Lock size={20} />
            Unlock Add-on
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insights</h1>
          <p className="text-gray-600 mt-2">Insights into your business performance</p>
        </div>
        
        {/* Burger Menu Button */}
        <div className="relative">
          <button
            onClick={() => setBurgerMenuOpen(!burgerMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>

          {/* Burger Menu Dropdown */}
          {burgerMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setBurgerMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="py-2">
                  {analyticsTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => handleTypeSelect(type.id)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                          selectedAnalyticsType === type.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overview Cards - Order/Sales Analytics */}
      {selectedAnalyticsType === 'order' && (
        <div id="overview" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                ${overview?.totalRevenue ? typeof overview.totalRevenue === 'number' ? overview.totalRevenue.toFixed(2) : parseFloat(overview.totalRevenue || 0).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900">{overview?.totalOrders || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <ShoppingCart size={24} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{overview?.completedOrders || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
              <p className="text-3xl font-bold text-gray-900">
                {overview?.averageOrderValue !== undefined && overview?.averageOrderValue !== null
                  ? `$${typeof overview.averageOrderValue === 'number' ? overview.averageOrderValue.toFixed(2) : parseFloat(overview.averageOrderValue || 0).toFixed(2)}`
                  : '$0.00'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
              <BarChart3 size={24} />
            </div>
          </div>
        </div>
      </div>
      )}

      {selectedAnalyticsType === 'order' && !overview && (
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-yellow-800">
            Loading analytics data...
          </p>
        </div>
      )}
      
      {selectedAnalyticsType === 'order' && overview && overview.totalOrders === 0 && dateRange.startDate && dateRange.endDate && (
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-blue-800">
            No orders found for the selected date range. Try adjusting the date filter or check if you have completed orders.
          </p>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              className="input"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setDateRange({ startDate: '', endDate: '' })}
              className="btn btn-secondary"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Revenue Chart - Order/Sales Analytics */}
      {selectedAnalyticsType === 'order' && (
        <div id="revenue" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Revenue Trend</h2>
        {processedRevenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processedRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="period" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No revenue data available</div>
        )}
      </div>
      )}

      {/* Top Customers - Customer Analytics */}
      {selectedAnalyticsType === 'customer' && (
        <div id="top-customers" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Users size={24} />
          Top Customers
        </h2>
        {topCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Phone Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Spent</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order Count</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Avg Order Value</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => (
                  <tr key={customer.customerPhoneNumber || customer._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{customer.customerName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-mono">{customer.customerPhoneNumber || customer._id || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-medium">${customer.totalSpent?.toFixed(2) || 0}</td>
                    <td className="py-3 px-4 text-sm">{customer.orderCount || 0}</td>
                    <td className="py-3 px-4 text-sm">
                      ${customer.averageOrderValue?.toFixed(2) || (customer.orderCount > 0 ? (customer.totalSpent / customer.orderCount).toFixed(2) : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No customer data available</div>
        )}
      </div>
      )}

      {/* Most Recurring Customers - Customer Analytics */}
      {selectedAnalyticsType === 'customer' && (
        <div id="recurring-customers" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp size={24} />
          Most Recurring Customers
        </h2>
        {recurringCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Phone Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order Count</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Spent</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {recurringCustomers.map((customer, index) => (
                  <tr key={customer.customerPhoneNumber || customer._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{customer.customerName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-mono">{customer.customerPhoneNumber || customer._id || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-medium">{customer.orderCount || 0}</td>
                    <td className="py-3 px-4 text-sm">${customer.totalSpent?.toFixed(2) || 0}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No recurring customer data available</div>
        )}
      </div>
      )}

      {/* Popular Items Chart - Service Analytics */}
      {selectedAnalyticsType === 'service' && (
        <div id="popular-items" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Package size={24} />
          Most Popular Items (by orders)
        </h2>
        {popularItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={popularItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="timesOrdered" fill="#0ea5e9">
                {popularItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#0ea5e9" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No popular items data available</div>
        )}
      </div>
      )}

      {/* Most Delivered Items Chart - Service Analytics */}
      {selectedAnalyticsType === 'service' && (
        <div id="delivered-items" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Clock size={24} />
          Most Delivered Items (completion rate)
        </h2>
        {deliveredItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={deliveredItems.map(item => ({
              ...item,
              completionRate: item.timesOrdered > 0 
                ? parseFloat(((item.timesDelivered / item.timesOrdered) * 100).toFixed(1))
                : 0
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'timesDelivered') return [value, 'Times Delivered']
                  if (name === 'completionRate') return [`${value}%`, 'Completion Rate']
                  return value
                }}
              />
              <Bar dataKey="timesDelivered" fill="#0ea5e9">
                {deliveredItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#0ea5e9" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No delivered items data available</div>
        )}
      </div>
      )}

      {/* Customer Lifetime Value - Customer Analytics */}
      {selectedAnalyticsType === 'customer' && (
        <div id="lifetime-value" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <DollarSign size={24} />
          Customer Lifetime Value
        </h2>
        {lifetimeValue && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{lifetimeValue.totalCustomers || 0}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${lifetimeValue.totalRevenue?.toFixed(2) || 0}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Avg Lifetime Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${lifetimeValue.averageLifetimeValue?.toFixed(2) || 0}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Avg Orders/Customer</p>
                <p className="text-2xl font-bold text-gray-900">
                  {lifetimeValue.averageOrdersPerCustomer?.toFixed(1) || 0}
                </p>
              </div>
            </div>
            {lifetimeValue.customers && lifetimeValue.customers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Spent</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Avg Order Value</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lifetimeValue.customers.slice(0, 10).map((customer, index) => (
                      <tr key={customer.customerPhoneNumber || customer.phone || customer._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-mono">{customer.customerPhoneNumber || customer.phone || customer._id || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm font-medium">${customer.totalSpent?.toFixed(2) || 0}</td>
                        <td className="py-3 px-4 text-sm">{customer.orderCount || 0}</td>
                        <td className="py-3 px-4 text-sm">
                          ${customer.averageOrderValue?.toFixed(2) || (customer.orderCount > 0 ? (customer.totalSpent / customer.orderCount).toFixed(2) : 0)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Loyal Customer - Customer Analytics */}
      {selectedAnalyticsType === 'customer' && (
        <div id="loyal-customer" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Award size={24} />
          Loyal Customer
        </h2>
        {loyalCustomer ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Customer Name</p>
                <p className="text-lg font-bold text-gray-900">{loyalCustomer.customerName || 'N/A'}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                <p className="text-lg font-bold text-gray-900">{loyalCustomer.orderCount || 0}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Spent</p>
                <p className="text-lg font-bold text-gray-900">${loyalCustomer.totalSpent?.toFixed(2) || 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No loyal customer data available</div>
        )}
      </div>
      )}

      {/* Most Ordered Service - Service Analytics */}
      {selectedAnalyticsType === 'service' && (
        <div id="most-ordered" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Star size={24} />
          Most Ordered Service
        </h2>
        {mostOrdered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Service Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Quantity</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {mostOrdered.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{item.name || item.serviceName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-medium">{item.totalQuantity || item.quantity || 0}</td>
                    <td className="py-3 px-4 text-sm">${typeof item.revenue === 'number' ? item.revenue.toFixed(2) : parseFloat(item.revenue || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No most ordered service data available</div>
        )}
      </div>
      )}

      {/* Most Rewarding Service - Service Analytics */}
      {selectedAnalyticsType === 'service' && (
        <div id="most-rewarding" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Star size={24} />
          Most Rewarding Service
        </h2>
        {mostRewarding.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Service Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Profit</th>
                </tr>
              </thead>
              <tbody>
                {mostRewarding.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{item.name || item.serviceName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-medium">${item.revenue?.toFixed(2) || 0}</td>
                    <td className="py-3 px-4 text-sm">${typeof item.profit === 'number' ? item.profit.toFixed(2) : parseFloat(item.profit || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No most rewarding service data available</div>
        )}
      </div>
      )}

      {/* Time Breakdown - Order/Sales Analytics */}
      {selectedAnalyticsType === 'order' && (
        <div id="time-breakdown" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Calendar size={24} />
          Time Breakdown
        </h2>
        {timeBreakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="order_count" fill="#0ea5e9">
                {timeBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#0ea5e9" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No time breakdown data available</div>
        )}
      </div>
      )}

      {/* Order Status Breakdown - Order/Sales Analytics */}
      {selectedAnalyticsType === 'order' && (
        <div id="order-status" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <PieChart size={24} />
          Order Status Breakdown
        </h2>
        {orderStatusBreakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={orderStatusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9">
                {orderStatusBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#0ea5e9" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No order status breakdown data available</div>
        )}
      </div>
      )}

      {/* Peak Ordering Hours - Order/Sales Analytics */}
      {selectedAnalyticsType === 'order' && (
        <div id="peak-hours" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Clock size={24} />
          Peak Ordering Hours
        </h2>
        {peakOrderingHours.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peakOrderingHours.sort((a, b) => (a.hour || 0) - (b.hour || 0))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                label={{ value: 'Hour (0-23)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="order_count" fill="#0ea5e9">
                {peakOrderingHours.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#0ea5e9" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No peak ordering hours data available</div>
        )}
      </div>
      )}

      {/* Delivery Type Split - Order/Sales Analytics */}
      {selectedAnalyticsType === 'order' && (
        <div id="delivery-split" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <MapPin size={24} />
          Delivery Type Split
        </h2>
        {deliveryTypeSplit.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deliveryTypeSplit}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9">
                {deliveryTypeSplit.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#0ea5e9" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No delivery type split data available</div>
        )}
      </div>
      )}

      {/* New vs Returning Customers - Customer Analytics */}
      {selectedAnalyticsType === 'customer' && (
        <div id="new-vs-returning" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <RefreshCw size={24} />
          New vs Returning Customers
        </h2>
        {newVsReturning ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">New Customers</p>
              <p className="text-3xl font-bold text-gray-900">{newVsReturning.newCustomers || 0}</p>
              <p className="text-sm text-gray-500 mt-2">
                {newVsReturning.totalCustomers > 0 
                  ? `${((newVsReturning.newCustomers / newVsReturning.totalCustomers) * 100).toFixed(1)}% of total`
                  : '0% of total'}
              </p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Returning Customers</p>
              <p className="text-3xl font-bold text-gray-900">{newVsReturning.returningCustomers || 0}</p>
              <p className="text-sm text-gray-500 mt-2">
                {newVsReturning.totalCustomers > 0 
                  ? `${((newVsReturning.returningCustomers / newVsReturning.totalCustomers) * 100).toFixed(1)}% of total`
                  : '0% of total'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No new vs returning customer data available</div>
        )}
      </div>
      )}

      {/* Financial Analytics */}
      {selectedAnalyticsType === 'financial' && (
        <>
          {/* Daily Report */}
          {dailyReport && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <DollarSign size={24} />
                Daily Sales Report
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Date</p>
                  <p className="text-lg font-bold text-gray-900">{dailyReport.date || 'N/A'}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Orders</p>
                  <p className="text-lg font-bold text-gray-900">{dailyReport.order_count || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Revenue</p>
                  <p className="text-lg font-bold text-gray-900">${dailyReport.total_revenue?.toFixed(2) || 0}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
                  <p className="text-lg font-bold text-gray-900">${dailyReport.avg_order_value?.toFixed(2) || 0}</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Delivery Fees</p>
                  <p className="text-lg font-bold text-gray-900">${dailyReport.delivery_fees?.toFixed(2) || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Summary */}
          {weeklySummary && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Calendar size={24} />
                Weekly Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Week Period</p>
                  <p className="text-lg font-bold text-gray-900">
                    {weeklySummary.week_start} to {weeklySummary.week_end}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-lg font-bold text-gray-900">${weeklySummary.total_revenue?.toFixed(2) || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                  <p className="text-lg font-bold text-gray-900">{weeklySummary.total_orders || 0}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Avg Daily Revenue</p>
                  <p className="text-lg font-bold text-gray-900">${weeklySummary.avg_daily_revenue?.toFixed(2) || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Performance */}
          {monthlyPerformance && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp size={24} />
                Monthly Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Month</p>
                  <p className="text-lg font-bold text-gray-900">
                    {monthlyPerformance.year}-{String(monthlyPerformance.month).padStart(2, '0')}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-lg font-bold text-gray-900">${monthlyPerformance.total_revenue?.toFixed(2) || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                  <p className="text-lg font-bold text-gray-900">{monthlyPerformance.total_orders || 0}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
                  <p className="text-lg font-bold text-gray-900">${monthlyPerformance.avg_order_value?.toFixed(2) || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Month Over Month Growth */}
          {monthOverMonthGrowth && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp size={24} />
                Month Over Month Growth
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Revenue Growth</p>
                  <p className={`text-3xl font-bold ${(monthOverMonthGrowth.revenue_growth_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {typeof monthOverMonthGrowth.revenue_growth_percent === 'number' ? monthOverMonthGrowth.revenue_growth_percent.toFixed(1) : parseFloat(monthOverMonthGrowth.revenue_growth_percent || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Order Growth</p>
                  <p className={`text-3xl font-bold ${(monthOverMonthGrowth.order_growth_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {typeof monthOverMonthGrowth.order_growth_percent === 'number' ? monthOverMonthGrowth.order_growth_percent.toFixed(1) : parseFloat(monthOverMonthGrowth.order_growth_percent || 0).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Best Day & Hour */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bestDay && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Calendar size={24} />
                  Best Day This Month
                </h2>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Date</p>
                    <p className="text-lg font-bold text-gray-900">{bestDay.period || bestDay.date || 'N/A'}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Revenue</p>
                    <p className="text-lg font-bold text-gray-900">${bestDay.total_revenue?.toFixed(2) || 0}</p>
                  </div>
                </div>
              </div>
            )}
            {bestHour && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Clock size={24} />
                  Best Hour This Month
                </h2>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Hour</p>
                    <p className="text-lg font-bold text-gray-900">{bestHour.hour || 0}:00</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Orders</p>
                    <p className="text-lg font-bold text-gray-900">{bestHour.order_count || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Chatbot/Ops Analytics */}
      {selectedAnalyticsType === 'chatbot' && (
        <>
          {/* Requests Handled */}
          {requestsHandled && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <MessageSquare size={24} />
                Requests Handled
              </h2>
              <div className="bg-blue-50 p-6 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Total Inbound Messages</p>
                <p className="text-3xl font-bold text-gray-900">{requestsHandled.count || 0}</p>
              </div>
            </div>
          )}

          {/* Conversations */}
          {conversations && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Users size={24} />
                Conversations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                  <p className="text-2xl font-bold text-gray-900">{conversations.count || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Unique Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{conversations.unique_customers || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Response Time - Removed per user request */}

          {/* Resolution & Conversion Rates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {resolutionRate && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <TrendingUp size={24} />
                  Resolution Rate
                </h2>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{typeof resolutionRate.resolution_rate === 'number' ? resolutionRate.resolution_rate.toFixed(1) : parseFloat(resolutionRate.resolution_rate || 0).toFixed(1)}%</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Chats</p>
                      <p className="text-lg font-bold text-gray-900">{resolutionRate.chats_count || 0}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Orders</p>
                      <p className="text-lg font-bold text-gray-900">{resolutionRate.orders_count || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {conversionRate && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <TrendingUp size={24} />
                  Conversion Rate
                </h2>
                <div className="bg-green-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Chat to Order</p>
                  <p className="text-3xl font-bold text-gray-900">{typeof conversionRate.resolution_rate === 'number' ? conversionRate.resolution_rate.toFixed(1) : parseFloat(conversionRate.resolution_rate || 0).toFixed(1)}%</p>
                </div>
              </div>
            )}
          </div>

          {/* Fallback Rate */}
          {fallbackRate && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <MessageSquare size={24} />
                Fallback Rate
              </h2>
              <div className="bg-orange-50 p-6 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">LLM Didn't Understand</p>
                <p className="text-3xl font-bold text-gray-900">{typeof fallbackRate.fallback_rate === 'number' ? fallbackRate.fallback_rate.toFixed(1) : parseFloat(fallbackRate.fallback_rate || 0).toFixed(1)}%</p>
              </div>
            </div>
          )}

          {/* Drop Off Points */}
          {dropOffPoints.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp size={24} />
                Drop Off Points
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Point</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dropOffPoints.map((point, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{point.point || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm font-medium">{point.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Most Asked Questions */}
          {mostAskedQuestions.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <MessageSquare size={24} />
                Most Asked Questions
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Question</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostAskedQuestions.map((q, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{q.question || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm font-medium">{q.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delivery/Logistics Analytics */}
      {selectedAnalyticsType === 'delivery' && (
        <>
          {/* Delivery Fee Revenue */}
          {deliveryFeeRevenue && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <DollarSign size={24} />
                Delivery Fee Revenue
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Delivery Fees</p>
                  <p className="text-2xl font-bold text-gray-900">${deliveryFeeRevenue.total_delivery_fees?.toFixed(2) || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Delivery Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{deliveryFeeRevenue.delivery_order_count || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${deliveryFeeRevenue.total_revenue?.toFixed(2) || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Busy Delivery Slots */}
          {busySlots.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Clock size={24} />
                Busy Delivery Slots
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hour</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {busySlots.map((slot, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{slot.hour || 0}:00</td>
                        <td className="py-3 px-4 text-sm font-medium">{slot.order_count || 0}</td>
                        <td className="py-3 px-4 text-sm">${typeof slot.revenue === 'number' ? slot.revenue.toFixed(2) : parseFloat(slot.revenue || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Common Delivery Areas */}
          {commonAreas.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <MapPin size={24} />
                Common Delivery Areas
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Area</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Unique Customers</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commonAreas.slice(0, 20).map((area, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{area.location_address || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm font-medium">{area.order_count || 0}</td>
                        <td className="py-3 px-4 text-sm">{area.unique_customers || 0}</td>
                        <td className="py-3 px-4 text-sm">${typeof area.revenue === 'number' ? area.revenue.toFixed(2) : parseFloat(area.revenue || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reservations Analytics */}
      {selectedAnalyticsType === 'reservations' && (
        <>
          {/* Total Reservations */}
          {totalReservations && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Calendar size={24} />
                Total Reservations
              </h2>
              {totalReservations.message ? (
                <div className="text-center py-12 text-gray-500">{totalReservations.message}</div>
              ) : (
                <div className="bg-blue-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Total</p>
                  <p className="text-3xl font-bold text-gray-900">{totalReservations.total || 0}</p>
                </div>
              )}
            </div>
          )}

          {/* Completion Rate */}
          {reservationCompletionRate && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp size={24} />
                Completion Rate
              </h2>
              {reservationCompletionRate.message ? (
                <div className="text-center py-12 text-gray-500">{reservationCompletionRate.message}</div>
              ) : (
                <div className="bg-green-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {typeof reservationCompletionRate.completion_rate === 'number' 
                      ? reservationCompletionRate.completion_rate.toFixed(1) 
                      : parseFloat(reservationCompletionRate.completion_rate || 0).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No Show Rate */}
          {noShowRate && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp size={24} />
                No Show Rate
              </h2>
              {noShowRate.message ? (
                <div className="text-center py-12 text-gray-500">{noShowRate.message}</div>
              ) : (
                <div className="bg-orange-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {typeof noShowRate.no_show_rate === 'number' 
                      ? noShowRate.no_show_rate.toFixed(1) 
                      : parseFloat(noShowRate.no_show_rate || 0).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Peak Hours */}
          {peakReservationHours.length > 0 && !peakReservationHours[0]?.message && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Clock size={24} />
                Peak Reservation Hours
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hour</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Reservations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peakReservationHours.map((hour, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{hour.hour || 0}:00</td>
                        <td className="py-3 px-4 text-sm font-medium">{hour.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Peak Days */}
          {peakReservationDays.length > 0 && !peakReservationDays[0]?.message && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Calendar size={24} />
                Peak Reservation Days
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Day</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Reservations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peakReservationDays.map((day, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{day.day || day.period || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm font-medium">{day.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table Utilization */}
          {tableUtilization.length > 0 && !tableUtilization[0]?.message && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 size={24} />
                Table Utilization
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Table</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableUtilization.map((table, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{table.table_id || table.table || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm font-medium">
                          {typeof table.utilization === 'number' 
                            ? table.utilization.toFixed(1) 
                            : parseFloat(table.utilization || 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Avg Guests */}
          {avgGuests && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Users size={24} />
                Average Guests Per Reservation
              </h2>
              {avgGuests.message ? (
                <div className="text-center py-12 text-gray-500">{avgGuests.message}</div>
              ) : (
                <div className="bg-purple-50 p-6 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Average</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {typeof avgGuests.avg_guests === 'number' 
                      ? avgGuests.avg_guests.toFixed(1) 
                      : parseFloat(avgGuests.avg_guests || 0).toFixed(1)}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Legacy/General Analytics */}
      {selectedAnalyticsType === 'legacy' && (
        <>
          {/* Overview (already displayed at top, but can show here too) */}
          {overview && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 size={24} />
                Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{overview.totalOrders || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{overview.completedOrders || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Cancelled</p>
                  <p className="text-2xl font-bold text-gray-900">{overview.cancelledOrders || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${typeof overview.totalRevenue === 'number' 
                      ? overview.totalRevenue.toFixed(2) 
                      : parseFloat(overview.totalRevenue || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Branch Comparison */}
          {branchComparison.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 size={24} />
                Branch Comparison
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Branch</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchComparison.map((branch, index) => (
                      <tr key={branch.branchId || index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{branch.branchId || branch.branch_name || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm font-medium">{branch.orders || 0}</td>
                        <td className="py-3 px-4 text-sm">
                          ${typeof branch.revenue === 'number' 
                            ? branch.revenue.toFixed(2) 
                            : parseFloat(branch.revenue || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Free Metrics */}
          {freeMetrics && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp size={24} />
                Free Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {freeMetrics.milestones && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Best Minute</p>
                    <p className="text-lg font-bold text-gray-900">{freeMetrics.milestones.count || 0} orders</p>
                    <p className="text-xs text-gray-500">{freeMetrics.milestones.minute || 'N/A'}</p>
                  </div>
                )}
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Requests Handled</p>
                  <p className="text-lg font-bold text-gray-900">{freeMetrics.requests_handled || 0}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
