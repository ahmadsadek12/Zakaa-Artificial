import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Building2, Store, ShoppingCart, MessageSquare, CheckCircle, X as XIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState({
    businesses: 0,
    branches: 0,
    orders: { total: 0, accepted: 0, completed: 0, rejected: 0 },
    messages: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is admin
    if (user && user.userType !== 'admin') {
      navigate('/')
      return
    }

    fetchStats()
  }, [user, navigate])

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      const response = await axios.get(`${API_URL}/api/admin/stats`, { headers })
      setStats(response.data.data)
    } catch (error) {
      console.error('Error fetching admin stats:', error)
      alert('Failed to load admin statistics')
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Businesses',
      value: stats.businesses,
      icon: Building2,
      color: 'text-purple-600 bg-purple-50',
      link: '/admin/businesses'
    },
    {
      title: 'Total Branches',
      value: stats.branches,
      icon: Store,
      color: 'text-indigo-600 bg-indigo-50',
      link: '/admin/branches'
    },
    {
      title: 'Total Orders',
      value: stats.orders.total,
      icon: ShoppingCart,
      color: 'text-blue-600 bg-blue-50',
      link: null
    },
    {
      title: 'Messages Sent',
      value: stats.messages,
      icon: MessageSquare,
      color: 'text-green-600 bg-green-50',
      link: null
    }
  ]

  const orderStats = [
    {
      title: 'Accepted Orders',
      value: stats.orders.accepted,
      icon: CheckCircle,
      color: 'text-blue-600'
    },
    {
      title: 'Completed Orders',
      value: stats.orders.completed,
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      title: 'Rejected Orders',
      value: stats.orders.rejected,
      icon: XIcon,
      color: 'text-red-600'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">System-wide statistics and management</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          const Card = (
            <div className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          )

          if (stat.link) {
            return (
              <button
                key={stat.title}
                onClick={() => navigate(stat.link)}
                className="text-left"
              >
                {Card}
              </button>
            )
          }

          return <div key={stat.title}>{Card}</div>
        })}
      </div>

      {/* Order Statistics */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {orderStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.title} className="flex items-center space-x-4">
                <Icon className={stat.color} size={32} />
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/admin/businesses')}
            className="btn btn-primary"
          >
            <Building2 size={20} />
            Manage Businesses
          </button>
          <button
            onClick={() => navigate('/admin/branches')}
            className="btn btn-secondary"
          >
            <Store size={20} />
            Manage Branches
          </button>
        </div>
      </div>
    </div>
  )
}
