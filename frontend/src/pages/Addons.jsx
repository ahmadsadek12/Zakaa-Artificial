import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { Package, Check, X, DollarSign } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Addons() {
  const { user } = useAuth()
  const [addons, setAddons] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState({})

  useEffect(() => {
    fetchAddons()
  }, [])

  const fetchAddons = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/addons`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAddons(response.data.data.addons || [])
    } catch (error) {
      console.error('Error fetching addons:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAddon = async (addonKey, currentStatus) => {
    setUpdating({ ...updating, [addonKey]: true })
    try {
      const token = localStorage.getItem('token')
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      await axios.put(
        `${API_URL}/api/addons/${addonKey}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchAddons()
    } catch (error) {
      console.error('Error updating addon:', error)
      alert(error.response?.data?.error?.message || 'Failed to update addon')
    } finally {
      setUpdating({ ...updating, [addonKey]: false })
    }
  }

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {addons.map((addon) => (
          <div
            key={addon.addon_key}
            className={`border rounded-lg p-6 ${
              addon.isActive
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {addon.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    ${addon.priceOverride || addon.default_price}
                  </span>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  addon.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {addon.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => toggleAddon(addon.addon_key, addon.status)}
                disabled={updating[addon.addon_key]}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  addon.isActive
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {updating[addon.addon_key] ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : addon.isActive ? (
                  <>
                    <X className="w-4 h-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Activate
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {addons.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No add-ons available</p>
        </div>
      )}
    </div>
  )
}
