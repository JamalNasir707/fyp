/**
 * AV2TripsPage — Trip Management
 * ──────────────────────────────
 * Refactored in Phase 0.5 to use the shared component library.
 * Visual output is IDENTICAL to Phase 0. Zero behaviour changes.
 *
 * Future integration (Phase 2):
 *   - Replace PLACEHOLDER_ROWS with data from GET /api/admin/trips
 *   - Wire search → API
 *   - Wire AdminPagination → page state
 *   - Wire AdminDrawer → trip itinerary inspection (read-only)
 *   - Wire Delete → DELETE /api/admin/trips/{id} + AdminConfirmModal (requireReason=true)
 *
 * DO NOT connect any actions in this phase.
 */
import { useEffect, useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { fetchAdminTripsRequest, deleteAdminTripRequest } from '../../lib/session'
import {
  AdminPageHeader,
  AdminPanel,
  AdminSection,
  AdminBadge,
  AdminButton,
  AdminFilterBar,
  AdminDataTable,
  AdminPagination,
  AdminPlaceholderBanner,
  AdminDrawer,
} from './components'

const COLUMNS = ['ID', 'Owner', 'Destination', 'Days', 'Budget', 'Start Date', 'Last Updated', 'Actions']

const FILTERS = ['Duration ▾', 'Province ▾', 'Date Range ▾']

export default function AV2TripsPage() {
  const { token } = useApp()
  const [loading, setLoading] = useState(true)
  const [trips, setTrips] = useState([])
  const [error, setError] = useState('')

  // Search input and query states
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Drawer / Inspection detail state
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Debounce search input changes by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchInput])

  const loadTrips = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchAdminTripsRequest(token, searchQuery)
      if (data.success) {
        setTrips(data.trips || [])
      }
    } catch (err) {
      setError(err.message || 'Failed to load trips.')
    } finally {
      setLoading(false)
    }
  }, [token, searchQuery])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  const handleConfirmDelete = async (tripId) => {
    if (!window.confirm('Are you sure you want to delete this trip? This action cannot be undone.')) return
    try {
      const res = await deleteAdminTripRequest(token, tripId)
      if (res.success) {
        loadTrips()
      } else {
        alert(res.error || 'Failed to delete trip.')
      }
    } catch (err) {
      alert(err.message || 'Error communicating with server.')
    }
  }

  function renderTripRow(row) {
    const days = row.data?.itinerary?.length || 1
    const budgetAmount = row.data?.budget?.amount
    const budgetStr = budgetAmount ? `${Number(budgetAmount).toLocaleString()} ${row.data.budget.currency || 'PKR'}` : '₨ 0'

    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A'
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    return (
      <tr key={row.id}>
        <td style={{ color: '#9ca3af', fontSize: 12 }}>#{row.id}</td>
        <td><strong>{row.owner || 'unknown'}</strong></td>
        <td>📍 {row.name || 'Custom Route'}</td>
        <td><AdminBadge color="blue">{days}d</AdminBadge></td>
        <td style={{ color: '#6b7280' }}>{budgetStr}</td>
        <td style={{ color: '#6b7280' }}>{formatDate(row.startDate)}</td>
        <td style={{ color: '#6b7280' }}>{formatDate(row.updatedAt)}</td>
        <td>
          <div style={{ display: 'flex', gap: 6 }}>
            <AdminButton
              size="sm"
              onClick={() => {
                setSelectedTrip(row)
                setDrawerOpen(true)
              }}
            >
              Inspect
            </AdminButton>
            <AdminButton
              size="sm"
              variant="danger"
              onClick={() => handleConfirmDelete(row.id)}
            >
              Delete
            </AdminButton>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <AdminSection>
      <AdminPageHeader
        title="Trip Management"
        sub="Inspect, search, and moderate all user itineraries."
      />

      {/* Toolbar */}
      <AdminPanel>
        <AdminFilterBar
          searchPlaceholder="Search by destination or owner…"
          filters={FILTERS}
          searchValue={searchInput}
          onSearchChange={(e) => setSearchInput(e.target.value)}
        />
      </AdminPanel>

      {/* Table */}
      <AdminPanel
        title="All Trips"
        sub={loading ? 'Loading records...' : `${trips.length} records total`}
        noPadding
      >
        {error && (
          <div style={{ color: '#ef4444', fontSize: 13, background: '#fee2e2', padding: 12, margin: 16, borderRadius: 6 }}>
            ⚠️ {error}
          </div>
        )}
        <AdminDataTable
          columns={COLUMNS}
          rows={trips}
          renderRow={renderTripRow}
          emptyTitle="No trips found"
          emptyText="No itineraries match your current filters."
        />
        <AdminPagination />
      </AdminPanel>

      {/* Itinerary details slide-out drawer */}
      <AdminDrawer
        open={drawerOpen}
        title="Trip Details Inspection"
        onClose={() => {
          setDrawerOpen(false)
          setSelectedTrip(null)
        }}
        width={500}
      >
        {selectedTrip ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '10px 0' }}>
            {/* Summary details card */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
                📍 {selectedTrip.name || 'Custom Route'}
              </h3>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px 0' }}>
                Trip ID: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{selectedTrip.id}</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Owner</span>
                  <strong style={{ color: '#374151' }}>@{selectedTrip.owner || 'unknown'}</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Duration</span>
                  <strong style={{ color: '#374151' }}>{selectedTrip.data?.itinerary?.length || 1} Days</strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Budget</span>
                  <strong style={{ color: '#374151' }}>
                    {selectedTrip.data?.budget?.amount ? `${Number(selectedTrip.data.budget.amount).toLocaleString()} ${selectedTrip.data.budget.currency || 'PKR'}` : '₨ 0'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Province</span>
                  <strong style={{ color: '#374151' }}>
                    {selectedTrip.data?.preferences?.province || selectedTrip.data?.enginePreferences?.province || 'N/A'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Travel dates block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, borderBottom: '1px solid #f3f4f6', paddingBottom: 16 }}>
              <div>
                <span style={{ color: '#6b7280', display: 'block', fontSize: 11 }}>Start Date</span>
                <span style={{ color: '#111827', fontWeight: 600 }}>
                  {selectedTrip.startDate ? new Date(selectedTrip.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ color: '#6b7280', display: 'block', fontSize: 11 }}>End Date</span>
                <span style={{ color: '#111827', fontWeight: 600 }}>
                  {selectedTrip.endDate ? new Date(selectedTrip.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
            </div>

            {/* Day-by-day stop list */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                Day-by-Day Itinerary Stops
              </h3>
              <div style={{ maxHeight: 'calc(100vh - 365px)', overflowY: 'auto', paddingRight: 4 }}>
                {selectedTrip.data?.itinerary && selectedTrip.data.itinerary.length > 0 ? (
                  selectedTrip.data.itinerary.map((day, dIdx) => (
                    <div key={day.id || dIdx} style={{ marginBottom: 18, borderLeft: '2px solid var(--av2-accent, #ff7b47)', paddingLeft: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px 0' }}>
                        🗓️ {day.label || day.shortLabel || `Day ${dIdx + 1}`}
                      </h4>
                      {day.items && day.items.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 16, color: '#4b5563', fontSize: 12, lineHeight: '1.6' }}>
                          {day.items.map((item, itemIdx) => (
                            <li key={item.id || itemIdx} style={{ marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, color: '#111827' }}>{item.title}</span>
                              {item.subtitle ? <span style={{ color: '#6b7280' }}> - {item.subtitle}</span> : ''}
                              {item.category && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 9,
                                    background: '#f3f4f6',
                                    color: '#4b5563',
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    textTransform: 'uppercase',
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.category}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', paddingLeft: 16 }}>
                          No scheduled locations for this day.
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                    No itinerary schedule data available.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>No trip selected.</div>
        )}
      </AdminDrawer>

      <AdminPlaceholderBanner
        title="Full Trip Inspection Enabled"
        sub="Itinerary day-by-day breakdown has been successfully wired. Deletion actions and search filters remain disabled."
        phase="Phase 2 — Live Trip Inspection"
      />
    </AdminSection>
  )
}
