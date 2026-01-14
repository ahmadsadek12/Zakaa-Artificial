import { useEffect, useState } from 'react'
import axios from 'axios'
import { Plus, Edit, Trash2, Image as ImageIcon, FileText, Link as LinkIcon, X, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Menus() {
  const { user } = useAuth()
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMenu, setEditingMenu] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    menuLink: '',
    isActive: true,
    menuPdf: null,
    menuImages: [],
    existingImageUrls: []
  })

  useEffect(() => {
    fetchMenus()
  }, [])

  const fetchMenus = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/menus`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMenus(response.data.data.menus || [])
    } catch (error) {
      console.error('Error fetching menus:', error)
      alert('Failed to fetch menus')
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
      if (formData.menuLink) formDataToSend.append('menuLink', formData.menuLink)
      formDataToSend.append('isActive', formData.isActive)
      
      // Append PDF if provided
      if (formData.menuPdf) {
        formDataToSend.append('menuPdf', formData.menuPdf)
      }
      
      // Append existing image URLs to keep (only when editing)
      if (editingMenu && formData.existingImageUrls.length > 0) {
        formDataToSend.append('existingImageUrls', JSON.stringify(formData.existingImageUrls))
      }
      
      // Append multiple images
      formData.menuImages.forEach((image) => {
        formDataToSend.append('menuImages', image)
      })

      if (editingMenu) {
        await axios.put(`${API_URL}/api/menus/${editingMenu.id}`, formDataToSend, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        })
      } else {
        await axios.post(`${API_URL}/api/menus`, formDataToSend, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        })
      }

      setShowModal(false)
      resetForm()
      fetchMenus()
      alert(editingMenu ? 'Menu updated successfully' : 'Menu created successfully')
    } catch (error) {
      console.error('Error saving menu:', error)
      const errorMessage = error.response?.data?.error?.message || 'Failed to save menu'
      const errorDetails = error.response?.data?.error?.errors || []
      if (errorDetails.length > 0) {
        const details = errorDetails.map(e => `${e.path}: ${e.msg}`).join('\n')
        alert(`${errorMessage}\n\nDetails:\n${details}`)
      } else {
        alert(errorMessage)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this menu?')) return
    
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/api/menus/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchMenus()
      alert('Menu deleted successfully')
    } catch (error) {
      console.error('Error deleting menu:', error)
      alert('Failed to delete menu')
    }
  }

  const handleEdit = (menu) => {
    setEditingMenu(menu)
    // Parse menu_image_urls if it's a JSON string
    const imageUrls = menu.menu_image_urls 
      ? (typeof menu.menu_image_urls === 'string' ? JSON.parse(menu.menu_image_urls) : menu.menu_image_urls)
      : []
    
    setFormData({
      name: menu.name || '',
      description: menu.description || '',
      menuLink: menu.menu_link || '',
      isActive: menu.is_active !== undefined ? menu.is_active : true,
      menuPdf: null,
      menuImages: [],
      existingImageUrls: imageUrls
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingMenu(null)
    setFormData({
      name: '',
      description: '',
      menuLink: '',
      isActive: true,
      menuPdf: null,
      menuImages: [],
      existingImageUrls: []
    })
  }

  const handlePdfChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.type === 'application/pdf') {
        setFormData({ ...formData, menuPdf: file })
      } else {
        alert('Please select a PDF file')
        e.target.value = ''
      }
    }
  }

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    if (imageFiles.length !== files.length) {
      alert('Some files were not images and were skipped')
    }
    setFormData({
      ...formData,
      menuImages: [...formData.menuImages, ...imageFiles]
    })
  }

  const removeImage = (index) => {
    setFormData({
      ...formData,
      menuImages: formData.menuImages.filter((_, i) => i !== index)
    })
  }

  const removeExistingImage = (index) => {
    setFormData({
      ...formData,
      existingImageUrls: formData.existingImageUrls.filter((_, i) => i !== index)
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
          <h1 className="text-3xl font-bold text-gray-900">Menus</h1>
          <p className="text-gray-600 mt-2">Manage your menu collections</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Add Menu</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menus.map((menu) => {
          // Parse menu_image_urls
          const imageUrls = menu.menu_image_urls 
            ? (typeof menu.menu_image_urls === 'string' ? JSON.parse(menu.menu_image_urls) : menu.menu_image_urls)
            : []
          const hasImages = imageUrls.length > 0
          const hasPdf = menu.menu_pdf_url
          const hasLink = menu.menu_link

          return (
            <div key={menu.id} className="card">
              {/* Display first image or placeholder */}
              {hasImages && imageUrls[0] ? (
                <img
                  src={imageUrls[0]}
                  alt={menu.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              ) : hasPdf ? (
                <div className="w-full h-48 bg-blue-50 rounded-lg mb-4 flex items-center justify-center">
                  <FileText size={48} className="text-blue-400" />
                </div>
              ) : hasLink ? (
                <div className="w-full h-48 bg-purple-50 rounded-lg mb-4 flex items-center justify-center">
                  <LinkIcon size={48} className="text-purple-400" />
                </div>
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                  <ImageIcon size={48} className="text-gray-400" />
                </div>
              )}
              
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{menu.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${menu.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {menu.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {menu.description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{menu.description}</p>
              )}
              
              {/* Menu type indicators */}
              <div className="flex flex-wrap gap-2 mb-4">
                {hasPdf && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">PDF</span>
                )}
                {hasImages && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {imageUrls.length} {imageUrls.length === 1 ? 'Image' : 'Images'}
                  </span>
                )}
                {hasLink && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Link</span>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(menu)}
                  className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
                >
                  <Edit size={16} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(menu.id)}
                  className="btn btn-danger flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {menus.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No menus yet</p>
          <button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Create Your First Menu</span>
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingMenu ? 'Edit Menu' : 'Add Menu'}
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
                    <label className="label">Link (URL)</label>
                    <input
                      type="url"
                      className="input"
                      value={formData.menuLink}
                      onChange={(e) => setFormData({ ...formData, menuLink: e.target.value })}
                      placeholder="https://example.com/menu"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* PDF Upload */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">PDF Menu</h3>
                <div>
                  <label className="label">PDF File</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="input"
                    onChange={handlePdfChange}
                  />
                  {formData.menuPdf && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: {formData.menuPdf.name}
                    </p>
                  )}
                  {editingMenu && editingMenu.menu_pdf_url && (
                    <a
                      href={editingMenu.menu_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-2 block"
                    >
                      Current PDF: {editingMenu.menu_pdf_url.split('/').pop()}
                    </a>
                  )}
                </div>
              </div>

              {/* Multiple Images Upload */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Images</h3>
                <div>
                  <label className="label">Image Files (Multiple)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="input"
                    onChange={handleImagesChange}
                  />
                  {formData.menuImages.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">New Images ({formData.menuImages.length}):</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.menuImages.map((image, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(image)}
                              alt={`Preview ${index + 1}`}
                              className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {formData.existingImageUrls.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Existing Images ({formData.existingImageUrls.length}):</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.existingImageUrls.map((url, index) => (
                          <div key={index} className="relative">
                            <img
                              src={url}
                              alt={`Existing ${index + 1}`}
                              className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                  {submitting ? 'Saving...' : (editingMenu ? 'Update Menu' : 'Create Menu')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
