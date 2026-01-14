import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  ArrowLeft, Building2, Store, ShoppingCart, MessageSquare, 
  Mail, Phone, MapPin, Calendar, Edit2, Plus, Eye
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function AdminBusinessDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const [business, setBusiness] = useState(null)
  const [branches, setBranches] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.userType !== 'admin') {
      navigate('/')
      return
    }
    fetchBusinessDetail()
  }, [user, navigate, id])

  const fetchBusinessDetail = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(`${API_URL}/api/admin/businesses/${id}`, { headers })
      setBusiness(response.data.data.business)
      setBranches(response.data.data.branches)
      setStats(response.data.data.stats)
    } catch (error) {
      console.error('Error fetching business details:', error)
      alert('Failed to load business details')
      navigate('/admin/businesses')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Business not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/businesses')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{business.business_name}</h1>
            <p className="text-gray-600 mt-1 capitalize">{business.business_type?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/businesses')}
          className="btn btn-secondary"
        >
          <Edit2 size={18} />
          Edit Business
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Branches</p>
              <p className="text-3xl font-bold text-gray-900">{branches.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <Store size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.orders?.total || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900">{stats?.orders?.completed || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <ShoppingCart size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Messages</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.messages || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
              <MessageSquare size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Business Information */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Business Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Email</p>
            <p className="text-base text-gray-900 flex items-center gap-2">
              <Mail size={16} />
              {business.email}
            </p>
          </div>

          {business.contact_phone_number && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Contact Phone</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <Phone size={16} />
                {business.contact_phone_number}
              </p>
            </div>
          )}

          {business.whatsapp_phone_number && (
            <div>
              <p className="text-sm text-gray-600 mb-1">WhatsApp Number</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <MessageSquare size={16} />
                {business.whatsapp_phone_number}
              </p>
            </div>
          )}

          {business.whatsapp_phone_number_id && (
            <div>
              <p className="text-sm text-gray-600 mb-1">WhatsApp Phone Number ID</p>
              <p className="text-base text-gray-900 font-mono text-sm">{business.whatsapp_phone_number_id}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-600 mb-1">Subscription</p>
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                business.subscription_type === 'premium'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {business.subscription_type}
              </span>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                business.subscription_status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {business.subscription_status}
              </span>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Account Status</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
              business.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {business.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Created At</p>
            <p className="text-base text-gray-900 flex items-center gap-2">
              <Calendar size={16} />
              {new Date(business.created_at).toLocaleDateString()}
            </p>
          </div>

          {business.business_description && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600 mb-1">Description</p>
              <p className="text-base text-gray-900">{business.business_description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Statistics */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.orders?.total || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Accepted</p>
            <p className="text-2xl font-bold text-blue-600">{stats?.orders?.accepted || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats?.orders?.completed || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats?.orders?.rejected || 0}</p>
          </div>
          {stats?.orders?.total_revenue > 0 && (
            <div className="md:col-span-4">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600">
                ${parseFloat(stats.orders.total_revenue).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Branches */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Branches</h2>
          <button
            onClick={() => navigate(`/admin/branches?businessId=${id}`)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={18} />
            Add Branch
          </button>
        </div>

        {branches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Store size={48} className="mx-auto mb-4 opacity-50" />
            <p>No branches yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Branch Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stats</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{branch.business_name}</p>
                      {branch.email && (
                        <p className="text-sm text-gray-500">{branch.email}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {branch.city || branch.street ? (
                        <div className="text-sm text-gray-700">
                          <p className="flex items-center gap-1">
                            <MapPin size={12} />
                            {branch.city && branch.street
                              ? `${branch.city}, ${branch.street}`
                              : branch.city || branch.street}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No location</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {branch.contact_phone_number && (
                          <p className="text-gray-700 flex items-center gap-1">
                            <Phone size={12} />
                            {branch.contact_phone_number}
                          </p>
                        )}
                        {branch.whatsapp_phone_number && (
                          <p className="text-green-600 flex items-center gap-1 mt-1">
                            <MessageSquare size={12} />
                            {branch.whatsapp_phone_number}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm space-y-1">
                        <p className="text-gray-600">
                          {branch.orders_count || 0} orders
                        </p>
                        <p className="text-gray-600">
                          {branch.messages_count || 0} messages
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        branch.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/admin/branches/${branch.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
