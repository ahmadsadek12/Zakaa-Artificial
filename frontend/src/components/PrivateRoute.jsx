import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from './Layout'

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect admin users to admin dashboard if they try to access business routes
  if (user.userType === 'admin' && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />
  }

  // Redirect business users to business dashboard if they try to access admin routes
  if (user.userType !== 'admin' && location.pathname.startsWith('/admin')) {
    return <Navigate to="/" replace />
  }

  return <Layout>{children}</Layout>
}
