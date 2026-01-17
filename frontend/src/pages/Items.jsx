import { useEffect, useState } from 'react'
import axios from 'axios'
import { Plus, Edit, Trash2, Image as ImageIcon, X, Clock, Calendar, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function Items() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ingredients: '',
    price: '',
    cost: '',
    durationMinutes: '',
    quantity: '',
    isReusable: true,
    itemType: 'good',
    isSchedulable: false,
    minScheduleHours: 0,
    availableFrom: '',
    availableTo: '',
    daysAvailable: [],
    availability: 'available',
    itemImage: null,
    imagePreview: null
  })
  const [submitting, setSubmitting] = useState(false)

  const businessType = user?.business_type || 'f & b'

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/items`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setItems(response.data.data.items || [])
    } catch (error) {
      console.error('Error fetching items:', error)
      alert('Failed to fetch items')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const formDataToSend = new FormData()
      formDataToSend.append('name', formData.name)
      if (formData.description) formDataToSend.append('description', formData.description)
      if (formData.ingredients) formDataToSend.append('ingredients', formData.ingredients)
      formDataToSend.append('price', formData.price)
      if (formData.cost) formDataToSend.append('cost', formData.cost)
      
      // Reservation Time Limit (for all business types)
      if (formData.durationMinutes) {
        formDataToSend.append('durationMinutes', formData.durationMinutes)
      }
      
      // Quantity field (for all business types) - always send it to allow clearing (empty = unlimited)
      formDataToSend.append('quantity', formData.quantity || '')
      // FormData converts boolean to string, so we explicitly convert to string
      formDataToSend.append('isReusable', formData.isReusable ? 'true' : 'false')
      
      // Scheduling fields (for all businesses)
      formDataToSend.append('itemType', formData.itemType)
      formDataToSend.append('isSchedulable', formData.isSchedulable ? 'true' : 'false')
      formDataToSend.append('minScheduleHours', formData.minScheduleHours.toString())
      
      // Availability fields
      if (formData.availableFrom) formDataToSend.append('availableFrom', formData.availableFrom)
      if (formData.availableTo) formDataToSend.append('availableTo', formData.availableTo)
      if (formData.daysAvailable.length > 0) {
        formDataToSend.append('daysAvailable', JSON.stringify(formData.daysAvailable))
      }
      
      formDataToSend.append('availability', formData.availability)
      
      if (formData.itemImage) {
        formDataToSend.append('itemImage', formData.itemImage)
      }

      if (editingItem) {
        await axios.put(`${API_URL}/api/items/${editingItem.id}`, formDataToSend, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        })
      } else {
        await axios.post(`${API_URL}/api/items`, formDataToSend, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        })
      }

      setShowModal(false)
      resetForm()
      fetchItems()
      alert(editingItem ? 'Item updated successfully' : 'Item created successfully')
    } catch (error) {
      console.error('Error saving item:', error)
      console.error('Error response data:', error.response?.data)
      console.error('Full error response:', JSON.stringify(error.response?.data, null, 2))
      const errorMessage = error.response?.data?.error?.message || 'Failed to save item'
      const errorDetails = error.response?.data?.error?.errors || error.response?.data?.error?.details || []
      console.error('Error details:', errorDetails)
      if (errorDetails.length > 0) {
        const details = errorDetails.map(e => `${e.path || e.param || 'field'}: ${e.msg || e.message || JSON.stringify(e)}`).join('\n')
        alert(`${errorMessage}\n\nDetails:\n${details}`)
      } else {
        alert(`${errorMessage}\n\nPlease check the browser console for more details.`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/api/items/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchItems()
      alert('Item deleted successfully')
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name || '',
      description: item.description || '',
      ingredients: item.ingredients || '',
      price: item.price || '',
      cost: item.cost || '',
      durationMinutes: item.duration_minutes || '',
      quantity: item.quantity || '',
      isReusable: item.is_reusable !== undefined ? item.is_reusable : true,
      itemType: item.item_type || 'good',
      isSchedulable: item.is_schedulable !== undefined ? item.is_schedulable : false,
      minScheduleHours: item.min_schedule_hours !== undefined ? item.min_schedule_hours : 0,
      availableFrom: item.available_from || '',
      availableTo: item.available_to || '',
      daysAvailable: (() => {
        if (!item.days_available) return [];
        if (Array.isArray(item.days_available)) return item.days_available;
        try {
          const parsed = JSON.parse(item.days_available);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('Failed to parse days_available:', item.days_available, e);
          return [];
        }
      })(),
      availability: item.availability || 'available',
      itemImage: null,
      imagePreview: item.item_image_url || null
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      description: '',
      ingredients: '',
      price: '',
      cost: '',
      durationMinutes: '',
      quantity: '',
      isReusable: true,
      itemType: 'good',
      isSchedulable: false,
      minScheduleHours: 0,
      availableFrom: '',
      availableTo: '',
      daysAvailable: [],
      availability: 'available',
      itemImage: null,
      imagePreview: null
    })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({
        ...formData,
        itemImage: file,
        imagePreview: URL.createObjectURL(file)
      })
    }
  }

  const toggleDay = (day) => {
    setFormData({
      ...formData,
      daysAvailable: formData.daysAvailable.includes(day)
        ? formData.daysAvailable.filter(d => d !== day)
        : [...formData.daysAvailable, day]
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
          <h1 className="text-3xl font-bold text-gray-900">Items</h1>
          <p className="text-gray-600 mt-2">Manage your menu items</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Add Item</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.id} className="card">
            {item.item_image_url ? (
              <img
                src={item.item_image_url}
                alt={item.name}
                className="w-full h-40 object-cover rounded-lg mb-4"
              />
            ) : (
              <div className="w-full h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <ImageIcon size={32} className="text-gray-400" />
              </div>
            )}
            <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
            {item.description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
            )}
            <p className="text-2xl font-bold text-primary-600 mb-2">${item.price}</p>
            
            {/* Availability info */}
            {(item.available_from || item.available_to || item.days_available) && (
              <div className="text-xs text-gray-500 mb-2">
                {item.available_from && item.available_to && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{item.available_from} - {item.available_to}</span>
                  </div>
                )}
                {item.days_available && (() => {
                  let daysCount = 0;
                  try {
                    if (Array.isArray(item.days_available)) {
                      daysCount = item.days_available.length;
                    } else if (typeof item.days_available === 'string') {
                      const parsed = JSON.parse(item.days_available || '[]');
                      daysCount = Array.isArray(parsed) ? parsed.length : 0;
                    }
                  } catch (e) {
                    daysCount = 0;
                  }
                  return daysCount > 0 ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar size={12} />
                      <span>{daysCount} days</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
            
            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => handleEdit(item)}
                className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
              >
                <Edit size={16} />
                <span>Edit</span>
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="btn btn-danger flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No items yet</p>
          <button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Add Your First Item</span>
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingItem ? 'Edit Item' : 'Add Item'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Name *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Ingredients</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={formData.ingredients}
                      onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                      placeholder="Comma-separated or one per line"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reservation Time Limit */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Reservation Settings</h3>
                <div>
                  <label className="label">Reservation Time Limit (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    placeholder="e.g., 60 (how long the reservation lasts)"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum duration for this reservation (e.g., 60 = 1 hour, 90 = 1.5 hours)
                  </p>
                </div>
              </div>

              {/* Quantity (for all business types) */}
              <div className="border-b border-gray-200 pb-4">
                <div className="space-y-4">
                  <div>
                    <label className="label">Quantity (Optional)</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      placeholder="Leave empty for unlimited"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      1 = single instance, &gt;1 = multiple instances, empty = unlimited
                    </p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isReusable}
                        onChange={(e) => setFormData({ ...formData, isReusable: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Is Reusable</span>
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                        Reusable items (like football fields) become available again after reservation ends. Consumable items (like toys) are permanently used.
                      </p>
                    </div>
                  </div>
                </div>

              {/* Item Type & Scheduling */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduling Options</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Item Type</label>
                    <select
                      className="input"
                      value={formData.itemType}
                      onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                    >
                      <option value="good">Good (Physical Product)</option>
                      <option value="service">Service</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isSchedulable}
                        onChange={(e) => setFormData({ ...formData, isSchedulable: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Only Scheduled</span>
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      Check if this item can ONLY be scheduled (not ordered directly). Customers must schedule these items for a future time.
                    </p>
                  </div>
                  
                  {formData.isSchedulable && (
                    <div>
                      <label className="label">Minimum Schedule Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="168"
                        className="input"
                        placeholder="0 for immediate, or hours in advance"
                        value={formData.minScheduleHours}
                        onChange={(e) => setFormData({ ...formData, minScheduleHours: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Minimum hours in advance required for scheduling (0 = can order immediately or schedule, 2+ = must schedule ahead)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Availability */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Available From</label>
                    <input
                      type="time"
                      className="input"
                      value={formData.availableFrom}
                      onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Available To</label>
                    <input
                      type="time"
                      className="input"
                      value={formData.availableTo}
                      onChange={(e) => setFormData({ ...formData, availableTo: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Days Available</label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {DAYS.map((day) => (
                      <label key={day} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.daysAvailable.includes(day)}
                          onChange={() => toggleDay(day)}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{day.substring(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Image Upload */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Image</h3>
                <div>
                  <label className="label">Item Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="input"
                    onChange={handleImageChange}
                  />
                  {formData.imagePreview && (
                    <div className="mt-4">
                      <img
                        src={formData.imagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Availability Status */}
              <div className="pb-4">
                <label className="label">Availability Status</label>
                <select
                  className="input"
                  value={formData.availability}
                  onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                >
                  <option value="available">Available</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>

              {/* Analytics (read-only in edit mode) - Reserved for premium features */}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : (editingItem ? 'Update Item' : 'Create Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
