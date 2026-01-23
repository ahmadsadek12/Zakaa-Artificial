import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Users, Package, Clock, Menu, X, Award, Star, Calendar, PieChart, MapPin, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import { getNavTerminology } from '../utils/terminology'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

export default function Analytics() {
  const { user } = useAuth()
  const navTerms = getNavTerminology()
  const [overview, setOverview] = useState(null)
  const [burgerMenuOpen, setBurgerMenuOpen] = useState(false)
  
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
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const params = {}
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      // Fetch free metrics first
      const freeMetricsRes = await axios.get(`${API_URL}/api/analytics/free`, { headers, params }).catch(() => ({ data: { data: { freeMetrics: null } } }))
      
      // Try to fetch basic overview (no premium required)
      const basicOverviewRes = await axios.get(`${API_URL}/api/analytics/basic-overview`, { headers, params }).catch((err) => {
        console.error('Error fetching basic overview:', err)
        return { data: { data: { overview: null } } }
      })
      
      // Try to fetch premium metrics (will fail gracefully if not premium or 403)
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
        newVsReturningRes
      ] = await Promise.allSettled([
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
        })
      ])
      
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
      
      setRevenue(revenueRes.status === 'fulfilled' ? revenueRes.value.data.data.revenue || [] : [])
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

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setBurgerMenuOpen(false)
    }
  }

  const insightsSections = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'revenue', label: 'Revenue Trend', icon: TrendingUp },
    { id: 'top-customers', label: 'Top Customers', icon: Users },
    { id: 'recurring-customers', label: 'Recurring Customers', icon: TrendingUp },
    { id: 'popular-items', label: 'Popular Items', icon: Package },
    { id: 'delivered-items', label: 'Delivered Items', icon: Clock },
    { id: 'lifetime-value', label: 'Customer Lifetime Value', icon: DollarSign },
    { id: 'loyal-customer', label: 'Loyal Customer', icon: Award },
    { id: 'most-ordered', label: 'Most Ordered Service', icon: Star },
    { id: 'most-rewarding', label: 'Most Rewarding Service', icon: Star },
    { id: 'time-breakdown', label: 'Time Breakdown', icon: Calendar },
    { id: 'order-status', label: 'Order Status Breakdown', icon: PieChart },
    { id: 'peak-hours', label: 'Peak Ordering Hours', icon: Clock },
    { id: 'delivery-split', label: 'Delivery Type Split', icon: MapPin },
    { id: 'new-vs-returning', label: 'New vs Returning Customers', icon: RefreshCw },
  ]

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
                  {insightsSections.map((section) => {
                    const Icon = section.icon
                    return (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                      >
                        <Icon className="w-4 h-4" />
                        <span>{section.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div id="overview" className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

      {!overview && (
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-yellow-800">
            Loading analytics data...
          </p>
        </div>
      )}
      
      {overview && overview.totalOrders === 0 && dateRange.startDate && dateRange.endDate && (
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

      {/* Revenue Chart */}
      <div id="revenue" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Revenue Trend</h2>
        {revenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No revenue data available</div>
        )}
      </div>

      {/* Top Customers */}
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

      {/* Most Recurring Customers */}
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

      {/* Popular Items Chart */}
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
              <Bar dataKey="timesOrdered" fill="#000000">
                {popularItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#000000" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No popular items data available</div>
        )}
      </div>

      {/* Most Delivered Items Chart */}
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
                ? ((item.timesDelivered / item.timesOrdered) * 100).toFixed(1)
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
              <Bar dataKey="timesDelivered" fill="#000000">
                {deliveredItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#000000" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No delivered items data available</div>
        )}
      </div>

      {/* Customer Lifetime Value */}
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

      {/* Loyal Customer */}
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

      {/* Most Ordered Service */}
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
                    <td className="py-3 px-4 text-sm">${item.revenue?.toFixed(2) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No most ordered service data available</div>
        )}
      </div>

      {/* Most Rewarding Service */}
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
                    <td className="py-3 px-4 text-sm">${item.profit?.toFixed(2) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No most rewarding service data available</div>
        )}
      </div>

      {/* Time Breakdown */}
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
              <Bar dataKey="order_count" fill="#000000">
                {timeBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#000000" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No time breakdown data available</div>
        )}
      </div>

      {/* Order Status Breakdown */}
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
              <Bar dataKey="count" fill="#000000">
                {orderStatusBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#000000" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No order status breakdown data available</div>
        )}
      </div>

      {/* Peak Ordering Hours */}
      <div id="peak-hours" className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Clock size={24} />
          Peak Ordering Hours
        </h2>
        {peakOrderingHours.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peakOrderingHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="order_count" fill="#000000">
                {peakOrderingHours.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#000000" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No peak ordering hours data available</div>
        )}
      </div>

      {/* Delivery Type Split */}
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
              <Bar dataKey="count" fill="#000000">
                {deliveryTypeSplit.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#000000" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No delivery type split data available</div>
        )}
      </div>

      {/* New vs Returning Customers */}
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
    </div>
  )
}
