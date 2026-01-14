import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Carts from './pages/Carts'
import Branches from './pages/Branches'
import Menus from './pages/Menus'
import Items from './pages/Items'
import Scheduled from './pages/Scheduled'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/orders" element={<PrivateRoute><Orders /></PrivateRoute>} />
          <Route path="/carts" element={<PrivateRoute><Carts /></PrivateRoute>} />
          <Route path="/branches" element={<PrivateRoute><Branches /></PrivateRoute>} />
          <Route path="/menus" element={<PrivateRoute><Menus /></PrivateRoute>} />
          <Route path="/items" element={<PrivateRoute><Items /></PrivateRoute>} />
          <Route path="/scheduled" element={<PrivateRoute><Scheduled /></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
