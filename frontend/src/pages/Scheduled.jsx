import { useEffect, useState } from 'react'
import axios from 'axios'
import { Calendar as CalendarIcon, Clock, Users, MapPin, Phone, Plus, Edit, Trash2, CheckCircle } from 'lucide-react'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Localizer for react-big-calendar with moment
const localizer = momentLocalizer(moment)

export default function Scheduled() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [scheduledOrders, setScheduledOrders] = useState([])
  const [tables, setTables] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState(Views.MONTH)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDayModal, setShowDayModal] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [dayReservations, setDayReservations] = useState([])
  const [dayOrders, setDayOrders] = useState([])
  const [sortBy, setSortBy] = useState('time') // 'time' or 'income'
  const [newEventType, setNewEventType] = useState('reservation')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhoneNumber: '',
    reservationDate: '',
    reservationTime: '',
    numberOfGuests: '',
    tableId: '',
    itemId: '',
    notes: ''
  })

  const businessType = user?.business_type || 'f & b'
  const isFoodAndBeverage = businessType === 'f & b'

  useEffect(() => {
    fetchScheduledData()
  }, [currentDate, currentView])

  const fetchScheduledData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      // Calculate date range based on view
      let startDate, endDate
      if (currentView === Views.MONTH) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        startDate = format(monthStart, 'yyyy-MM-dd')
        endDate = format(monthEnd, 'yyyy-MM-dd')
      } else if (currentView === Views.WEEK) {
        const weekStart = moment(currentDate).startOf('week').toDate()
        const weekEnd = moment(currentDate).endOf('week').toDate()
        startDate = format(weekStart, 'yyyy-MM-dd')
        endDate = format(weekEnd, 'yyyy-MM-dd')
      } else {
        startDate = format(currentDate, 'yyyy-MM-dd')
        endDate = startDate
      }

      // Fetch reservations
      const reservationsRes = await axios.get(`${API_URL}/api/reservations`, {
        params: { startDate, endDate },
        headers
      })
      setReservations(reservationsRes.data.data.reservations || [])

      // Fetch scheduled orders - need to fetch all accepted orders and filter by scheduled_for
      const ordersRes = await axios.get(`${API_URL}/api/orders`, {
        params: { 
          status: 'accepted'
        },
        headers
      })
      // Filter orders by scheduled_for date range
      const allOrders = ordersRes.data.data.orders || []
      const filteredOrders = allOrders.filter(order => {
        if (!order.scheduled_for) return false
        const scheduledDate = format(new Date(order.scheduled_for), 'yyyy-MM-dd')
        return scheduledDate >= startDate && scheduledDate <= endDate
      })
      setScheduledOrders(filteredOrders)

      // Fetch tables for F&B businesses
      if (isFoodAndBeverage) {
        const tablesRes = await axios.get(`${API_URL}/api/tables`, { headers })
        setTables(tablesRes.data.data.tables || [])
      }
      
      // Fetch items for all business types (for item selection in reservations)
      const itemsRes = await axios.get(`${API_URL}/api/items`, { headers })
      setItems(itemsRes.data.data.items || [])
    } catch (error) {
      console.error('Error fetching scheduled data:', error)
      alert('Failed to fetch scheduled data')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to check if an item is available at a specific date/time
  const isItemAvailableAtDateTime = (item, date, time) => {
    // Check basic availability status
    if (item.availability !== 'available') {
      return false
    }

    // Parse date to get day of week
    const selectedDate = new Date(date)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayOfWeek = dayNames[selectedDate.getDay()]

    // Check days_available constraint
    let daysAvailable = item.days_available
    if (typeof daysAvailable === 'string') {
      try {
        daysAvailable = JSON.parse(daysAvailable)
      } catch (e) {
        daysAvailable = null
      }
    }
    if (daysAvailable && Array.isArray(daysAvailable) && daysAvailable.length > 0) {
      if (!daysAvailable.includes(dayOfWeek)) {
        return false
      }
    }

    // Check time range constraint (available_from and available_to)
    if (item.available_from && item.available_to) {
      const selectedTime = time.substring(0, 5) // HH:MM format
      const availableFrom = item.available_from.substring(0, 5)
      const availableTo = item.available_to.substring(0, 5)
      
      // Compare times as strings (HH:MM format allows this)
      if (selectedTime < availableFrom || selectedTime > availableTo) {
        return false
      }
    }

    // Check for conflicting reservations
    const isReusable = item.is_reusable !== undefined ? item.is_reusable : true // Default to true if not set
    
    // Get item duration (default to 60 minutes if not specified)
    const durationMinutes = item.duration_minutes || 60
    
    // Calculate reservation end time
    const [selectedHour, selectedMinute] = time.split(':').map(Number)
    const selectedDateTime = new Date(date)
    selectedDateTime.setHours(selectedHour, selectedMinute, 0, 0)
    const endDateTime = new Date(selectedDateTime.getTime() + durationMinutes * 60 * 1000)

    // Get current date/time for checking if reusable reservations have ended
    const now = new Date()

    // Check if any existing reservation for this item overlaps
    const conflictingReservation = reservations.find(reservation => {
      // Only check reservations for the same item
      if (reservation.item_id !== item.id) {
        return false
      }

      // Only check reservations on the same date
      if (reservation.reservation_date !== date) {
        return false
      }

      // Only check confirmed reservations (ignore cancelled)
      if (reservation.status === 'cancelled') {
        return false
      }

      // For reusable items, only count active reservations (not completed and not yet expired)
      if (isReusable) {
        // Ignore completed reservations for reusable items
        if (reservation.status === 'completed') {
          return false
        }

        // Check if reservation has ended (for reusable items, expired reservations don't count)
        const [resHour, resMinute] = reservation.reservation_time.split(':').map(Number)
        const resDate = new Date(reservation.reservation_date)
        resDate.setHours(resHour, resMinute, 0, 0)
        
        const resDurationMinutes = item.duration_minutes || 60
        const resEndDateTime = new Date(resDate.getTime() + resDurationMinutes * 60 * 1000)
        
        // If reservation has already ended, don't count it (item is available again)
        if (resEndDateTime < now) {
          return false
        }
      } else {
        // For consumable items, count all confirmed reservations (they permanently consume the item)
        // Ignore cancelled, but completed still counts (item was consumed)
        if (reservation.status === 'cancelled') {
          return false
        }
      }

      // Get reservation start and end times
      const [resHour, resMinute] = reservation.reservation_time.split(':').map(Number)
      const resDateTime = new Date(date)
      resDateTime.setHours(resHour, resMinute, 0, 0)
      
      // Get item duration for the existing reservation (default to 60 minutes)
      const resDurationMinutes = item.duration_minutes || 60
      const resEndDateTime = new Date(resDateTime.getTime() + resDurationMinutes * 60 * 1000)

      // Check for overlap: [selectedDateTime, endDateTime] overlaps with [resDateTime, resEndDateTime]
      // Two intervals overlap if: selectedDateTime < resEndDateTime && endDateTime > resDateTime
      return selectedDateTime < resEndDateTime && endDateTime > resDateTime
    })

    if (conflictingReservation) {
      return false
    }

    return true
  }

  // Get available items for the selected date/time
  const getAvailableItems = () => {
    if (!formData.reservationDate || !formData.reservationTime) {
      // If no date/time selected, return all available items
      return items.filter(item => item.availability === 'available')
    }
    
    return items.filter(item => isItemAvailableAtDateTime(item, formData.reservationDate, formData.reservationTime))
  }

  // Transform data into calendar events
  const getCalendarEvents = () => {
    const events = []

    // Add reservations (blue)
    reservations.forEach(reservation => {
      const dateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`)
      const table = reservation.table_id ? tables.find(t => t.id === reservation.table_id) : null
      const tableInfo = table ? ` - Table ${table.number}` : ''
      events.push({
        id: reservation.id,
        title: `${reservation.customer_name}${tableInfo}`,
        start: dateTime,
        end: new Date(dateTime.getTime() + 60 * 60 * 1000), // 1 hour duration
        resource: {
          type: 'reservation',
          ...reservation
        },
        color: '#3b82f6' // blue
      })
    })

    // Add scheduled orders (orange)
    scheduledOrders.forEach(order => {
      if (order.scheduled_for) {
        const dateTime = new Date(order.scheduled_for)
        events.push({
          id: order.id,
          title: `Order: ${order.customer_name || order.customer_phone_number} - $${order.total}`,
          start: dateTime,
          end: new Date(dateTime.getTime() + 30 * 60 * 1000), // 30 min duration
          resource: {
            type: 'order',
            ...order
          },
          color: '#f97316' // orange
        })
      }
    })

    return events
  }

  const handleSelectSlot = async ({ start }) => {
    const selectedDate = format(start, 'yyyy-MM-dd')
    setSelectedDay(selectedDate)
    
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      // Fetch reservations for the selected day
      const reservationsRes = await axios.get(`${API_URL}/api/reservations`, {
        params: { reservationDate: selectedDate },
        headers
      })
      
      // Fetch scheduled orders for the selected day
      const ordersRes = await axios.get(`${API_URL}/api/orders`, {
        params: { status: 'accepted' },
        headers
      })
      
      const allOrders = ordersRes.data.data.orders || []
      const filteredOrders = allOrders.filter(order => {
        if (!order.scheduled_for) return false
        const scheduledDate = format(new Date(order.scheduled_for), 'yyyy-MM-dd')
        return scheduledDate === selectedDate
      })
      
      setDayReservations(reservationsRes.data.data.reservations || [])
      setDayOrders(filteredOrders)
      setShowDayModal(true)
    } catch (error) {
      console.error('Error fetching day data:', error)
      alert('Failed to fetch reservations for this day')
    }
  }

  const handleSelectEvent = (event) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleCreateReservation = async () => {
    try {
      const token = localStorage.getItem('token')
      
      // Prepare request data - API gets businessUserId from authentication
      const requestData = {
        customerPhoneNumber: formData.customerPhoneNumber.trim(),
        customerName: formData.customerName.trim(),
        reservationDate: formData.reservationDate,
        reservationTime: formData.reservationTime,
        status: 'confirmed'
      }
      
      // Add optional fields only if they have values
      if (formData.tableId) {
        requestData.tableId = formData.tableId
      }
      if (formData.itemId) {
        requestData.itemId = formData.itemId
      }
      if (formData.numberOfGuests && formData.numberOfGuests.trim()) {
        requestData.numberOfGuests = parseInt(formData.numberOfGuests)
      }
      if (formData.notes && formData.notes.trim()) {
        requestData.notes = formData.notes.trim()
      }
      
      await axios.post(`${API_URL}/api/reservations`, requestData, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setShowAddModal(false)
      resetForm()
      fetchScheduledData()
      // Refresh day modal if it's open
      if (showDayModal && selectedDay) {
        const token = localStorage.getItem('token')
        const headers = { Authorization: `Bearer ${token}` }
        const reservationsRes = await axios.get(`${API_URL}/api/reservations`, {
          params: { reservationDate: selectedDay },
          headers
        })
        setDayReservations(reservationsRes.data.data.reservations || [])
      }
      alert('Reservation created successfully')
    } catch (error) {
      console.error('Error creating reservation:', error)
      console.error('Error response:', error.response?.data)
      const errorMessage = error.response?.data?.error?.message || 'Failed to create reservation'
      const errorDetails = error.response?.data?.error?.details
      if (errorDetails && Array.isArray(errorDetails)) {
        const details = errorDetails.map(e => `${e.path || e.param}: ${e.msg || e.message}`).join('\n')
        alert(`${errorMessage}\n\nDetails:\n${details}`)
      } else {
        alert(errorMessage)
      }
    }
  }

  const handleCreateScheduledOrder = async () => {
    // Note: This would need order creation endpoint with scheduled_for
    // For now, show a placeholder
    alert('Scheduled order creation will be implemented with order creation flow')
  }

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhoneNumber: '',
      reservationDate: '',
      reservationTime: '',
      numberOfGuests: '',
      tableId: '',
      itemId: '',
      notes: ''
    })
    setSelectedSlot(null)
    setNewEventType('reservation')
  }

  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: event.color || '#3b82f6',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    }
  }

  // Add indicator to days that have events
  const dayPropGetter = (date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const hasEvents = calendarEvents.some(event => {
        // Validate event.start exists and is a valid date
        if (!event.start) return false
        
        try {
          const eventDate = new Date(event.start)
          if (isNaN(eventDate.getTime())) return false
          
          const eventDateStr = format(eventDate, 'yyyy-MM-dd')
          return eventDateStr === dateStr
        } catch (e) {
          return false
        }
      })
      
      if (hasEvents) {
        return {
          className: 'has-events',
          style: {
            position: 'relative'
          }
        }
      }
    } catch (error) {
      console.error('Error in dayPropGetter:', error)
    }
    return {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const calendarEvents = getCalendarEvents()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scheduled</h1>
          <p className="text-gray-600 mt-2">View and manage reservations and scheduled orders</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentView(Views.MONTH)}
              className={`px-3 py-1 rounded ${currentView === Views.MONTH ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Month
            </button>
            <button
              onClick={() => setCurrentView(Views.WEEK)}
              className={`px-3 py-1 rounded ${currentView === Views.WEEK ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Week
            </button>
            <button
              onClick={() => setCurrentView(Views.DAY)}
              className={`px-3 py-1 rounded ${currentView === Views.DAY ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Day
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="btn btn-secondary"
          >
            Today
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span>Reservations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span>Scheduled Orders</span>
          </div>
          {isFoodAndBeverage && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span>Table Bookings</span>
            </div>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="card p-4">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          view={currentView}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayPropGetter}
          popup
        />
      </div>

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowEventModal(false)
                setSelectedEvent(null)
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pr-8">
              {selectedEvent.resource.type === 'reservation' ? 'Reservation Details' : 'Order Details'}
            </h2>
            
            {selectedEvent.resource.type === 'reservation' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">Customer Name</label>
                  <p className="font-medium">{selectedEvent.resource.customer_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Phone Number</label>
                  <p className="font-mono">{selectedEvent.resource.customer_phone_number}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Date & Time</label>
                  <p>{format(selectedEvent.start, 'PPP p')}</p>
                </div>
                {selectedEvent.resource.number_of_guests && (
                  <div>
                    <label className="text-sm text-gray-600">Number of Guests</label>
                    <p>{selectedEvent.resource.number_of_guests}</p>
                  </div>
                )}
                {selectedEvent.resource.table_id && (() => {
                  const table = tables.find(t => t.id === selectedEvent.resource.table_id)
                  return table ? (
                    <div>
                      <label className="text-sm text-gray-600">Table</label>
                      <p>Table {table.number} ({table.seats} seats)</p>
                    </div>
                  ) : null
                })()}
                {selectedEvent.resource.notes && (
                  <div>
                    <label className="text-sm text-gray-600">Notes</label>
                    <p>{selectedEvent.resource.notes}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-600">Status</label>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedEvent.resource.status === 'confirmed'
                      ? 'bg-blue-100 text-blue-800'
                      : selectedEvent.resource.status === 'completed'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedEvent.resource.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">Customer</label>
                  <p className="font-medium">{selectedEvent.resource.customer_name || selectedEvent.resource.customer_phone_number}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Scheduled Time</label>
                  <p>{format(selectedEvent.start, 'PPP p')}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Total</label>
                  <p className="font-medium">${selectedEvent.resource.total}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Status</label>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {selectedEvent.resource.status}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEventModal(false)
                  setSelectedEvent(null)
                }}
                className="flex-1 btn btn-secondary"
              >
                Close
              </button>
              {selectedEvent.resource.type === 'order' && (
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token')
                      await axios.put(
                        `${API_URL}/api/orders/${selectedEvent.resource.id}/status`,
                        { status: 'completed' },
                        { headers: { Authorization: `Bearer ${token}` } }
                      )
                      setShowEventModal(false)
                      fetchScheduledData()
                      alert('Order marked as completed')
                    } catch (error) {
                      alert('Failed to update order')
                    }
                  }}
                  className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  <span>Mark Completed</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Day View Modal */}
      {showDayModal && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 h-[300px] flex flex-col relative">
            <button
              onClick={() => {
                setShowDayModal(false)
                setSelectedDay(null)
                setDayReservations([])
                setDayOrders([])
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
            >
              ×
            </button>
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between mb-6 pr-8">
              <h2 className="text-2xl font-bold text-gray-900">
                Reservations for {format(new Date(selectedDay + 'T00:00:00'), 'PPP')}
              </h2>
            </div>

            {/* Sort Options and Add Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input text-sm"
                >
                  <option value="time">Time</option>
                  <option value="income">Income (Orders)</option>
                </select>
              </div>
              <button
                onClick={() => {
                  setSelectedSlot(new Date(selectedDay + 'T12:00:00'))
                  setFormData({
                    customerName: '',
                    customerPhoneNumber: '',
                    reservationDate: selectedDay,
                    reservationTime: '12:00',
                    numberOfGuests: '',
                    tableId: '',
                    itemId: '',
                    notes: ''
                  })
                  setShowAddModal(true)
                }}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus size={16} />
                <span>Add Reservation</span>
              </button>
              </div>
            </div>

            {/* Reservations and Orders List */}
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {sortBy === 'time' && (() => {
                const allItems = [
                  ...dayReservations.map(r => ({
                    type: 'reservation',
                    id: r.id,
                    customer_name: r.customer_name,
                    customer_phone_number: r.customer_phone_number,
                    time: r.reservation_time,
                    date: r.reservation_date,
                    number_of_guests: r.number_of_guests,
                    table_id: r.table_id,
                    notes: r.notes,
                    status: r.status,
                    income: null
                  })),
                  ...dayOrders.map(o => ({
                    type: 'order',
                    id: o.id,
                    customer_name: o.customer_name,
                    customer_phone_number: o.customer_phone_number,
                    time: format(new Date(o.scheduled_for), 'HH:mm'),
                    date: format(new Date(o.scheduled_for), 'yyyy-MM-dd'),
                    total: o.total,
                    status: o.status,
                    income: parseFloat(o.total || 0)
                  }))
                ].sort((a, b) => a.time.localeCompare(b.time))

                if (allItems.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <p>No reservations or orders for this day</p>
                    </div>
                  )
                }

                return allItems.map((item) => {
                  const reservation = item.type === 'reservation' ? dayReservations.find(r => r.id === item.id) : null
                  const order = item.type === 'order' ? dayOrders.find(o => o.id === item.id) : null
                  const table = reservation && tables.find(t => t.id === reservation.table_id)
                  
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`p-4 rounded-lg border-2 ${
                        item.type === 'reservation' ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'
                      } hover:shadow-md transition-shadow cursor-pointer`}
                      onClick={() => {
                        if (item.type === 'reservation' && reservation) {
                          const dateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`)
                          setSelectedEvent({
                            id: reservation.id,
                            start: dateTime,
                            resource: { type: 'reservation', ...reservation },
                            color: '#3b82f6'
                          })
                          setShowEventModal(true)
                        } else if (item.type === 'order' && order) {
                          setSelectedEvent({
                            id: order.id,
                            start: new Date(order.scheduled_for),
                            resource: { type: 'order', ...order },
                            color: '#f97316'
                          })
                          setShowEventModal(true)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.type === 'reservation' ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'
                            }`}>
                              {item.type === 'reservation' ? 'Reservation' : 'Order'}
                            </span>
                            <span className="font-mono text-sm text-gray-600">{item.time}</span>
                            <span className="font-semibold text-gray-900">{item.customer_name || item.customer_phone_number}</span>
                            {item.income !== null && (
                              <span className="font-medium text-green-600">${item.income.toFixed(2)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="font-mono">{item.customer_phone_number}</span>
                            {item.type === 'reservation' && item.number_of_guests && (
                              <span>{item.number_of_guests} guests</span>
                            )}
                            {table && (
                              <span>Table {table.number}</span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              item.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-sm text-gray-500 mt-2">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}

              {sortBy === 'income' && (() => {
                const allItems = dayOrders
                  .map(o => ({
                    type: 'order',
                    id: o.id,
                    customer_name: o.customer_name,
                    customer_phone_number: o.customer_phone_number,
                    time: format(new Date(o.scheduled_for), 'HH:mm'),
                    date: format(new Date(o.scheduled_for), 'yyyy-MM-dd'),
                    total: o.total,
                    status: o.status,
                    income: parseFloat(o.total || 0)
                  }))
                  .sort((a, b) => b.income - a.income)

                if (allItems.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <p>No orders for this day</p>
                    </div>
                  )
                }

                return allItems.map((item) => {
                  const order = dayOrders.find(o => o.id === item.id)
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="p-4 rounded-lg border-2 border-orange-200 bg-orange-50 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        if (order) {
                          setSelectedEvent({
                            id: order.id,
                            start: new Date(order.scheduled_for),
                            resource: { type: 'order', ...order },
                            color: '#f97316'
                          })
                          setShowEventModal(true)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-200 text-orange-800">
                              Order
                            </span>
                            <span className="font-mono text-sm text-gray-600">{item.time}</span>
                            <span className="font-semibold text-gray-900">{item.customer_name || item.customer_phone_number}</span>
                            <span className="font-medium text-green-600">${item.income.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="font-mono">{item.customer_phone_number}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              item.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] flex flex-col relative">
            <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-200">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
              >
                ×
              </button>
              <h2 className="text-xl font-bold text-gray-900 pr-8">Create {newEventType === 'reservation' ? 'Reservation' : 'Scheduled Order'}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <div className="mb-4">
                <label className="label">Event Type</label>
                <select
                  className="input"
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                >
                  <option value="reservation">Reservation</option>
                  <option value="order">Scheduled Order</option>
                </select>
              </div>

              {newEventType === 'reservation' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleCreateReservation(); }} className="space-y-4">
                <div>
                  <label className="label">Customer Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Phone Number *</label>
                  <input
                    type="tel"
                    className="input"
                    value={formData.customerPhoneNumber}
                    onChange={(e) => setFormData({ ...formData, customerPhoneNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.reservationDate}
                      onChange={(e) => setFormData({ ...formData, reservationDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Time *</label>
                    <input
                      type="time"
                      className="input"
                      value={formData.reservationTime}
                      onChange={(e) => setFormData({ ...formData, reservationTime: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {isFoodAndBeverage && (
                  <div>
                    <label className="label">Table</label>
                    <select
                      className="input"
                      value={formData.tableId}
                      onChange={(e) => setFormData({ ...formData, tableId: e.target.value })}
                    >
                      <option value="">Select table (optional)</option>
                      {tables.filter(t => !t.reserved).map(table => (
                        <option key={table.id} value={table.id}>
                          Table {table.number} ({table.seats} seats)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!isFoodAndBeverage && (
                  <div>
                    <label className="label">Item/Service</label>
                    <select
                      className="input"
                      value={formData.itemId}
                      onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                    >
                      <option value="">Select item/service (optional)</option>
                      {getAvailableItems().map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.price ? `($${item.price})` : ''}
                        </option>
                      ))}
                    </select>
                    {formData.reservationDate && formData.reservationTime && getAvailableItems().length === 0 && (
                      <p className="text-sm text-amber-600 mt-1">No items available at the selected date/time</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="label">Number of Guests</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={formData.numberOfGuests}
                    onChange={(e) => setFormData({ ...formData, numberOfGuests: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                </form>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Scheduled order creation will be integrated with the order creation flow.</p>
                </div>
              )}
            </div>
            
            <div className="flex-shrink-0 p-6 pt-4 border-t border-gray-200">
              {newEventType === 'reservation' ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                    className="flex-1 btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleCreateReservation();
                    }}
                    className="flex-1 btn btn-primary"
                  >
                    Create Reservation
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="w-full btn btn-secondary"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
