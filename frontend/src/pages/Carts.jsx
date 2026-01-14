import { useEffect, useState } from 'react'
import axios from 'axios'
import { Search, Eye, X, User, Phone, Clock, ShoppingCart, Trash2, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Carts() {
  const [carts, setCarts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCartModal, setShowCartModal] = useState(false)
  const [selectedCart, setSelectedCart] = useState(null)
  const [cartDetails, setCartDetails] = useState(null)
  const [loadingCartDetails, setLoadingCartDetails] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cartToCancel, setCartToCancel] = useState(null)

  useEffect(() => {
    fetchCarts()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCarts, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchCarts = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const response = await axios.get(`${API_URL}/api/carts`, { headers })
      setCarts(response.data.data.carts || [])
    } catch (error) {
      console.error('Error fetching carts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCartClick = async (cart) => {
    try {
      setSelectedCart(cart)
      setShowCartModal(true)
      setLoadingCartDetails(true)
      
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(`${API_URL}/api/carts/${cart.id}`, { headers })
      setCartDetails(response.data.data.cart)
    } catch (error) {
      console.error('Error fetching cart details:', error)
      alert('Failed to load cart details')
      setShowCartModal(false)
    } finally {
      setLoadingCartDetails(false)
    }
  }

  const closeCartModal = () => {
    setShowCartModal(false)
    setSelectedCart(null)
    setCartDetails(null)
  }

  const handleCancelClick = (cart) => {
    setCartToCancel(cart)
    setShowCancelConfirm(true)
  }

  const confirmCancelCart = async () => {
    if (!cartToCancel) return
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      await axios.delete(`${API_URL}/api/carts/${cartToCancel.id}`, { headers })
      
      // Refresh carts list
      fetchCarts()
      
      // Close modals
      setShowCancelConfirm(false)
      setCartToCancel(null)
      
      // Close cart details modal if this cart is being viewed
      if (selectedCart?.id === cartToCancel.id) {
        closeCartModal()
      }
      
      alert('Cart cancelled successfully')
    } catch (error) {
      console.error('Error cancelling cart:', error)
      alert('Failed to cancel cart')
    }
  }

  const filteredCarts = carts.filter((cart) => {
    const matchesSearch =
      cart.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.customer_phone_number?.includes(searchTerm) ||
      cart.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getAgeColor = (minutesSinceUpdate) => {
    if (minutesSinceUpdate < 60) return 'text-green-600' // < 1 hour - green
    if (minutesSinceUpdate < 90) return 'text-yellow-600' // 1-1.5 hours - yellow
    return 'text-red-600' // > 1.5 hours - red
  }

  const getTimeoutWarning = (minutesUntilTimeout) => {
    if (minutesUntilTimeout < 0) return { show: true, text: 'EXPIRED', color: 'bg-red-100 text-red-800 border-red-300' }
    if (minutesUntilTimeout < 30) return { show: true, text: `${minutesUntilTimeout} min left`, color: 'bg-orange-100 text-orange-800 border-orange-300' }
    return { show: false }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading carts...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Active Carts</h1>
        <p className="text-gray-600">
          Customer shopping carts that haven't been completed yet. Carts are automatically cancelled after 2 hours of inactivity.
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by ID, phone, or name..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Carts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timeout
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCarts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <ShoppingCart className="mx-auto mb-2 text-gray-400" size={48} />
                    <p className="text-lg">No active carts</p>
                    <p className="text-sm">Customer carts will appear here when they start shopping</p>
                  </td>
                </tr>
              ) : (
                filteredCarts.map((cart) => {
                  const warning = getTimeoutWarning(cart.minutes_until_timeout)
                  return (
                    <tr key={cart.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="text-gray-400 mr-2" size={16} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {cart.customer_name || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Phone size={12} className="mr-1" />
                              {cart.customer_phone_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{cart.items_count} item(s)</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${parseFloat(cart.total || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm flex items-center ${getAgeColor(cart.minutes_since_update)}`}>
                          <Clock size={14} className="mr-1" />
                          {formatDistanceToNow(new Date(cart.updated_at), { addSuffix: true })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {warning.show ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${warning.color}`}>
                            <AlertCircle size={12} className="mr-1" />
                            {warning.text}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {Math.floor(cart.minutes_until_timeout / 60)}h {cart.minutes_until_timeout % 60}m
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {cart.order_source || 'whatsapp'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleCartClick(cart)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleCancelClick(cart)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cart Details Modal */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Cart Details</h2>
              <button onClick={closeCartModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            {loadingCartDetails ? (
              <div className="p-6 text-center">Loading cart details...</div>
            ) : cartDetails ? (
              <div className="p-6 space-y-6">
                {/* Customer Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <User className="mr-2" size={20} />
                    Customer Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{cartDetails.customer_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{cartDetails.customer_phone_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Channel:</span>
                      <span className="font-medium capitalize">{cartDetails.order_source || 'whatsapp'}</span>
                    </div>
                    {cartDetails.language_used && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Language:</span>
                        <span className="font-medium capitalize">{cartDetails.language_used}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <ShoppingCart className="mr-2" size={20} />
                    Cart Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="font-medium">
                        {formatDistanceToNow(new Date(cartDetails.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Updated:</span>
                      <span className={`font-medium ${getAgeColor(cartDetails.minutes_since_update)}`}>
                        {formatDistanceToNow(new Date(cartDetails.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time Until Timeout:</span>
                      {cartDetails.minutes_until_timeout < 0 ? (
                        <span className="font-medium text-red-600">EXPIRED</span>
                      ) : cartDetails.minutes_until_timeout < 30 ? (
                        <span className="font-medium text-orange-600">
                          {cartDetails.minutes_until_timeout} minutes
                        </span>
                      ) : (
                        <span className="font-medium">
                          {Math.floor(cartDetails.minutes_until_timeout / 60)}h {cartDetails.minutes_until_timeout % 60}m
                        </span>
                      )}
                    </div>
                    {cartDetails.delivery_type && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Delivery Type:</span>
                        <span className="font-medium capitalize">{cartDetails.delivery_type}</span>
                      </div>
                    )}
                    {cartDetails.location_address && (
                      <div className="flex flex-col">
                        <span className="text-gray-600 mb-1">Delivery Address:</span>
                        <span className="font-medium text-sm">{cartDetails.location_address}</span>
                      </div>
                    )}
                    {cartDetails.scheduled_for && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Scheduled For:</span>
                        <span className="font-medium text-sm">
                          {new Date(cartDetails.scheduled_for).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Items in Cart</h3>
                  <div className="space-y-2">
                    {cartDetails.items && cartDetails.items.length > 0 ? (
                      cartDetails.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{item.name_at_time || item.name}</div>
                            {item.notes && (
                              <div className="text-sm text-gray-500">Note: {item.notes}</div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm text-gray-600">Qty: {item.quantity}</div>
                            <div className="font-medium">${parseFloat(item.price_at_time).toFixed(2)}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">No items in cart</div>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>${parseFloat(cartDetails.total || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={closeCartModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      closeCartModal()
                      handleCancelClick(cartDetails)
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Cancel Cart
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="text-red-600 mr-2" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Cancel Cart?</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this cart? This action cannot be undone. The cart will be marked as rejected.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  setCartToCancel(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                No, Keep Cart
              </button>
              <button
                onClick={confirmCancelCart}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Yes, Cancel Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
