import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { UtensilsCrossed, Plus, Edit, Trash2, Power, PowerOff, Calendar, Users, MapPin, Phone, CheckCircle, XCircle, Clock, History, AlertCircle, Search } from 'lucide-react'
import { format } from 'date-fns'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function TableReservations() {
  const { user } = useAuth()
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [historyReservations, setHistoryReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('reservations') // 'reservations', 'tables', or 'history'
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTerm, setSearchTerm] = useState('')
  const [showTableModal, setShowTableModal] = useState(false)
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [reservationDetails, setReservationDetails] = useState(null)
  const [items, setItems] = useState([])
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [itemForm, setItemForm] = useState({ itemId: '', quantity: 1, notes: '' })
  const [tableForm, setTableForm] = useState({
    table_number: '',
    min_seats: 2,
    max_seats: 4,
    position_label: '',
    position_notes: '',
    is_active: true
  })
  const [reservationForm, setReservationForm] = useState({
    customer_name: '',
    customer_phone_number: '',
    reservation_date: format(new Date(), 'yyyy-MM-dd'),
    reservation_time: '',
    number_of_guests: '',
    table_id: '',
    notes: ''
  })

  useEffect(() => {
    fetchData()
    fetchItems()
  }, [selectedDate, activeTab])

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/api/items`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setItems(res.data.data.items || [])
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  const fetchReservationDetails = async (reservationId) => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_URL}/api/reservations/${reservationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setReservationDetails(res.data.data)
    } catch (error) {
      console.error('Error fetching reservation details:', error)
    }
  }

  const handleAddItemToReservation = async () => {
    if (!selectedReservation || !itemForm.itemId) {
      alert('Please select an item')
      return
    }
    try {
      const token = localStorage.getItem('token')
      const payload = {
        itemId: itemForm.itemId,
        quantity: itemForm.quantity ? parseInt(itemForm.quantity) : 1
      }
      if (itemForm.notes && itemForm.notes.trim()) {
        payload.notes = itemForm.notes.trim()
      }
      
      console.log('Adding item to reservation:', payload)
      
      await axios.post(`${API_URL}/api/reservations/${selectedReservation.id}/items`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowAddItemModal(false)
      setItemForm({ itemId: '', quantity: 1, notes: '' })
      fetchReservationDetails(selectedReservation.id)
      fetchData()
    } catch (error) {
      console.error('Error adding item to reservation:', error)
      console.error('Error response:', error.response?.data)
      const errorDetails = error.response?.data?.error?.details
      const errorMessage = errorDetails && errorDetails.length > 0
        ? errorDetails.map(e => e.msg || e.message).join(', ')
        : error.response?.data?.error?.message || 'Failed to add item to reservation'
      alert(`Error: ${errorMessage}`)
    }
  }

  const handleRemoveItemFromReservation = async (itemId) => {
    if (!selectedReservation) return
    if (!confirm('Remove this item from the reservation?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/api/reservations/${selectedReservation.id}/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchReservationDetails(selectedReservation.id)
      fetchData()
    } catch (error) {
      console.error('Error removing item from reservation:', error)
      alert(error.response?.data?.error?.message || 'Failed to remove item')
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      // Fetch tables with reservation status for selected date
      const tablesRes = await axios.get(`${API_URL}/api/tables`, {
        params: { date: selectedDate },
        headers
      })
      setTables(tablesRes.data.data.tables || [])

      // Fetch reservations for selected date (confirmed only)
      if (activeTab === 'reservations') {
        const reservationsRes = await axios.get(`${API_URL}/api/reservations`, {
          params: { 
            startDate: selectedDate,
            endDate: selectedDate,
            type: 'table',
            status: 'confirmed'
          },
          headers
        })
        setReservations(reservationsRes.data.data.reservations || [])
      }
      
      // Fetch history reservations (non-confirmed) - fetch all and filter on frontend
      if (activeTab === 'history') {
        const historyRes = await axios.get(`${API_URL}/api/reservations`, {
          params: { 
            type: 'table'
          },
          headers
        })
        // Filter to show only non-confirmed reservations
        const allReservations = historyRes.data.data.reservations || []
        const nonConfirmed = allReservations.filter(r => 
          r.status !== 'confirmed' && (r.status === 'cancelled' || r.status === 'completed' || r.status === 'no_show')
        )
        // Sort by date descending (most recent first)
        nonConfirmed.sort((a, b) => {
          const dateA = new Date(`${a.reservation_date} ${a.reservation_time}`)
          const dateB = new Date(`${b.reservation_date} ${b.reservation_time}`)
          return dateB - dateA
        })
        setHistoryReservations(nonConfirmed)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      if (error.response?.status === 403) {
        alert('Table reservations addon is not active for this business')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTable = async () => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/api/tables`, tableForm, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowTableModal(false)
      resetTableForm()
      fetchData()
      alert('Table created successfully')
    } catch (error) {
      console.error('Error creating table:', error)
      alert(error.response?.data?.error?.message || 'Failed to create table')
    }
  }

  const handleUpdateTable = async () => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(`${API_URL}/api/tables/${editingTable.id}`, tableForm, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowTableModal(false)
      setEditingTable(null)
      resetTableForm()
      fetchData()
      alert('Table updated successfully')
    } catch (error) {
      console.error('Error updating table:', error)
      alert(error.response?.data?.error?.message || 'Failed to update table')
    }
  }

  const handleToggleTable = async (table) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(`${API_URL}/api/tables/${table.id}/toggle`, {
        is_active: !table.is_active
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchData()
    } catch (error) {
      console.error('Error toggling table:', error)
      alert(error.response?.data?.error?.message || 'Failed to toggle table')
    }
  }

  const handleCreateReservation = async () => {
    try {
      const token = localStorage.getItem('token')
      
      // Transform snake_case to camelCase for API
      const payload = {
        customerPhoneNumber: reservationForm.customer_phone_number,
        customerName: reservationForm.customer_name,
        reservationDate: reservationForm.reservation_date,
        reservationTime: reservationForm.reservation_time,
        numberOfGuests: reservationForm.number_of_guests || null,
        notes: reservationForm.notes || null,
        source: 'dashboard',
        platform: 'dashboard'
      }
      
      // Only include tableId if it's a valid UUID (not empty string)
      if (reservationForm.table_id && reservationForm.table_id.trim() !== '') {
        payload.tableId = reservationForm.table_id
      }
      
      await axios.post(`${API_URL}/api/reservations`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowReservationModal(false)
      resetReservationForm()
      fetchData()
      alert('Reservation created successfully')
    } catch (error) {
      console.error('Error creating reservation:', error)
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.error?.details?.[0]?.msg ||
                          'Failed to create reservation'
      alert(errorMessage)
    }
  }

  const handleUpdateReservationStatus = async (reservationId, newStatus) => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(`${API_URL}/api/reservations/${reservationId}/status`, {
        status: newStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchData()
      setSelectedReservation(null)
      alert('Reservation status updated')
    } catch (error) {
      console.error('Error updating reservation:', error)
      alert(error.response?.data?.error?.message || 'Failed to update reservation')
    }
  }

  const resetTableForm = () => {
    setTableForm({
      table_number: '',
      min_seats: 2,
      max_seats: 4,
      position_label: '',
      position_notes: '',
      is_active: true
    })
  }

  const resetReservationForm = () => {
    setReservationForm({
      customer_name: '',
      customer_phone_number: '',
      reservation_date: selectedDate,
      reservation_time: '',
      number_of_guests: '',
      table_id: '',
      notes: ''
    })
  }

  const openEditTable = (table) => {
    setEditingTable(table)
    setTableForm({
      table_number: table.table_number || '',
      min_seats: table.min_seats || 2,
      max_seats: table.max_seats || 4,
      position_label: table.position_label || '',
      position_notes: table.position_notes || '',
      is_active: table.is_active !== false
    })
    setShowTableModal(true)
  }

  if (loading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <UtensilsCrossed className="w-8 h-8" />
          Table Reservations
        </h1>
        <p className="text-gray-600 mt-2">Manage tables and reservations for your restaurant</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('reservations')}
            className={`pb-4 px-4 font-medium transition-colors ${
              activeTab === 'reservations'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Table Reservation
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`pb-4 px-4 font-medium transition-colors ${
              activeTab === 'tables'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tables
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-4 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Table History
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {(activeTab === 'reservations' || activeTab === 'history') && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search reservations by customer name, phone, or table..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Date Selector for Reservations */}
      {activeTab === 'reservations' && (
        <div className="mb-6">
          <label className="label">View Reservations for Date</label>
          <input
            type="date"
            className="input max-w-xs"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      )}

      {/* Tables Tab */}
      {activeTab === 'tables' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
            <button
              onClick={() => {
                setEditingTable(null)
                resetTableForm()
                setShowTableModal(true)
              }}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Table
            </button>
          </div>

          {/* Tables Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => {
              const hasReservation = table.reservation_status === 'reserved'
              
              return (
                <div
                  key={table.id}
                  className={`border rounded-lg p-4 bg-white ${
                    !table.is_active ? 'opacity-50' : ''
                  } ${
                    hasReservation ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Table {table.table_number}
                      </h3>
                      {table.position_label && (
                        <p className="text-sm text-gray-600">{table.position_label}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleTable(table)}
                        className={`p-2 rounded ${
                          table.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={table.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {table.is_active ? (
                          <Power className="w-4 h-4" />
                        ) : (
                          <PowerOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditTable(table)}
                        className="p-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">
                        {table.min_seats} - {table.max_seats} seats
                      </span>
                    </div>
                    {hasReservation && (
                      <div className="flex items-center gap-2 text-blue-700">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Reserved</span>
                      </div>
                    )}
                    {table.position_notes && (
                      <p className="text-gray-600 text-xs">{table.position_notes}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {tables.length === 0 && (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <UtensilsCrossed className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No tables found. Create your first table!</p>
            </div>
          )}
        </div>
      )}

      {/* Reservations Tab */}
      {activeTab === 'reservations' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Reservations for {format(new Date(selectedDate), 'MMMM d, yyyy')}
            </h2>
            <button
              onClick={() => {
                setReservationForm({
                  ...reservationForm,
                  reservation_date: selectedDate
                })
                setShowReservationModal(true)
              }}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Reservation
            </button>
          </div>

          {/* Reservations List */}
          <div className="space-y-4">
            {reservations
              .filter((reservation) => {
                if (!searchTerm) return true
                const searchLower = searchTerm.toLowerCase()
                const customerName = (reservation.customer_name || '').toLowerCase()
                const phone = reservation.customer_phone_number || ''
                const table = tables.find(t => t.id === reservation.table_id)
                const tableNumber = table ? `table ${table.table_number}`.toLowerCase() : ''
                return customerName.includes(searchLower) || 
                       phone.includes(searchTerm) ||
                       tableNumber.includes(searchLower)
              })
              .map((reservation) => {
              const table = tables.find(t => t.id === reservation.table_id)
              
              return (
                <div
                  key={reservation.id}
                  className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedReservation(reservation)
                    fetchReservationDetails(reservation.id)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {reservation.customer_name || reservation.customer_phone_number}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          reservation.status === 'completed' ? 'bg-green-100 text-green-800' :
                          reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          reservation.status === 'no_show' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {reservation.status === 'no_show' ? 'No Show' : reservation.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{reservation.reservation_time}</span>
                        </div>
                        {reservation.number_of_guests && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{reservation.number_of_guests} guests</span>
                          </div>
                        )}
                        {table ? (
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span>Table {table.table_number}</span>
                          </div>
                        ) : reservation.table_id ? (
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span className="text-gray-500">Table ID: {reservation.table_id.substring(0, 8)}...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span className="text-gray-500">Auto-assigned</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span className="font-mono">{reservation.customer_phone_number}</span>
                        </div>
                      </div>
                      
                      {reservation.notes && (
                        <p className="text-sm text-gray-600 mt-2">{reservation.notes}</p>
                      )}
                      
                      {/* Reservation Items Preview */}
                      {reservation.items && reservation.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Pre-ordered Items ({reservation.items.length}):</p>
                          <p className="text-xs text-gray-600">
                            {reservation.items.slice(0, 2).map(item => `${item.quantity}x ${item.name_at_time}`).join(', ')}
                            {reservation.items.length > 2 && ` +${reservation.items.length - 2} more`}
                          </p>
                          <p className="text-xs font-semibold text-gray-900 mt-1">
                            Total: ${reservation.items.reduce((sum, item) => sum + (parseFloat(item.price_at_time) * item.quantity), 0).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {reservation.status === 'confirmed' && (
                        <>
                          <button
                            onClick={() => handleUpdateReservationStatus(reservation.id, 'completed')}
                            className="p-2 rounded bg-green-100 text-green-700 hover:bg-green-200"
                            title="Mark as Completed"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateReservationStatus(reservation.id, 'no_show')}
                            className="p-2 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                            title="Mark as No Show"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateReservationStatus(reservation.id, 'cancelled')}
                            className="p-2 rounded bg-red-100 text-red-700 hover:bg-red-200"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {reservations
            .filter((reservation) => {
              if (!searchTerm) return true
              const searchLower = searchTerm.toLowerCase()
              const customerName = (reservation.customer_name || '').toLowerCase()
              const phone = reservation.customer_phone_number || ''
              const table = tables.find(t => t.id === reservation.table_id)
              const tableNumber = table ? `table ${table.table_number}`.toLowerCase() : ''
              return customerName.includes(searchLower) || 
                     phone.includes(searchTerm) ||
                     tableNumber.includes(searchLower)
            }).length === 0 && (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No confirmed reservations for this date</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Reservation History
            </h2>
          </div>

          {/* History Reservations List */}
          <div className="space-y-4">
            {historyReservations
            .filter((reservation) => {
              if (!searchTerm) return true
              const searchLower = searchTerm.toLowerCase()
              const customerName = (reservation.customer_name || '').toLowerCase()
              const phone = reservation.customer_phone_number || ''
              const table = tables.find(t => t.id === reservation.table_id)
              const tableNumber = table ? `table ${table.table_number}`.toLowerCase() : ''
              return customerName.includes(searchLower) || 
                     phone.includes(searchTerm) ||
                     tableNumber.includes(searchLower)
            })
            .map((reservation) => {
              const table = tables.find(t => t.id === reservation.table_id)
              
              // Create tooltip content
              const tooltipContent = `
                Customer: ${reservation.customer_name || 'N/A'}
                Phone: ${reservation.customer_phone_number}
                Date: ${format(new Date(reservation.reservation_date), 'MMM d, yyyy')}
                Time: ${reservation.reservation_time}
                Guests: ${reservation.number_of_guests || 'N/A'}
                Table: ${table ? `Table ${table.table_number}` : reservation.table_id ? `ID: ${reservation.table_id.substring(0, 8)}...` : 'Auto-assigned'}
                Status: ${reservation.status === 'no_show' ? 'No Show' : reservation.status}
                ${reservation.notes ? `Notes: ${reservation.notes}` : ''}
              `.trim()
              
              return (
                <div
                  key={reservation.id}
                  className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow relative group"
                  title={tooltipContent}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {reservation.customer_name || reservation.customer_phone_number}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          reservation.status === 'completed' ? 'bg-green-100 text-green-800' :
                          reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          reservation.status === 'no_show' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {reservation.status === 'no_show' ? 'No Show' : reservation.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(reservation.reservation_date), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{reservation.reservation_time}</span>
                        </div>
                        {reservation.number_of_guests && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{reservation.number_of_guests} guests</span>
                          </div>
                        )}
                        {table ? (
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span>Table {table.table_number}</span>
                          </div>
                        ) : reservation.table_id ? (
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span className="text-gray-500">Table ID: {reservation.table_id.substring(0, 8)}...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span className="text-gray-500">Auto-assigned</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span className="font-mono">{reservation.customer_phone_number}</span>
                        </div>
                      </div>
                      
                      {reservation.notes && (
                        <p className="text-sm text-gray-600 mt-2">{reservation.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {historyReservations
            .filter((reservation) => {
              if (!searchTerm) return true
              const searchLower = searchTerm.toLowerCase()
              const customerName = (reservation.customer_name || '').toLowerCase()
              const phone = reservation.customer_phone_number || ''
              const table = tables.find(t => t.id === reservation.table_id)
              const tableNumber = table ? `table ${table.table_number}`.toLowerCase() : ''
              return customerName.includes(searchLower) || 
                     phone.includes(searchTerm) ||
                     tableNumber.includes(searchLower)
            }).length === 0 && (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No reservation history found</p>
            </div>
          )}
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingTable ? 'Edit Table' : 'Add New Table'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="label">Table Number *</label>
                <input
                  type="text"
                  className="input"
                  value={tableForm.table_number}
                  onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })}
                  placeholder="e.g., A1, 12, Window-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Min Seats *</label>
                  <input
                    type="number"
                    className="input"
                    value={tableForm.min_seats}
                    onChange={(e) => setTableForm({ ...tableForm, min_seats: parseInt(e.target.value) || 1 })}
                    min="1"
                  />
                </div>
                <div>
                  <label className="label">Max Seats *</label>
                  <input
                    type="number"
                    className="input"
                    value={tableForm.max_seats}
                    onChange={(e) => setTableForm({ ...tableForm, max_seats: parseInt(e.target.value) || 1 })}
                    min={tableForm.min_seats}
                  />
                </div>
              </div>

              <div>
                <label className="label">Position Label</label>
                <input
                  type="text"
                  className="input"
                  value={tableForm.position_label}
                  onChange={(e) => setTableForm({ ...tableForm, position_label: e.target.value })}
                  placeholder="e.g., Terrace, Inside, Window"
                />
              </div>

              <div>
                <label className="label">Position Notes</label>
                <textarea
                  className="input"
                  value={tableForm.position_notes}
                  onChange={(e) => setTableForm({ ...tableForm, position_notes: e.target.value })}
                  placeholder="Additional notes about table location"
                  rows="3"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={tableForm.is_active}
                  onChange={(e) => setTableForm({ ...tableForm, is_active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Table is active
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTableModal(false)
                  setEditingTable(null)
                  resetTableForm()
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={editingTable ? handleUpdateTable : handleCreateTable}
                className="btn btn-primary flex-1"
                disabled={!tableForm.table_number || tableForm.min_seats > tableForm.max_seats}
              >
                {editingTable ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Modal */}
      {showReservationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] flex flex-col relative">
            {/* Header with close button */}
            <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-200">
              <button
                onClick={() => {
                  setShowReservationModal(false)
                  resetReservationForm()
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
                aria-label="Close"
              >
                ×
              </button>
              <h2 className="text-xl font-bold text-gray-900 pr-8">New Reservation</h2>
            </div>
            
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <div className="space-y-4">
                <div>
                  <label className="label">Customer Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={reservationForm.customer_name}
                    onChange={(e) => setReservationForm({ ...reservationForm, customer_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Customer Phone *</label>
                  <input
                    type="tel"
                    className="input"
                    value={reservationForm.customer_phone_number}
                    onChange={(e) => setReservationForm({ ...reservationForm, customer_phone_number: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={reservationForm.reservation_date}
                      onChange={(e) => setReservationForm({ ...reservationForm, reservation_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Time *</label>
                    <input
                      type="time"
                      className="input"
                      value={reservationForm.reservation_time}
                      onChange={(e) => setReservationForm({ ...reservationForm, reservation_time: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Number of Guests</label>
                  <input
                    type="number"
                    className="input"
                    value={reservationForm.number_of_guests}
                    onChange={(e) => setReservationForm({ ...reservationForm, number_of_guests: parseInt(e.target.value) || '' })}
                    min="1"
                  />
                </div>

                <div>
                  <label className="label">Table (Optional)</label>
                  <select
                    className="input"
                    value={reservationForm.table_id}
                    onChange={(e) => setReservationForm({ ...reservationForm, table_id: e.target.value })}
                  >
                    <option value="">Auto-assign</option>
                    {tables.filter(t => t.is_active).map(table => (
                      <option key={table.id} value={table.id}>
                        Table {table.table_number} ({table.min_seats}-{table.max_seats} seats)
                        {table.position_label && ` - ${table.position_label}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    value={reservationForm.notes}
                    onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })}
                    rows="3"
                  />
                </div>
              </div>
            </div>

            {/* Footer with buttons */}
            <div className="flex-shrink-0 p-6 pt-4 border-t border-gray-200">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReservationModal(false)
                    resetReservationForm()
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateReservation}
                  className="btn btn-primary flex-1"
                  disabled={!reservationForm.customer_name || !reservationForm.customer_phone_number || !reservationForm.reservation_date || !reservationForm.reservation_time}
                >
                  Create Reservation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Details Modal */}
      {selectedReservation && reservationDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-200">
              <button
                onClick={() => {
                  setSelectedReservation(null)
                  setReservationDetails(null)
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
              >
                ×
              </button>
              <h2 className="text-xl font-bold text-gray-900 pr-8">Reservation Details</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Customer Name</p>
                    <p className="font-semibold">{reservationDetails.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-semibold font-mono">{reservationDetails.customer_phone_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-semibold">{format(new Date(reservationDetails.reservation_date), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Time</p>
                    <p className="font-semibold">{reservationDetails.reservation_time}</p>
                  </div>
                  {reservationDetails.number_of_guests && (
                    <div>
                      <p className="text-sm text-gray-600">Guests</p>
                      <p className="font-semibold">{reservationDetails.number_of_guests}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      reservationDetails.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                      reservationDetails.status === 'completed' ? 'bg-green-100 text-green-800' :
                      reservationDetails.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {reservationDetails.status}
                    </span>
                  </div>
                </div>
                
                {reservationDetails.notes && (
                  <div>
                    <p className="text-sm text-gray-600">Notes</p>
                    <p className="text-gray-900">{reservationDetails.notes}</p>
                  </div>
                )}

                {/* Reservation Items */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Pre-ordered Items</h3>
                    {reservationDetails.status === 'confirmed' && (
                      <button
                        onClick={() => setShowAddItemModal(true)}
                        className="btn btn-primary text-sm flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Item
                      </button>
                    )}
                  </div>
                  
                  {reservationDetails.items && reservationDetails.items.length > 0 ? (
                    <div className="space-y-2">
                      {reservationDetails.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{item.quantity}x {item.name_at_time}</p>
                            {item.notes && <p className="text-sm text-gray-600">{item.notes}</p>}
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-semibold">${(parseFloat(item.price_at_time) * item.quantity).toFixed(2)}</p>
                            {reservationDetails.status === 'confirmed' && (
                              <button
                                onClick={() => handleRemoveItemFromReservation(item.item_id)}
                                className="text-red-600 hover:text-red-800"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t font-semibold">
                        <span>Total:</span>
                        <span>${reservationDetails.items.reduce((sum, item) => sum + (parseFloat(item.price_at_time) * item.quantity), 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No items added yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Item to Reservation</h2>
            
            <div className="space-y-4">
              <div>
                <label className="label">Item *</label>
                <select
                  className="input"
                  value={itemForm.itemId}
                  onChange={(e) => setItemForm({ ...itemForm, itemId: e.target.value })}
                  required
                >
                  <option value="">Select an item</option>
                  {items.filter(i => i.availability === 'available' || i.availability_status === 'available').map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} - ${item.price}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Quantity *</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  className="input"
                  rows="3"
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  placeholder="Special instructions or modifications"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddItemModal(false)
                  setItemForm({ itemId: '', quantity: 1, notes: '' })
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItemToReservation}
                className="btn btn-primary flex-1"
                disabled={!itemForm.itemId}
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
