import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Lock, Save, Shield } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function AdminProfile() {
  const navigate = useNavigate()
  const { user, fetchUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    email: '',
    first_name: '',
    last_name: '',
    contact_phone_number: ''
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user && user.userType !== 'admin') {
      navigate('/')
      return
    }
    fetchProfile()
  }, [user, navigate])

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(`${API_URL}/api/admin/profile`, { headers })
      setProfile(response.data.data.profile)
    } catch (error) {
      console.error('Error fetching profile:', error)
      showMessage('error', 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      await axios.put(`${API_URL}/api/admin/profile`, profile, { headers })
      await fetchUser() // Refresh user data in context
      showMessage('success', 'Profile updated successfully')
    } catch (error) {
      console.error('Error updating profile:', error)
      showMessage('error', error.response?.data?.error?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    // Validate passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      showMessage('error', 'New passwords do not match')
      return
    }
    
    // Validate password strength
    if (passwordData.new_password.length < 8) {
      showMessage('error', 'Password must be at least 8 characters long')
      return
    }
    
    setSaving(true)
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      await axios.put(
        `${API_URL}/api/admin/profile/password`,
        {
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        },
        { headers }
      )
      
      showMessage('success', 'Password changed successfully')
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (error) {
      console.error('Error changing password:', error)
      showMessage('error', error.response?.data?.error?.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Profile</h1>
        <p className="text-gray-600 mt-2">Manage your account information</p>
      </div>

      {/* Success/Error Messages */}
      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Information */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary-50 rounded-lg">
            <User size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
            <p className="text-sm text-gray-600">Update your personal details</p>
          </div>
        </div>

        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail size={16} className="inline mr-2" />
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone size={16} className="inline mr-2" />
                Contact Phone
              </label>
              <input
                type="tel"
                value={profile.contact_phone_number || ''}
                onChange={(e) => setProfile({ ...profile, contact_phone_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="+1234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={profile.first_name || ''}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={profile.last_name || ''}
                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield size={16} className="text-primary-600" />
              <span>Admin Account</span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-50 rounded-lg">
            <Lock size={24} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
            <p className="text-sm text-gray-600">Update your password to keep your account secure</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={passwordData.current_password}
              onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
                minLength={8}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              <Lock size={18} />
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Information */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Account Type</p>
            <p className="text-base font-medium text-gray-900 mt-1">Administrator</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Account Status</p>
            <p className="text-base font-medium text-green-600 mt-1">Active</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Account Created</p>
            <p className="text-base font-medium text-gray-900 mt-1">
              {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Last Updated</p>
            <p className="text-base font-medium text-gray-900 mt-1">
              {new Date(profile.updated_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
