import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Store, Plus, Search, Edit2, Trash2, Building2, 
  ShoppingCart, MessageSquare, X, Mail, Phone, MapPin 
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function AdminBranches() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const businessIdParam = searchParams.get('businessId')
  
  const [branches, setBranches] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessIdParam || '')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    business_name: '',
    business_description: '',
    contact_phone_number: '',
    whatsapp_phone_number: '',
    whatsapp_phone_number_id: '',
    whatsapp_access_token: '',
    location: {
      city: '',
      street: '',
      building: '',
      floor: '',
      notes: '',
      latitude: '',
      longitude: ''
    },
    is_active: true
  })

  useEffect(() => {
    if (user && user.userType !== 'admin') {
      navigate('/')
      return
    }
    fetchBusinesses()
    fetchBranches()
  }, [user, navigate, page, search, selectedBusinessId])

  const fetchBusinesses = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(`${API_URL}/api/admin/businesses?limit=1000`, { headers })
      setBusinesses(response.data.data.businesses)
    } catch (error) {
      console.error('Error fetching businesses:', error)
    }
  }

  const fetchBranches = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      let url = `${API_URL}/api/admin/branches?page=${page}&limit=20&search=${search}`
      if (selectedBusinessId) {
        url += `&businessId=${selectedBusinessId}`
      }
      
      const response = await axios.get(url, { headers })
      setBranches(response.data.data.branches)
      setPagination(response.data.data.pagination)
    } catch (error) {
      console.error('Error fetching branches:', error)
      alert('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    if (!selectedBusinessId) {
      alert('Please select a business first')
      return
    }
    
    setModalMode('create')
    setSelectedBranch(null)
    setFormData({
      email: '',
      password: '',
      business_name: '',
      business_description: '',
      contact_phone_number: '',
      whatsapp_phone_number: '',
      whatsapp_phone_number_id: '',
      whatsapp_access_token: '',
      location: {
        city: '',
        street: '',
        building: '',
        floor: '',
        notes: '',
        latitude: '',
        longitude: ''
      },
      is_active: true
    })
    setShowModal(true)
  }

  const handleEdit = (branch) => {
    setModalMode('edit')
    setSelectedBranch(branch)
    setFormData({
      email: branch.email || '',
      password: '',
      business_name: branch.business_name || '',
      business_description: branch.business_description || '',
      contact_phone_number: branch.contact_phone_number || '',
      whatsapp_phone_number: branch.whatsapp_phone_number || '',
      whatsapp_phone_number_id: branch.whatsapp_phone_number_id || '',
      whatsapp_access_token: '',
      location: {
        city: branch.city || '',
        street: branch.street || '',
        building: branch.building || '',
        floor: branch.floor || '',
        notes: branch.location_notes || '',
        latitude: branch.location_latitude || '',
        longitude: branch.location_longitude || ''
      },
      is_active: branch.is_active !== undefined ? branch.is_active : true
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      if (modalMode === 'create') {
        await axios.post(
          `${API_URL}/api/admin/businesses/${selectedBusinessId}/branches`,
          formData,
          { headers }
        )
        alert('Branch created successfully')
      } else {
        const updateData = { ...formData }
        if (!updateData.password) {
          delete updateData.password
        }
        if (!updateData.whatsapp_access_token) {
          delete updateData.whatsapp_access_token
        }
        
        await axios.put(
          `${API_URL}/api/admin/branches/${selectedBranch.id}`,
          updateData,
          { headers }
        )
        alert('Branch updated successfully')
      }
      
      setShowModal(false)
      fetchBranches()
    } catch (error) {
      console.error('Error saving branch:', error)
      alert(error.response?.data?.error?.message || 'Failed to save branch')
    }
  }

  const handleDelete = async (branchId) => {
    if (!confirm('Are you sure you want to delete this branch?')) {
      return
    }
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      await axios.delete(`${API_URL}/api/admin/branches/${branchId}`, { headers })
      alert('Branch deleted successfully')
      fetchBranches()
    } catch (error) {
      console.error('Error deleting branch:', error)
      alert('Failed to delete branch')
    }
  }

  if (loading && branches.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-600 mt-2">Manage all branches across businesses</p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary">
          <Plus size={20} />
          Add Branch
        </button>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Business
            </label>
            <select
              value={selectedBusinessId}
              onChange={(e) => {
                setSelectedBusinessId(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Businesses</option>
              {businesses.map(business => (
                <option key={business.id} value={business.id}>
                  {business.business_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg">
              <Search size={20} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search branches..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="flex-1 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Branches Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Branch</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Business</th>
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
                    <div>
                      <p className="font-medium text-gray-900">{branch.business_name}</p>
                      {branch.email && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail size={12} />
                          {branch.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {branch.parent_business_name || 'N/A'}
                      </span>
                    </div>
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
                        {branch.building && (
                          <p className="text-xs text-gray-500 mt-1">
                            Building: {branch.building}
                          </p>
                        )}
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
                      <p className="flex items-center gap-1 text-gray-600">
                        <ShoppingCart size={12} />
                        {branch.orders_count || 0} orders
                      </p>
                      <p className="flex items-center gap-1 text-gray-600">
                        <MessageSquare size={12} />
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
                        onClick={() => handleEdit(branch)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(branch.id)}
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
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {modalMode === 'create' ? 'Create Branch' : 'Edit Branch'}
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

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Branch Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.business_name}
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Branch Description
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

                {/* Location */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.location.city}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, city: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                      <input
                        type="text"
                        value={formData.location.street}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, street: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                      <input
                        type="text"
                        value={formData.location.building}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, building: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                      <input
                        type="text"
                        value={formData.location.floor}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, floor: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.location.latitude}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, latitude: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.location.longitude}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, longitude: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location Notes</label>
                      <textarea
                        value={formData.location.notes}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          location: { ...formData.location, notes: e.target.value }
                        })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact & WhatsApp</h3>
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
                        placeholder={modalMode === 'edit' ? 'Leave empty to keep current' : ''}
                      />
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Status</h3>
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

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? 'Create Branch' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
