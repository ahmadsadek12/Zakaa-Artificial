import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserPlus } from 'lucide-react'

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    business_name: '',
    business_type: 'restaurant',
    contact_phone_number: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await register({ ...formData, user_type: 'business' })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4 py-12">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center justify-center mb-4 gap-3">
              <img src="/zakaa-logo.jpeg" alt="Zakaa" className="h-20 w-auto" />
              <h1 className="text-3xl font-bold text-gray-900">Zakaa</h1>
            </div>
            <p className="text-gray-600">Create your business account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="label">Business Name</label>
              <input
                type="text"
                name="business_name"
                className="input"
                value={formData.business_name}
                onChange={handleChange}
                required
                placeholder="My Restaurant"
              />
            </div>

            <div>
              <label className="label">Business Type</label>
              <select
                name="business_type"
                className="input"
                value={formData.business_type}
                onChange={handleChange}
                required
              >
                <option value="restaurant">Restaurant</option>
                <option value="sports_court">Sports Court</option>
                <option value="salon">Salon</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                name="email"
                className="input"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="business@example.com"
              />
            </div>

            <div>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                name="contact_phone_number"
                className="input"
                value={formData.contact_phone_number}
                onChange={handleChange}
                required
                placeholder="+1234567890"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                name="password"
                className="input"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
