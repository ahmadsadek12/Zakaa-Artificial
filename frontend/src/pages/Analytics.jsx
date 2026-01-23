import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Users, Package, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import { getNavTerminology } from '../utils/terminology'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

export default function Analytics() {
  const { user } = useAuth()
  const navTerms = getNavTerminology()
  const [overview, setOverview] = useState(null)
  const [revenue, setRevenue] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [recurringCustomers, setRecurringCustomers] = useState([])
  const [popularItems, setPopularItems] = useState([])
  const [deliveredItems, setDeliveredItems] = useState([])
  const [lifetimeValue, setLifetimeValue] = useState(null)
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
      const basicOverviewRes = await axios.get(`${API_URL}/api/analytics/basic-overview`, { headers, params }).catch(() => ({ data: { data: { overview: null } } }))
      
      // Try to fetch premium metrics (will fail gracefully if not premium or 403)
      const [
        overviewRes,
        revenueRes,
        topCustomersRes,
        recurringCustomersRes,
        popularItemsRes,
        deliveredItemsRes,
        lifetimeValueRes
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
        })
      ])
      
      // Use premium overview if available, otherwise use basic overview
      const premiumOverview = overviewRes.status === 'fulfilled' ? overviewRes.value.data.data.overview : null
      const basicOverview = basicOverviewRes.data?.data?.overview
      setOverview(premiumOverview || basicOverview || null)
      
      setRevenue(revenueRes.status === 'fulfilled' ? revenueRes.value.data.data.revenue || [] : [])
      setTopCustomers(topCustomersRes.status === 'fulfilled' ? topCustomersRes.value.data.data.customers || [] : [])
      setRecurringCustomers(recurringCustomersRes.status === 'fulfilled' ? recurringCustomersRes.value.data.data.customers || [] : [])
      setPopularItems(popularItemsRes.status === 'fulfilled' ? popularItemsRes.value.data.data.items || [] : [])
      setDeliveredItems(deliveredItemsRes.status === 'fulfilled' ? deliveredItemsRes.value.data.data.items || [] : [])
      setLifetimeValue(lifetimeValueRes.status === 'fulfilled' ? lifetimeValueRes.value.data.data || {} : {})
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{navTerms.analytics}</h1>
        <p className="text-gray-600 mt-2">Insights into your business performance</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                ${overview?.averageOrderValue ? typeof overview.averageOrderValue === 'number' ? overview.averageOrderValue.toFixed(2) : parseFloat(overview.averageOrderValue || 0).toFixed(2) : '0.00'}
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
            Premium analytics require a premium subscription. Some free metrics may be available.
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
      <div className="card">
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
      <div className="card">
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
                  <tr key={customer._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{customer.customerName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-mono">{customer._id}</td>
                    <td className="py-3 px-4 text-sm font-medium">${customer.totalSpent?.toFixed(2) || 0}</td>
                    <td className="py-3 px-4 text-sm">{customer.orderCount || 0}</td>
                    <td className="py-3 px-4 text-sm">
                      ${customer.orderCount > 0 ? (customer.totalSpent / customer.orderCount).toFixed(2) : 0}
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
      <div className="card">
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
                  <tr key={customer._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{customer.customerName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm font-mono">{customer._id}</td>
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
      <div className="card">
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
              <Bar dataKey="times_ordered" fill="#0ea5e9">
                {popularItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No popular items data available</div>
        )}
      </div>

      {/* Most Delivered Items Chart */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Clock size={24} />
          Most Delivered Items (completion rate)
        </h2>
        {deliveredItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={deliveredItems.map(item => ({
              ...item,
              completionRate: item.times_ordered > 0 
                ? ((item.times_delivered / item.times_ordered) * 100).toFixed(1)
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
                  if (name === 'times_delivered') return [value, 'Times Delivered']
                  if (name === 'completionRate') return [`${value}%`, 'Completion Rate']
                  return value
                }}
              />
              <Bar dataKey="times_delivered" fill="#10b981">
                {deliveredItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-500">No delivered items data available</div>
        )}
      </div>

      {/* Customer Lifetime Value */}
      <div className="card">
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
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-mono">{customer.phone || customer._id}</td>
                        <td className="py-3 px-4 text-sm font-medium">${customer.totalSpent?.toFixed(2) || 0}</td>
                        <td className="py-3 px-4 text-sm">{customer.orderCount || 0}</td>
                        <td className="py-3 px-4 text-sm">
                          ${customer.orderCount > 0 ? (customer.totalSpent / customer.orderCount).toFixed(2) : 0}
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
    </div>
  )
}
