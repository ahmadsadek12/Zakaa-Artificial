import { useEffect, useState } from 'react'
import axios from 'axios'
import { Plus, Edit, Trash2, MapPin, Mail, Lock, Phone, Building2, Key } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Branches() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    branchName: '', // Fixed: was businessName, API expects branchName
    contactPhoneNumber: '',
    whatsappPhoneNumber: '',
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    location: {
      city: '',
      street: '',
      building: '',
      floor: '',
    },
  })

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/businesses/me/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setBranches(response.data.data.branches || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
      alert('Failed to fetch branches')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      // Prepare location data
      const locationData = formData.location.city || formData.location.street 
        ? { 
            city: formData.location.city,
            street: formData.location.street,
            building: formData.location.building,
            floor: formData.location.floor,
          }
        : null

      if (editingBranch) {
        // Update branch - password is optional
        const updateData = {
          ...formData,
          location: locationData,
        }
        
        // Don't send empty password
        if (!updateData.password) {
          delete updateData.password
        }
        
        await axios.put(`${API_URL}/api/businesses/me/branches/${editingBranch.id}`, updateData, { headers })
      } else {
        // Create branch - password is required
        if (!formData.password) {
          alert('Password is required for new branches')
          return
        }
        
        await axios.post(`${API_URL}/api/businesses/me/branches`, {
          ...formData,
          location: locationData,
        }, { headers })
      }
      
      setShowModal(false)
      setEditingBranch(null)
      resetForm()
      fetchBranches()
    } catch (error) {
      console.error('Error saving branch:', error)
      const errorData = error.response?.data?.error
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        const errorMessages = errorData.errors.map(e => `${e.field}: ${e.message}`).join('\n')
        alert(`Validation errors:\n${errorMessages}`)
      } else {
        alert(errorData?.message || 'Failed to save branch')
      }
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this branch? This action cannot be undone.')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/api/businesses/me/branches/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchBranches()
    } catch (error) {
      console.error('Error deleting branch:', error)
      alert('Failed to delete branch')
    }
  }

  const handleEdit = (branch) => {
    setEditingBranch(branch)
    setFormData({
      email: branch.email || '',
      password: '', // Don't prefill password
      branchName: branch.business_name || branch.branch_name || '', // Fixed: use branchName
      contactPhoneNumber: branch.contact_phone_number || '',
      whatsappPhoneNumber: branch.whatsapp_phone_number || '',
      whatsappPhoneNumberId: branch.whatsapp_phone_number_id || '',
      whatsappAccessToken: branch.whatsapp_access_token || '', // Decrypted if available
      location: {
        city: branch.city || '',
        street: branch.street || '',
        building: branch.building || '',
        floor: branch.floor || '',
      },
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      branchName: '', // Fixed: use branchName
      contactPhoneNumber: '',
      whatsappPhoneNumber: '',
      whatsappPhoneNumberId: '',
      whatsappAccessToken: '',
      location: {
        city: '',
        street: '',
        building: '',
        floor: '',
      },
    })
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-600 mt-2">Manage branch users with independent logins and WhatsApp credentials</p>
        </div>
        <button
          onClick={() => {
            setEditingBranch(null)
            resetForm()
            setShowModal(true)
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Add Branch</span>
        </button>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <div key={branch.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {branch.business_name || branch.branch_name}
                </h3>
                {branch.email && (
                  <div className="flex items-start gap-2 text-gray-600 text-sm mb-2">
                    <Mail size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{branch.email}</span>
                  </div>
                )}
                {(branch.city || branch.street) && (
                  <div className="flex items-start gap-2 text-gray-600 text-sm mb-2">
                    <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                    <span>
                      {[branch.street, branch.building, branch.city].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {branch.contact_phone_number && (
                  <div className="flex items-start gap-2 text-gray-600 text-sm mb-2">
                    <Phone size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{branch.contact_phone_number}</span>
                  </div>
                )}
                {branch.whatsapp_phone_number_id && (
                  <div className="flex items-start gap-2 text-green-600 text-sm mb-2">
                    <Key size={16} className="mt-0.5 flex-shrink-0" />
                    <span>WhatsApp Connected</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleEdit(branch)}
                className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
              >
                <Edit size={16} />
                <span>Edit</span>
              </button>
              <button
                onClick={() => handleDelete(branch.id)}
                className="btn btn-danger flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {branches.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No branches yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Add Your First Branch</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingBranch ? 'Edit Branch User' : 'Add Branch User'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Login Credentials */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Lock size={20} />
                  Login Credentials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email *</label>
                    <input
                      type="email"
                      className="input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">
                      Password {editingBranch ? '(leave empty to keep current)' : '*'}
                    </label>
                    <input
                      type="password"
                      className="input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingBranch}
                      minLength={8}
                    />
                  </div>
                </div>
              </div>

              {/* Business Info */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 size={20} />
                  Business Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Branch Name *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.branchName}
                      onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Contact Phone Number</label>
                    <input
                      type="tel"
                      className="input"
                      value={formData.contactPhoneNumber}
                      onChange={(e) => setFormData({ ...formData, contactPhoneNumber: e.target.value })}
                      placeholder="+961XXXXXXXX"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin size={20} />
                  Location
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">City</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.location.city}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        location: { ...formData.location, city: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="label">Street</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.location.street}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        location: { ...formData.location, street: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="label">Building</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.location.building}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        location: { ...formData.location, building: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="label">Floor</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.location.floor}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        location: { ...formData.location, floor: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp Credentials (Optional) */}
              <div className="pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Key size={20} />
                  WhatsApp Business API (Optional)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">WhatsApp Phone Number</label>
                    <input
                      type="tel"
                      className="input"
                      value={formData.whatsappPhoneNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappPhoneNumber: e.target.value })}
                      placeholder="+961XXXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="label">WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.whatsappPhoneNumberId}
                      onChange={(e) => setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">WhatsApp Access Token</label>
                    <input
                      type="password"
                      className="input"
                      value={formData.whatsappAccessToken}
                      onChange={(e) => setFormData({ ...formData, whatsappAccessToken: e.target.value })}
                      placeholder={editingBranch ? 'Leave empty to keep current token' : ''}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingBranch(null)
                    resetForm()
                  }}
                  className="flex-1 btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn btn-primary">
                  {editingBranch ? 'Update Branch' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
