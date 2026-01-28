import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Package,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Building2,
  Settings2,
  Table,
  MessageSquare,
  MessageCircle,
  MessageCircleDashed
} from 'lucide-react'
import { useState } from 'react'
import { getTerminology, getNavTerminology } from '../utils/terminology'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Admin navigation items
  const adminNavItems = [
    { path: '/admin', icon: Shield, label: 'Admin Dashboard' },
    { path: '/admin/businesses', icon: Building2, label: 'Businesses' },
    { path: '/admin/branches', icon: Store, label: 'All Branches' },
    { path: '/admin/profile', icon: Settings, label: 'My Profile' },
  ]

  // Get terminology based on business type
  const terms = getTerminology(user?.business_type)
  const navTerms = getNavTerminology()

  // Business navigation items
  const businessNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/orders', icon: ShoppingCart, label: terms.orders },
    { path: '/carts', icon: ShoppingBag, label: terms.activeRequests },
    { path: '/branches', icon: Store, label: 'Branches' },
    { path: '/menus', icon: UtensilsCrossed, label: terms.menus },
    { path: '/items', icon: Package, label: terms.items },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/analytics', icon: BarChart3, label: 'Insights' },
    { path: '/table-reservations', icon: Table, label: 'Table Reservations' },
    { path: '/tickets', icon: MessageSquare, label: 'Support Tickets' },
    { path: '/chat-sessions', icon: MessageCircle, label: 'Chat Sessions' },
    { path: '/whatsapp-messages', icon: MessageCircleDashed, label: 'WhatsApp Messages' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  const navItems = user?.userType === 'admin' ? adminNavItems : businessNavItems
  
  // Debug logging
  console.log('🔍 Layout - User:', user)
  console.log('🔍 Layout - User Type:', user?.userType)
  console.log('🔍 Layout - Is Admin?', user?.userType === 'admin')

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3">
                <img src="/zakaa-logo.jpeg" alt="Zakaa" className="h-12 w-auto object-contain" />
                <span className="text-xl font-bold text-gray-900">Zakaa</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 font-semibold">
                  {(user?.business_name || user?.businessName)?.[0] || user?.email?.[0] || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.business_name || user?.businessName || user?.email}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {user?.userType === 'admin' ? 'Admin' : 'Business'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
