'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Events() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [filters, setFilters] = useState({
    endpoint: '',
    statusGroup: '',
    page: 1,
  })
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.tenantId) {
      fetchEvents()
    }
  }, [session, filters])

  const fetchEvents = async () => {
    if (!session?.user?.tenantId) return

    setLoading(true)
    const params = new URLSearchParams({
      tenantId: session.user.tenantId,
      page: filters.page.toString(),
      pageSize: '20',
    })

    if (filters.endpoint) params.append('endpoint', filters.endpoint)
    if (filters.statusGroup) params.append('statusGroup', filters.statusGroup)

    try {
      const response = await fetch(`/api/events?${params}`)
      const data = await response.json()
      setEvents(data.events || [])
      setPagination(data.pagination)
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <a href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Dashboard
              </a>
              <h1 className="text-xl font-bold">API Events</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Filter by endpoint"
              value={filters.endpoint}
              onChange={(e) => setFilters({ ...filters, endpoint: e.target.value, page: 1 })}
              className="px-4 py-2 border rounded-lg"
            />
            <select
              value={filters.statusGroup}
              onChange={(e) => setFilters({ ...filters, statusGroup: e.target.value, page: 1 })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">All Status Codes</option>
              <option value="2xx">2xx (Success)</option>
              <option value="4xx">4xx (Client Error)</option>
              <option value="5xx">5xx (Server Error)</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Latency
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event) => (
                <tr 
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{event.endpoint}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{event.method}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        event.statusCode < 300
                          ? 'bg-green-100 text-green-800'
                          : event.statusCode < 500
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {event.statusCode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{event.latencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page === 1}
                className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= pagination.totalPages}
                className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Event Details</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Request ID</label>
                  <p className="text-sm font-mono">{selectedEvent.requestId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <p className="text-sm">{new Date(selectedEvent.timestamp).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Endpoint</label>
                  <p className="text-sm font-mono">{selectedEvent.endpoint}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Method</label>
                  <p className="text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                      {selectedEvent.method}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status Code</label>
                  <p className="text-sm">
                    <span
                      className={`px-2 py-1 text-xs rounded font-semibold ${
                        selectedEvent.statusCode < 300
                          ? 'bg-green-100 text-green-800'
                          : selectedEvent.statusCode < 500
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {selectedEvent.statusCode}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Latency</label>
                  <p className="text-sm font-semibold">{selectedEvent.latencyMs}ms</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Tenant ID</label>
                <p className="text-sm font-mono">{selectedEvent.tenantId}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Event ID</label>
                <p className="text-sm font-mono text-gray-600">{selectedEvent.id}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
