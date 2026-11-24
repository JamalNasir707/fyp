import { useEffect, useState } from 'react'
import { countTripPlaces, formatTripDateRange, getTripCoverImage } from '../lib/trips'

export default function TripHubSavedTripsGrid({
  savedTrips = [],
  onOpenTrip,
  onDeleteTrip,
  emptyMessage = 'No saved trips yet.',
  emptyActionLabel = '',
  onEmptyAction,
}) {
  const [openMenuTripId, setOpenMenuTripId] = useState(null)
  const [pendingDeleteTripId, setPendingDeleteTripId] = useState(null)

  useEffect(() => {
    function handleMouseDown(event) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.TripHubCard__actions')) {
        setOpenMenuTripId(null)
      }
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setOpenMenuTripId(null)
      setPendingDeleteTripId(null)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <>
      {!savedTrips.length ? (
        <div className="TripHubTrips__empty">
          <p>{emptyMessage}</p>
          {emptyActionLabel && onEmptyAction ? (
            <button type="button" className="TripHubCtaButton TripHubCtaButton--inline" onClick={onEmptyAction}>
              {emptyActionLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="TripHubTrips__grid">
          {savedTrips.map((trip) => {
            const data = trip.data || {}
            const tripId = trip.id
            const isMenuOpen = String(openMenuTripId || '') === String(tripId || '')

            return (
              <article key={tripId} className="TripHubCard" data-trip-id={tripId}>
                <div className="TripHubCard__image" style={{ backgroundImage: `url('${getTripCoverImage(data)}')` }}>
                  <span className={`TripHubCard__badge${trip.isTripmate ? ' TripHubCard__badge--tripmate' : ''}`}>
                    {trip.isTripmate ? '🤝 Shared Tripmate' : 'Saved'}
                  </span>
                  {!trip.isTripmate ? (
                    <div className="TripHubCard__actions">
                      <button
                        type="button"
                        className="TripHubCard__menuBtn"
                        aria-label="Trip options"
                        aria-haspopup="true"
                        aria-expanded={isMenuOpen ? 'true' : 'false'}
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpenMenuTripId((prev) => (String(prev || '') === String(tripId) ? null : tripId))
                        }}
                      >
                        ⋯
                      </button>
                      <div className={`TripHubCard__menu dropdown-menu dropdown-menu-right${isMenuOpen ? ' show' : ''}`}>
                        <button
                          type="button"
                          className="dropdown-item TripHubCard__deleteItem"
                          data-delete-trip={tripId}
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenMenuTripId(null)
                            setPendingDeleteTripId(tripId)
                          }}
                        >
                          <span className="TripHubCard__deleteIcon" aria-hidden="true">🗑</span>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div
                  className="TripHubCard__body"
                  data-open-trip="true"
                  onClick={() => {
                    if (typeof onOpenTrip === 'function') onOpenTrip(tripId, trip)
                  }}
                >
                  <h3>{trip.name || data.title || data.name || 'My Trip'}</h3>
                  <p className="TripHubCard__meta">{formatTripDateRange(trip.startDate, trip.endDate) || 'Dates not set'}</p>
                  <p className="TripHubCard__meta">{countTripPlaces(Array.isArray(trip?.days) ? trip : data)} places</p>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="TripHubDeleteModal" hidden={pendingDeleteTripId == null} aria-hidden={pendingDeleteTripId == null ? 'true' : 'false'}>
        <div className="TripHubDeleteModal__backdrop" onClick={() => setPendingDeleteTripId(null)} />
        <div className="TripHubDeleteModal__dialog" role="dialog" aria-modal="true" aria-labelledby="shared-delete-title">
          <h2 id="shared-delete-title">Delete</h2>
          <p>Are you sure you want to delete this trip plan? This action is not reversible!</p>
          <div className="TripHubDeleteModal__actions">
            <button type="button" className="TripHubDeleteModal__cancel" onClick={() => setPendingDeleteTripId(null)}>No, don&apos;t delete</button>
            <button
              type="button"
              className="TripHubDeleteModal__confirm"
              onClick={async () => {
                if (pendingDeleteTripId == null || typeof onDeleteTrip !== 'function') return
                await onDeleteTrip(pendingDeleteTripId)
                setPendingDeleteTripId(null)
                setOpenMenuTripId(null)
              }}
            >
              Yes, delete it
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
