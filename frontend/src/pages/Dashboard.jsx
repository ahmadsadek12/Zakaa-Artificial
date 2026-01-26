import { useEffect, useState } from 'react'
import axios from 'axios'
import { ShoppingCart, Store, Package, TrendingUp, Clock, CheckCircle, X, User, Phone, Calendar, MapPin, CreditCard, FileText, MessageSquare, Zap, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { getTerminology } from '../utils/terminology'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const REQUIRED_ADDON_KEY = 'base_bot' // Change this to the add-on key that controls dashboard access

export default function Dashboard() {
  const { user } = useAuth()
  const terms = getTerminology(user?.business_type)
  const [stats, setStats] = useState({
    orders: { total: 0, accepted: 0, completed: 0, today: 0 },
    branches: 0,
    items: 0,
    revenue: 0,
    requestsHandled: 0,
    averageResponseTimeSeconds: 0,
  })
  const [upcomingOrders, setUpcomingOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderDetails, setOrderDetails] = useState(null)
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false)
  const [addonActive, setAddonActive] = useState(true) // Default to true to avoid flicker
  const [checkingAddon, setCheckingAddon] = useState(true)

  useEffect(() => {
    checkAddonStatus()
  }, [])

  useEffect(() => {
    if (addonActive) {
      fetchDashboardData()
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchDashboardData, 30000)
      return () => clearInterval(interval)
    }
  }, [addonActive])

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

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No token found in localStorage')
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      // Fetch orders stats
      const ordersRes = await axios.get(`${API_URL}/api/orders/stats`, { headers })
      const orders = ordersRes.data.data.stats

      // Fetch branches count
      const branchesRes = await axios.get(`${API_URL}/api/branches`, { headers })
      const branches = branchesRes.data.data.branches || []

      // Fetch items count
      const itemsRes = await axios.get(`${API_URL}/api/items`, { headers })
      const items = itemsRes.data.data.items || []

      // Fetch upcoming orders (only accepted status)
      const upcomingRes = await axios.get(`${API_URL}/api/orders?status=accepted&limit=10`, { headers })
      const upcoming = upcomingRes.data.data.orders || []

      setStats({
        orders: {
          total: orders.total || 0,
          accepted: orders.accepted || orders.byStatus?.accepted || 0,
          completed: orders.completed || orders.byStatus?.completed || 0,
          today: orders.total || 0, // Simplified
        },
        branches: branches.length,
        items: items.length,
        revenue: orders.totalRevenue || 0,
        requestsHandled: orders.requestsHandled || 0,
        averageResponseTimeSeconds: orders.averageResponseTimeSeconds || 0,
      })
      setUpcomingOrders(upcoming)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      console.error('Error response:', error.response?.data)
      const errorMessage = error.response?.data?.error?.message || error.message
      console.error('Error message:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: `Accepted ${terms.orders}`,
      value: stats.orders.accepted,
      icon: Clock,
      color: 'text-blue-600 bg-blue-50',
      link: '/orders?status=accepted',
    },
    {
      title: `Completed ${terms.orders}`,
      value: stats.orders.completed,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
      link: '/orders?status=completed',
    },
    {
      title: `Total ${terms.orders}`,
      value: stats.orders.total,
      icon: ShoppingCart,
      color: 'text-gray-600 bg-gray-50',
      link: '/orders',
    },
    {
      title: 'Branches',
      value: stats.branches,
      icon: Store,
      color: 'text-purple-600 bg-purple-50',
      link: '/branches',
    },
    {
      title: terms.items,
      value: stats.items,
      icon: Package,
      color: 'text-indigo-600 bg-indigo-50',
      link: '/items',
    },
    {
      title: 'Requests Handled',
      value: stats.requestsHandled.toLocaleString(),
      icon: MessageSquare,
      color: 'text-cyan-600 bg-cyan-50',
      link: null, // No link for this card
    },
    {
      title: 'Avg Response Time',
      value: stats.averageResponseTimeSeconds > 0 
        ? `${stats.averageResponseTimeSeconds}s` 
        : 'N/A',
      icon: Zap,
      color: 'text-orange-600 bg-orange-50',
      link: null, // No link for this card
    },
  ]

  const getStatusColor = (status) => {
    const colors = {
      accepted: 'bg-blue-100 text-blue-800',
      delivering: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return colors[status] || colors.accepted
  }

  const handleMarkCompleted = async (orderId) => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/api/orders/${orderId}/status`,
        { status: 'completed' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      // Refresh upcoming orders
      fetchDashboardData()
    } catch (error) {
      console.error('Error marking order as completed:', error)
      alert('Failed to update order status')
    }
  }

  const handleOrderClick = async (order) => {
    try {
      setSelectedOrder(order)
      setShowOrderModal(true)
      setLoadingOrderDetails(true)
      
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(`${API_URL}/api/orders/${order.id}`, { headers })
      setOrderDetails(response.data.data.order)
    } catch (error) {
      console.error('Error fetching order details:', error)
      alert('Failed to load order details')
      setShowOrderModal(false)
    } finally {
      setLoadingOrderDetails(false)
    }
  }

  const closeOrderModal = () => {
    setShowOrderModal(false)
    setSelectedOrder(null)
    setOrderDetails(null)
  }

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
              This feature requires an active add-on. Please unlock the add-on to access the dashboard.
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          const CardWrapper = stat.link ? Link : 'div'
          const cardProps = stat.link ? { to: stat.link } : {}
          
          return (
            <CardWrapper
              key={stat.title}
              {...cardProps}
              className={`card ${stat.link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''} p-4`}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon size={24} />
                </div>
                <div className="w-full">
                  <p className="text-xs text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </CardWrapper>
          )
        })}
      </div>

      {/* Upcoming Orders (Accepted Orders Only) */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Orders</h2>
          <Link
            to="/orders?status=accepted"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all →
          </Link>
        </div>

        {upcomingOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
            <p>No accepted orders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Scheduled</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {upcomingOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleOrderClick(order)}
                        className="text-primary-600 hover:text-primary-700 font-mono text-sm cursor-pointer"
                      >
                        {order.id.substring(0, 8).toUpperCase()}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {order.customer_name || order.customer_phone_number}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium">${order.total}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {order.scheduled_for 
                        ? new Date(order.scheduled_for).toLocaleDateString() + ' ' + new Date(order.scheduled_for).toLocaleTimeString()
                        : 'Not scheduled'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleMarkCompleted(order.id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      >
                        Mark Completed
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showOrderModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeOrderModal}
        >
          <div 
            className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={closeOrderModal}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold bg-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="overflow-y-auto flex-1 p-6">
              {loadingOrderDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : orderDetails ? (
                <div className="space-y-6">
                  {/* Customer Information */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <User size={20} />
                      Customer Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Customer Name</p>
                        <p className="text-base font-medium text-gray-900">{orderDetails.customer_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Phone Number</p>
                        <p className="text-base font-medium text-gray-900 flex items-center gap-2">
                          <Phone size={16} />
                          {orderDetails.customer_phone_number}
                        </p>
                      </div>
                      {orderDetails.whatsapp_user_id && (
                        <div>
                          <p className="text-sm text-gray-600">WhatsApp User ID</p>
                          <p className="text-base font-medium text-gray-900">{orderDetails.whatsapp_user_id}</p>
                        </div>
                      )}
                      {orderDetails.language_used && (
                        <div>
                          <p className="text-sm text-gray-600">Language Used</p>
                          <p className="text-base font-medium text-gray-900 capitalize">{orderDetails.language_used}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText size={20} />
                      Order Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Order ID</p>
                        <p className="text-base font-mono text-gray-900">{orderDetails.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(orderDetails.status)}`}>
                          {orderDetails.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Delivery Type</p>
                        <p className="text-base font-medium text-gray-900 capitalize flex items-center gap-2">
                          <MapPin size={16} />
                          {orderDetails.delivery_type?.replace('_', ' ')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Payment Method</p>
                        <p className="text-base font-medium text-gray-900 capitalize flex items-center gap-2">
                          <CreditCard size={16} />
                          {orderDetails.payment_method || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Payment Status</p>
                        <p className="text-base font-medium text-gray-900 capitalize">{orderDetails.payment_status || 'Unpaid'}</p>
                      </div>
                      {orderDetails.scheduled_for && (
                        <div>
                          <p className="text-sm text-gray-600">Scheduled For</p>
                          <p className="text-base font-medium text-gray-900 flex items-center gap-2">
                            <Calendar size={16} />
                            {format(new Date(orderDetails.scheduled_for), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                      )}
                      {(orderDetails.location_address || orderDetails.delivery_type === 'delivery') && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600">Delivery Address</p>
                          <p className="text-base text-gray-900">{orderDetails.location_address || 'Not provided'}</p>
                        </div>
                      )}
                      {orderDetails.notes && orderDetails.notes !== '__cart__' && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600">Notes</p>
                          <p className="text-base text-gray-900">{orderDetails.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{terms.orderItems}</h3>
                    {orderDetails.items && orderDetails.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">{terms.itemName}</th>
                              <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Quantity</th>
                              <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Price</th>
                              <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderDetails.items.map((item) => (
                              <tr key={item.id} className="border-b border-gray-100">
                                <td className="py-3 px-3">
                                  <p className="font-medium text-gray-900">{item.name_at_time || item.name}</p>
                                  {item.notes && (
                                    <p className="text-sm text-gray-500 mt-1">Note: {item.notes}</p>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right text-gray-900">{item.quantity}</td>
                                <td className="py-3 px-3 text-right text-gray-900">${parseFloat(item.price_at_time || item.price).toFixed(2)}</td>
                                <td className="py-3 px-3 text-right font-medium text-gray-900">
                                  ${(parseFloat(item.price_at_time || item.price) * parseInt(item.quantity)).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500">{terms.noItems}</p>
                    )}
                  </div>

                  {/* Pricing Summary */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium text-gray-900">${parseFloat(orderDetails.subtotal || 0).toFixed(2)}</span>
                      </div>
                      {orderDetails.delivery_price > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Delivery Price</span>
                          <span className="font-medium text-gray-900">${parseFloat(orderDetails.delivery_price || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-lg font-semibold text-gray-900">Total</span>
                        <span className="text-lg font-bold text-gray-900">${parseFloat(orderDetails.total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Timestamps</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Created At</p>
                        <p className="text-base text-gray-900">{format(new Date(orderDetails.created_at), 'MMM d, yyyy HH:mm:ss')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Updated At</p>
                        <p className="text-base text-gray-900">{format(new Date(orderDetails.updated_at), 'MMM d, yyyy HH:mm:ss')}</p>
                      </div>
                      {orderDetails.completed_at && (
                        <div>
                          <p className="text-sm text-gray-600">Completed At</p>
                          <p className="text-base text-gray-900">{format(new Date(orderDetails.completed_at), 'MMM d, yyyy HH:mm:ss')}</p>
                        </div>
                      )}
                      {orderDetails.cancelled_at && (
                        <div>
                          <p className="text-sm text-gray-600">Cancelled At</p>
                          <p className="text-base text-gray-900">{format(new Date(orderDetails.cancelled_at), 'MMM d, yyyy HH:mm:ss')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Failed to load order details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
