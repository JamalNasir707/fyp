import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PlannerSectionCard from '../components/PlannerSectionCard'
import PlannerItemCard from '../components/PlannerItemCard'
import PlannerMapPanel from '../components/PlannerMapPanel'
import SectionBadge from '../components/SectionBadge'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { getSectionAppearance } from '../lib/sections'
import { countTripPlaces, ensureWorkspaceParityTrip, formatTripDateRange, getTripCoverImage } from '../lib/trips'
import {
  getSharedTripmateTripRequest,
  updateTripmateItineraryRequest,
  readStoredToken,
} from '../lib/session'

const CATEGORY_OPTIONS = [
  'Sightseeing',
  'Attraction',
  'Lodging',
  'Dining',
  'Cafe',
  'Shopping',
  'Nature',
  'Culture',
  'Entertainment',
]

const EXPLORE_SUGGESTIONS = [
  { id: 'sugg-1', title: 'Mall Road Murree', note: 'Vibrant walking street with shops & local food', category: 'Shopping', lat: 33.907, lon: 73.3903 },
  { id: 'sugg-2', title: 'Patriata Chairlift (New Murree)', note: 'Breathtaking cable car rides and pine valley views', category: 'Attraction', lat: 33.9555, lon: 73.4475 },
  { id: 'sugg-3', title: 'Kashmir Point', note: 'Highest point in Murree offering panoramic mountain views', category: 'Sightseeing', lat: 33.91, lon: 73.398 },
  { id: 'sugg-4', title: 'Pindi Point', note: 'Popular viewpoint overlooking Rawalpindi and pine forests', category: 'Sightseeing', lat: 33.899, lon: 73.385 },
]

function formatDayLabel(dateStr, index, fallback) {
  if (dateStr) {
    const date = new Date(dateStr)
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }
  }
  return fallback || `Day ${index + 1}`
}

export default function TripmateWorkspacePage({ tripId }) {
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [saveError, setSaveError] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)

  // Workspace Navigation & Sidebar State
  const [activeSectionId, setActiveSectionId] = useState('overview')
  const [activeChildId, setActiveChildId] = useState(null)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const sectionRefs = useRef({})

  // In-app Place Addition state
  const [activeAddContainer, setActiveAddContainer] = useState(null) // dayId or 'pool'
  const [addTitle, setAddTitle] = useState('')
  const [addCategory, setAddCategory] = useState('Sightseeing')
  const [addNote, setAddNote] = useState('')

  // Load canonical shared Tripmate trip
  useEffect(() => {
    if (!tripId) return

    let isMounted = true
    setLoading(true)
    setError('')
    const token = readStoredToken()

    getSharedTripmateTripRequest(token, tripId)
      .then((res) => {
        if (!isMounted) return
        if (res?.success && res?.trip) {
          const rawTrip = res.trip?.data || res.trip
          const normalized = ensureWorkspaceParityTrip(rawTrip)
          setTrip(normalized)
          setOwner(res.owner || res.trip?.owner || null)
          setSelectedPlaceId(normalized?.map?.selectedPlaceId || null)
        } else {
          setError(res?.error || res?.detail || 'Access denied. You are no longer an active Tripmate for this trip.')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err?.message || err?.detail || 'Access denied. You are no longer an active Tripmate for this trip.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [tripId])

  // Clear toasts
  useEffect(() => {
    if (!saveSuccess) return undefined
    const timer = setTimeout(() => setSaveSuccess(''), 3000)
    return () => clearTimeout(timer)
  }, [saveSuccess])

  useEffect(() => {
    if (!saveError) return undefined
    const timer = setTimeout(() => setSaveError(''), 4000)
    return () => clearTimeout(timer)
  }, [saveError])

  // Explicit Save Handler
  async function handleSaveItinerary() {
    if (!tripId || !trip) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    const token = readStoredToken()
    const payload = {
      days: Array.isArray(trip.days) ? trip.days : [],
      placesPool: Array.isArray(trip.placesPool) ? trip.placesPool : [],
      customLists: trip.customLists || [],
    }

    try {
      const res = await updateTripmateItineraryRequest(token, tripId, payload)
      if (res?.success) {
        setSaveSuccess('Itinerary saved to canonical shared trip successfully!')
        if (res.trip) {
          const rawTrip = res.trip?.data || res.trip
          const normalized = ensureWorkspaceParityTrip(rawTrip)
          setTrip(normalized)
        }
      } else {
        setSaveError(res?.error || res?.detail || 'Failed to save Tripmate itinerary')
      }
    } catch (err) {
      setSaveError(err?.message || 'Network error while saving Tripmate itinerary')
    } finally {
      setSaving(false)
    }
  }

  // Scroll to workspace section
  function scrollToSection(sectionId) {
    setActiveSectionId(sectionId)
    const targetNode = sectionRefs.current[sectionId]
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Action: Add place to day or pool
  function handleConfirmAddPlace(containerId) {
    if (!addTitle.trim() || !trip) return

    const newPlace = {
      id: `place-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: addTitle.trim(),
      title: addTitle.trim(),
      category: addCategory,
      notes: addNote.trim(),
    }

    setTrip((prev) => {
      if (!prev) return prev
      if (containerId === 'pool') {
        const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
        poolCopy.push(newPlace)
        return { ...prev, placesPool: poolCopy }
      }

      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const targetDay = daysCopy.find((d) => String(d.id) === String(containerId))
      if (targetDay) {
        if (!Array.isArray(targetDay.items)) targetDay.items = []
        targetDay.items.push(newPlace)
      }
      return { ...prev, days: daysCopy }
    })

    setAddTitle('')
    setAddNote('')
    setActiveAddContainer(null)
  }

  // Add suggestion from Explore to Pool
  function handleAddExploreSuggestionToPool(suggestion) {
    const newPlace = {
      id: `place-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: suggestion.title,
      title: suggestion.title,
      category: suggestion.category || 'Attraction',
      notes: suggestion.note || '',
      lat: suggestion.lat,
      lon: suggestion.lon,
    }
    setTrip((prev) => {
      if (!prev) return prev
      const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
      poolCopy.push(newPlace)
      return { ...prev, placesPool: poolCopy }
    })
  }

  // Action: Remove item
  function handleRemoveItem(containerId, index) {
    setTrip((prev) => {
      if (!prev) return prev
      if (containerId === 'pool') {
        const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
        poolCopy.splice(index, 1)
        return { ...prev, placesPool: poolCopy }
      }
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const day = daysCopy.find((d) => String(d.id) === String(containerId))
      if (day && Array.isArray(day.items)) {
        day.items.splice(index, 1)
      }
      return { ...prev, days: daysCopy }
    })
  }

  // Action: Move item
  function handleMoveItem(containerId, index, targetContainerId) {
    setTrip((prev) => {
      if (!prev) return prev
      let movedItem = null
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))

      if (containerId === 'pool') {
        if (poolCopy[index]) [movedItem] = poolCopy.splice(index, 1)
      } else {
        const srcDay = daysCopy.find((d) => String(d.id) === String(containerId))
        if (srcDay && Array.isArray(srcDay.items) && srcDay.items[index]) {
          [movedItem] = srcDay.items.splice(index, 1)
        }
      }

      if (!movedItem) return prev

      if (targetContainerId === 'pool') {
        poolCopy.push(movedItem)
      } else {
        const targetDay = daysCopy.find((d) => String(d.id) === String(targetContainerId))
        if (targetDay) {
          if (!Array.isArray(targetDay.items)) targetDay.items = []
          targetDay.items.push(movedItem)
        }
      }

      return { ...prev, days: daysCopy, placesPool: poolCopy }
    })
  }

  // Action: Update note
  function handleUpdateNote(containerId, index, newNote) {
    setTrip((prev) => {
      if (!prev) return prev
      if (containerId === 'pool') {
        const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
        if (poolCopy[index]) poolCopy[index].notes = newNote
        return { ...prev, placesPool: poolCopy }
      }
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const day = daysCopy.find((d) => String(d.id) === String(containerId))
      if (day && Array.isArray(day.items) && day.items[index]) {
        day.items[index].notes = newNote
      }
      return { ...prev, days: daysCopy }
    })
  }

  // Action: Toggle Visited
  function handleToggleVisited(containerId, index) {
    setTrip((prev) => {
      if (!prev) return prev
      if (containerId === 'pool') {
        const poolCopy = JSON.parse(JSON.stringify(prev.placesPool || []))
        if (poolCopy[index]) poolCopy[index].visited = !poolCopy[index].visited
        return { ...prev, placesPool: poolCopy }
      }
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const day = daysCopy.find((d) => String(d.id) === String(containerId))
      if (day && Array.isArray(day.items) && day.items[index]) {
        day.items[index].visited = !day.items[index].visited
      }
      return { ...prev, days: daysCopy }
    })
  }

  // Action: Add Day
  function handleAddDay() {
    setTrip((prev) => {
      if (!prev) return prev
      const daysCopy = JSON.parse(JSON.stringify(prev.days || []))
      const nextNum = daysCopy.length + 1
      daysCopy.push({
        id: `day-${Date.now()}`,
        label: `Day ${nextNum}`,
        title: `Day ${nextNum}`,
        date: '',
        items: [],
      })
      return { ...prev, days: daysCopy }
    })
  }

  if (loading) {
    return (
      <div className="WorkspacePage WorkspacePage--loading">
        <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
          <h2>Loading shared Tripmate workspace...</h2>
        </div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="WorkspacePage WorkspacePage--error">
        <div style={{ maxWidth: '600px', margin: '80px auto', padding: '32px', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Access Unavailable</h2>
          <p style={{ color: '#475569', marginBottom: '24px' }}>{error || 'Could not load Tripmate workspace.'}</p>
          <button type="button" className="TripHubCtaButton" onClick={() => navigate('/home')}>
            Return Home
          </button>
        </div>
      </div>
    )
  }

  const days = Array.isArray(trip.days) ? trip.days : []
  const placesPool = Array.isArray(trip.placesPool) ? trip.placesPool : []
  const ownerDisplayName = owner?.name || owner?.username || trip.ownerName || 'Trip Owner'

  // Sidebar Navigation Sections
  const sidebarSections = [
    { id: 'overview', label: 'Overview' },
    { id: 'explore', label: 'Explore Suggestions' },
    {
      id: 'itinerary',
      label: 'Itinerary',
      children: days.map((d, i) => ({ id: d.id, label: d.label || d.title || `Day ${i + 1}` })),
    },
    { id: 'pool', label: 'Places Pool' },
  ]

  const containerDestinations = [
    ...days.map((d, i) => ({ id: d.id, label: d.label || d.title || `Day ${i + 1}` })),
    { id: 'pool', label: 'Unassigned Pool' },
  ]

  return (
    <div className="WorkspacePage TripmateWorkspacePage" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Workspace Topbar Header */}
      <header className="WorkspaceTopbar" style={{ padding: '12px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', sticky: 'top', zIndex: 100 }}>
        <div className="WorkspaceTopbar__left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            className="TripHubCtaButton TripHubCtaButton--inline"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => navigate('/home')}
          >
            ← Home
          </button>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="TripHubCard__badge TripHubCard__badge--tripmate" style={{ fontSize: '11px', padding: '2px 8px' }}>
                🤝 Shared Trip — Tripmate
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Owner: <strong>{ownerDisplayName}</strong></span>
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {trip.title || trip.name || trip.destination || 'Murree Trip'}
            </h2>
          </div>
        </div>

        <div className="WorkspaceTopbar__right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saveSuccess ? (
            <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600, background: '#f0fdf4', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
              ✓ {saveSuccess}
            </span>
          ) : null}
          {saveError ? (
            <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600, background: '#fef2f2', padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
              ⚠️ {saveError}
            </span>
          ) : null}
          <button
            type="button"
            className="TripHubCtaButton"
            style={{ padding: '8px 18px', fontSize: '14px', background: saving ? '#94a3b8' : '#2563eb', color: '#ffffff', border: 'none' }}
            disabled={saving}
            onClick={handleSaveItinerary}
          >
            {saving ? 'Saving...' : '💾 Save Tripmate Itinerary'}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar Navigation */}
        {!sidebarHidden ? (
          <WorkspaceSidebar
            sections={sidebarSections}
            activeSectionId={activeSectionId}
            activeChildId={activeChildId}
            onGoToSection={(secId) => {
              setActiveChildId(days.some((d) => d.id === secId) ? secId : null)
              scrollToSection(secId)
            }}
            onToggleAllSections={() => {}}
            onHideSidebar={() => setSidebarHidden(false)}
            onToggleAiAssistant={() => {}}
          />
        ) : null}

        {/* Center Main Planner Content Area */}
        <main className="PlannerMain PlannerMainReact" style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 1: Overview & Hero Trip Card */}
          <section
            className="PlannerHeroSection PlannerSection--hero"
            ref={(node) => { sectionRefs.current.overview = node }}
          >
            <div className="PlannerTripCard">
              <div
                className="PlannerTripCard__banner"
                style={{ backgroundImage: `url('${getTripCoverImage(trip)}')` }}
              />
              <div className="PlannerTripCard__content">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      🤝 Tripmate Collaboration Workspace
                    </span>
                  </div>
                  <h1 className="PlannerTripCard__title">
                    {trip.title || trip.name || trip.destination || 'Murree Trip'}
                  </h1>
                  <p className="PlannerTripCard__meta">
                    {formatTripDateRange(trip.startDate, trip.endDate) || 'Dates not set'} • {countTripPlaces(trip)} places total
                  </p>
                  <p className="PlannerTripCard__meta" style={{ marginTop: '4px', color: '#64748b' }}>
                    Original owner: <strong>{ownerDisplayName}</strong>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Explore Suggestions */}
          <PlannerSectionCard
            sectionRef={(node) => { sectionRefs.current.explore = node }}
            titleContent={
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Explore & Add Suggestions</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Browse popular spots in {trip.destination || 'Pakistan'} and add them directly to your Tripmate pool.
                </p>
              </div>
            }
          >
            <div className="PlannerExploreGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginTop: '12px' }}>
              {EXPLORE_SUGGESTIONS.map((sugg) => {
                const alreadyAdded = (trip.placesPool || []).some((p) => p.name === sugg.title || p.title === sugg.title)
                return (
                  <article key={sugg.id} className="PlannerExploreCardReact" style={{ background: '#ffffff', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#1e293b' }}>{sugg.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{sugg.note}</p>
                    </div>
                    <button
                      type="button"
                      className={`PlannerPillButton ${alreadyAdded ? 'PlannerPillButton--light' : 'PlannerPillButton--accent'}`}
                      style={{ marginTop: '12px', alignSelf: 'flex-start', fontSize: '12px', padding: '4px 10px' }}
                      disabled={alreadyAdded}
                      onClick={() => handleAddExploreSuggestionToPool(sugg)}
                    >
                      {alreadyAdded ? 'In pool' : '+ Add to pool'}
                    </button>
                  </article>
                )
              })}
            </div>
          </PlannerSectionCard>

          {/* Section 3: Itinerary Days */}
          {days.map((day, dayIndex) => {
            const appearance = getSectionAppearance(dayIndex)
            const dayItems = Array.isArray(day.items) ? day.items : (Array.isArray(day.places) ? day.places : [])
            const dayLabelText = formatDayLabel(day.date, dayIndex, day.label || day.title)
            const moveOptions = containerDestinations.filter((d) => String(d.id) !== String(day.id))

            return (
              <PlannerSectionCard
                key={day.id || dayIndex}
                sectionRef={(node) => {
                  sectionRefs.current[day.id] = node
                  if (dayIndex === 0) sectionRefs.current.itinerary = node
                }}
                titleContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SectionBadge color={appearance.color} icon={String(dayIndex + 1)} label={`Day ${dayIndex + 1}`} />
                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>{dayLabelText}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>({dayItems.length} places)</span>
                  </div>
                }
                actions={
                  <button
                    type="button"
                    className="TripHubCtaButton TripHubCtaButton--inline"
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                    onClick={() => setActiveAddContainer(day.id)}
                  >
                    + Add Place
                  </button>
                }
              >
                {/* Inline Form to Add Place */}
                {activeAddContainer === day.id ? (
                  <div style={{ margin: '12px 0', padding: '14px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b' }}>Add Place to Day {dayIndex + 1}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Place name (e.g. Mall Road, Patriata Chairlift)..."
                        value={addTitle}
                        onChange={(e) => setAddTitle(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <select
                          value={addCategory}
                          onChange={(e) => setAddCategory(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          {CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Optional note / details..."
                          value={addNote}
                          onChange={(e) => setAddNote(e.target.value)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <button
                          type="button"
                          className="TripHubCtaButton"
                          style={{ padding: '6px 14px', fontSize: '12px', background: '#2563eb' }}
                          onClick={() => handleConfirmAddPlace(day.id)}
                        >
                          Add to Day
                        </button>
                        <button
                          type="button"
                          className="TripHubCtaButton TripHubCtaButton--inline"
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                          onClick={() => { setActiveAddContainer(null); setAddTitle(''); setAddNote(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Places List for this Day */}
                {!dayItems.length ? (
                  <div style={{ padding: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center', fontStyle: 'italic' }}>
                    No places planned for this day yet. Click "+ Add Place" to add one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    {dayItems.map((item, itemIdx) => (
                      <PlannerItemCard
                        key={item.id || itemIdx}
                        item={item}
                        containerId={day.id}
                        index={itemIdx}
                        appearance={appearance}
                        moveDestinations={moveOptions}
                        isChecked={Boolean(item.visited)}
                        onRemoveItem={() => handleRemoveItem(day.id, itemIdx)}
                        onMoveItem={(destId) => handleMoveItem(day.id, itemIdx, destId)}
                        onUpdateNote={(newNote) => handleUpdateNote(day.id, itemIdx, newNote)}
                        onMarkVisited={() => handleToggleVisited(day.id, itemIdx)}
                        onMarkNotVisited={() => handleToggleVisited(day.id, itemIdx)}
                        onOpenMap={() => setSelectedPlaceId(item.id || item.place_id)}
                      />
                    ))}
                  </div>
                )}
              </PlannerSectionCard>
            )
          })}

          {/* Section 4: Unassigned Places Pool */}
          <PlannerSectionCard
            sectionRef={(node) => { sectionRefs.current.pool = node }}
            titleContent={
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <SectionBadge color="#64748b" icon="pool" label="Places Pool" />
                <span style={{ fontWeight: 600, color: '#475569', fontSize: '15px' }}>Unassigned Places Pool</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>({placesPool.length} places)</span>
              </div>
            }
            actions={
              <button
                type="button"
                className="TripHubCtaButton TripHubCtaButton--inline"
                style={{ padding: '4px 12px', fontSize: '12px' }}
                onClick={() => setActiveAddContainer('pool')}
              >
                + Add to Pool
              </button>
            }
          >
            {activeAddContainer === 'pool' ? (
              <div style={{ margin: '12px 0', padding: '14px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b' }}>Add Place to Pool</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Place name..."
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      value={addCategory}
                      onChange={(e) => setAddCategory(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Optional note..."
                      value={addNote}
                      onChange={(e) => setAddNote(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="TripHubCtaButton"
                      style={{ padding: '6px 14px', fontSize: '12px', background: '#2563eb' }}
                      onClick={() => handleConfirmAddPlace('pool')}
                    >
                      Add to Pool
                    </button>
                    <button
                      type="button"
                      className="TripHubCtaButton TripHubCtaButton--inline"
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                      onClick={() => { setActiveAddContainer(null); setAddTitle(''); setAddNote(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!placesPool.length ? (
              <div style={{ padding: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center', fontStyle: 'italic' }}>
                No unassigned places in pool.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                {placesPool.map((item, pIdx) => (
                  <PlannerItemCard
                    key={item.id || pIdx}
                    item={item}
                    containerId="pool"
                    index={pIdx}
                    appearance={{ color: '#64748b' }}
                    moveDestinations={days.map((d, i) => ({ id: d.id, label: d.label || d.title || `Day ${i + 1}` }))}
                    isChecked={Boolean(item.visited)}
                    onRemoveItem={() => handleRemoveItem('pool', pIdx)}
                    onMoveItem={(destId) => handleMoveItem('pool', pIdx, destId)}
                    onUpdateNote={(newNote) => handleUpdateNote('pool', pIdx, newNote)}
                    onMarkVisited={() => handleToggleVisited('pool', pIdx)}
                    onMarkNotVisited={() => handleToggleVisited('pool', pIdx)}
                    onOpenMap={() => setSelectedPlaceId(item.id || item.place_id)}
                  />
                ))}
              </div>
            )}
          </PlannerSectionCard>

          {/* Add Day Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', marginBottom: '40px' }}>
            <button
              type="button"
              className="TripHubCtaButton TripHubCtaButton--inline"
              style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
              onClick={handleAddDay}
            >
              + Add Day to Itinerary
            </button>
          </div>
        </main>

        {/* Right Side Map Panel */}
        <aside style={{ width: '420px', minWidth: '360px', borderLeft: '1px solid #e2e8f0', background: '#fff' }}>
          <PlannerMapPanel
            trip={trip}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={(place) => setSelectedPlaceId(place?.id || null)}
          />
        </aside>
      </div>
    </div>
  )
}
