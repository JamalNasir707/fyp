import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TripHubHeader from '../components/TripHubHeader'
import LandingFooter from '../components/landing/LandingFooter'
import { useApp } from '../context/AppContext'
import { fetchActivityHistoryRequest } from '../lib/session'
import '../styles/landing.css'

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.7l3 1.8" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6.5 6 7.4 20h9.2L17.5 6" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function getActivityIcon(eventType) {
  if (eventType === 'trip_deleted') return <TrashIcon />
  if (eventType === 'trip_updated' || eventType === 'trip_renamed') return <EditIcon />
  if (eventType === 'trip_created') return <PlusIcon />
  return <ClockIcon />
}

function getEventTypeLabel(eventType) {
  return String(eventType || '')
    .replace(/^trip_/, '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Activity'
}

function formatTimestamp(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Unknown time'
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const { token, openSavedTrip } = useApp()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      if (!token) {
        if (!cancelled) {
          setActivities([])
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError('')
      try {
        const response = await fetchActivityHistoryRequest(token)
        if (!cancelled) {
          setActivities(Array.isArray(response.activities) ? response.activities : [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load your activity history.')
          setActivities([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [token])

  const rows = useMemo(() => (
    activities.map((activity) => ({
      id: activity.id,
      tripId: activity.tripId,
      eventType: activity.eventType,
      typeLabel: getEventTypeLabel(activity.eventType),
      title: activity.title || 'Activity',
      description: activity.description || 'No details available.',
      timestamp: formatTimestamp(activity.createdAt),
      actionUrl: activity.actionUrl,
      icon: getActivityIcon(activity.eventType),
    }))
  ), [activities])

  function handleOpenActivity(row) {
    if (row.tripId) {
      const trip = openSavedTrip(row.tripId)
      if (trip) {
        navigate('/workspace')
        return
      }
    }

    if (row.actionUrl && row.actionUrl !== '/workspace') {
      navigate(row.actionUrl)
    }
  }

  return (
    <div className="TripHubPage TripHubPage--history">
      <TripHubHeader activePage="history" />

      <main className="TripHubMain TripHubHistoryMain">
        <section className="TripHubHistory">
          <header className="TripHubHistory__header">
            <h1>Your history</h1>
          </header>

          {error ? <div className="AdminDashboardAlert" role="alert">{error}</div> : null}

          {loading ? (
            <div className="TripHubTrips__empty">
              <p>Loading your recent activity...</p>
            </div>
          ) : !rows.length ? (
            <div className="TripHubTrips__empty">
              <p>No recent activity yet.</p>
            </div>
          ) : (
            <div className="TripHubHistoryTable" role="table" aria-label="Trip activity history">
              <div className="TripHubHistoryTable__head" role="rowgroup">
                <div className="TripHubHistoryTable__row TripHubHistoryTable__row--head" role="row">
                  <span role="columnheader">Activity</span>
                  <span role="columnheader">Type</span>
                  <span role="columnheader">Time</span>
                </div>
              </div>

              <div className="TripHubHistoryTable__body" role="rowgroup">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="TripHubHistoryTable__row TripHubHistoryTable__row--item"
                    role="row"
                    onClick={() => handleOpenActivity(row)}
                  >
                    <span role="cell" className="TripHubHistoryTable__activityCell">
                      <span className={`TripHubHistoryIcon TripHubHistoryIcon--${row.eventType}`} aria-hidden="true">
                        {row.icon}
                      </span>
                      <span className="TripHubHistoryTable__activityCopy">
                        <strong>{row.title}</strong>
                        <small>{row.description}</small>
                      </span>
                    </span>
                    <span role="cell" className="TripHubHistoryTable__typeCell">{row.typeLabel}</span>
                    <span role="cell" className="TripHubHistoryTable__timeCell">{row.timestamp}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
