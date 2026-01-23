import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { UtensilsCrossed, Plus, Edit, Trash2, Power, PowerOff, Calendar, Users, MapPin, Phone, CheckCircle, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function TableReservations() {
  const { user } = useAuth()
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('tables') // 'tables' or 'reservations'
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showTableModal, setShowTableModal] = useState(false)
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [selectedReservation, setSelectedReservation] = useState(null)
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
  }, [selectedDate, activeTab])

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

      // Fetch reservations for selected date
      if (activeTab === 'reservations') {
        const reservationsRes = await axios.get(`${API_URL}/api/reservations`, {
          params: { 
            startDate: selectedDate,
            endDate: selectedDate,
            type: 'table'
          },
          headers
        })
        setReservations(reservationsRes.data.data.reservations || [])
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
      await axios.post(`${API_URL}/api/reservations`, reservationForm, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowReservationModal(false)
      resetReservationForm()
      fetchData()
      alert('Reservation created successfully')
    } catch (error) {
      console.error('Error creating reservation:', error)
      alert(error.response?.data?.error?.message || 'Failed to create reservation')
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
            onClick={() => setActiveTab('reservations')}
            className={`pb-4 px-4 font-medium transition-colors ${
              activeTab === 'reservations'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Reservations
          </button>
        </div>
      </div>

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
            {reservations.map((reservation) => {
              const table = tables.find(t => t.id === reservation.table_id)
              
              return (
                <div
                  key={reservation.id}
                  className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
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
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {reservation.status}
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
                        {table && (
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span>Table {table.table_number}</span>
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

          {reservations.length === 0 && (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No reservations for this date</p>
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
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">New Reservation</h2>
            
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

            <div className="flex gap-3 mt-6">
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
      )}
    </div>
  )
}
