import { useEffect, useState } from 'react'
import axios from 'axios'
import { Search, MessageSquare, User, Clock, Lock, Unlock, UserPlus, Eye, Filter, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ChatSessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionActions, setSessionActions] = useState([])
  const [employees, setEmployees] = useState([])

  useEffect(() => {
    fetchSessions()
    fetchEmployees()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000)
    return () => clearInterval(interval)
  }, [statusFilter])

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token')
      // TODO: Implement employee fetching endpoint
      setEmployees([])
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/chat-sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSessions(response.data.data || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionDetails = async (sessionId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/chat-sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSelectedSession(response.data.data)
      setSessionActions(response.data.data.actions || [])
    } catch (error) {
      console.error('Error fetching session details:', error)
      alert('Failed to load session details')
    }
  }

  const handleViewSession = async (session) => {
    setSelectedSession(session)
    setShowSessionModal(true)
    await fetchSessionDetails(session.id)
  }

  const handleAssignEmployee = async (sessionId, employeeId) => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/api/chat-sessions/${sessionId}/assign`,
        { employeeId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchSessions()
      if (selectedSession?.id === sessionId) {
        await fetchSessionDetails(sessionId)
      }
    } catch (error) {
      console.error('Error assigning session:', error)
      alert('Failed to assign session')
    }
  }

  const getModeColor = (mode) => {
    const colors = {
      delivery: 'bg-blue-100 text-blue-800',
      takeaway: 'bg-green-100 text-green-800',
      dine_in: 'bg-purple-100 text-purple-800',
      support: 'bg-gray-100 text-gray-800',
    }
    return colors[mode] || colors.support
  }

  const getStepLabel = (step) => {
    const labels = {
      start: 'Starting',
      intent_detected: 'Intent Detected',
      collecting_items: 'Collecting Items',
      awaiting_address: 'Awaiting Address',
      selecting_delivery_type: 'Selecting Delivery Type',
      scheduled: 'Scheduled',
      confirming: 'Confirming',
      order_confirmed: 'Order Confirmed',
      reservation_created: 'Reservation Created',
      ticket_created: 'Ticket Created',
      handover_to_employee: 'Handover to Employee',
      mode_switched: 'Mode Switched',
    }
    return labels[step] || step
  }

  const filteredSessions = sessions.filter(session => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        session.id.toLowerCase().includes(searchLower) ||
        session.customer_id?.toLowerCase().includes(searchLower) ||
        session.mode?.toLowerCase().includes(searchLower) ||
        session.step?.toLowerCase().includes(searchLower)
      )
    }
    if (statusFilter === 'locked') return session.locked
    if (statusFilter === 'assigned') return session.assigned_employee_id
    if (statusFilter === 'unassigned') return !session.assigned_employee_id && !session.locked
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading sessions...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat Sessions</h1>
          <p className="text-gray-600 mt-1">Monitor and manage active chatbot conversations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Sessions</option>
            <option value="locked">Locked</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Step</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No sessions found
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">
                        {session.id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">{session.platform}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModeColor(session.mode)}`}>
                        {session.mode?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getStepLabel(session.step)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {session.locked && <Lock className="w-4 h-4 text-red-500" />}
                        {session.assigned_employee_id && (
                          <span className="text-xs text-gray-600">Assigned</span>
                        )}
                        {!session.locked && !session.assigned_employee_id && (
                          <span className="text-xs text-green-600">Active</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(session.updated_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewSession(session)}
                        className="text-primary-600 hover:text-primary-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Detail Modal */}
      {showSessionModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Session {selectedSession.id.substring(0, 8)}...
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedSession.platform} • {selectedSession.mode}
                </p>
              </div>
              <button
                onClick={() => setShowSessionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Session Info */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Mode</div>
                  <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModeColor(selectedSession.mode)}`}>
                    {selectedSession.mode?.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Step</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">
                    {getStepLabel(selectedSession.step)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm text-gray-900 mt-1 flex items-center gap-1">
                    {selectedSession.locked ? (
                      <>
                        <Lock className="w-4 h-4 text-red-500" />
                        <span>Locked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 text-green-500" />
                        <span>Active</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Assigned To</div>
                  <div className="text-sm text-gray-900 mt-1">
                    {selectedSession.assigned_employee_id ? 'Employee' : 'Unassigned'}
                  </div>
                </div>
              </div>
            </div>

            {/* Draft Payload */}
            {selectedSession.draft_payload && (
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-900 mb-2">Draft Data</div>
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(
                    typeof selectedSession.draft_payload === 'string'
                      ? JSON.parse(selectedSession.draft_payload)
                      : selectedSession.draft_payload,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            {/* Actions Log */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="text-sm font-medium text-gray-900 mb-3">Recent Actions</div>
              <div className="space-y-2">
                {sessionActions.length === 0 ? (
                  <div className="text-sm text-gray-500">No actions logged</div>
                ) : (
                  sessionActions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-gray-50 p-3 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {action.action_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(action.created_at), 'MMM d, HH:mm:ss')}
                        </span>
                      </div>
                      {action.payload && (
                        <pre className="text-xs text-gray-600 mt-1 overflow-auto">
                          {JSON.stringify(
                            typeof action.payload === 'string'
                              ? JSON.parse(action.payload)
                              : action.payload,
                            null,
                            2
                          )}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
