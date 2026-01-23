import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { Package, Check, X, Power, PowerOff, DollarSign, Calendar } from 'lucide-react'

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

  const handleToggleAddon = async (addon) => {
    const newStatus = addon.isActive ? 'inactive' : 'active'
    
    setUpdating({ ...updating, [addon.addon_key]: true })
    
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/api/addons/${addon.addon_key}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      // Update local state
      setAddons(addons.map(a => 
        a.addon_key === addon.addon_key 
          ? { ...a, isActive: newStatus === 'active', status: newStatus }
          : a
      ))
    } catch (error) {
      console.error('Error updating addon:', error)
      alert(error.response?.data?.error?.message || 'Failed to update addon')
    } finally {
      setUpdating({ ...updating, [addon.addon_key]: false })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Group addons by category
  const groupedAddons = {
    'Core Features': addons.filter(a => 
      a.addon_key.includes('base') || 
      a.addon_key.includes('channel') ||
      a.addon_key === 'table_reservations'
    ),
    'Analytics': addons.filter(a => a.addon_key.includes('analytics')),
    'Other': addons.filter(a => 
      !a.addon_key.includes('base') && 
      !a.addon_key.includes('channel') && 
      !a.addon_key.includes('analytics') &&
      a.addon_key !== 'table_reservations'
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-8 h-8" />
          Add-ons Management
        </h1>
        <p className="text-gray-600 mt-2">Activate or deactivate add-ons for your business</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Add-ons</div>
          <div className="text-2xl font-bold text-gray-900">{addons.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-2xl font-bold text-green-600">
            {addons.filter(a => a.isActive).length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Inactive</div>
          <div className="text-2xl font-bold text-gray-400">
            {addons.filter(a => !a.isActive).length}
          </div>
        </div>
      </div>

      {/* Addons List */}
      {Object.entries(groupedAddons).map(([category, categoryAddons]) => {
        if (categoryAddons.length === 0) return null
        
        return (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryAddons.map((addon) => {
                const price = addon.priceOverride || addon.default_price || 0
                const isUpdating = updating[addon.addon_key]
                
                return (
                  <div
                    key={addon.addon_key}
                    className={`border rounded-lg p-5 bg-white transition-all ${
                      addon.isActive
                        ? 'border-green-500 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {addon.name}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono mb-2">
                          {addon.addon_key}
                        </p>
                      </div>
                      {addon.isActive && (
                        <div className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Active
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1 text-gray-600">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold">
                          ${typeof price === 'number' ? price.toFixed(2) : parseFloat(price || 0).toFixed(2)}
                        </span>
                        {addon.priceOverride && (
                          <span className="text-xs text-gray-400 ml-1">(custom)</span>
                        )}
                      </div>
                    </div>

                    {addon.activatedAt && (
                      <div className="text-xs text-gray-500 mb-3">
                        Activated: {new Date(addon.activatedAt).toLocaleDateString()}
                      </div>
                    )}

                    <button
                      onClick={() => handleToggleAddon(addon)}
                      disabled={isUpdating}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        addon.isActive
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          <span>Updating...</span>
                        </>
                      ) : addon.isActive ? (
                        <>
                          <PowerOff className="w-4 h-4" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-4 h-4" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {addons.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No add-ons available</p>
        </div>
      )}
    </div>
  )
}
