import { useEffect, useState } from 'react'
import axios from 'axios'
import { Search, Filter, Eye, X, User, Phone, Calendar, MapPin, CreditCard, FileText, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { getTerminology } from '../utils/terminology'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Orders() {
  const { user } = useAuth()
  const terms = getTerminology(user?.business_type)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderDetails, setOrderDetails] = useState(null)
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false)
  const [deliveryPriceInput, setDeliveryPriceInput] = useState('')
  const [settingDeliveryPrice, setSettingDeliveryPrice] = useState(false)
  
  // Create order modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [items, setItems] = useState([])
  const [createFormData, setCreateFormData] = useState({
    customerPhoneNumber: '',
    customerName: '',
    deliveryType: 'takeaway',
    selectedItems: [{ itemId: '', quantity: 1 }],
    notes: '',
    locationAddress: '',
    isScheduled: false,
    scheduledDate: '',
    scheduledTime: ''
  })

  useEffect(() => {
    fetchOrders()
    fetchItems()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchOrders()
    }, 30000)
    return () => clearInterval(interval)
  }, [statusFilter, activeTab])
  
  // Sync activeTab with statusFilter
  useEffect(() => {
    setStatusFilter(activeTab)
  }, [activeTab])
  
  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/items`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setItems(response.data.data.items || [])
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const params = statusFilter !== 'all' ? { status: statusFilter } : {}
      const response = await axios.get(`${API_URL}/api/orders`, { params, headers })
      setOrders(response.data.data.orders || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/api/orders/${orderId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      fetchOrders()
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Failed to update order status')
    }
  }

  const cancelScheduledOrder = async (order) => {
    // Check if order is scheduled
    if (!order.scheduled_for) {
      alert('This is not a scheduled order')
      return
    }

    // Check if more than 2 hours remaining
    const scheduledDate = new Date(order.scheduled_for)
    const now = new Date()
    const hoursUntil = (scheduledDate - now) / (1000 * 60 * 60)

    if (hoursUntil < 2) {
      alert('Cannot cancel orders scheduled within 2 hours. Please contact the customer directly.')
      return
    }

    if (!confirm(`Are you sure you want to cancel this scheduled order?\n\nOrder: ${order.id.substring(0, 8).toUpperCase()}\nScheduled for: ${format(scheduledDate, 'MMM d, yyyy HH:mm')}\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/api/orders/${order.id}/cancel-scheduled`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert('Scheduled order cancelled successfully')
      fetchOrders()
    } catch (error) {
      console.error('Error cancelling scheduled order:', error)
      const errorMessage = error.response?.data?.error?.message || 'Failed to cancel order'
      alert(errorMessage)
    }
  }

  const filteredOrders = orders.filter((order) => {
    // Filter by search term
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone_number?.includes(searchTerm) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Filter by active tab (status)
    const matchesStatus = activeTab === 'all' || order.status === activeTab
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status) => {
    const colors = {
      accepted: 'bg-blue-100 text-blue-800',
      delivering: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return colors[status] || colors.accepted
  }

  const handleOrderClick = async (order) => {
    try {
      setSelectedOrder(order)
      setShowOrderModal(true)
      setLoadingOrderDetails(true)
      setDeliveryPriceInput('') // Reset delivery price input
      
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
    setDeliveryPriceInput('')
  }
  
  const handleSetDeliveryPrice = async () => {
    if (!deliveryPriceInput || parseFloat(deliveryPriceInput) < 0) {
      alert('Please enter a valid delivery price')
      return
    }
    
    if (!confirm(`Set delivery price to $${parseFloat(deliveryPriceInput).toFixed(2)}? The customer will be notified.`)) {
      return
    }
    
    setSettingDeliveryPrice(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.put(
        `${API_URL}/api/orders/${orderDetails.id}/delivery-price`,
        { deliveryPrice: parseFloat(deliveryPriceInput) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      alert('Delivery price set successfully! Customer has been notified.')
      
      // Refresh order details
      const orderResponse = await axios.get(`${API_URL}/api/orders/${orderDetails.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setOrderDetails(orderResponse.data.data.order)
      setDeliveryPriceInput('')
    } catch (error) {
      console.error('Error setting delivery price:', error)
      alert(error.response?.data?.error?.message || 'Failed to set delivery price')
    } finally {
      setSettingDeliveryPrice(false)
    }
  }
  
  const handleCreateOrder = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      
      // Filter out empty items
      const validItems = createFormData.selectedItems.filter(item => item.itemId && item.quantity > 0)
      
      if (validItems.length === 0) {
        alert('Please select at least one item')
        return
      }
      
      // Validate scheduled time if scheduling is enabled
      if (createFormData.isScheduled) {
        if (!createFormData.scheduledDate || !createFormData.scheduledTime) {
          alert('Please select both date and time for scheduled order')
          return
        }
        
        const scheduledDateTime = new Date(`${createFormData.scheduledDate}T${createFormData.scheduledTime}`)
        const now = new Date()
        
        if (scheduledDateTime <= now) {
          alert('Scheduled time must be in the future')
          return
        }
      }
      
      const payload = {
        customerPhoneNumber: createFormData.customerPhoneNumber,
        customerName: createFormData.customerName || undefined,
        deliveryType: createFormData.deliveryType,
        items: validItems.map(item => ({
          itemId: item.itemId,
          quantity: parseInt(item.quantity, 10)
        })),
        notes: createFormData.notes || undefined,
        locationAddress: createFormData.locationAddress || undefined
      }
      
      // Add scheduled time if provided
      if (createFormData.isScheduled && createFormData.scheduledDate && createFormData.scheduledTime) {
        const scheduledDateTime = `${createFormData.scheduledDate}T${createFormData.scheduledTime}:00`
        payload.scheduledFor = scheduledDateTime
      }
      
      await axios.post(`${API_URL}/api/orders`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      alert('Order created successfully!')
      setShowCreateModal(false)
      setCreateFormData({
        customerPhoneNumber: '',
        customerName: '',
        deliveryType: 'takeaway',
        selectedItems: [{ itemId: '', quantity: 1 }],
        notes: '',
        locationAddress: '',
        isScheduled: false,
        scheduledDate: '',
        scheduledTime: ''
      })
      fetchOrders()
    } catch (error) {
      console.error('Error creating order:', error)
      alert(error.response?.data?.error?.message || 'Failed to create order')
    }
  }
  
  const addItemToOrder = () => {
    setCreateFormData(prev => ({
      ...prev,
      selectedItems: [...prev.selectedItems, { itemId: '', quantity: 1 }]
    }))
  }
  
  const removeItemFromOrder = (index) => {
    setCreateFormData(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.filter((_, i) => i !== index)
    }))
  }
  
  const updateOrderItem = (index, field, value) => {
    setCreateFormData(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const statusOptions = [
    { value: 'all', label: `All ${terms.orders}` },
    { value: 'accepted', label: 'Accepted' },
    { value: 'delivering', label: 'Delivering' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ]
  
  const orderTabs = [
    { value: 'all', label: 'All' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{terms.orders}</h1>
          <p className="text-gray-600 mt-2">Manage and track all your {terms.orders.toLowerCase()}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Create {terms.order}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          {orderTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`pb-4 px-4 font-medium transition-colors ${
                activeTab === tab.value
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={`Search ${terms.orders.toLowerCase()}...`}
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No {terms.orders.toLowerCase()} found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Items</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
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
                      <div>
                        <p className="font-medium">{order.customer_name || 'N/A'}</p>
                        <p className="text-gray-500 text-xs">{order.customer_phone_number}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} item(s)
                    </td>
                    <td className="py-3 px-4 text-sm font-medium">${order.total}</td>
                    <td className="py-3 px-4">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status === 'accepted' && (
                          <>
                            <option value="accepted">Accepted</option>
                            <option value="delivering">Start Delivery</option>
                            <option value="completed">Complete</option>
                            <option value="rejected">Reject</option>
                          </>
                        )}
                        {order.status === 'delivering' && (
                          <>
                            <option value="delivering">Delivering</option>
                            <option value="completed">Complete</option>
                            <option value="rejected">Reject</option>
                          </>
                        )}
                        {order.status === 'completed' && <option value="completed">Completed</option>}
                        {order.status === 'rejected' && <option value="rejected">Rejected</option>}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOrderClick(order)}
                          className="text-primary-600 hover:text-primary-700 cursor-pointer"
                          title="View details"
                        >
                          <Eye size={18} />
                        </button>
                        {order.scheduled_for && order.status === 'accepted' && (() => {
                          const hoursUntil = (new Date(order.scheduled_for) - new Date()) / (1000 * 60 * 60)
                          return hoursUntil >= 2 ? (
                            <button
                              onClick={() => cancelScheduledOrder(order)}
                              className="text-red-600 hover:text-red-700 cursor-pointer"
                              title="Cancel scheduled order"
                            >
                              <Trash2 size={18} />
                            </button>
                          ) : null
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ShoppingCart size={24} />
                Create New Order
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrder} className="p-6 space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Phone Number *</label>
                    <input
                      type="tel"
                      className="input"
                      value={createFormData.customerPhoneNumber}
                      onChange={(e) => setCreateFormData({ ...createFormData, customerPhoneNumber: e.target.value })}
                      placeholder="+9611234567"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Customer Name</label>
                    <input
                      type="text"
                      className="input"
                      value={createFormData.customerName}
                      onChange={(e) => setCreateFormData({ ...createFormData, customerName: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              </div>
              
              {/* Order Items */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{terms.orderItems}</h3>
                <div className="space-y-3">
                  {createFormData.selectedItems.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <select
                          className="input"
                          value={item.itemId}
                          onChange={(e) => updateOrderItem(index, 'itemId', e.target.value)}
                          required
                        >
                          <option value="">{terms.selectItem}</option>
                          {items.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.name} - ${i.price}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          className="input"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(index, 'quantity', e.target.value)}
                          placeholder="Qty"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemFromOrder(index)}
                        className="btn btn-secondary p-2"
                        disabled={createFormData.selectedItems.length === 1}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addItemToOrder}
                  className="mt-3 text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Plus size={18} />
                  Add Item
                </button>
              </div>
              
              {/* Delivery Details */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Delivery Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Delivery Type *</label>
                    <select
                      className="input"
                      value={createFormData.deliveryType}
                      onChange={(e) => setCreateFormData({ ...createFormData, deliveryType: e.target.value })}
                      required
                    >
                      <option value="takeaway">Takeaway</option>
                      <option value="delivery">Delivery</option>
                      <option value="on_site">On-site</option>
                    </select>
                  </div>
                  
                  {createFormData.deliveryType === 'delivery' && (
                    <div>
                      <label className="label">Delivery Address *</label>
                      <textarea
                        className="input"
                        rows="2"
                        value={createFormData.locationAddress}
                        onChange={(e) => setCreateFormData({ ...createFormData, locationAddress: e.target.value })}
                        placeholder="Enter delivery address..."
                        required={createFormData.deliveryType === 'delivery'}
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="label">Order Notes</label>
                    <textarea
                      className="input"
                      rows="2"
                      value={createFormData.notes}
                      onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                      placeholder="Special instructions..."
                    />
                  </div>
                </div>
              </div>
              
              {/* Schedule Order */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Scheduling</h3>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createFormData.isScheduled}
                        onChange={(e) => setCreateFormData({ 
                          ...createFormData, 
                          isScheduled: e.target.checked,
                          scheduledDate: e.target.checked ? createFormData.scheduledDate : '',
                          scheduledTime: e.target.checked ? createFormData.scheduledTime : ''
                        })}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Schedule this order for later</span>
                    </label>
                  </div>
                  
                  {createFormData.isScheduled && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="label">Date *</label>
                        <input
                          type="date"
                          className="input"
                          value={createFormData.scheduledDate}
                          onChange={(e) => setCreateFormData({ ...createFormData, scheduledDate: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          required={createFormData.isScheduled}
                        />
                      </div>
                      <div>
                        <label className="label">Time *</label>
                        <input
                          type="time"
                          className="input"
                          value={createFormData.scheduledTime}
                          onChange={(e) => setCreateFormData({ ...createFormData, scheduledTime: e.target.value })}
                          required={createFormData.isScheduled}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create {terms.order}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      {/* Only show Delivery Type for F&B businesses or if order contains goods (not services) */}
                      {(() => {
                        const isFoodAndBeverage = user?.business_type === 'f & b'
                        const hasServiceItems = orderDetails.items?.some(item => item.item_type === 'service')
                        const shouldShowDeliveryType = isFoodAndBeverage || !hasServiceItems
                        
                        if (!shouldShowDeliveryType) return null
                        
                        return (
                          <div>
                            <p className="text-sm text-gray-600">Delivery Type</p>
                            <p className="text-base font-medium text-gray-900 capitalize flex items-center gap-2">
                              <MapPin size={16} />
                              {orderDetails.delivery_type?.replace('_', ' ')}
                            </p>
                          </div>
                        )
                      })()}
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
                      {orderDetails.delivery_price > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Delivery Price</span>
                          <span className="font-medium text-gray-900">${parseFloat(orderDetails.delivery_price || 0).toFixed(2)}</span>
                        </div>
                      ) : orderDetails.status === 'accepted' && orderDetails.delivery_type === 'delivery' ? (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
                          <div className="flex-1">
                            <label className="text-sm text-gray-600 mb-1 block">Set Delivery Price</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                className="input flex-1"
                                value={deliveryPriceInput}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Allow numbers, decimal point, and empty string
                                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                    setDeliveryPriceInput(value);
                                  }
                                }}
                                onWheel={(e) => e.target.blur()}
                                placeholder="0.00"
                              />
                              <button
                                type="button"
                                onClick={handleSetDeliveryPrice}
                                disabled={settingDeliveryPrice || !deliveryPriceInput}
                                className="btn btn-primary whitespace-nowrap"
                              >
                                {settingDeliveryPrice ? 'Setting...' : 'Set Price'}
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Customer will be notified automatically</p>
                          </div>
                        </div>
                      ) : null}
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
