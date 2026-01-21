import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { Calendar as CalendarIcon, Clock, User, MapPin } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Calendar() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState('month') // 'month', 'week', 'day'

  useEffect(() => {
    fetchCalendarEvents()
  }, [selectedDate, view])

  const fetchCalendarEvents = async () => {
    try {
      const token = localStorage.getItem('token')
      
      // Calculate date range based on view
      const from = new Date(selectedDate)
      const to = new Date(selectedDate)
      
      if (view === 'month') {
        from.setDate(1)
        to.setMonth(to.getMonth() + 1)
        to.setDate(0)
      } else if (view === 'week') {
        const day = from.getDay()
        from.setDate(from.getDate() - day)
        to.setDate(from.getDate() + 6)
      } else {
        // day view
        to.setDate(to.getDate() + 1)
      }
      
      const fromStr = from.toISOString().split('T')[0]
      const toStr = to.toISOString().split('T')[0]
      
      const response = await axios.get(
        `${API_URL}/api/calendar?from=${fromStr}&to=${toStr}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setEvents(response.data.data.events || [])
    } catch (error) {
      console.error('Error fetching calendar events:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEventColor = (type) => {
    return type === 'scheduled_request'
      ? 'bg-blue-100 border-blue-500 text-blue-800'
      : 'bg-purple-100 border-purple-500 text-purple-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8" />
            Calendar
          </h1>
          <p className="text-gray-600 mt-2">View scheduled requests and reservations</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setView('day')}
            className={`px-4 py-2 rounded-md ${
              view === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-md ${
              view === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-4 py-2 rounded-md ${
              view === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className={`border-l-4 rounded p-4 ${getEventColor(event.type)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{event.title}</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatDate(event.startAt)}</span>
                    </div>
                    {event.customerPhoneNumber && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{event.customerPhoneNumber}</span>
                      </div>
                    )}
                    {event.type === 'scheduled_request' && event.total && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Total: ${event.total.toFixed(2)}</span>
                      </div>
                    )}
                    {event.type === 'reservation' && event.numberOfGuests && (
                      <div className="flex items-center gap-2">
                        <span>Guests: {event.numberOfGuests}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs font-medium uppercase">
                  {event.type === 'scheduled_request' ? 'Request' : 'Reservation'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {events.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No events scheduled for this period</p>
          </div>
        )}
      </div>
    </div>
  )
}
