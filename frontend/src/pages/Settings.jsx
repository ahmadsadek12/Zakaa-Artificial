import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { Save, Building2, CreditCard, Phone, MapPin, Globe, MessageSquare, Key, Clock, Eye, EyeOff, Check } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Integration Setup Component
function IntegrationSetup({ platform, user, onUpdate }) {
  const [integration, setIntegration] = useState(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    page_id: '',
    access_token: '',
    app_id: ''
  })
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    fetchIntegration()
  }, [platform, user])

  const fetchIntegration = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/businesses/me/integrations/${platform}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.data.integration) {
        setIntegration(response.data.data.integration)
        setEnabled(response.data.data.enabled)
        setFormData({
          page_id: response.data.data.integration.page_id || '',
          access_token: response.data.data.integration.access_token ? '***' : '',
          app_id: response.data.data.integration.app_id || ''
        })
      }
    } catch (error) {
      console.error(`Error fetching ${platform} integration:`, error)
    }
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/api/businesses/me/integrations/${platform}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      await fetchIntegration()
      await onUpdate()
      alert(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`)
    } catch (error) {
      console.error(`Error connecting ${platform}:`, error)
      alert(error.response?.data?.error?.message || `Failed to connect ${platform}`)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/api/businesses/me/integrations/${platform}`,
        { enabled: !enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setEnabled(!enabled)
      await fetchIntegration()
    } catch (error) {
      console.error(`Error toggling ${platform}:`, error)
      alert(error.response?.data?.error?.message || `Failed to update ${platform}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${platform}?`)) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/api/businesses/me/integrations/${platform}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setIntegration(null)
      setEnabled(false)
      setFormData({ page_id: '', access_token: '', app_id: '' })
      await onUpdate()
    } catch (error) {
      console.error(`Error disconnecting ${platform}:`, error)
      alert(error.response?.data?.error?.message || `Failed to disconnect ${platform}`)
    } finally {
      setLoading(false)
    }
  }

  if (integration) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
          <div>
            <p className="font-medium text-green-900">Connected</p>
            <p className="text-sm text-green-700">Page ID: {integration.page_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                enabled
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleConnect} className="space-y-4">
      <div>
        <label className="label">Page ID *</label>
        <input
          type="text"
          className="input font-mono"
          value={formData.page_id}
          onChange={(e) => setFormData({ ...formData, page_id: e.target.value })}
          placeholder="1234567890123456"
          required
        />
        <p className="text-sm text-gray-500 mt-1">Your {platform} page ID from Meta Business Suite</p>
      </div>
      <div>
        <label className="label">Access Token *</label>
        <input
          type="password"
          className="input font-mono"
          value={formData.access_token}
          onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
          placeholder="EAAxxxxxxxxxxxxx..."
          required
        />
        <p className="text-sm text-gray-500 mt-1">Permanent access token from Meta Business Suite</p>
      </div>
      <div>
        <label className="label">App ID (Optional)</label>
        <input
          type="text"
          className="input font-mono"
          value={formData.app_id}
          onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
          placeholder="1234567890123456"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary flex items-center gap-2"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        ) : (
          <>
            <Check size={18} />
            Connect {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </>
        )}
      </button>
    </form>
  )
}

export default function Settings() {
  const { user, fetchUser } = useAuth()
  const isAdmin = user?.userType === 'admin'
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'food and beverage',
    lastOrderBeforeClosingMinutes: '30',
    email: '',
    contactPhoneNumber: '',
    businessDescription: '',
    locationLatitude: '',
    locationLongitude: '',
    deliveryPrice: '0',
    googleMapsLink: '',
    carrierPhoneNumber: '',
    estimatedDeliveryTimeMin: '',
    estimatedDeliveryTimeMax: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappAccessToken: '',
    telegramBotToken: '',
    chatbotEnabled: true,
  })
  const [contractInfo, setContractInfo] = useState({
    contract_file_url: null,
    contract_status: 'pending',
    contract_approved_at: null
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('business')
  const [openingHours, setOpeningHours] = useState({
    monday: { open: '', close: '', closed: false },
    tuesday: { open: '', close: '', closed: false },
    wednesday: { open: '', close: '', closed: false },
    thursday: { open: '', close: '', closed: false },
    friday: { open: '', close: '', closed: false },
    saturday: { open: '', close: '', closed: false },
    sunday: { open: '', close: '', closed: false }
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })

  // Debug: Log password message changes
  useEffect(() => {
    if (passwordMessage.text) {
      console.log('📢 Password message updated:', passwordMessage)
    }
  }, [passwordMessage])

  useEffect(() => {
    if (user) {
      console.log('User data received:', user)
      console.log('chatbot_enabled value:', user.chatbot_enabled, 'type:', typeof user.chatbot_enabled)
      setFormData({
        businessName: user.business_name || user.businessName || '',
        businessType: user.business_type || (user.business_type === 'f & b' ? 'food and beverage' : 'food and beverage'),
        lastOrderBeforeClosingMinutes: user.last_order_before_closing_minutes || '30',
        email: user.email || '',
        contactPhoneNumber: user.contact_phone_number || '',
        businessDescription: user.business_description || '',
        locationLatitude: user.location_latitude || '',
        locationLongitude: user.location_longitude || '',
        deliveryPrice: user.delivery_price !== null && user.delivery_price !== undefined ? String(user.delivery_price) : '0',
        googleMapsLink: user.google_maps_link || '',
        carrierPhoneNumber: user.carrier_phone_number || '',
        estimatedDeliveryTimeMin: user.estimated_delivery_time_min || '',
        estimatedDeliveryTimeMax: user.estimated_delivery_time_max || '',
        whatsappPhoneNumberId: user.whatsapp_phone_number_id || '',
        whatsappBusinessAccountId: user.whatsapp_business_account_id || '',
        whatsappAccessToken: user.whatsapp_access_token || '',
        telegramBotToken: user.telegram_bot_token || '',
        chatbotEnabled: user.chatbot_enabled !== undefined ? user.chatbot_enabled : true,
      })
      
      // Fetch contract info
      fetchContractInfo()
      
      // Fetch opening hours
      fetchOpeningHours()
    }
  }, [user])
  
  const fetchContractInfo = async () => {
    if (!user || user.userType !== 'business') return
    
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/businesses/me/contract`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setContractInfo(response.data.data || {})
    } catch (error) {
      console.error('Error fetching contract info:', error)
    }
  }

  const fetchOpeningHours = async () => {
    if (!user) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/api/opening-hours?ownerType=business&ownerId=${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      // Initialize with default values for all days
      const defaultHours = {
        monday: { open: '', close: '', closed: false },
        tuesday: { open: '', close: '', closed: false },
        wednesday: { open: '', close: '', closed: false },
        thursday: { open: '', close: '', closed: false },
        friday: { open: '', close: '', closed: false },
        saturday: { open: '', close: '', closed: false },
        sunday: { open: '', close: '', closed: false }
      }
      
      if (response.data.success && response.data.data.openingHours) {
        // Merge fetched hours with defaults to ensure all days are present
        const hours = { ...defaultHours }
        response.data.data.openingHours.forEach(h => {
          if (h.day_of_week && defaultHours.hasOwnProperty(h.day_of_week)) {
            hours[h.day_of_week] = {
              open: h.open_time ? h.open_time.substring(0, 5) : '',
              close: h.close_time ? h.close_time.substring(0, 5) : '',
              closed: h.is_closed || false
            }
          }
        })
        setOpeningHours(hours)
      } else {
        // If no opening hours exist, use defaults
        setOpeningHours(defaultHours)
      }
    } catch (error) {
      console.error('Error fetching opening hours:', error)
      // On error, ensure we still have default values
      setOpeningHours({
        monday: { open: '', close: '', closed: false },
        tuesday: { open: '', close: '', closed: false },
        wednesday: { open: '', close: '', closed: false },
        thursday: { open: '', close: '', closed: false },
        friday: { open: '', close: '', closed: false },
        saturday: { open: '', close: '', closed: false },
        sunday: { open: '', close: '', closed: false }
      })
    }
  }
  
  const handleOpeningHoursSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('🔵 handleOpeningHoursSubmit called')
    console.log('🔵 User:', user)
    console.log('🔵 Opening hours state:', openingHours)
    
    if (!user || !user.id) {
      alert('User not loaded. Please refresh the page.')
      return
    }
    
    setLoading(true)
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        alert('Not authenticated. Please log in again.')
        return
      }
      
      const payload = {
        ownerType: 'business',
        ownerId: user.id,
        hours: openingHours
      }
      
      console.log('📤 Saving opening hours:', payload)
      
      const response = await axios.post(
        `${API_URL}/api/opening-hours`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      console.log('✅ Opening hours save response:', response.data)
      
      // Refetch opening hours to show saved data
      if (response.data.success) {
        await fetchOpeningHours()
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        alert('Failed to save opening hours')
      }
    } catch (error) {
      console.error('❌ Error saving opening hours:', error)
      console.error('Error response:', error.response?.data)
      alert(error.response?.data?.error?.message || 'Failed to save opening hours')
    } finally {
      setLoading(false)
    }
  }
  
  const handleLanguageToggle = (lang) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSaved(false)

    try {
      const token = localStorage.getItem('token')
      console.log('📤 Sending formData:', formData)
      console.log('📤 businessName:', formData.businessName, 'type:', typeof formData.businessName)
      console.log('📤 deliveryPrice:', formData.deliveryPrice, 'type:', typeof formData.deliveryPrice)
      console.log('📤 chatbotEnabled being sent:', formData.chatbotEnabled, 'type:', typeof formData.chatbotEnabled)
      
      const response = await axios.put(`${API_URL}/api/businesses/me`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      console.log('✅ Update response:', response.data)
      console.log('✅ business_name in response:', response.data?.data?.business?.business_name)
      console.log('✅ delivery_price in response:', response.data?.data?.business?.delivery_price)
      console.log('✅ chatbot_enabled in response:', response.data?.data?.business?.chatbot_enabled, 'type:', typeof response.data?.data?.business?.chatbot_enabled)
      
      // Show special message if Telegram webhook was configured
      const webhookStatus = response.data?.data?.business?.telegram_webhook_status
      if (webhookStatus?.configured) {
        alert(`✅ Settings saved!\n\nTelegram Bot Connected:\n• Bot: @${webhookStatus.botUsername}\n• Name: ${webhookStatus.botName}\n• Webhook: ${webhookStatus.webhookUrl}\n\nYour bot is ready to receive messages!`)
      }
      
      await fetchUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error updating profile:', error)
      console.error('Error response:', error.response?.data)
      console.error('Validation errors:', error.response?.data?.error?.errors)
      if (error.response?.data?.error?.errors?.length > 0) {
        error.response.data.error.errors.forEach((err, index) => {
          console.error(`Validation error ${index + 1}:`, err)
        })
      }
      alert(error.response?.data?.error?.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('🔐 Password change form submitted')
    console.log('🔐 Event:', e)
    console.log('🔐 Event default prevented:', e.defaultPrevented)
    
    setLoading(true)
    setSaved(false)
    setPasswordMessage({ type: '', text: '' })

    // Validate passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      console.log('❌ Validation failed: passwords do not match')
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' })
      setLoading(false)
      return
    }

    // Validate password strength
    if (passwordData.new_password.length < 8) {
      console.log('❌ Validation failed: password too short')
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters long' })
      setLoading(false)
      return
    }

    // Validate current password is provided
    if (!passwordData.current_password) {
      console.log('❌ Validation failed: current password missing')
      setPasswordMessage({ type: 'error', text: 'Current password is required' })
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.log('❌ No authentication token found')
        setPasswordMessage({ type: 'error', text: 'You must be logged in to change your password' })
        setLoading(false)
        return
      }
      
      console.log('📤 Sending password change request to:', `${API_URL}/api/businesses/me/password`)
      const requestData = {
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
          confirm_password: passwordData.confirm_password
      }
      console.log('📤 Request data:', { ...requestData, current_password: '***', new_password: '***', confirm_password: '***' })
      
      const response = await axios.put(
        `${API_URL}/api/businesses/me/password`,
        requestData,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      console.log('✅ Password change response:', response.data)
      
      if (response.data && response.data.success) {
        console.log('✅ Password changed successfully')
        setPasswordMessage({ type: 'success', text: 'Password changed successfully' })
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
        setTimeout(() => {
          setPasswordMessage({ type: '', text: '' })
        }, 5000)
      } else {
        console.log('❌ Password change failed:', response.data)
        setPasswordMessage({ type: 'error', text: response.data?.error?.message || 'Failed to change password' })
      }
    } catch (error) {
      console.error('❌ Error changing password:', error)
      console.error('❌ Error response:', error.response?.data)
      console.error('❌ Error status:', error.response?.status)
      console.error('❌ Error message:', error.message)
      
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.error?.errors?.map(e => e.message || e.msg).join(', ') ||
                          error.message || 
                          'Failed to change password'
      console.log('📝 Setting error message:', errorMessage)
      setPasswordMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
      console.log('🏁 Password change handler finished, loading set to false')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your business profile and preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('business')}
            className={`${
              activeTab === 'business'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Building2 size={18} />
            Business Info
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`${
              activeTab === 'location'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <MapPin size={18} />
            Location & Delivery
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`${
              activeTab === 'hours'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Clock size={18} />
            Opening Hours
          </button>
          <button
            onClick={() => setActiveTab('bot')}
            className={`${
              activeTab === 'bot'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <MessageSquare size={18} />
            Bot Configuration
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`${
              activeTab === 'password'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Key size={18} />
            Password
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`${
              activeTab === 'subscription'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <CreditCard size={18} />
            Subscription
          </button>
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Info Tab */}
        {activeTab === 'business' && (
          <div className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Business Name *</label>
                  <input
                    type="text"
                    className="input bg-gray-50 cursor-not-allowed"
                    value={formData.businessName}
                    disabled
                    required
                    title="This field cannot be changed after registration"
                  />
                  <p className="text-xs text-gray-500 mt-1">This field cannot be changed</p>
                </div>
                <div>
                  <label className="label">Business Type *</label>
                  <select
                    className="input bg-gray-50 cursor-not-allowed"
                    value={formData.businessType}
                    disabled
                    required
                    title="This field cannot be changed after registration"
                  >
                    <option value="food and beverage">Food & Beverage</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="sports">Sports</option>
                    <option value="salons">Salons</option>
                    <option value="clinics">Clinics</option>
                    <option value="rentals">Rentals</option>
                    <option value="other">Other</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">This field cannot be changed</p>
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    className="input bg-gray-50 cursor-not-allowed"
                    value={formData.email}
                    disabled
                    required
                    title="This field cannot be changed after registration"
                  />
                  <p className="text-xs text-gray-500 mt-1">This field cannot be changed</p>
                </div>
                <div>
                  <label className="label">Phone Number *</label>
                  <input
                    type="tel"
                    className={`input ${!isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    value={formData.contactPhoneNumber}
                    onChange={(e) => setFormData({ ...formData, contactPhoneNumber: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="+961..."
                    required
                    title={!isAdmin ? 'Only admin can edit this field' : ''}
                  />
                  {!isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">This field can only be edited by admin</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="label">Business Description</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={formData.businessDescription}
                    onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                    placeholder="Brief description of your business..."
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Location & Delivery Tab */}
        {activeTab === 'location' && (
          <div className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Location & Delivery Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={formData.locationLatitude}
                    onChange={(e) => setFormData({ ...formData, locationLatitude: e.target.value })}
                    placeholder="33.8938"
                  />
                  <p className="text-sm text-gray-500 mt-1">Your business location</p>
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={formData.locationLongitude}
                    onChange={(e) => setFormData({ ...formData, locationLongitude: e.target.value })}
                    placeholder="35.5018"
                  />
                  <p className="text-sm text-gray-500 mt-1">Your business location</p>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Delivery Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={formData.deliveryPrice}
                    onChange={(e) => setFormData({ ...formData, deliveryPrice: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    The price charged for delivery orders. This will be automatically added to the order total when customers choose delivery.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Google Maps Link</label>
                  <input
                    type="url"
                    className="input"
                    value={formData.googleMapsLink}
                    onChange={(e) => setFormData({ ...formData, googleMapsLink: e.target.value })}
                    placeholder="https://maps.google.com/..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Link to your business location on Google Maps
                  </p>
                </div>
                <div>
                  <label className="label">Carrier Phone Number</label>
                  <input
                    type="tel"
                    className="input"
                    value={formData.carrierPhoneNumber}
                    onChange={(e) => setFormData({ ...formData, carrierPhoneNumber: e.target.value })}
                    placeholder="+961..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Phone number for delivery carrier
                  </p>
                </div>
                <div>
                  <label className="label">Estimated Delivery Time (Min) - minutes</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.estimatedDeliveryTimeMin}
                    onChange={(e) => setFormData({ ...formData, estimatedDeliveryTimeMin: e.target.value })}
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="label">Estimated Delivery Time (Max) - minutes</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.estimatedDeliveryTimeMax}
                    onChange={(e) => setFormData({ ...formData, estimatedDeliveryTimeMax: e.target.value })}
                    placeholder="60"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Last Order Before Closing (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    className="input"
                    value={formData.lastOrderBeforeClosingMinutes}
                    onChange={(e) => setFormData({ ...formData, lastOrderBeforeClosingMinutes: e.target.value })}
                    placeholder="30"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    How many minutes before closing time should you stop accepting new orders? (e.g., 30 = stop accepting orders 30 minutes before closing)
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How to find your coordinates:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Open Google Maps</li>
                  <li>Right-click on your business location</li>
                  <li>Click the coordinates to copy them</li>
                  <li>Paste here (format: latitude, longitude)</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Opening Hours Tab */}
        {activeTab === 'hours' && (
          <div className="card space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Clock size={24} />
                  Opening Hours
                </h2>
                {saved && (
                  <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                    <span>✓ Saved successfully!</span>
                  </div>
                )}
              </div>
              <form onSubmit={handleOpeningHoursSubmit} className="space-y-4" noValidate>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                  // Ensure day exists in openingHours with default values
                  const dayHours = openingHours[day] || { open: '', close: '', closed: false }
                  return (
                    <div key={day} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="w-24">
                        <label className="font-medium text-gray-900 capitalize">{day}</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dayHours.closed}
                          onChange={(e) => {
                            setOpeningHours(prev => ({
                              ...prev,
                              [day]: { ...(prev[day] || { open: '', close: '', closed: false }), closed: e.target.checked }
                            }))
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-600">Closed</span>
                      </div>
                      {!dayHours.closed && (
                      <>
                        <div className="flex-1">
                          <label className="text-sm text-gray-600 mb-1 block">Open Time</label>
                          <input
                            type="time"
                            className="input"
                            value={dayHours.open}
                            onChange={(e) => {
                              setOpeningHours(prev => ({
                                ...prev,
                                [day]: { ...(prev[day] || { open: '', close: '', closed: false }), open: e.target.value }
                              }))
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm text-gray-600 mb-1 block">Close Time</label>
                          <input
                            type="time"
                            className="input"
                            value={dayHours.close}
                            onChange={(e) => {
                              setOpeningHours(prev => ({
                                ...prev,
                                [day]: { ...(prev[day] || { open: '', close: '', closed: false }), close: e.target.value }
                              }))
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )
                })}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    disabled={loading || !user}
                    className="btn btn-primary flex items-center gap-2"
                    onClick={(e) => {
                      console.log('🔵 Save button clicked')
                      e.preventDefault()
                      e.stopPropagation()
                      if (!user) {
                        alert('User not loaded. Please refresh the page.')
                        return
                      }
                      // Manually trigger form submission
                      handleOpeningHoursSubmit(e)
                    }}
                  >
                    <Save size={18} />
                    {loading ? 'Saving...' : 'Save Opening Hours'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bot Configuration Tab */}
        {activeTab === 'bot' && (
          <div className="card space-y-6">
            {/* Chatbot Enable/Disable */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <MessageSquare size={20} />
                    Chatbot Status
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {formData.chatbotEnabled 
                      ? 'Your chatbot is currently active and responding to customer messages.'
                      : 'Your chatbot is currently disabled. Customers will not receive automated responses.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAdmin) return
                    const newValue = !formData.chatbotEnabled
                    console.log('Toggle clicked! Changing chatbotEnabled from', formData.chatbotEnabled, 'to', newValue)
                    setFormData({ ...formData, chatbotEnabled: newValue })
                  }}
                  disabled={!isAdmin}
                  className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    formData.chatbotEnabled ? 'bg-green-600' : 'bg-gray-300'
                  } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!isAdmin ? 'Only admin can edit this field' : ''}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.chatbotEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  formData.chatbotEnabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {formData.chatbotEnabled ? '● Enabled' : '○ Disabled'}
                </span>
              </div>
            </div>

            {!isAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Bot Configuration is Admin-Only:</strong> These settings can only be edited by administrators. Contact support if you need changes.
                </p>
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare size={24} />
                WhatsApp Configuration
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="label flex items-center gap-2">
                    <Key size={16} />
                    WhatsApp Phone Number ID
                  </label>
                  <input
                    type="text"
                    className={`input font-mono ${!isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    value={formData.whatsappPhoneNumberId}
                    onChange={(e) => setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="1234567890123456"
                    title={!isAdmin ? 'Only admin can edit this field' : ''}
                  />
                  <p className="text-sm text-gray-500 mt-1">Found in Meta Business Suite → WhatsApp → API Setup</p>
                  {!isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">This field can only be edited by admin</p>
                  )}
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Key size={16} />
                    WhatsApp Business Account ID
                  </label>
                  <input
                    type="text"
                    className={`input font-mono ${!isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    value={formData.whatsappBusinessAccountId}
                    onChange={(e) => setFormData({ ...formData, whatsappBusinessAccountId: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="1234567890123456"
                    title={!isAdmin ? 'Only admin can edit this field' : ''}
                  />
                  <p className="text-sm text-gray-500 mt-1">Your WABA ID from Meta Business Manager</p>
                  {!isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">This field can only be edited by admin</p>
                  )}
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Key size={16} />
                    WhatsApp Access Token
                  </label>
                  <input
                    type="password"
                    className={`input font-mono ${!isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    value={formData.whatsappAccessToken}
                    onChange={(e) => setFormData({ ...formData, whatsappAccessToken: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="EAAxxxxxxxxxxxxx..."
                    title={!isAdmin ? 'Only admin can edit this field' : ''}
                  />
                  <p className="text-sm text-gray-500 mt-1">Your permanent access token from Meta Business Suite</p>
                  {!isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">This field can only be edited by admin</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare size={24} />
                Telegram Configuration
              </h2>
              <div>
                <label className="label flex items-center gap-2">
                  <Key size={16} />
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  className={`input font-mono ${!isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  value={formData.telegramBotToken}
                  onChange={(e) => setFormData({ ...formData, telegramBotToken: e.target.value })}
                  disabled={!isAdmin}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  title={!isAdmin ? 'Only admin can edit this field' : ''}
                />
                <p className="text-sm text-gray-500 mt-1">Get from @BotFather on Telegram</p>
                {!isAdmin && (
                  <p className="text-xs text-gray-500 mt-1">This field can only be edited by admin</p>
                )}
              </div>
              
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-sm font-medium text-amber-900 mb-2">⚠️ Security Notice:</h4>
                <p className="text-sm text-amber-800">
                  These tokens give access to your messaging accounts. Keep them secure and never share them publicly.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare size={24} />
                Instagram Configuration
              </h2>
              <IntegrationSetup 
                platform="instagram"
                user={user}
                onUpdate={fetchUser}
              />
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare size={24} />
                Facebook Configuration
              </h2>
              <IntegrationSetup 
                platform="facebook"
                user={user}
                onUpdate={fetchUser}
              />
            </div>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key size={24} />
                Change Password
              </h2>
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePasswordChange(e)
                }} 
                className="space-y-4"
                noValidate
              >
                {/* Password Change Messages */}
                {passwordMessage.text && (
                  <div className={`p-4 rounded-lg ${
                    passwordMessage.type === 'success' 
                      ? 'bg-green-50 border border-green-200 text-green-800' 
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    <p className="font-medium">
                      {passwordMessage.type === 'success' ? '✓ ' : '✗ '}
                      {passwordMessage.text}
                    </p>
                  </div>
                )}

                <div>
                  <label className="label">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      className="input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPasswords.current ? (
                        <EyeOff size={20} className="text-gray-400" />
                      ) : (
                        <Eye size={20} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="input pr-10"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPasswords.new ? (
                        <EyeOff size={20} className="text-gray-400" />
                      ) : (
                        <Eye size={20} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                </div>

                <div>
                  <label className="label">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      className="input pr-10"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPasswords.confirm ? (
                        <EyeOff size={20} className="text-gray-400" />
                      ) : (
                        <Eye size={20} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handlePasswordChange(e)
                    }}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Key size={18} />
                        <span>Change Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Contract Tab */}
        {activeTab === 'contract' && user?.userType === 'business' && (
          <div className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contract Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Contract Status</label>
                  <div className={`px-4 py-2 rounded-md font-medium ${
                    contractInfo.contract_status === 'approved' ? 'bg-green-100 text-green-800' :
                    contractInfo.contract_status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {contractInfo.contract_status?.toUpperCase() || 'PENDING'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Your contract approval status</p>
                </div>
                
                {contractInfo.contract_file_url && (
                  <div>
                    <label className="label">Contract File</label>
                    <a
                      href={contractInfo.contract_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View Contract PDF
                    </a>
                  </div>
                )}
                
                {contractInfo.contract_approved_at && (
                  <div>
                    <label className="label">Approved At</label>
                    <p className="text-gray-700">
                      {new Date(contractInfo.contract_approved_at).toLocaleString()}
                    </p>
                  </div>
                )}
                
                {!contractInfo.contract_file_url && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Your contract will be uploaded by an administrator. Please contact support for more information.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                <CreditCard size={24} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Subscription</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  {user?.subscription_type === 'premium' ? 'Premium Plan' : 'Standard Plan'}
                </p>
                <p className="text-sm text-gray-600">
                  {user?.subscription_type === 'premium'
                    ? 'Access to all features including analytics'
                    : 'Basic features only'}
                </p>
              </div>
              {user?.subscription_type !== 'premium' && (
                <button type="button" className="btn btn-primary">Upgrade to Premium</button>
              )}
            </div>
          </div>
        )}

        {/* Save Button & Success Message */}
        {activeTab !== 'subscription' && activeTab !== 'password' && activeTab !== 'contract' && (
          <>
            {saved && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                Settings updated successfully!
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
