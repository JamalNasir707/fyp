import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PlannerMapPanel from '../components/PlannerMapPanel'
import { DAY_FALLBACK_COLORS } from '../lib/sections'
import { formatTripDateRange } from '../lib/trips'
import {
  fetchPublicTripByIdRequest,
  formatDisplayName,
  formatUsername,
  getInitials,
} from '../lib/profile'

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.75 14.25a1 1 0 0 1 0-1.41l4.5-4.5a2.5 2.5 0 1 1 3.54 3.54l-2 2a1 1 0 1 1-1.42-1.42l2-2a.5.5 0 1 0-.7-.7l-4.5 4.5a1 1 0 0 1-1.42 0Zm-3.54 7.02a2.5 2.5 0 0 1 0-3.54l2-2a1 1 0 0 1 1.42 1.42l-2 2a.5.5 0 0 0 .7.7l4.5-4.5a1 1 0 0 1 1.42 1.42l-4.5 4.5a2.5 2.5 0 0 1-3.54 0Z" fill="currentColor" />
    </svg>
  )
}

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

export default function PublicTripPage() {
  const navigate = useNavigate()
  const { tripId } = useParams()

  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const publicTripUrl = typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/trips/public/${tripId}`
    : `http://localhost:5173/trips/public/${tripId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicTripUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  useEffect(() => {
    if (!shareOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') setShareOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shareOpen])

  useEffect(() => {
    if (!tripId) {
      setError('Trip ID is required')
      setLoading(false)
      return
    }

    let isSubscribed = true
    setLoading(true)
    setError('')

    fetchPublicTripByIdRequest(tripId)
      .then((res) => {
        if (!isSubscribed) return
        if (res?.success && res?.trip) {
          setTrip(res.trip)
          const firstDayPlace = res.trip.days?.[0]?.items?.[0]?.id
          const firstPoolPlace = res.trip.placesPool?.[0]?.id
          setSelectedPlaceId(firstDayPlace || firstPoolPlace || null)
        } else {
          setError(res?.detail || 'This trip is not publicly available.')
        }
      })
      .catch((err) => {
        if (!isSubscribed) return
        setError(err?.message || 'This trip is not publicly available.')
      })
      .finally(() => {
        if (isSubscribed) setLoading(false)
      })

    return () => {
      isSubscribed = false
    }
  }, [tripId])

  if (loading) {
    return (
      <div className="TripViewPage TripViewPage--loading">
        <header className="TripViewTopNav">
          <div className="TripViewTopNav__left">
            <span className="TripViewBrand" onClick={() => navigate('/home')} role="button" tabIndex={0}>
              TripNest
            </span>
            <div className="TripViewTopNav__badge">🌐 Public trip</div>
          </div>
        </header>
        <div className="TripViewLoadingState">
          <div className="TripViewSpinner" />
          <p>Loading public trip...</p>
        </div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="TripViewPage TripViewPage--error">
        <header className="TripViewTopNav">
          <div className="TripViewTopNav__left">
            <span className="TripViewBrand" onClick={() => navigate('/home')} role="button" tabIndex={0}>
              TripNest
            </span>
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
          <p>{error || 'This trip is not publicly available.'}</p>
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

  const days = Array.isArray(trip.days) ? trip.days : []
  const placesPool = Array.isArray(trip.placesPool) ? trip.placesPool : []
  const owner = trip.owner || null
  const ownerName = formatDisplayName(owner) || 'Traveler'
  const ownerUsername = owner?.username ? formatUsername(owner) : ''
  const dateRangeText = formatTripDateRange(trip.startDate, trip.endDate)

  return (
    <div className="TripViewPage">
      {/* Top sticky navigation bar */}
      <header className="TripViewTopNav">
        <div className="TripViewTopNav__left">
          <span
            className="TripViewBrand"
            onClick={() => navigate('/home')}
            role="button"
            tabIndex={0}
          >
            TripNest
          </span>
          <div className="TripViewTopNav__badge">🌐 Public itinerary</div>
        </div>
        <div className="TripViewTopNav__right">
          <button
            type="button"
            className="TripViewNavBtn TripViewNavBtn--share"
            onClick={() => setShareOpen(true)}
            aria-label="Share this public trip"
          >
            Share
          </button>
          {owner?.username && (
            <button
              type="button"
              className="TripViewNavBtn TripViewNavBtn--back"
              onClick={() => navigate(`/profile/${encodeURIComponent(owner.username)}`)}
            >
              @{owner.username}&apos;s Profile
            </button>
          )}
          <button
            type="button"
            className="TripViewNavBtn TripViewNavBtn--back"
            onClick={() => navigate('/home')}
          >
            Home
          </button>
        </div>
      </header>

      {shareOpen && (
        <div className="TripHubDeleteModal" aria-hidden="false">
          <div className="TripHubDeleteModal__backdrop" onClick={() => setShareOpen(false)} />
          <div
            className="TripHubDeleteModal__dialog TripHubModalCard TripHubModalCard--share"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-public-trip-title"
          >
            <button
              type="button"
              className="TripHubModalCard__close"
              aria-label="Close"
              onClick={() => setShareOpen(false)}
            >
              ×
            </button>
            <h2 id="share-public-trip-title">Share this public trip</h2>
            <p>Anyone with this link can view the public itinerary.</p>

            <div className="TripHubShareModal__linkRow">
              <div className="TripHubShareModal__link">
                <LinkIcon />
                <span>{publicTripUrl}</span>
              </div>
              <button
                type="button"
                className="TripHubDeleteModal__confirm"
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="TripViewLayout">
        {/* Left Itinerary Area */}
        <main className="TripViewMain">
          {/* Trip Hero Header */}
          <section className="TripViewHero">
            <div className="TripViewHero__backdrop">
              <div className="TripViewHero__badge">{trip.destination || 'Trip'}</div>
              <h1 className="TripViewHero__title">{trip.title || trip.name || 'Public Trip'}</h1>
              {dateRangeText ? (
                <div className="TripViewHero__dates">📅 {dateRangeText}</div>
              ) : null}
            </div>

            <div className="TripViewHero__authorRow">
              <div
                className="TripViewHero__author"
                onClick={() => {
                  if (owner?.username) {
                    navigate(`/profile/${encodeURIComponent(owner.username)}`)
                  }
                }}
                style={{ cursor: owner?.username ? 'pointer' : 'default' }}
              >
                {owner?.profileImage ? (
                  <img src={owner.profileImage} alt={ownerName} className="TripViewHero__avatar" />
                ) : (
                  <div className="TripViewHero__avatarFallback">
                    {getInitials(owner)}
                  </div>
                )}
                <div>
                  <strong className="TripViewHero__authorName">{ownerName}</strong>
                  <div className="TripViewHero__tripMeta">
                    {ownerUsername ? `${ownerUsername} · ` : ''}Public travel plan
                  </div>
                </div>
              </div>

              <div className="TripHubCard__metaDetails" style={{ marginLeft: 'auto' }}>
                <span className="TripHubCard__meta">
                  {trip.placeCount ?? 0} {(trip.placeCount === 1 ? 'place' : 'places')}
                </span>
                {trip.dayCount ? (
                  <span className="TripHubCard__meta">
                    • {trip.dayCount} {(trip.dayCount === 1 ? 'day' : 'days')}
                  </span>
                ) : null}
              </div>
            </div>

            {owner?.bio ? (
              <div className="TripViewHero__notes" style={{ marginTop: '12px' }}>
                <p style={{ fontStyle: 'italic', color: '#475569' }}>&ldquo;{owner.bio}&rdquo;</p>
              </div>
            ) : null}
          </section>

          {/* Places to Visit / Pool Section */}
          {placesPool.length > 0 ? (
            <section className="TripViewSection">
              <h2 className="TripViewSection__title">Places to visit</h2>
              <div className="TripViewCards">
                {placesPool.map((place, idx) => {
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
                          <h3 className="TripViewCard__title">{place.title || place.name}</h3>
                          {place.category ? (
                            <span className="TripViewCard__tag">{place.category}</span>
                          ) : null}
                          {place.subtitle || place.address ? (
                            <p className="TripViewCard__desc">{place.subtitle || place.address}</p>
                          ) : null}
                        </div>
                        {place.image ? (
                          <div className="TripViewCard__imageWrap">
                            <img src={place.image} alt={place.title || place.name} className="TripViewCard__image" />
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
                                  <h3 className="TripViewCard__title">{place.title || place.name}</h3>
                                  {place.category ? (
                                    <span className="TripViewCard__tag">{place.category}</span>
                                  ) : null}
                                  {scheduledLabel ? (
                                    <div className="TripViewCard__schedule">
                                      ⏰ Scheduled: {scheduledLabel}
                                    </div>
                                  ) : null}
                                  {place.subtitle || place.address ? (
                                    <p className="TripViewCard__desc">{place.subtitle || place.address}</p>
                                  ) : null}
                                </div>
                                {place.image ? (
                                  <div className="TripViewCard__imageWrap">
                                    <img src={place.image} alt={place.title || place.name} className="TripViewCard__image" />
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>
              )
            })
          ) : (
            <section className="TripViewSection">
              <p className="TripViewEmptyDay">No itinerary days found in this trip.</p>
            </section>
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
