import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { Save, Building2, CreditCard, Phone, MapPin, Globe, MessageSquare, Key, Clock, Eye, EyeOff } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Settings() {
  const { user, fetchUser } = useAuth()
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'f & b',
    email: '',
    contactPhoneNumber: '',
    businessDescription: '',
    locationLatitude: '',
    locationLongitude: '',
    deliveryRadiusKm: '10',
    deliveryPrice: '0',
    defaultLanguage: 'english',
    languages: ['english', 'arabic'],
    timezone: 'Asia/Beirut',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappAccessToken: '',
    telegramBotToken: '',
    chatbotEnabled: true,
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('business')
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

  useEffect(() => {
    if (user) {
      console.log('User data received:', user)
      console.log('chatbot_enabled value:', user.chatbot_enabled, 'type:', typeof user.chatbot_enabled)
      setFormData({
        businessName: user.business_name || '',
        businessType: user.business_type || 'f & b',
        email: user.email || '',
        contactPhoneNumber: user.contact_phone_number || '',
        businessDescription: user.business_description || '',
        locationLatitude: user.location_latitude || '',
        locationLongitude: user.location_longitude || '',
        deliveryRadiusKm: user.delivery_radius_km || '10',
        deliveryPrice: user.delivery_price || '0',
        defaultLanguage: user.default_language || 'english',
        languages: user.languages ? (typeof user.languages === 'string' ? JSON.parse(user.languages) : user.languages) : ['english', 'arabic'],
        timezone: user.timezone || 'Asia/Beirut',
        whatsappPhoneNumberId: user.whatsapp_phone_number_id || '',
        whatsappBusinessAccountId: user.whatsapp_business_account_id || '',
        whatsappAccessToken: user.whatsapp_access_token || '',
        telegramBotToken: user.telegram_bot_token || '',
        chatbotEnabled: user.chatbot_enabled !== undefined ? user.chatbot_enabled : true,
      })
    }
  }, [user])
  
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
      console.log('Sending formData:', formData)
      console.log('chatbotEnabled being sent:', formData.chatbotEnabled, 'type:', typeof formData.chatbotEnabled)
      const response = await axios.put(`${API_URL}/api/businesses/me`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      console.log('Update response:', response.data)
      console.log('chatbot_enabled in response:', response.data?.data?.business?.chatbot_enabled, 'type:', typeof response.data?.data?.business?.chatbot_enabled)
      
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
    setLoading(true)
    setSaved(false)

    // Validate passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('New passwords do not match')
      setLoading(false)
      return
    }

    // Validate password strength
    if (passwordData.new_password.length < 8) {
      alert('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        alert('You must be logged in to change your password')
        setLoading(false)
        return
      }
      
      const response = await axios.put(
        `${API_URL}/api/businesses/me/password`,
        {
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
          confirm_password: passwordData.confirm_password
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (response.data.success) {
        setSaved(true)
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
        setTimeout(() => setSaved(false), 3000)
        alert('Password changed successfully')
      } else {
        alert(response.data.error?.message || 'Failed to change password')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.error?.errors?.map(e => e.message).join(', ') ||
                          error.message || 
                          'Failed to change password'
      alert(errorMessage)
    } finally {
      setLoading(false)
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
                    className="input"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Business Type *</label>
                  <select
                    className="input"
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    required
                  >
                    <option value="f & b">F & B (Food & Beverage)</option>
                    <option value="services">Services</option>
                    <option value="products">Products</option>
                  </select>
                </div>
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
                  <label className="label">Phone Number</label>
                  <input
                    type="tel"
                    className="input"
                    value={formData.contactPhoneNumber}
                    onChange={(e) => setFormData({ ...formData, contactPhoneNumber: e.target.value })}
                    placeholder="+961..."
                  />
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

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe size={20} />
                Language & Localization
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Default Language</label>
                  <select
                    className="input"
                    value={formData.defaultLanguage}
                    onChange={(e) => setFormData({ ...formData, defaultLanguage: e.target.value })}
                  >
                    <option value="english">English (Default)</option>
                    <option value="arabic">Arabic (عربي)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <select
                    className="input"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  >
                    <option value="Asia/Beirut">Beirut (GMT+2/+3)</option>
                    <option value="Europe/London">London (GMT+0/+1)</option>
                    <option value="Europe/Paris">Paris (GMT+1/+2)</option>
                    <option value="America/New_York">New York (GMT-5/-4)</option>
                    <option value="Asia/Dubai">Dubai (GMT+4)</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="label">Bot Default Language</label>
                <p className="text-sm text-gray-500 mb-2">The bot always starts in English. Customers can request Arabic by saying "Arabic" or "عربي"</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    🌐 <strong>Default:</strong> English<br/>
                    🔄 <strong>Available:</strong> English, Arabic (عربي)
                  </p>
                </div>
                {/* Hidden language checkboxes - kept for backward compatibility but hidden */}
                <div className="hidden">
                  {[
                    { value: 'english', label: 'English' },
                    { value: 'arabic', label: 'عربي (Arabic)' }
                  ].map(lang => (
                    <label key={lang.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.languages.includes(lang.value)}
                        onChange={() => handleLanguageToggle(lang.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{lang.label}</span>
                    </label>
                  ))}
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
                  <p className="text-sm text-gray-500 mt-1">Your business location (for delivery radius calculation)</p>
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
                  <p className="text-sm text-gray-500 mt-1">Your business location (for delivery radius calculation)</p>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Delivery Radius (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="input"
                    value={formData.deliveryRadiusKm}
                    onChange={(e) => setFormData({ ...formData, deliveryRadiusKm: e.target.value })}
                    placeholder="10"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum distance you deliver to (in kilometers). Leave blank for unlimited.
                  </p>
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
                    const newValue = !formData.chatbotEnabled
                    console.log('Toggle clicked! Changing chatbotEnabled from', formData.chatbotEnabled, 'to', newValue)
                    setFormData({ ...formData, chatbotEnabled: newValue })
                  }}
                  className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    formData.chatbotEnabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
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
                    className="input font-mono"
                    value={formData.whatsappPhoneNumberId}
                    onChange={(e) => setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })}
                    placeholder="1234567890123456"
                  />
                  <p className="text-sm text-gray-500 mt-1">Found in Meta Business Suite → WhatsApp → API Setup</p>
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Key size={16} />
                    WhatsApp Business Account ID
                  </label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={formData.whatsappBusinessAccountId}
                    onChange={(e) => setFormData({ ...formData, whatsappBusinessAccountId: e.target.value })}
                    placeholder="1234567890123456"
                  />
                  <p className="text-sm text-gray-500 mt-1">Your WABA ID from Meta Business Manager</p>
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Key size={16} />
                    WhatsApp Access Token
                  </label>
                  <input
                    type="password"
                    className="input font-mono"
                    value={formData.whatsappAccessToken}
                    onChange={(e) => setFormData({ ...formData, whatsappAccessToken: e.target.value })}
                    placeholder="EAAxxxxxxxxxxxxx..."
                  />
                  <p className="text-sm text-gray-500 mt-1">Your permanent access token from Meta Business Suite</p>
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
                  className="input font-mono"
                  value={formData.telegramBotToken}
                  onChange={(e) => setFormData({ ...formData, telegramBotToken: e.target.value })}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                />
                <p className="text-sm text-gray-500 mt-1">Get from @BotFather on Telegram</p>
              </div>
              
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-sm font-medium text-amber-900 mb-2">⚠️ Security Notice:</h4>
                <p className="text-sm text-amber-800">
                  These tokens give access to your messaging accounts. Keep them secure and never share them publicly.
                </p>
              </div>
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
              <form onSubmit={handlePasswordChange} className="space-y-4">
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
                    type="submit"
                    disabled={loading}
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
        {activeTab !== 'subscription' && activeTab !== 'password' && (
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
