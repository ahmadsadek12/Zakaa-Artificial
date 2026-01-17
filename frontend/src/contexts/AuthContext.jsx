import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`)
      const userData = response.data.data.user
      console.log('🔍 Fetched user data:', userData)
      console.log('🔍 User type:', userData.userType || userData.user_type)
      setUser(userData)
    } catch (error) {
      console.error('❌ Error fetching user:', error)
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, { email, password })
    const { token, user: loginUser } = response.data.data
    console.log('🔐 Login successful, initial user data:', loginUser)
    console.log('🔐 User type:', loginUser.userType)
    localStorage.setItem('token', token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    
    // Fetch full user data after login to get all fields (delivery_price, business_name, etc.)
    try {
      const fullUserResponse = await axios.get(`${API_URL}/api/auth/me`)
      const fullUser = fullUserResponse.data.data.user
      console.log('🔐 Full user data fetched:', fullUser)
      setUser(fullUser)
      return { token, user: fullUser }
    } catch (error) {
      console.error('❌ Error fetching full user data after login:', error)
      // Fallback to login user data if fetch fails
      setUser(loginUser)
      return { token, user: loginUser }
    }
  }

  const register = async (userData) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, userData)
    const { token, user } = response.data.data
    localStorage.setItem('token', token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(user)
    return { token, user }
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
