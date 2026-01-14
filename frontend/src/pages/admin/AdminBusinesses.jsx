import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, Plus, Search, Edit2, Trash2, Eye, Store, 
  ShoppingCart, MessageSquare, X, CheckCircle, Mail, Phone 
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function AdminBusinesses() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    business_name: '',
    business_type: 'food and beverage',
    business_description: '',
    contact_phone_number: '',
    whatsapp_phone_number: '',
    whatsapp_phone_number_id: '',
    whatsapp_access_token: '',
    subscription_type: 'standard',
    subscription_status: 'active',
    is_active: true
  })

  useEffect(() => {
    if (user && user.userType !== 'admin') {
      navigate('/')
      return
    }
    fetchBusinesses()
  }, [user, navigate, page, search])

  const fetchBusinesses = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(
        `${API_URL}/api/admin/businesses?page=${page}&limit=20&search=${search}`,
        { headers }
      )
      
      setBusinesses(response.data.data.businesses)
      setPagination(response.data.data.pagination)
    } catch (error) {
      console.error('Error fetching businesses:', error)
      alert('Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setModalMode('create')
    setSelectedBusiness(null)
    setFormData({
      email: '',
      password: '',
      business_name: '',
      business_type: 'food and beverage',
      business_description: '',
      contact_phone_number: '',
      whatsapp_phone_number: '',
      whatsapp_phone_number_id: '',
      whatsapp_access_token: '',
      subscription_type: 'standard',
      subscription_status: 'active',
      is_active: true
    })
    setShowModal(true)
  }

  const handleEdit = async (business) => {
    setModalMode('edit')
    setSelectedBusiness(business)
    setFormData({
      email: business.email || '',
      password: '', // Don't populate password for edit
      business_name: business.business_name || '',
      business_type: business.business_type || 'food and beverage',
      business_description: business.business_description || '',
      contact_phone_number: business.contact_phone_number || '',
      whatsapp_phone_number: business.whatsapp_phone_number || '',
      whatsapp_phone_number_id: business.whatsapp_phone_number_id || '',
      whatsapp_access_token: '', // Don't populate token for security
      subscription_type: business.subscription_type || 'standard',
      subscription_status: business.subscription_status || 'active',
      is_active: business.is_active !== undefined ? business.is_active : true
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      if (modalMode === 'create') {
        await axios.post(`${API_URL}/api/admin/businesses`, formData, { headers })
        alert('Business created successfully')
      } else {
        // Don't send password if it's empty
        const updateData = { ...formData }
        if (!updateData.password) {
          delete updateData.password
        }
        if (!updateData.whatsapp_access_token) {
          delete updateData.whatsapp_access_token
        }
        
        await axios.put(
          `${API_URL}/api/admin/businesses/${selectedBusiness.id}`,
          updateData,
          { headers }
        )
        alert('Business updated successfully')
      }
      
      setShowModal(false)
      fetchBusinesses()
    } catch (error) {
      console.error('Error saving business:', error)
      alert(error.response?.data?.error?.message || 'Failed to save business')
    }
  }

  const handleDelete = async (businessId) => {
    if (!confirm('Are you sure you want to delete this business? This will also delete all its branches.')) {
      return
    }
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      await axios.delete(`${API_URL}/api/admin/businesses/${businessId}`, { headers })
      alert('Business deleted successfully')
      fetchBusinesses()
    } catch (error) {
      console.error('Error deleting business:', error)
      alert('Failed to delete business')
    }
  }

  const handleViewDetails = (businessId) => {
    navigate(`/admin/businesses/${businessId}`)
  }

  const businessTypes = [
    'food and beverage',
    'entertainment',
    'sports',
    'salons',
    'clinics',
    'rentals',
    'other'
  ]

  if (loading && businesses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Businesses</h1>
          <p className="text-gray-600 mt-2">Manage all businesses in the system</p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary">
          <Plus size={20} />
          Add Business
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex items-center space-x-2">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search businesses by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex-1 outline-none"
          />
        </div>
      </div>

      {/* Businesses Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Business</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Contact</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Subscription</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stats</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <tr key={business.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{business.business_name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail size={12} />
                        {business.email}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-700 capitalize">
                      {business.business_type?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm">
                      {business.contact_phone_number && (
                        <p className="text-gray-700 flex items-center gap-1">
                          <Phone size={12} />
                          {business.contact_phone_number}
                        </p>
                      )}
                      {business.whatsapp_phone_number && (
                        <p className="text-green-600 flex items-center gap-1 mt-1">
                          <MessageSquare size={12} />
                          {business.whatsapp_phone_number}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        business.subscription_type === 'premium'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {business.subscription_type}
                      </span>
                      <p className={`text-xs mt-1 ${
                        business.subscription_status === 'active'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {business.subscription_status}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm space-y-1">
                      <p className="flex items-center gap-1 text-gray-600">
                        <Store size={12} />
                        {business.branches_count} branches
                      </p>
                      <p className="flex items-center gap-1 text-gray-600">
                        <ShoppingCart size={12} />
                        {business.orders_count} orders
                      </p>
                      <p className="flex items-center gap-1 text-gray-600">
                        <MessageSquare size={12} />
                        {business.messages_count || 0} messages
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      business.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {business.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewDetails(business.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(business)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(business.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Page {page} of {pagination.pages} ({pagination.total} total)
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {modalMode === 'create' ? 'Create Business' : 'Edit Business'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6">
              <div className="space-y-4">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password {modalMode === 'create' ? '*' : '(leave empty to keep current)'}
                      </label>
                      <input
                        type="password"
                        required={modalMode === 'create'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.business_name}
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Type *
                      </label>
                      <select
                        required
                        value={formData.business_type}
                        onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {businessTypes.map(type => (
                          <option key={type} value={type}>
                            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Description
                      </label>
                      <textarea
                        value={formData.business_description}
                        onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.contact_phone_number}
                        onChange={(e) => setFormData({ ...formData, contact_phone_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        WhatsApp Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.whatsapp_phone_number}
                        onChange={(e) => setFormData({ ...formData, whatsapp_phone_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        WhatsApp Phone Number ID
                      </label>
                      <input
                        type="text"
                        value={formData.whatsapp_phone_number_id}
                        onChange={(e) => setFormData({ ...formData, whatsapp_phone_number_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="From Meta Business"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        WhatsApp Access Token
                      </label>
                      <input
                        type="password"
                        value={formData.whatsapp_access_token}
                        onChange={(e) => setFormData({ ...formData, whatsapp_access_token: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={modalMode === 'edit' ? 'Leave empty to keep current' : 'From Meta Business'}
                      />
                    </div>
                  </div>
                </div>

                {/* Subscription & Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Subscription & Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subscription Type
                      </label>
                      <select
                        value={formData.subscription_type}
                        onChange={(e) => setFormData({ ...formData, subscription_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subscription Status
                      </label>
                      <select
                        value={formData.subscription_status}
                        onChange={(e) => setFormData({ ...formData, subscription_status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="past_due">Past Due</option>
                        <option value="canceled">Canceled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Status
                      </label>
                      <select
                        value={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? 'Create Business' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
