import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Pane, Polyline, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import { buildRouteSignature, buildSearchPlace, findTripPlaceById, getPlaceLatLon, getTripPlaceCollections } from '../lib/map'
import { DAY_FALLBACK_COLORS } from '../lib/sections'
import { useWeather, isPlaceWithValidCoords } from '../hooks/useWeather'
import WeatherIcon from './WeatherIcon'
import { fetchPlacePhotosRequest } from '../lib/session'
import { useApp } from '../context/AppContext'

const CARTO_KEY = import.meta.env.VITE_CARTO_KEY || ''
const CARTO_TILE_URL = CARTO_KEY
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

function createItineraryIcon(label, color, isSelected) {
  return L.divIcon({
    className: `PlannerLeafletMarker${isSelected ? ' is-selected' : ''}`,
    html: `<div style="background:${color}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function createPoolIcon(label, isSelected) {
  return L.divIcon({
    className: `PlannerLeafletPoolMarker${isSelected ? ' is-selected' : ''}`,
    html: `<div>${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function createTempMarkerIcon() {
  return L.divIcon({
    className: 'PlannerLeafletTempMarker',
    html: '<div>+</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function getDayDisplayInfo(day, index) {
  let dateText = ''
  if (day.date) {
    const d = new Date(day.date)
    if (Number.isFinite(d.getTime())) {
      dateText = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }
  }
  if (!dateText && day.shortLabel) {
    dateText = day.shortLabel
  }

  const customTitle = (day.title || (day.label && day.label !== dateText && !day.label.toLowerCase().startsWith('day '))) ? (day.title || day.label) : null
  const mainLabel = customTitle || dateText || day.label || `Day ${index + 1}`
  const subLabel = customTitle ? dateText : null

  return { mainLabel, subLabel, dateText: dateText || mainLabel }
}


function FitMapToPlaces({ boundsKey, bounds, followSelected, selectedPoint }) {

  const map = useMap()
  const hasInteractedRef = useRef(false)

  useEffect(() => {
    const onMoveStart = () => {
      hasInteractedRef.current = true
    }
    map.on('dragstart', onMoveStart)
    map.on('zoomstart', onMoveStart)
    return () => {
      map.off('dragstart', onMoveStart)
      map.off('zoomstart', onMoveStart)
    }
  }, [map])

  useEffect(() => {
    if (!bounds.length || hasInteractedRef.current) return
    if (bounds.length === 1) {
      map.setView(bounds[0], 13)
      return
    }
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, bounds, boundsKey])

  useEffect(() => {
    if (!followSelected || !selectedPoint) return
    map.setView(selectedPoint, Math.max(map.getZoom(), 13), { animate: true })
  }, [map, followSelected, selectedPoint])

  return null
}

export default function PlannerMapPanel({
  trip,
  selectedPlaceId,
  selectedExplorePlace = null,
  onSelectPlace,
  onAddPlaceToPool,
}) {
  const { updateTrip } = useApp()
  const { poolPlaces, dayPlaces } = useMemo(() => getTripPlaceCollections(trip), [trip])
  const [routesOn, setRoutesOn] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchResultsOpen, setSearchResultsOpen] = useState(false)
  const [selectedSearchPlace, setSelectedSearchPlace] = useState(null)
  const [activeTab, setActiveTab] = useState('about')
  const [infoDismissed, setInfoDismissed] = useState(false)
  const [dayVisibility, setDayVisibility] = useState(() => new Map((trip.days || []).map((day) => [day.id, true])))
  const [poolVisible, setPoolVisible] = useState(true)
  const [routeLinesByDay, setRouteLinesByDay] = useState({})
  const [addToTripOpen, setAddToTripOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const searchAbortRef = useRef(null)

  useEffect(() => {
    if (!addToTripOpen) return
    const handleClickOutside = () => setAddToTripOpen(false)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [addToTripOpen])


  const dayColorById = useMemo(() => {
    const map = new Map()
    ;(trip.days || []).forEach((day, index) => {
      map.set(day.id, day.color || DAY_FALLBACK_COLORS[index % DAY_FALLBACK_COLORS.length])
    })
    return map
  }, [trip.days])

  useEffect(() => {
    setDayVisibility((prev) => {
      const next = new Map(prev)
      ;(trip.days || []).forEach((day) => {
        if (!next.has(day.id)) next.set(day.id, true)
      })
      Array.from(next.keys()).forEach((key) => {
        if (!(trip.days || []).some((day) => day.id === key)) next.delete(key)
      })
      return next
    })
  }, [trip.days])

  const selectedTripPlace = useMemo(() => findTripPlaceById(trip, selectedPlaceId), [trip, selectedPlaceId])
  const rawActiveInfoPlace = infoDismissed ? null : (selectedSearchPlace || selectedExplorePlace || selectedTripPlace)

  const activeInfoPlace = useMemo(() => {
    if (!rawActiveInfoPlace || typeof rawActiveInfoPlace !== 'object') return null

    let lat = rawActiveInfoPlace.lat !== undefined && rawActiveInfoPlace.lat !== null ? Number(rawActiveInfoPlace.lat) : null
    let lon = rawActiveInfoPlace.lon !== undefined && rawActiveInfoPlace.lon !== null ? Number(rawActiveInfoPlace.lon) : null

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const loc = rawActiveInfoPlace.location || rawActiveInfoPlace.gps_coordinates || rawActiveInfoPlace.coordinates || (rawActiveInfoPlace.geometry && rawActiveInfoPlace.geometry.location)
      if (loc && typeof loc === 'object') {
        const rawLat = loc.lat ?? loc.latitude ?? (Array.isArray(loc) ? loc[1] : undefined)
        const rawLon = loc.lon ?? loc.lng ?? loc.longitude ?? (Array.isArray(loc) ? loc[0] : undefined)
        if (rawLat !== undefined && rawLon !== undefined) {
          lat = Number(rawLat)
          lon = Number(rawLon)
        }
      } else if (rawActiveInfoPlace.latitude !== undefined && rawActiveInfoPlace.longitude !== undefined) {
        lat = Number(rawActiveInfoPlace.latitude)
        lon = Number(rawActiveInfoPlace.longitude)
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const fallback = getPlaceLatLon(rawActiveInfoPlace)
      if (fallback && Number.isFinite(fallback.lat) && Number.isFinite(fallback.lon)) {
        lat = fallback.lat
        lon = fallback.lon
      }
    }

    return {
      ...rawActiveInfoPlace,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
    }
  }, [rawActiveInfoPlace])

  const assignedLocation = useMemo(() => {
    if (!activeInfoPlace || !trip) return null
    const currentId = String(activeInfoPlace.place_id || activeInfoPlace.id || '').replace(/^serp-/, '')
    const currentTitle = String(activeInfoPlace.title || '').trim().toLowerCase()

    if (Array.isArray(trip.placesPool)) {
      const inPool = trip.placesPool.some((item) => {
        const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '')
        const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
        return (currentId && itemId && currentId === itemId) || (currentTitle && itemTitle && currentTitle === itemTitle)
      })
      if (inPool) return { type: 'pool', id: 'places-pool', label: 'Places to Visit' }
    }

    if (Array.isArray(trip.days)) {
      for (const day of trip.days) {
        if (!Array.isArray(day.items)) continue
        const found = day.items.some((item) => {
          const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '')
          const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
          return (currentId && itemId && currentId === itemId) || (currentTitle && itemTitle && currentTitle === itemTitle)
        })
        if (found) return { type: 'day', day, id: day.id }
      }
    }

    return null
  }, [activeInfoPlace, trip])

  const handleSelectOption = (targetOption) => {
    setAddToTripOpen(false)
    if (!activeInfoPlace || !targetOption) return

    if (assignedLocation && assignedLocation.id === targetOption.id) {
      return
    }

    const placeIdStr = String(activeInfoPlace.place_id || activeInfoPlace.id || `place-${Date.now()}`)
    const cleanTitle = activeInfoPlace.title || 'Untitled place'

    const newItem = {
      id: placeIdStr,
      place_id: placeIdStr,
      data_id: activeInfoPlace.data_id || '',
      title: cleanTitle,
      category: activeInfoPlace.category || 'attraction',
      subtitle: activeInfoPlace.address || activeInfoPlace.subtitle || '',
      lat: Number(getPlaceLatLon(activeInfoPlace).lat) || 33.6844,
      lon: Number(getPlaceLatLon(activeInfoPlace).lon) || 73.0479,
      address: activeInfoPlace.address || '',
      photo: activeInfoPlace.photo || (activeInfoPlace.images && activeInfoPlace.images[0]) || '',
      rating: activeInfoPlace.rating || null,
      reviewCount: activeInfoPlace.reviewCount || null,
      website: activeInfoPlace.website || '',
      phone: activeInfoPlace.phone || '',
      directionsLink: activeInfoPlace.directionsLink || '',
      openStatus: activeInfoPlace.openStatus || '',
      description: activeInfoPlace.description || '',
      note: '',
      startTime: '',
      endTime: '',
      visitDetails: {
        visited: false,
        visitedDate: null,
        visitedTime: null,
        notes: '',
      },
    }

    const isMove = Boolean(assignedLocation)

    updateTrip((prevTrip) => {
      if (!prevTrip) return prevTrip

      const filterItem = (itemsList) => (itemsList || []).filter((item) => {
        const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '')
        const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
        const currentId = String(activeInfoPlace.place_id || activeInfoPlace.id || '').replace(/^serp-/, '')
        const currentTitle = String(activeInfoPlace.title || '').trim().toLowerCase()
        return !((currentId && itemId && currentId === itemId) || (currentTitle && itemTitle && currentTitle === itemTitle))
      })

      let updatedPool = filterItem(prevTrip.placesPool)
      let updatedDays = (prevTrip.days || []).map((day) => ({
        ...day,
        items: filterItem(day.items),
      }))

      if (targetOption.type === 'pool') {
        const alreadyInPool = updatedPool.some((item) => {
          const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '')
          const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
          const currentId = String(activeInfoPlace.place_id || activeInfoPlace.id || '').replace(/^serp-/, '')
          const currentTitle = String(activeInfoPlace.title || '').trim().toLowerCase()
          return (currentId && itemId && currentId === itemId) || (currentTitle && itemTitle && currentTitle === itemTitle)
        })
        if (!alreadyInPool) {
          updatedPool.push(newItem)
        }
      } else if (targetOption.type === 'day') {
        updatedDays = updatedDays.map((day) => {
          if (day.id === targetOption.day.id) {
            const alreadyInDay = (day.items || []).some((item) => {
              const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '')
              const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
              const currentId = String(activeInfoPlace.place_id || activeInfoPlace.id || '').replace(/^serp-/, '')
              const currentTitle = String(activeInfoPlace.title || '').trim().toLowerCase()
              return (currentId && itemId && currentId === itemId) || (currentTitle && itemTitle && currentTitle === itemTitle)
            })
            if (!alreadyInDay) {
              return { ...day, items: [...(day.items || []), newItem] }
            }
          }
          return day
        })
      }

      return {
        ...prevTrip,
        placesPool: updatedPool,
        days: updatedDays,
      }
    })

    const targetLabel = targetOption.type === 'pool' ? 'Places to Visit' : (getDayDisplayInfo(targetOption.day, 0).dateText || getDayDisplayInfo(targetOption.day, 0).mainLabel)
    const message = isMove
      ? `✓ Moved to ${targetLabel}`
      : `✓ ${cleanTitle} added to ${targetLabel}`

    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleRemoveFromTrip = () => {
    setAddToTripOpen(false)
    if (!activeInfoPlace || !assignedLocation) return

    updateTrip((prevTrip) => {
      if (!prevTrip) return prevTrip

      const filterItem = (itemsList) => (itemsList || []).filter((item) => {
        const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '')
        const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
        const currentId = String(activeInfoPlace.place_id || activeInfoPlace.id || '').replace(/^serp-/, '')
        const currentTitle = String(activeInfoPlace.title || '').trim().toLowerCase()
        return !((currentId && itemId && currentId === itemId) || (currentTitle && itemTitle && currentTitle === itemTitle))
      })

      const updatedPool = filterItem(prevTrip.placesPool)
      const updatedDays = (prevTrip.days || []).map((day) => ({
        ...day,
        items: filterItem(day.items),
      }))

      return {
        ...prevTrip,
        placesPool: updatedPool,
        days: updatedDays,
      }
    })

    setToastMessage('✓ Removed from itinerary')
    setTimeout(() => setToastMessage(''), 3000)
  }







  const { weather: mapWeather, loading: mapWeatherLoading, error: mapWeatherError } = useWeather(activeInfoPlace)

  const [photosMap, setPhotosMap] = useState({})
  const [zoomedImageIndex, setZoomedImageIndex] = useState(null)
  const [copiedToast, setCopiedToast] = useState(false)

  const currentPhotoList = useMemo(() => {
    if (!activeInfoPlace) return []
    const targetDataId = activeInfoPlace.data_id || (activeInfoPlace.place_id || '').replace(/^serp-/, '')
    const richPhotos = (photosMap[targetDataId]?.photos || []).map((img) => {
      if (typeof img === 'string') return img.trim()
      if (img && typeof img === 'object') return (img.image || img.thumbnail || img.link || '').trim()
      return ''
    })
    const placeImages = (activeInfoPlace.images || []).map((img) => {
      if (typeof img === 'string') return img.trim()
      if (img && typeof img === 'object') return (img.image || img.thumbnail || img.link || '').trim()
      return ''
    })
    const mainPhoto = activeInfoPlace.photo ? [activeInfoPlace.photo] : []
    const combined = [...richPhotos, ...placeImages, ...mainPhoto]
    return Array.from(new Set(combined.filter(Boolean)))
  }, [activeInfoPlace, photosMap])



  // Lazy-load rich photos ONLY when the user clicks the "Photos" tab for the first time
  useEffect(() => {
    if (activeTab !== 'photos' || !activeInfoPlace) return
    const targetDataId = activeInfoPlace.data_id || (activeInfoPlace.place_id || '').replace(/^serp-/, '')
    if (!targetDataId) return

    if (photosMap[targetDataId]) return

    setPhotosMap((prev) => ({
      ...prev,
      [targetDataId]: { loading: true, photos: [], error: '' }
    }))

    fetchPlacePhotosRequest(targetDataId)
      .then((res) => {
        if (res && res.success && Array.isArray(res.photos)) {
          setPhotosMap((prev) => ({
            ...prev,
            [targetDataId]: { loading: false, photos: res.photos, error: '' }
          }))
        } else {
          setPhotosMap((prev) => ({
            ...prev,
            [targetDataId]: { loading: false, photos: [], error: '' }
          }))
        }
      })
      .catch((err) => {
        setPhotosMap((prev) => ({
          ...prev,
          [targetDataId]: { loading: false, photos: [], error: err.message || 'Failed to load photos' }
        }))
      })
  }, [activeTab, activeInfoPlace])


  const allVisibleBounds = useMemo(() => {
    const bounds = []
    if (poolVisible) {
      poolPlaces.forEach((place) => {
        const coords = getPlaceLatLon(place)
        bounds.push([coords.lat, coords.lon])
      })
    }
    dayPlaces.forEach((day) => {
      if (dayVisibility.get(day.dayId) === false) return
      day.items.forEach((place) => {
        const coords = getPlaceLatLon(place)
        bounds.push([coords.lat, coords.lon])
      })
    })
    if (selectedSearchPlace) {
      const coords = getPlaceLatLon(selectedSearchPlace)
      bounds.push([coords.lat, coords.lon])
    }
    if (selectedExplorePlace && isPlaceWithValidCoords(selectedExplorePlace)) {
      const coords = getPlaceLatLon(selectedExplorePlace)
      bounds.push([coords.lat, coords.lon])
    }
    return bounds
  }, [poolVisible, poolPlaces, dayPlaces, dayVisibility, selectedSearchPlace, selectedExplorePlace])

  const visibleDayIds = useMemo(() => {
    return new Set(dayPlaces.filter((day) => dayVisibility.get(day.dayId) !== false).map((day) => day.dayId))
  }, [dayPlaces, dayVisibility])
  const routeSignature = useMemo(() => buildRouteSignature(dayPlaces, visibleDayIds), [dayPlaces, visibleDayIds])

  useEffect(() => {
    if (!routesOn) {
      setRouteLinesByDay({})
      return
    }

    const routeCandidates = dayPlaces.filter((day) => visibleDayIds.has(day.dayId) && day.items.length >= 2)
    if (!routeCandidates.length) {
      setRouteLinesByDay({})
      return
    }

    const abort = new AbortController()
    const nextLines = {}

    Promise.all(routeCandidates.map(async (day) => {
      const points = day.items.map((item) => getPlaceLatLon(item))
      const coords = points.map((point) => `${point.lon},${point.lat}`).join(';')
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
          signal: abort.signal,
        })
        if (!response.ok) throw new Error('osrm')
        const data = await response.json()
        const line = data?.routes?.[0]?.geometry?.coordinates || []
        nextLines[day.dayId] = line.length
          ? line.map(([lon, lat]) => [lat, lon])
          : points.map((point) => [point.lat, point.lon])
      } catch (error) {
        if (String(error?.name || '') === 'AbortError') return
        nextLines[day.dayId] = points.map((point) => [point.lat, point.lon])
      }
    })).then(() => {
      if (!abort.signal.aborted) {
        setRouteLinesByDay(nextLines)
      }
    })

    return () => abort.abort()
  }, [routesOn, dayPlaces, visibleDayIds, routeSignature])

  useEffect(() => {
    if (!selectedTripPlace) return
    setSelectedSearchPlace(null)
    setActiveTab('about')
    setInfoDismissed(false)
  }, [selectedTripPlace])

  useEffect(() => {
    if (!selectedExplorePlace) return
    setSelectedSearchPlace(null)
    setActiveTab('about')
    setInfoDismissed(false)
  }, [selectedExplorePlace])

  useEffect(() => () => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }
  }, [])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!searchOpen || !query) {
      setSearchResults([])
      setSearchResultsOpen(false)
      return undefined
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }
    const abort = new AbortController()
    searchAbortRef.current = abort
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`, {
          signal: abort.signal,
        })
        const data = await response.json()
        const next = Array.isArray(data) ? data.slice(0, 8) : []
        setSearchResults(next)
        setSearchResultsOpen(next.length > 0)
      } catch (error) {
        if (String(error?.name || '') !== 'AbortError') {
          setSearchResults([])
          setSearchResultsOpen(false)
        }
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      abort.abort()
    }
  }, [searchOpen, searchQuery])

  const selectedPoint = activeInfoPlace ? [getPlaceLatLon(activeInfoPlace).lat, getPlaceLatLon(activeInfoPlace).lon] : null
  const activeDescription = activeInfoPlace?.description || activeInfoPlace?.note || activeInfoPlace?.subtitle || ''

  return (
    <div className="PlannerMapPanel__sticky">
      <div className="PlannerMapCanvas PlannerMapCanvas--leaflet">
        <div className={`PlannerMapSearch${searchOpen ? ' is-open' : ''}`}>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearchResults([])
                setSearchResultsOpen(false)
              }
            }}
            placeholder="Search places"
          />
          <div className={`PlannerMapSearchResults${searchResultsOpen ? ' is-open' : ''}`}>
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                type="button"
                className="PlannerMapSearchResult"
                onClick={() => {
                  setSelectedSearchPlace(buildSearchPlace(result))
                  setActiveTab('about')
                  setInfoDismissed(false)
                  setSearchResultsOpen(false)
                }}
              >
                <strong>{(result.display_name || '').split(',')[0] || 'Result'}</strong>
                <span>{result.display_name || ''}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="PlannerMapControls">
          <button
            type="button"
            className={`PlannerMapControlBtn${searchOpen ? ' is-active' : ''}`}
            aria-label="Search"
            onClick={() => {
              setSearchOpen((prev) => !prev)
              setLayersOpen(false)
            }}
          >
            🔍
          </button>
          <button
            type="button"
            className={`PlannerMapControlBtn${layersOpen ? ' is-active' : ''}`}
            aria-label="Layers"
            onClick={() => {
              setLayersOpen((prev) => !prev)
              setSearchOpen(false)
            }}
          >
            📊
          </button>
        </div>
        <div className={`PlannerMapLayersPanel${layersOpen ? ' is-open' : ''}`}>
          <div className="PlannerMapFloatingPanel">
            <div className="PlannerMapFloatingPanel__title">Overview</div>
            <label className="PlannerMapToggle">
              <input type="checkbox" checked={poolVisible} onChange={(event) => setPoolVisible(event.target.checked)} />
              <span>Places to visit</span>
            </label>
            <div className="PlannerMapFloatingPanel__title">Itinerary Days</div>
            <label className="PlannerMapToggle route-toggle">
              <input type="checkbox" checked={routesOn} onChange={(event) => setRoutesOn(event.target.checked)} />
              <span>Always show route lines</span>
            </label>
            {trip.days.map((day, index) => (
              <label key={day.id} className="PlannerMapToggle">
                <input
                  type="checkbox"
                  checked={dayVisibility.get(day.id) !== false}
                  onChange={(event) => setDayVisibility((prev) => new Map(prev).set(day.id, event.target.checked))}
                />
                <span>{day.shortLabel || `Day ${index + 1}`}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="PlannerLeafletMap">
          <MapContainer center={[33.6844, 73.0479]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              attribution="© OpenStreetMap contributors © CARTO"
              url={CARTO_TILE_URL}
            />
            <ZoomControl position="bottomright" />
            <FitMapToPlaces
              bounds={allVisibleBounds}
              boundsKey={buildRouteSignature(dayPlaces, visibleDayIds)}
              followSelected={Boolean(activeInfoPlace)}
              selectedPoint={selectedPoint}
            />
            <Pane name="routes" style={{ zIndex: 350 }} />
            <Pane name="markers" style={{ zIndex: 450 }} />

            {routesOn && Object.entries(routeLinesByDay).map(([dayId, line], index) => (
              <Polyline
                key={dayId}
                positions={line}
                pathOptions={{ color: dayColorById.get(dayId) || DAY_FALLBACK_COLORS[index % DAY_FALLBACK_COLORS.length], weight: 4, opacity: 0.85 }}
                pane="routes"
              />
            ))}

            {poolVisible && poolPlaces.map((place, index) => {
              const coords = getPlaceLatLon(place)
              const isSelected = String(selectedPlaceId) === String(place.id)
              return (
                <Marker
                  key={place.id}
                  position={[coords.lat, coords.lon]}
                  icon={createPoolIcon(index + 1, isSelected)}
                  pane="markers"
                  eventHandlers={{
                    click: () => {
                      setActiveTab('about')
                      setInfoDismissed(false)
                      onSelectPlace(place.id)
                    },
                  }}
                />
              )
            })}

            {dayPlaces.flatMap((day) => {
              if (dayVisibility.get(day.dayId) === false) return []
              const color = day.day?.color || dayColorById.get(day.dayId) || DAY_FALLBACK_COLORS[day.dayIndex % DAY_FALLBACK_COLORS.length]
              return day.items.map((place, index) => {
                const coords = getPlaceLatLon(place)
                const isSelected = String(selectedPlaceId) === String(place.id)
                return (
                  <Marker
                    key={place.id}
                    position={[coords.lat, coords.lon]}
                    icon={createItineraryIcon(index + 1, color, isSelected)}
                    pane="markers"
                    eventHandlers={{
                      click: () => {
                        setActiveTab('about')
                        onSelectPlace(place.id)
                      },
                    }}
                  />
                )
              })
            })}

            {selectedSearchPlace ? (
              <Marker
                position={[getPlaceLatLon(selectedSearchPlace).lat, getPlaceLatLon(selectedSearchPlace).lon]}
                icon={createTempMarkerIcon()}
                pane="markers"
              />
            ) : null}

            {selectedExplorePlace && isPlaceWithValidCoords(selectedExplorePlace) ? (
              <Marker
                position={[getPlaceLatLon(selectedExplorePlace).lat, getPlaceLatLon(selectedExplorePlace).lon]}
                icon={createTempMarkerIcon()}
                pane="markers"
              />
            ) : null}
          </MapContainer>
        </div>
        <div className="PlannerMapInfoPanelHost">
          {activeInfoPlace ? (
            <div className="PlannerMapInfoPanel">
              {/* Hero Image Banner if available */}
              {(activeInfoPlace.photo || (activeInfoPlace.images && activeInfoPlace.images.length > 0)) ? (
                <div className="PlannerMapInfoPanel__heroBanner">
                  <img
                    src={activeInfoPlace.photo || activeInfoPlace.images[0]}
                    alt={activeInfoPlace.title}
                    className="PlannerMapInfoPanel__heroImg"
                    onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
                  />
                </div>
              ) : null}

              <div className="PlannerMapInfoPanel__tabs">
                <button type="button" className={activeTab === 'about' ? 'is-active' : ''} onClick={() => setActiveTab('about')}>About</button>
                <button type="button" className={activeTab === 'photos' ? 'is-active' : ''} onClick={() => setActiveTab('photos')}>Photos {(activeInfoPlace.images && activeInfoPlace.images.length > 0) ? `(${activeInfoPlace.images.length})` : ''}</button>
                <button type="button" className={activeTab === 'reviews' ? 'is-active' : ''} onClick={() => setActiveTab('reviews')}>Reviews {(activeInfoPlace.userReviews && activeInfoPlace.userReviews.length > 0) ? `(${activeInfoPlace.userReviews.length})` : ''}</button>
                <button type="button" className={activeTab === 'weather' ? 'is-active' : ''} onClick={() => setActiveTab('weather')}>Weather</button>
              </div>

              <div className="PlannerMapInfoPanel__body">
                <div className="PlannerMapInfoPanel__header">
                  <div>
                    <h3>{activeInfoPlace.title || 'Untitled place'}</h3>
                    <div className="PlannerMapInfoPanel__badges">
                      {activeInfoPlace.rating ? (
                        <span className="PlannerMapBadge PlannerMapBadge--rating">
                          ⭐ {activeInfoPlace.rating}
                          {activeInfoPlace.reviewCount ? ` (${activeInfoPlace.reviewCount.toLocaleString()})` : ''}
                        </span>
                      ) : null}
                      {activeInfoPlace.category ? (
                        <span className="PlannerMapBadge PlannerMapBadge--category">{activeInfoPlace.category}</span>
                      ) : null}
                      {activeInfoPlace.openStatus ? (
                        <span className={`PlannerMapBadge PlannerMapBadge--status ${activeInfoPlace.openStatus.toLowerCase().includes('open') ? 'is-open' : 'is-closed'}`}>
                          {activeInfoPlace.openStatus}
                        </span>
                      ) : null}
                      {activeInfoPlace.priceLevel ? (
                        <span className="PlannerMapBadge PlannerMapBadge--price">{activeInfoPlace.priceLevel}</span>
                      ) : null}
                    </div>
                    <div className="PlannerMapInfoPanel__meta">
                      📍 {getPlaceLatLon(activeInfoPlace).lat.toFixed(5)}, {getPlaceLatLon(activeInfoPlace).lon.toFixed(5)}
                    </div>

                    {/* Split Pill Button */}
                    <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: '20px',
                          overflow: 'hidden',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                          backgroundColor: assignedLocation ? '#f1f5f9' : '#1e293b',
                          border: assignedLocation ? '1px solid #cbd5e1' : '1px solid #1e293b',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Left Section */}
                        <button
                          type="button"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            border: 'none',
                            background: 'transparent',
                            color: assignedLocation ? '#0f172a' : '#ffffff',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setAddToTripOpen((prev) => !prev)
                          }}
                        >
                          {assignedLocation ? '✓ Added' : '+ Add to Trip'}
                        </button>

                        {/* Subtle Vertical Divider */}
                        <div
                          style={{
                            width: '1px',
                            height: '16px',
                            backgroundColor: assignedLocation ? '#cbd5e1' : 'rgba(255,255,255,0.25)',
                          }}
                        />

                        {/* Right Section Arrow */}
                        <button
                          type="button"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            border: 'none',
                            background: 'transparent',
                            color: assignedLocation ? '#0f172a' : '#ffffff',
                            fontSize: '10px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setAddToTripOpen((prev) => !prev)
                          }}
                        >
                          ▼
                        </button>
                      </div>

                      {/* Dropdown Menu (TripNest Color Palette) */}
                      {addToTripOpen ? (
                        <div
                          className="PlannerAddToTripDropdown"
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            zIndex: 9999,
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 12px 28px -4px rgba(0,0,0,0.18), 0 6px 12px -4px rgba(0,0,0,0.08)',
                            border: '1px solid #e2e8f0',
                            minWidth: '220px',
                            padding: '6px 0',
                            overflow: 'hidden',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* 1. Places to Visit Option */}
                          {(() => {
                            const isPoolAssigned = assignedLocation && assignedLocation.type === 'pool'
                            return (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '9px 14px',
                                  backgroundColor: isPoolAssigned ? '#eff6ff' : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease',
                                  borderLeft: isPoolAssigned ? '3px solid #2563eb' : '3px solid transparent',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isPoolAssigned) e.currentTarget.style.backgroundColor = '#f8fafc'
                                }}
                                onMouseLeave={(e) => {
                                  if (!isPoolAssigned) e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                onClick={() => handleSelectOption({ type: 'pool', id: 'places-pool', label: 'Places to Visit' })}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: isPoolAssigned ? '700' : '600',
                                      color: isPoolAssigned ? '#2563eb' : '#1e293b',
                                    }}
                                  >
                                    📍 Places to Visit
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                    Unscheduled places pool
                                  </span>
                                </div>
                                {isPoolAssigned ? (
                                  <span style={{ fontSize: '14px', color: '#2563eb', fontWeight: '700' }}>✔</span>
                                ) : null}
                              </div>
                            )
                          })()}

                          <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

                          {/* 2. Itinerary Days Options */}
                          {trip?.days && trip.days.length > 0 ? (
                            trip.days.map((day, idx) => {
                              const isDayAssigned = assignedLocation && assignedLocation.type === 'day' && assignedLocation.id === day.id
                              const { mainLabel, subLabel } = getDayDisplayInfo(day, idx)
                              return (
                                <div
                                  key={day.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '9px 14px',
                                    backgroundColor: isDayAssigned ? '#eff6ff' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s ease',
                                    borderLeft: isDayAssigned ? '3px solid #2563eb' : '3px solid transparent',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isDayAssigned) e.currentTarget.style.backgroundColor = '#f8fafc'
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isDayAssigned) e.currentTarget.style.backgroundColor = 'transparent'
                                  }}
                                  onClick={() => handleSelectOption({ type: 'day', day, id: day.id })}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span
                                      style={{
                                        fontSize: '13px',
                                        fontWeight: isDayAssigned ? '700' : '600',
                                        color: isDayAssigned ? '#2563eb' : '#1e293b',
                                      }}
                                    >
                                      📅 {mainLabel}
                                    </span>
                                    {subLabel ? (
                                      <span style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                        {subLabel}
                                      </span>
                                    ) : null}
                                  </div>

                                  {isDayAssigned ? (
                                    <span style={{ fontSize: '14px', color: '#2563eb', fontWeight: '700' }}>✔</span>
                                  ) : null}
                                </div>
                              )
                            })
                          ) : (
                            <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8' }}>
                              No itinerary days found
                            </div>
                          )}

                          {/* 3. Remove from Itinerary Option */}
                          {assignedLocation ? (
                            <>
                              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '9px 14px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fef2f2'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                onClick={handleRemoveFromTrip}
                              >
                                <span>🗑️ Remove from itinerary</span>
                              </div>
                            </>
                          ) : null}

                        </div>
                      ) : null}
                    </div>



                  </div>

                  <button
                    type="button"
                    className="PlannerMapInfoPanel__close"
                    onClick={() => {
                      setInfoDismissed(true)
                    }}
                  >
                    ✕
                  </button>
                </div>

                {activeTab === 'about' ? (
                  <div className="PlannerMapInfoPanel__sectionGroup">
                    {/* About Snippet */}
                    <div className="PlannerMapInfoPanel__descBox">
                      <p>{activeDescription || `Discover ${activeInfoPlace.title || 'this spot'}${activeInfoPlace.address ? ` located at ${activeInfoPlace.address}` : ''}.`}</p>
                    </div>

                    {/* Contact & Information (Includes Plus Code) */}
                    {(activeInfoPlace.address || activeInfoPlace.plusCode || activeInfoPlace.phone || activeInfoPlace.website || activeInfoPlace.directionsLink) ? (
                      <div className="PlannerMapInfoPanel__contactCard">
                        <h4 className="PlannerMapInfoPanel__subTitle">Contact & Information</h4>
                        <ul className="PlannerMapInfoPanel__infoList">
                          {activeInfoPlace.address ? (
                            <li>
                              <span className="PlannerInfoIcon">📍</span>
                              <span>{activeInfoPlace.address}</span>
                            </li>
                          ) : null}
                          {activeInfoPlace.plusCode ? (
                            <li style={{ fontSize: '11px', color: '#64748b', paddingLeft: '22px', marginTop: '-2px' }}>
                              <span>Plus Code: <strong>{activeInfoPlace.plusCode}</strong></span>
                            </li>
                          ) : null}
                          {activeInfoPlace.phone ? (
                            <li>
                              <span className="PlannerInfoIcon">📞</span>
                              <a href={`tel:${activeInfoPlace.phone}`} className="PlannerInfoLink">{activeInfoPlace.phone}</a>
                            </li>
                          ) : null}
                          {activeInfoPlace.website ? (
                            <li>
                              <span className="PlannerInfoIcon">🌐</span>
                              <a href={activeInfoPlace.website} target="_blank" rel="noreferrer" className="PlannerInfoLink">Visit Website ↗</a>
                            </li>
                          ) : null}
                        </ul>

                        {/* Unified Primary Action Bar */}
                        <div className="PlannerMapInfoPanel__actionsBar" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                          {activeInfoPlace.directionsLink ? (
                            <a
                              href={activeInfoPlace.directionsLink}
                              target="_blank"
                              rel="noreferrer"
                              className="PlannerPillButton PlannerPillButton--accent"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', flex: '1', minWidth: '130px', justifyContent: 'center' }}
                            >
                              🧭 Directions
                            </a>
                          ) : null}

                          {activeInfoPlace.website ? (
                            <a
                              href={activeInfoPlace.website}
                              target="_blank"
                              rel="noreferrer"
                              className="PlannerPillButton PlannerPillButton--light"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', flex: '1', minWidth: '100px', justifyContent: 'center' }}
                            >
                              🌐 Website ↗
                            </a>
                          ) : null}

                          {activeInfoPlace.phone ? (
                            <a
                              href={`tel:${activeInfoPlace.phone}`}
                              className="PlannerPillButton PlannerPillButton--light"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', flex: '1', minWidth: '85px', justifyContent: 'center' }}
                            >
                              📞 Call
                            </a>
                          ) : null}

                          <button
                            type="button"
                            className="PlannerPillButton PlannerPillButton--light"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: '1', minWidth: '80px', justifyContent: 'center', cursor: 'pointer' }}
                            onClick={() => {
                              const textToCopy = `${activeInfoPlace.title || 'Place'} - ${activeInfoPlace.address || ''}`
                              navigator.clipboard.writeText(textToCopy)
                              setCopiedToast(true)
                              setTimeout(() => setCopiedToast(false), 2000)
                            }}
                          >
                            🔗 {copiedToast ? 'Copied!' : 'Share'}
                          </button>

                          {activeInfoPlace.menuLink ? (
                            <a
                              href={activeInfoPlace.menuLink}
                              target="_blank"
                              rel="noreferrer"
                              className="PlannerPillButton PlannerPillButton--light"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', flex: '1', minWidth: '90px', justifyContent: 'center' }}
                            >
                              📖 Menu ↗
                            </a>
                          ) : null}

                          {(activeInfoPlace.bookingLink || activeInfoPlace.reserveLink) ? (
                            <a
                              href={activeInfoPlace.bookingLink || activeInfoPlace.reserveLink}
                              target="_blank"
                              rel="noreferrer"
                              className="PlannerPillButton PlannerPillButton--accent"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', flex: '1', minWidth: '110px', justifyContent: 'center' }}
                            >
                              📅 Reserve ↗
                            </a>
                          ) : null}
                        </div>

                      </div>
                    ) : null}

                    {/* SECTION 1: Operating Hours (Full Mon-Sun schedule, Highlight today, Show last updated) */}
                    {activeInfoPlace.operatingHours && Object.keys(activeInfoPlace.operatingHours).length > 0 ? (
                      <div className="PlannerMapInfoPanel__contactCard">
                        <h4 className="PlannerMapInfoPanel__subTitle">⏰ Operating Hours</h4>
                        <div className="PlannerMapInfoPanel__hoursBox">
                          <div className="PlannerMapInfoPanel__hoursGrid">
                            {(() => {
                              const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
                              return Object.entries(activeInfoPlace.operatingHours).map(([day, hours]) => {
                                const isToday = day.toLowerCase() === todayName
                                return (
                                  <div
                                    key={day}
                                    className={`PlannerMapInfoPanel__hoursRow${isToday ? ' is-today' : ''}`}
                                    style={isToday ? { fontWeight: '700', color: '#ea580c', backgroundColor: 'rgba(242,94,37,0.08)', borderRadius: '4px', padding: '2px 6px' } : {}}
                                  >
                                    <span className="PlannerDayName">{day}{isToday ? ' (Today)' : ''}</span>
                                    <span className="PlannerDayHours">{hours}</span>
                                  </div>
                                )
                              })
                            })()}
                          </div>
                          {activeInfoPlace.hoursLastUpdated ? (
                            <div className="PlannerHoursUpdatedNotice" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', fontStyle: 'italic' }}>
                              ℹ️ {activeInfoPlace.hoursLastUpdated}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {/* SECTION 2: Visit Insights (Typical Visit Duration & Live Busyness/Crowd Status) */}
                    {(() => {
                      const timeSpent = activeInfoPlace.popularTimes?.live_hash?.time_spent || activeInfoPlace.popularTimes?.time_spent
                      const crowdInfo = activeInfoPlace.popularTimes?.live_hash?.info || activeInfoPlace.popularTimes?.info
                      if (!timeSpent && !crowdInfo) return null

                      return (
                        <div className="PlannerMapInfoPanel__contactCard">
                          <h4 className="PlannerMapInfoPanel__subTitle">⏱ Visit Insights</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                            {timeSpent ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '16px' }}>⏳</span>
                                <div>
                                  <div style={{ fontWeight: '600', color: '#334155' }}>Typical Duration</div>
                                  <div style={{ color: '#64748b' }}>{timeSpent}</div>
                                </div>
                              </div>
                            ) : null}
                            {crowdInfo ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '16px' }}>📊</span>
                                <div>
                                  <div style={{ fontWeight: '600', color: '#334155' }}>Live Crowd Status</div>
                                  <div style={{ color: '#64748b' }}>{crowdInfo}</div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })()}

                    {/* SECTION 3: Accessibility & Amenities */}
                    {activeInfoPlace.serviceOptions && activeInfoPlace.serviceOptions.length > 0 ? (
                      <div className="PlannerMapInfoPanel__amenitiesCard">
                        <h4 className="PlannerMapInfoPanel__subTitle">Accessibility & Amenities</h4>
                        <div className="PlannerMapInfoPanel__tagCloud">
                          {activeInfoPlace.serviceOptions.map((opt, idx) => (
                            <span key={idx} className="PlannerFeatureBadge">✓ {opt}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* SECTION 4: At This Place (Sub-venue Information for Malls/Complexes) */}
                    {activeInfoPlace.atThisPlace && activeInfoPlace.atThisPlace.type && activeInfoPlace.atThisPlace.type.length > 0 ? (
                      <div className="PlannerMapInfoPanel__amenitiesCard">
                        <h4 className="PlannerMapInfoPanel__subTitle">🛍️ At This Place</h4>
                        <div className="PlannerMapInfoPanel__tagCloud">
                          {activeInfoPlace.atThisPlace.type.map((subItem, idx) => (
                            <span key={idx} className="PlannerFeatureBadge" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                              {subItem.title} ({subItem.places})
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}



                    {selectedSearchPlace ? (
                      <div className="PlannerMapCard__actions">
                        <button type="button" className="PlannerPillButton PlannerPillButton--accent" onClick={() => onAddPlaceToPool(selectedSearchPlace)}>
                          Add to trip
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : activeTab === 'photos' ? (
                  <div className="PlannerMapInfoPanel__photosTab">
                    {(() => {
                      const targetDataId = activeInfoPlace?.data_id || (activeInfoPlace?.place_id || '').replace(/^serp-/, '')
                      const photoState = photosMap[targetDataId]
                      const richPhotos = photoState?.photos || []

                      if (photoState?.loading) {
                        return (
                          <div className="PlannerEmptyState" style={{ padding: '24px 0', textAlign: 'center' }}>
                            <div className="PlannerSpinner" style={{ margin: '0 auto 8px auto' }} />
                            <span>Loading photo gallery...</span>
                          </div>
                        )
                      }

                      if (richPhotos.length > 0) {
                        return (
                          <div className="PlannerMapInfoPanel__photoGrid">
                            {richPhotos.map((item, i) => {
                              const src = typeof item === 'string' ? item : (item.image || item.thumbnail)
                              return (
                                <div
                                  key={i}
                                  className="PlannerMapInfoPanel__photoItem"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setZoomedImageIndex(i)}
                                >
                                  <img
                                    src={src}
                                    alt={item.title || `${activeInfoPlace.title} ${i + 1}`}
                                    className="PlannerMapInfoPanel__gridImg"
                                    onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )
                      }

                      if (currentPhotoList.length > 0) {
                        return (
                          <div className="PlannerMapInfoPanel__photoGrid">
                            {currentPhotoList.map((imgUrl, i) => (
                              <div
                                key={i}
                                className="PlannerMapInfoPanel__photoItem"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setZoomedImageIndex(i)}
                              >
                                <img
                                  src={imgUrl}
                                  alt={`${activeInfoPlace.title} ${i + 1}`}
                                  className="PlannerMapInfoPanel__gridImg"
                                  onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }}
                                />
                              </div>
                            ))}
                          </div>
                        )
                      }

                      return <div className="PlannerEmptyState">No additional photos available.</div>
                    })()}

                    {/* Lightbox Modal with Prev/Next Controls */}
                    {zoomedImageIndex !== null && currentPhotoList.length > 0 ? (
                      <div
                        className="PlannerPhotoLightbox"
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0,0,0,0.88)',
                          zIndex: 99999,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '20px',
                        }}
                        onClick={() => setZoomedImageIndex(null)}
                      >
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '90vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
                          <img
                            src={typeof currentPhotoList[zoomedImageIndex] === 'string' ? currentPhotoList[zoomedImageIndex] : (currentPhotoList[zoomedImageIndex]?.image || currentPhotoList[zoomedImageIndex]?.thumbnail || currentPhotoList[zoomedImageIndex]?.link || '')}
                            alt="Enlarged view"
                            style={{ maxWidth: '90vw', maxHeight: '75vh', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', objectFit: 'contain' }}
                          />

                          
                          {/* Image Counter Badge */}
                          <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', marginTop: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '12px' }}>
                            Photo {zoomedImageIndex + 1} of {currentPhotoList.length}
                          </div>

                          {/* Previous Button */}
                          {currentPhotoList.length > 1 ? (
                            <button
                              type="button"
                              style={{
                                position: 'fixed',
                                left: '20px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255,255,255,0.2)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '44px',
                                height: '44px',
                                fontSize: '24px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setZoomedImageIndex((prev) => (prev - 1 + currentPhotoList.length) % currentPhotoList.length)
                              }}
                            >
                              ‹
                            </button>
                          ) : null}

                          {/* Next Button */}
                          {currentPhotoList.length > 1 ? (
                            <button
                              type="button"
                              style={{
                                position: 'fixed',
                                right: '20px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255,255,255,0.2)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '44px',
                                height: '44px',
                                fontSize: '24px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setZoomedImageIndex((prev) => (prev + 1) % currentPhotoList.length)
                              }}
                            >
                              ›
                            </button>
                          ) : null}

                          {/* Close Button */}
                          <button
                            type="button"
                            style={{
                              position: 'fixed',
                              top: '20px',
                              right: '20px',
                              background: 'rgba(255,255,255,0.2)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '36px',
                              height: '36px',
                              fontSize: '20px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setZoomedImageIndex(null)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
                 : activeTab === 'reviews' ? (
                  <div className="PlannerMapInfoPanel__reviewsTab" style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingBottom: '16px' }}>
                    {activeInfoPlace.userReviews && activeInfoPlace.userReviews.length > 0 ? (
                      <div className="PlannerMapInfoPanel__reviewList">
                        {activeInfoPlace.userReviews.map((rev, i) => (
                          <div key={i} className="PlannerReviewCard">
                            <div className="PlannerReviewCard__header">
                              <div className="PlannerReviewCard__user" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {rev.userThumbnail ? (
                                  <img src={rev.userThumbnail} alt={rev.user} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                ) : (
                                  <span className="PlannerReviewCard__avatar">👤</span>
                                )}
                                <strong>{rev.user || 'Traveler'}</strong>
                              </div>
                              <div className="PlannerReviewCard__meta">
                                <span className="PlannerReviewCard__stars">⭐ {rev.rating}</span>
                                {rev.date ? <span className="PlannerReviewCard__date">{rev.date}</span> : null}
                              </div>
                            </div>
                            {rev.snippet ? (
                              <p className="PlannerReviewCard__text">{rev.snippet}</p>
                            ) : null}
                          </div>
                        ))}

                        {/* View All Google Reviews External Link */}
                        {activeInfoPlace.reviewsLink ? (
                          <div style={{ marginTop: '16px', textAlign: 'center' }}>
                            <a
                              href={activeInfoPlace.reviewsLink}
                              target="_blank"
                              rel="noreferrer"
                              className="PlannerPillButton PlannerPillButton--light"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '13px', padding: '8px 18px', width: '100%', justifyContent: 'center' }}
                            >
                              🌐 View all Google Maps reviews ↗
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="PlannerEmptyState">
                        <p>No review snippets available for this place.</p>
                        {activeInfoPlace.reviewsLink ? (
                          <div style={{ marginTop: '12px' }}>
                            <a
                              href={activeInfoPlace.reviewsLink}
                              target="_blank"
                              rel="noreferrer"
                              className="PlannerPillButton PlannerPillButton--light"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '13px' }}
                            >
                              🌐 View Google Maps reviews ↗
                            </a>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>


                ) : activeTab === 'weather' ? (
                  <div className="PlannerMapInfoPanel__weatherTab" style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingBottom: '16px' }}>
                    {mapWeatherLoading ? (
                      <div className="WeatherPlaceholder">Loading weather...</div>
                    ) : mapWeatherError ? (
                      <div className="WeatherErrorText">Weather unavailable</div>
                    ) : mapWeather ? (
                      <div className="WeatherStackedCard">
                        <div className="WeatherHeaderSection">
                          <WeatherIcon icon={mapWeather.icon} description={mapWeather.description} size={48} />
                          <div className="WeatherHeaderTempGroup">
                            <div className="WeatherHeaderTemp">{mapWeather.temperature}°C</div>
                            <div className="WeatherHeaderDesc">{mapWeather.description}</div>
                            <div className="WeatherHeaderFeels">Feels like {mapWeather.feels_like}°C</div>
                          </div>
                        </div>

                        <div className="WeatherVerticalMetrics">
                          <div className="WeatherMetricRow">
                            <span className="WeatherMetricRowLabel">💧 Humidity</span>
                            <span className="WeatherMetricRowVal">{mapWeather.humidity}%</span>
                          </div>

                          <div className="WeatherMetricRow">
                            <span className="WeatherMetricRowLabel">🌬️ Wind Speed</span>
                            <span className="WeatherMetricRowVal">{mapWeather.wind_speed} m/s</span>
                          </div>

                          <div className="WeatherMetricRow">
                            <span className="WeatherMetricRowLabel">☁️ Cloud Cover</span>
                            <span className="WeatherMetricRowVal">{mapWeather.cloud_cover ?? 20}%</span>
                          </div>

                          <div className="WeatherMetricRow">
                            <span className="WeatherMetricRowLabel">🌡️ Pressure</span>
                            <span className="WeatherMetricRowVal">{mapWeather.pressure ?? 1012} hPa</span>
                          </div>
                        </div>

                        <div className="WeatherStackedFooter">
                          <span>⏱ Updated just now</span>
                        </div>
                      </div>
                    ) : (
                      <div className="WeatherErrorText">Weather unavailable</div>
                    )}
                  </div>
                ) : null}

              </div>
            </div>
          ) : null}

          {/* Toast Notification Banner */}
          {toastMessage ? (
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                pointerEvents: 'none',
              }}
            >
              {toastMessage}
            </div>
          ) : null}
        </div>


      </div>
    </div>
  )
}
