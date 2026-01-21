import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { Package, Check, X, DollarSign, Unlock } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Addons() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [userSubscriptions, setUserSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSubscription, setSelectedSubscription] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      
      // Fetch all available subscriptions
      const subscriptionsRes = await axios.get(`${API_URL}/api/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSubscriptions(subscriptionsRes.data.data.subscriptions || [])

      // Fetch user's active subscriptions
      const userSubsRes = await axios.get(`${API_URL}/api/subscriptions/my-subscriptions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUserSubscriptions(userSubsRes.data.data.subscriptions || [])
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscriptionClick = (subscription) => {
    setSelectedSubscription(subscription)
    setShowModal(true)
  }

  const hasAnySubscription = userSubscriptions.length > 0
  const userSubscriptionIds = new Set(userSubscriptions.map(us => us.subscription_id))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-8 h-8" />
          Add-ons
        </h1>
        <p className="text-gray-600 mt-2">Manage your add-on subscriptions</p>
      </div>

      {/* Unlock Other Add Ons Button - Only show if user has no subscriptions */}
      {!hasAnySubscription && (
        <div className="mb-6">
          <button className="btn btn-primary flex items-center gap-2">
            <Unlock className="w-5 h-5" />
            Unlock Other Add Ons
          </button>
        </div>
      )}

      {/* Subscriptions Grid - Centered */}
      <div className="flex justify-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
          {subscriptions.map((subscription) => {
            const userHasIt = userSubscriptionIds.has(subscription.id)
            const saleAmount = subscription.sale > 0 
              ? (subscription.price * subscription.sale / 100) 
              : 0
            const finalPrice = subscription.price - saleAmount

            return (
              <div
                key={subscription.id}
                className={`border rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
                  userHasIt
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
                onClick={() => handleSubscriptionClick(subscription)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {subscription.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {subscription.description}
                    </p>
                  </div>
                  {userHasIt && (
                    <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <div className="flex items-center gap-2">
                      {subscription.sale > 0 ? (
                        <>
                          <span className="text-lg font-bold text-gray-900">
                            ${finalPrice.toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500 line-through">
                            ${subscription.price.toFixed(2)}
                          </span>
                          <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded">
                            {subscription.sale}% OFF
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-gray-900">
                          ${subscription.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {subscriptions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No subscriptions available</p>
        </div>
      )}

      {/* Subscription Modal - Placeholder */}
      {showModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowModal(false)
                setSelectedSubscription(null)
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pr-8">
              {selectedSubscription.name}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedSubscription.description}
            </p>
            <div className="text-lg font-semibold text-gray-900 mb-6">
              ${selectedSubscription.price.toFixed(2)}
              {selectedSubscription.sale > 0 && (
                <span className="text-sm text-red-600 ml-2">
                  ({selectedSubscription.sale}% OFF)
                </span>
              )}
            </div>
            <div className="text-center text-gray-500 text-sm">
              Modal content will be implemented later
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
