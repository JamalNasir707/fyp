import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PlannerMapPanel from '../components/PlannerMapPanel'
import { DAY_FALLBACK_COLORS } from '../lib/sections'
import { ensureWorkspaceParityTrip } from '../lib/trips'
import TripmateWorkspacePage from './TripmateWorkspacePage'
import {
  fetchSharedTripRequest,
  fetchSharedEditTripRequest,
  getSharedTripmateTripRequest,
  updateTripmateItineraryRequest,
  copySharedEditTripRequest,
  readStoredToken,
  readStoredUser,
} from '../lib/session'

function formatDayLabel(dateStr, fallback) {
  if (!dateStr) return fallback || 'Day'
  const date = new Date(dateStr)
  if (!Number.isFinite(date.getTime())) return fallback || 'Day'
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime12h(time) {
  if (!time) return ''
  const parts = String(time).split(':')
  if (parts.length < 2) return ''
  const hours = Number.parseInt(parts[0], 10)
  const minutes = Number.parseInt(parts[1], 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return ''
  const period = hours >= 12 ? 'PM' : 'AM'
  const normalizedHours = hours % 12 === 0 ? 12 : hours % 12
  return `${normalizedHours}:${String(minutes).padStart(2, '0')} ${period}`
}

function toCoords(place) {
  const lat = Number(place?.lat)
  const lon = Number(place?.lon)
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  return null
}

function haversineKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(to.lat - from.lat)
  const dLon = toRad(to.lon - from.lon)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function TripViewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = useParams()
  const { activeTrip, user, token: authToken, updateTrip } = useApp()

  const isSharedMode = Boolean(token)
  const searchParams = new URLSearchParams(location.search)
  const tripmateTripId = searchParams.get('tripId')
  const isTripmateMode = searchParams.get('mode') === 'tripmate' && Boolean(tripmateTripId)

  if (isTripmateMode) {
    return <TripmateWorkspacePage tripId={tripmateTripId} />
  }

  const isEditSharedMode = Boolean(
    token && (token.startsWith('sh_edit_') || location.pathname.startsWith('/share/edit/'))
  )

  const [sharedTripData, setSharedTripData] = useState(null)
  // Dedicated Tripmates Read-Only State (Isolated from View Only / Can Edit)
  const [tripmateTripData, setTripmateTripData] = useState(null)
  const [tripmateOwner, setTripmateOwner] = useState(null)
  const [tripmateLoading, setTripmateLoading] = useState(false)
  const [tripmateError, setTripmateError] = useState('')
  // Dedicated Tripmates Local Editing & Save State (Isolated inside Tripmate mode)
  const [isTripmateEditMode, setIsTripmateEditMode] = useState(false)
  const [tripmateSaving, setTripmateSaving] = useState(false)
  const [tripmateSaveSuccess, setTripmateSaveSuccess] = useState('')
  const [tripmateSaveError, setTripmateSaveError] = useState('')
  // Inline Place Creation Form State (Replaces browser prompt)
  const [activeAddPlaceDay, setActiveAddPlaceDay] = useState(null)
  const [addTitle, setAddTitle] = useState('')
  const [addCategory, setAddCategory] = useState('Sightseeing')
  const [addNote, setAddNote] = useState('')
  const [sharedOwner, setSharedOwner] = useState(null)
  const [sharedPermission, setSharedPermission] = useState(isEditSharedMode ? 'edit' : 'view')
  const [loading, setLoading] = useState(isSharedMode)
  const [error, setError] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)

  const copyInProgressRef = useRef(false)
  const updateTripRef = useRef(updateTrip)
  const navigateRef = useRef(navigate)

  useEffect(() => {
    updateTripRef.current = updateTrip
    navigateRef.current = navigate
  })

  useEffect(() => {
    if (!token) return

    const effectiveToken = authToken || readStoredToken()
    const effectiveUser = user || readStoredUser()

    // If accessing an edit-share link and user is authenticated:
    // Create/retrieve User B's independent copy and navigate to /workspace
    if (isEditSharedMode && effectiveToken && effectiveUser) {
      if (copyInProgressRef.current) return
      copyInProgressRef.current = true
      setLoading(true)
      setError('')

      copySharedEditTripRequest(effectiveToken, token)
        .then((res) => {
          if (res?.success && res?.trip) {
            const rawTrip = res.trip?.data || res.trip
            const normalized = ensureWorkspaceParityTrip(rawTrip)
            if (typeof updateTripRef.current === 'function') {
              updateTripRef.current(normalized)
            }
            navigateRef.current('/workspace', { replace: true })
          } else {
            copyInProgressRef.current = false
            setError(res?.detail || res?.error || 'Shared edit trip could not be copied.')
            setLoading(false)
          }
        })
        .catch((err) => {
          copyInProgressRef.current = false
          setError(err?.message || 'Shared edit trip could not be copied or link has expired.')
          setLoading(false)
        })

      return
    }

    // Otherwise (view-only mode or unauthenticated edit link), fetch read-only preview
    let isSubscribed = true
    setLoading(true)
    setError('')
    const fetcher = isEditSharedMode ? fetchSharedEditTripRequest : fetchSharedTripRequest

    fetcher(token)
      .then((res) => {
        if (!isSubscribed) return
        if (res?.success && res?.trip) {
          const rawTrip = res.trip?.data || res.trip
          const normalized = ensureWorkspaceParityTrip(rawTrip)
          setSharedTripData(normalized)
          setSharedOwner(res.owner || null)
          setSharedPermission(res.permission || (isEditSharedMode ? 'edit' : 'view'))
          setSelectedPlaceId(normalized?.map?.selectedPlaceId || null)
        } else {
          setError(res?.detail || (isEditSharedMode ? 'Shared edit trip could not be found.' : 'Shared trip could not be found.'))
        }
      })
      .catch((err) => {
        if (!isSubscribed) return
        setError(err?.message || (isEditSharedMode ? 'Shared edit trip not found or link has expired.' : 'Shared trip not found or link has expired.'))
      })
      .finally(() => {
        if (isSubscribed) setLoading(false)
      })

    return () => {
      isSubscribed = false
    }
  }, [token, isEditSharedMode])

  // Dedicated Tripmate read-only fetch effect
  useEffect(() => {
    if (!isTripmateMode || !tripmateTripId) return

    let isMounted = true
    setTripmateLoading(true)
    setTripmateError('')

    const effectiveToken = token || readStoredToken()

    getSharedTripmateTripRequest(effectiveToken, tripmateTripId)
      .then((res) => {
        if (!isMounted) return
        if (res?.success && res?.trip) {
          const rawTrip = res.trip?.data || res.trip
          const normalized = ensureWorkspaceParityTrip(rawTrip)
          setTripmateTripData(normalized)
          setTripmateOwner(res.owner || res.trip?.owner || null)
          setSelectedPlaceId(normalized?.map?.selectedPlaceId || null)
        } else {
          setTripmateError(res?.error || res?.detail || 'Access denied. You are no longer an active Tripmate for this trip.')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setTripmateError(err?.message || err?.detail || 'Access denied. You are no longer an active Tripmate for this trip.')
      })
      .finally(() => {
        if (isMounted) setTripmateLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isTripmateMode, tripmateTripId, token])

  // Explicit Save Handler for Tripmate Itinerary
  async function handleSaveTripmateItinerary() {
    if (!isTripmateMode || !tripmateTripId || !tripmateTripData) return

    setTripmateSaving(true)
    setTripmateSaveError('')
    setTripmateSaveSuccess('')

    const effectiveToken = authToken || readStoredToken()
    const payload = {
      days: Array.isArray(tripmateTripData.days) ? tripmateTripData.days : [],
      placesPool: Array.isArray(tripmateTripData.placesPool) ? tripmateTripData.placesPool : [],
      customLists: tripmateTripData.customLists || [],
    }

    try {
      const res = await updateTripmateItineraryRequest(effectiveToken, tripmateTripId, payload)
      if (res?.success) {
        if (res.trip) {
          const rawTrip = res.trip?.data || res.trip
          const normalized = ensureWorkspaceParityTrip(rawTrip)
          setTripmateTripData(normalized)
        }
        setTripmateSaveSuccess('✓ Tripmate itinerary saved successfully')
        setTimeout(() => setTripmateSaveSuccess(''), 4000)
      } else {
        setTripmateSaveError(res?.error || res?.detail || 'Failed to save Tripmate itinerary')
      }
    } catch (err) {
      setTripmateSaveError(err?.message || 'Failed to save Tripmate itinerary')
    } finally {
      setTripmateSaving(false)
    }
  }

  // Tripmate Editing Helpers (100% Isolated to tripmateTripData)
  function handleRemovePlaceFromDay(dayIdx, placeIdx) {
    setTripmateTripData((prev) => {
      if (!prev) return prev
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      if (daysCopy[dayIdx]?.items) {
        daysCopy[dayIdx].items.splice(placeIdx, 1)
      }
      return { ...prev, days: daysCopy }
    })
  }

  function handleMovePlaceToPool(dayIdx, placeIdx) {
    setTripmateTripData((prev) => {
      if (!prev) return prev
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
      if (daysCopy[dayIdx]?.items?.[placeIdx]) {
        const [movedItem] = daysCopy[dayIdx].items.splice(placeIdx, 1)
        poolCopy.push(movedItem)
      }
      return { ...prev, days: daysCopy, placesPool: poolCopy }
    })
  }

  function handleMovePoolPlaceToDay(poolIdx, targetDayIdx) {
    setTripmateTripData((prev) => {
      if (!prev) return prev
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
      if (poolCopy[poolIdx] && daysCopy[targetDayIdx]) {
        const [movedItem] = poolCopy.splice(poolIdx, 1)
        if (!Array.isArray(daysCopy[targetDayIdx].items)) daysCopy[targetDayIdx].items = []
        daysCopy[targetDayIdx].items.push(movedItem)
      }
      return { ...prev, days: daysCopy, placesPool: poolCopy }
    })
  }

  function handleRemovePlaceFromPool(poolIdx) {
    setTripmateTripData((prev) => {
      if (!prev) return prev
      const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
      poolCopy.splice(poolIdx, 1)
      return { ...prev, placesPool: poolCopy }
    })
  }

  function handleAddDayToItinerary() {
    setTripmateTripData((prev) => {
      if (!prev) return prev
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const nextDayNum = daysCopy.length + 1
      daysCopy.push({
        id: `day-${Date.now()}`,
        label: `Day ${nextDayNum}`,
        date: '',
        items: [],
      })
      return { ...prev, days: daysCopy }
    })
  }

  // Determine active trip and author based on mode
  const trip = isTripmateMode
    ? (tripmateTripData || { title: 'Shared Tripmate Trip', destination: '', dates: '', days: [], placesPool: [] })
    : isSharedMode
      ? (sharedTripData || { title: 'Shared Trip', destination: '', dates: '', days: [], placesPool: [] })
      : (activeTrip || { title: 'My Trip', destination: '', dates: '', days: [], placesPool: [] })

  const days = Array.isArray(trip.days) ? trip.days : []
  const placesToVisit = Array.isArray(trip.placesPool) ? trip.placesPool : []

  const ownerName = isTripmateMode
    ? (tripmateOwner?.name || tripmateOwner?.username || tripmateTripData?.ownerName || 'Trip Owner')
    : isSharedMode
      ? (sharedOwner?.name || sharedOwner?.username || 'Traveler')
      : (user?.name || user?.username || 'Owner')

  const ownerAvatar = isSharedMode
    ? (sharedOwner?.profileImage || null)
    : (user?.profileImage || null)

  if (isTripmateMode && tripmateLoading) {
    return (
      <div className="TripViewPage TripViewPage--loading">
        <header className="TripViewTopNav">
          <div className="TripViewTopNav__left">
            <span className="TripViewBrand">TripNest</span>
            <div className="TripViewTopNav__badge">🤝 Loading Tripmate trip...</div>
          </div>
        </header>
        <div className="TripViewLoadingState">
          <p>Loading shared Tripmates itinerary...</p>
        </div>
      </div>
    )
  }

  if (isTripmateMode && tripmateError) {
    return (
      <div className="TripViewPage TripViewPage--error" style={{ padding: '40px', textAlign: 'center' }}>
        <header className="TripViewTopNav" style={{ marginBottom: '40px' }}>
          <span className="TripViewBrand">TripNest</span>
        </header>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>Tripmate Access Error</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>{tripmateError}</p>
        </div>
      </div>
    )
  }

  if (isSharedMode && loading) {
    const isCopying = isEditSharedMode && Boolean(authToken && user)
    return (
      <div className="TripViewPage TripViewPage--loading">
        <header className="TripViewTopNav">
          <div className="TripViewTopNav__left">
            <span className="TripViewBrand">TripNest</span>
            <div className="TripViewTopNav__badge">
              {isCopying ? '✏️ Preparing editable copy...' : 'Loading shared trip...'}
            </div>
          </div>
        </header>
        <div className="TripViewLoadingState">
          <div className="TripViewSpinner" />
          <p>{isCopying ? 'Opening your editable workspace copy...' : 'Loading itinerary...'}</p>
        </div>
      </div>
    )
  }

  if (isSharedMode && error) {
    return (
      <div className="TripViewPage TripViewPage--error">
        <header className="TripViewTopNav">
          <div className="TripViewTopNav__left">
            <span className="TripViewBrand">TripNest</span>
          </div>
          <div className="TripViewTopNav__right">
            <button
              type="button"
              className="TripViewNavBtn TripViewNavBtn--back"
              onClick={() => navigate('/home')}
            >
              Go to TripNest
            </button>
          </div>
        </header>
        <div className="TripViewErrorState">
          <div className="TripViewErrorIcon">🔒</div>
          <h2>Trip Unavailable</h2>
          <p>{error}</p>
          <button
            type="button"
            className="PlannerPillButton PlannerPillButton--dark"
            onClick={() => navigate('/home')}
            style={{ marginTop: '16px' }}
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="TripViewPage">
      {/* Top sticky navigation bar */}
      <header className="TripViewTopNav">
        <div className="TripViewTopNav__left">
          {isSharedMode ? (
            <span className="TripViewBrand" onClick={() => navigate('/home')} role="button" tabIndex={0}>
              TripNest
            </span>
          ) : (
            <button
              type="button"
              className="TripViewNavBtn TripViewNavBtn--back"
              onClick={() => navigate('/workspace')}
              aria-label="Back to workspace"
            >
              ← <span className="TripViewNavBtn__text">Back to workspace</span>
            </button>
          )}
          <div className="TripViewTopNav__badge">
            {isTripmateMode
              ? (isTripmateEditMode ? '✏️ Tripmate Collaboration (Editing)' : '🤝 Tripmate Collaboration')
              : isSharedMode
                ? (isEditSharedMode ? '✏️ Shared trip (Edit link • Preview)' : '👁️ Shared trip (View only)')
                : '👁️ View only mode'}
          </div>
        </div>
        <div className="TripViewTopNav__right">
          {isTripmateMode ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="TripViewNavBtn TripViewNavBtn--edit"
                onClick={() => setIsTripmateEditMode((prev) => !prev)}
                style={{
                  backgroundColor: isTripmateEditMode ? '#e0e7ff' : undefined,
                  color: isTripmateEditMode ? '#4338ca' : undefined,
                  borderColor: isTripmateEditMode ? '#6366f1' : undefined,
                }}
              >
                {isTripmateEditMode ? '👁️ View Mode' : '✏️ Edit Itinerary'}
              </button>
              <button
                type="button"
                className="TripViewNavBtn TripViewNavBtn--back"
                onClick={() => navigate('/workspace')}
              >
                Back to workspace
              </button>
            </div>
          ) : isSharedMode ? (
            <button
              type="button"
              className="TripViewNavBtn TripViewNavBtn--back"
              onClick={() => navigate('/home')}
            >
              Home
            </button>
          ) : (
            <button
              type="button"
              className="TripViewNavBtn TripViewNavBtn--edit"
              onClick={() => navigate('/workspace')}
            >
              ✏️ Edit trip
            </button>
          )}
        </div>
      </header>

      <div className="TripViewLayout">
        {/* Left Itinerary Area */}
        <main className="TripViewMain">
          {/* Tripmate Collaboration Save Banner */}
          {isTripmateMode && isTripmateEditMode && (
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#1e40af' }}>
                <strong>🤝 Tripmate Itinerary Editor</strong> — Edits update the canonical shared trip directly.
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {tripmateSaveSuccess && (
                  <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
                    {tripmateSaveSuccess}
                  </span>
                )}
                {tripmateSaveError && (
                  <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600 }}>
                    {tripmateSaveError}
                  </span>
                )}
                <button
                  type="button"
                  disabled={tripmateSaving}
                  onClick={handleSaveTripmateItinerary}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: tripmateSaving ? 'not-allowed' : 'pointer',
                    opacity: tripmateSaving ? 0.7 : 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {tripmateSaving ? 'Saving...' : '💾 Save Tripmate Itinerary'}
                </button>
              </div>
            </div>
          )}

          {/* Trip Hero Header */}
          <section className="TripViewHero">
            <div className="TripViewHero__backdrop">
              <div className="TripViewHero__badge">{trip.destination || 'Trip'}</div>
              <h1 className="TripViewHero__title">{trip.title || trip.name || 'Untitled Trip'}</h1>
              {trip.dates ? <div className="TripViewHero__dates">📅 {trip.dates}</div> : null}
            </div>

            <div className="TripViewHero__authorRow">
              <div className="TripViewHero__author">
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt={ownerName} className="TripViewHero__avatar" />
                ) : (
                  <div className="TripViewHero__avatarFallback">
                    {ownerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <strong className="TripViewHero__authorName">{ownerName}</strong>
                  <div className="TripViewHero__tripMeta">
                    {isSharedMode ? 'Shared itinerary' : 'Owner preview'}
                  </div>
                </div>
              </div>
            </div>

            {trip.notes ? (
              <div className="TripViewHero__notes">
                <p>{trip.notes}</p>
              </div>
            ) : null}
          </section>

          {/* Places to Visit / Pool Section */}
          {placesToVisit.length > 0 ? (
            <section className="TripViewSection">
              <h2 className="TripViewSection__title">Places to visit</h2>
              <div className="TripViewCards">
                {placesToVisit.map((place, idx) => {
                  const isSelected = String(place.id) === String(selectedPlaceId)
                  return (
                    <article
                      key={place.id || idx}
                      className={`TripViewCard${isSelected ? ' is-selected' : ''}`}
                      onClick={() => setSelectedPlaceId(place.id)}
                    >
                      <div className="TripViewCard__row">
                        <div className="TripViewCard__marker TripViewCard__marker--pool">
                          {idx + 1}
                        </div>
                        <div className="TripViewCard__body">
                          <h3 className="TripViewCard__title">{place.title}</h3>
                          {place.category ? (
                            <span className="TripViewCard__tag">{place.category}</span>
                          ) : null}
                          {place.note || place.subtitle ? (
                            <p className="TripViewCard__desc">{place.note || place.subtitle}</p>
                          ) : null}
                        </div>
                        {isTripmateMode && isTripmateEditMode && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                            {days.length > 0 && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value !== '') {
                                    handleMovePoolPlaceToDay(idx, Number(e.target.value))
                                  }
                                }}
                                style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                              >
                                <option value="" disabled>Assign to Day...</option>
                                {days.map((d, dIdx) => (
                                  <option key={d.id || dIdx} value={dIdx}>Day {dIdx + 1}</option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemovePlaceFromPool(idx)}
                              style={{ fontSize: '11px', padding: '2px 6px', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                        {place.image ? (
                          <div className="TripViewCard__imageWrap">
                            <img src={place.image} alt={place.title} className="TripViewCard__image" />
                          </div>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Day-by-Day Sections */}
          {days.length > 0 ? (
            days.map((day, dayIdx) => {
              const items = Array.isArray(day.items) ? day.items : []
              const dayColor = DAY_FALLBACK_COLORS[dayIdx % DAY_FALLBACK_COLORS.length]

              return (
                <section key={day.id || dayIdx} className="TripViewSection">
                  <div className="TripViewSection__dayHeader">
                    <h2 className="TripViewSection__title">
                      {formatDayLabel(day.date, day.label || `Day ${dayIdx + 1}`)}
                    </h2>
                  </div>

                  <div className="TripViewCards">
                    {items.length === 0 ? (
                      <p className="TripViewEmptyDay">No places scheduled for this day.</p>
                    ) : (
                      items.map((place, placeIdx) => {
                        const isSelected = String(place.id) === String(selectedPlaceId)
                        const prevPlace = placeIdx > 0 ? items[placeIdx - 1] : null
                        let connectionText = null

                        if (prevPlace) {
                          const c1 = toCoords(prevPlace)
                          const c2 = toCoords(place)
                          if (c1 && c2) {
                            const distKm = haversineKm(c1, c2)
                            const distMin = Math.round(distKm * 2.5) + 3
                            connectionText = `${distMin} min · ${(distKm * 0.621371).toFixed(1)} mi (${distKm.toFixed(1)} km)`
                          }
                        }

                        const scheduledLabel = place.startTime || place.endTime
                          ? `${formatTime12h(place.startTime)}${place.startTime && place.endTime ? ' - ' : ''}${formatTime12h(place.endTime)}`
                          : null

                        return (
                          <div key={place.id || placeIdx}>
                            {connectionText ? (
                              <div className="TripViewConnection">
                                <span className="TripViewConnection__line" />
                                <span className="TripViewConnection__pill">🚗 {connectionText}</span>
                              </div>
                            ) : null}

                            <article
                              className={`TripViewCard${isSelected ? ' is-selected' : ''}`}
                              onClick={() => setSelectedPlaceId(place.id)}
                            >
                              <div className="TripViewCard__row">
                                <div
                                  className="TripViewCard__marker"
                                  style={{ backgroundColor: dayColor }}
                                >
                                  {placeIdx + 1}
                                </div>
                                <div className="TripViewCard__body">
                                  {isTripmateMode && isTripmateEditMode ? (
                                    <div style={{ width: '100%' }} onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                        <input
                                          type="text"
                                          value={place.title || ''}
                                          onChange={(e) => {
                                            const val = e.target.value
                                            setTripmateTripData((prev) => {
                                              if (!prev) return prev
                                              const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
                                              if (daysCopy[dayIdx]?.items?.[placeIdx]) {
                                                daysCopy[dayIdx].items[placeIdx].title = val
                                              }
                                              return { ...prev, days: daysCopy }
                                            })
                                          }}
                                          style={{
                                            flex: 1,
                                            padding: '4px 8px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            borderRadius: '4px',
                                            border: '1px solid #cbd5e1',
                                          }}
                                          placeholder="Place title..."
                                        />
                                        <select
                                          value={place.category || 'Sightseeing'}
                                          onChange={(e) => {
                                            const val = e.target.value
                                            setTripmateTripData((prev) => {
                                              if (!prev) return prev
                                              const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
                                              if (daysCopy[dayIdx]?.items?.[placeIdx]) {
                                                daysCopy[dayIdx].items[placeIdx].category = val
                                              }
                                              return { ...prev, days: daysCopy }
                                            })
                                          }}
                                          style={{ fontSize: '11px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                                        >
                                          <option value="Sightseeing">Sightseeing</option>
                                          <option value="Food & Drink">Food & Drink</option>
                                          <option value="Hotel & Stay">Hotel & Stay</option>
                                          <option value="Shopping">Shopping</option>
                                          <option value="Nature & Outdoor">Nature & Outdoor</option>
                                          <option value="Activity">Activity</option>
                                          <option value="Other">Other</option>
                                        </select>
                                      </div>
                                      <input
                                        type="text"
                                        value={place.note || place.subtitle || ''}
                                        onChange={(e) => {
                                          const val = e.target.value
                                          setTripmateTripData((prev) => {
                                            if (!prev) return prev
                                            const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
                                            if (daysCopy[dayIdx]?.items?.[placeIdx]) {
                                              daysCopy[dayIdx].items[placeIdx].note = val
                                            }
                                            return { ...prev, days: daysCopy }
                                          })
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '4px 8px',
                                          fontSize: '12px',
                                          borderRadius: '4px',
                                          border: '1px solid #e2e8f0',
                                          color: '#475569',
                                        }}
                                        placeholder="Add a note or subtitle..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <h3 className="TripViewCard__title">{place.title}</h3>
                                      {place.category ? (
                                        <span className="TripViewCard__tag">{place.category}</span>
                                      ) : null}
                                      {scheduledLabel ? (
                                        <div className="TripViewCard__schedule">
                                          ⏰ Scheduled: {scheduledLabel}
                                        </div>
                                      ) : null}
                                      {place.note || place.subtitle ? (
                                        <p className="TripViewCard__desc">{place.note || place.subtitle}</p>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                                {isTripmateMode && isTripmateEditMode && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center', marginLeft: '8px' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleMovePlaceToPool(dayIdx, placeIdx)}
                                      style={{ fontSize: '11px', padding: '2px 6px', color: '#1e40af', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                                      title="Move to Places Pool"
                                    >
                                      📥 Pool
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePlaceFromDay(dayIdx, placeIdx)}
                                      style={{ fontSize: '11px', padding: '2px 6px', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
                                      title="Delete place"
                                    >
                                      🗑️ Delete
                                    </button>
                                  </div>
                                )}
                                {place.image ? (
                                  <div className="TripViewCard__imageWrap">
                                    <img src={place.image} alt={place.title} className="TripViewCard__image" />
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {isTripmateMode && isTripmateEditMode && (
                    <div style={{ marginTop: '14px' }}>
                      {activeAddPlaceDay === dayIdx ? (
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #6366f1',
                            borderRadius: '8px',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: '0 2px 4px rgba(99,102,241,0.1)',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#4338ca' }}>
                            + Add New Place to Day {dayIdx + 1}
                          </div>
                          <input
                            type="text"
                            value={addTitle}
                            onChange={(e) => setAddTitle(e.target.value)}
                            placeholder="Place name (e.g. Lok Virsa Heritage Museum)"
                            style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                              value={addCategory}
                              onChange={(e) => setAddCategory(e.target.value)}
                              style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                            >
                              <option value="Sightseeing">Sightseeing</option>
                              <option value="Food & Drink">Food & Drink</option>
                              <option value="Hotel & Stay">Hotel & Stay</option>
                              <option value="Shopping">Shopping</option>
                              <option value="Nature & Outdoor">Nature & Outdoor</option>
                              <option value="Activity">Activity</option>
                              <option value="Other">Other</option>
                            </select>
                            <input
                              type="text"
                              value={addNote}
                              onChange={(e) => setAddNote(e.target.value)}
                              placeholder="Subtitle or note (optional)"
                              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAddPlaceDay(null)
                                setAddTitle('')
                                setAddNote('')
                              }}
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!addTitle.trim()}
                              onClick={() => {
                                if (!addTitle.trim()) return
                                setTripmateTripData((prev) => {
                                  if (!prev) return prev
                                  const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
                                  if (!daysCopy[dayIdx]) return prev
                                  if (!Array.isArray(daysCopy[dayIdx].items)) daysCopy[dayIdx].items = []
                                  daysCopy[dayIdx].items.push({
                                    id: `tm-place-${Date.now()}`,
                                    title: addTitle.trim(),
                                    category: addCategory,
                                    note: addNote.trim(),
                                    lat: 33.7297,
                                    lon: 73.0372,
                                  })
                                  return { ...prev, days: daysCopy }
                                })
                                setActiveAddPlaceDay(null)
                                setAddTitle('')
                                setAddNote('')
                              }}
                              style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                cursor: addTitle.trim() ? 'pointer' : 'not-allowed',
                                opacity: addTitle.trim() ? 1 : 0.6,
                              }}
                            >
                              + Add Place
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAddPlaceDay(dayIdx)
                            setAddTitle('')
                            setAddNote('')
                          }}
                          style={{
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            color: '#2563eb',
                            border: '1px dashed #93c5fd',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'center',
                          }}
                        >
                          + Add Place to Day {dayIdx + 1}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )
            })
          ) : (
            <section className="TripViewSection">
              <p className="TripViewEmptyDay">No itinerary days found in this trip.</p>
            </section>
          )}

          {isTripmateMode && isTripmateEditMode && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleAddDayToItinerary}
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: '#4338ca',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                + Add Day to Itinerary
              </button>
            </div>
          )}
        </main>

        {/* Right Interactive Map Panel */}
        <aside className="TripViewMapPanel">
          <PlannerMapPanel
            trip={trip}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
            onAddPlaceToPool={() => {}}
          />
        </aside>
      </div>
    </div>
  )
}
