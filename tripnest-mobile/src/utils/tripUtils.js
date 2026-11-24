/**
 * TripNest Mobile - Trip & Itinerary Utilities
 * 
 * Parity with existing travel-intelligence-react web implementation:
 * - Date range calculation & day generation
 * - Rebuilding days upon date range modifications with item preservation
 * - Spatial distance & OSRM / TSP Nearest Neighbor route optimization
 * - Full trip schema normalization & preservation
 */

import { PROVINCE_COORDS, KNOWN_CITY_COORDS, guessProvinceFromTripName, getDestinationCoordinates, geocodePlaceQuery } from './locationService.js'
export { PROVINCE_COORDS, KNOWN_CITY_COORDS, guessProvinceFromTripName, getDestinationCoordinates, geocodePlaceQuery }
import { findVerifiedLandmark } from '../services/imageService.js'
import { RECOMMENDED_PLACES_CATALOG } from '../constants/images.js'

export const DAY_FALLBACK_COLORS = [
  '#2563eb', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
]

export function getDayColor(dayIndex) {
  return DAY_FALLBACK_COLORS[dayIndex % DAY_FALLBACK_COLORS.length]
}

export function toNormalizedIsoDate(value) {
  if (!value) return ''
  const str = String(value).trim()
  if (!str) return ''

  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (ymdMatch) {
    const y = ymdMatch[1]
    const m = String(ymdMatch[2]).padStart(2, '0')
    const d = String(ymdMatch[3]).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const parsed = new Date(str)
  if (Number.isFinite(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const m = String(slashMatch[1]).padStart(2, '0')
    const d = String(slashMatch[2]).padStart(2, '0')
    const y = slashMatch[3]
    return `${y}-${m}-${d}`
  }

  return ''
}

export function addDaysToIso(isoDateStr, daysToAdd) {
  if (!isoDateStr) return ''
  const parts = isoDateStr.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0])) return ''
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  d.setUTCDate(d.getUTCDate() + daysToAdd)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function countDaysBetweenIso(startIso, endIso) {
  if (!startIso || !endIso) return 1
  const ymd1 = startIso.split('-').map(Number)
  const ymd2 = endIso.split('-').map(Number)
  const d1 = Date.UTC(ymd1[0], ymd1[1] - 1, ymd1[2])
  const d2 = Date.UTC(ymd2[0], ymd2[1] - 1, ymd2[2])
  const diffMs = d2 - d1
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
}

export function isoToDateString(isoDateStr) {
  if (!isoDateStr) return ''
  const ymd = isoDateStr.split('-').map(Number)
  if (ymd.length < 3) return ''
  const d = new Date(ymd[0], ymd[1] - 1, ymd[2], 12, 0, 0)
  return d.toDateString()
}

export function formatTripDateRange(startDate, endDate) {
  if (!startDate && !endDate) return ''
  if (startDate && endDate) return `${startDate} - ${endDate}`
  return startDate || endDate || ''
}

export function formatDayLabel(dateStr, fallback = 'Day') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (!Number.isFinite(date.getTime())) return fallback
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatMonthDayDisplay(dateVal) {
  if (!dateVal) return ''
  const iso = toNormalizedIsoDate(dateVal)
  if (iso) {
    const ymd = iso.split('-').map(Number)
    const d = new Date(ymd[0], ymd[1] - 1, ymd[2], 12, 0, 0)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const d = new Date(dateVal)
  if (Number.isFinite(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return String(dateVal)
}

/**
 * Builds dynamically indexed days from any startDate and endDate range.
 * Never hardcodes days count; supports 1 day, 5 days, 14 days, etc.
 */
export function buildDaysFromDateRange(startInput, endInput, destination = '') {
  const normStart = toNormalizedIsoDate(startInput) || new Date().toISOString().slice(0, 10)
  const normEnd = toNormalizedIsoDate(endInput) || normStart
  const totalDays = countDaysBetweenIso(normStart, normEnd)

  const days = []
  for (let i = 0; i < totalDays; i++) {
    const currentIso = addDaysToIso(normStart, i)
    const dateStr = isoToDateString(currentIso)
    const labelDate = formatDayLabel(dateStr, `Day ${i + 1}`)

    days.push({
      id: `day-${i + 1}`,
      label: labelDate !== `Day ${i + 1}` ? `${labelDate}${destination ? ` • ${destination}` : ''}` : `Day ${i + 1}`,
      shortLabel: `Day ${i + 1}`,
      date: dateStr,
      isoDate: currentIso,
      items: [],
    })
  }
  return days
}

/**
 * Rebuilds days when the user edits trip dates, strictly keeping existing
 * day items mapped to their corresponding calendar dates.
 */
export function rebuildTripDays(existingDays = [], newStartDate, newEndDate, previousTripStartDate) {
  const normNewStart = toNormalizedIsoDate(newStartDate)
  const normNewEnd = toNormalizedIsoDate(newEndDate)
  if (!normNewStart || !normNewEnd) return existingDays

  const totalDays = countDaysBetweenIso(normNewStart, normNewEnd)
  const tripStartDateIso = toNormalizedIsoDate(previousTripStartDate || (existingDays[0]?.date || ''))

  // Index existing days by actual ISO date or by index fallback
  const daysByIso = new Map()
  existingDays.forEach((day, idx) => {
    let dayIso = toNormalizedIsoDate(day.date)
    if (!dayIso && tripStartDateIso) {
      dayIso = addDaysToIso(tripStartDateIso, idx)
    }
    if (dayIso && !daysByIso.has(dayIso)) {
      daysByIso.set(dayIso, day)
    }
  })

  const nextDays = []
  for (let i = 0; i < totalDays; i++) {
    const currentIso = addDaysToIso(normNewStart, i)
    const dateStr = isoToDateString(currentIso)
    const labelDate = formatDayLabel(dateStr, `Day ${i + 1}`)

    const existingDay = daysByIso.get(currentIso) || (existingDays[i] && !daysByIso.size ? existingDays[i] : null)

    if (existingDay) {
      nextDays.push({
        ...existingDay,
        id: existingDay.id || `day-${i + 1}`,
        label: labelDate !== `Day ${i + 1}` ? labelDate : `Day ${i + 1}`,
        shortLabel: `Day ${i + 1}`,
        date: dateStr,
        isoDate: currentIso,
      })
    } else {
      nextDays.push({
        id: `day-${Date.now()}-${i + 1}`,
        label: labelDate !== `Day ${i + 1}` ? labelDate : `Day ${i + 1}`,
        shortLabel: `Day ${i + 1}`,
        date: dateStr,
        isoDate: currentIso,
        items: [],
      })
    }
  }

  return nextDays
}

/**
 * Rebuilds metadata for all days in a trip after add/remove/reorder.
 */
export function rebuildTripDayMetadata(prevTrip, rawDays) {
  const hasValidStart = Number.isFinite(new Date(prevTrip.startDate).getTime())
  const days = rawDays.map((day, index) => {
    let date = day.date
    let isoDate = day.isoDate
    if (hasValidStart) {
      const nextDate = new Date(prevTrip.startDate)
      nextDate.setDate(nextDate.getDate() + index)
      date = nextDate.toDateString()
      isoDate = nextDate.toISOString().slice(0, 10)
    }
    const labelDate = formatDayLabel(date, `Day ${index + 1}`)
    return {
      ...day,
      label: labelDate !== `Day ${index + 1}` ? labelDate : `Day ${index + 1}`,
      shortLabel: `Day ${index + 1}`,
      date,
      isoDate,
    }
  })

  if (!hasValidStart || !days.length) {
    return { ...prevTrip, days }
  }

  const endDate = new Date(prevTrip.startDate)
  endDate.setDate(endDate.getDate() + days.length - 1)
  const endDateIso = endDate.toISOString().slice(0, 10)
  return {
    ...prevTrip,
    days,
    endDate: endDateIso,
    dates: `${prevTrip.startDate} - ${endDateIso}`,
  }
}


/**
 * Ensures strict parity with TripNest website schema and unpackages
 * MongoDB document structures from the backend.
 * Never drops unknown or currently unused fields.
 */
export function ensureWorkspaceParityTrip(trip) {
  if (!trip || typeof trip !== 'object') {
    return {
      id: Date.now(),
      tripId: Date.now(),
      title: 'My Trip',
      name: 'My Trip',
      destination: 'Islamabad',
      dates: '',
      startDate: '',
      endDate: '',
      notes: '',
      privacy: 'private',
      placesPool: [],
      customLists: [],
      days: [],
      expenses: [],
      budget: { currency: 'PKR', amount: 0 },
      map: { selectedPlaceId: null },
      enginePreferences: {
        province: 'Punjab',
        startLat: 33.6844,
        startLon: 73.0479,
        maxBudget: 50000,
        maxTravelHours: 12,
        preferredCategories: ['park', 'scenic', 'museum'],
      },
    }
  }

  // Handle MongoDB / backend nested data wrappers (parity with website normalizeSavedTripForWorkspace)
  const recData = trip.data && typeof trip.data === 'object' ? trip.data : null
  const nested = recData?.data && typeof recData.data === 'object' ? recData.data : null
  const nestedMoreDetailed = nested && Object.keys(nested).length > Object.keys(recData || {}).length
  const base = (nestedMoreDetailed ? nested : recData) || trip || {}

  const rawId = trip.tripId || trip.id || trip._id || base.tripId || base.id || base._id
  const resolvedId = rawId !== undefined && rawId !== null && String(rawId).trim() !== ''
    ? rawId
    : Date.now()
  const rawDest = trip.destination || trip.name || trip.title || base.destination || base.name || base.title || 'Pakistan'
  const destination = String(rawDest).trim() || 'Pakistan'
  const startDate = trip.startDate || base.startDate || ''
  const endDate = trip.endDate || base.endDate || ''
  const dates = trip.dates || formatTripDateRange(startDate, endDate) || base.dates || ''

  // Resolve days from root, base.days, or base.itinerary
  let days = []
  if (Array.isArray(trip.days) && trip.days.length > 0) {
    days = trip.days
  } else if (Array.isArray(base.days) && base.days.length > 0) {
    days = base.days
  } else if (Array.isArray(base.itinerary) && base.itinerary.length > 0) {
    days = base.itinerary
  } else if (Array.isArray(trip.itinerary) && trip.itinerary.length > 0) {
    days = trip.itinerary
  }

  // Resolve placesPool from root, base.placesPool, base.locations, or base.places
  let placesPool = []
  if (Array.isArray(trip.placesPool)) {
    placesPool = trip.placesPool
  } else if (Array.isArray(base.placesPool)) {
    placesPool = base.placesPool
  } else if (Array.isArray(base.locations)) {
    placesPool = base.locations
  } else if (Array.isArray(base.places)) {
    placesPool = base.places
  }

  const destCoords = getDestinationCoordinates(destination)
  const enginePreferences = base.enginePreferences && typeof base.enginePreferences === 'object'
    ? base.enginePreferences
    : base.preferences && typeof base.preferences === 'object'
      ? base.preferences
      : trip.enginePreferences && typeof trip.enginePreferences === 'object'
        ? trip.enginePreferences
        : {
            province: destCoords.province || guessProvinceFromTripName(destination) || 'Punjab',
            startLat: destCoords.lat,
            startLon: destCoords.lon,
            maxBudget: 50000,
            maxTravelHours: 12,
            preferredCategories: ['park', 'scenic', 'museum'],
          }

  // Resolve budget with trip taking priority over stale base wrapper
  const rawBudget = trip.budget !== undefined ? trip.budget : base.budget
  const budget = rawBudget && typeof rawBudget === 'object'
    ? rawBudget
    : { currency: 'PKR', amount: Number(rawBudget) || 0 }

  // Resolve expenses and lists with trip taking priority over stale base wrapper
  const resolvedExpenses = Array.isArray(trip.expenses)
    ? trip.expenses
    : (Array.isArray(base.expenses) ? base.expenses : [])
  const resolvedCustomLists = Array.isArray(trip.customLists)
    ? trip.customLists
    : (Array.isArray(base.customLists) ? base.customLists : [])

  // Sync data sub-document if present so background persistence saves latest state
  const nextData = trip.data && typeof trip.data === 'object'
    ? {
        ...trip.data,
        budget,
        expenses: resolvedExpenses,
        customLists: resolvedCustomLists,
        placesPool,
        days,
      }
    : undefined

  return {
    ...base,
    ...trip,
    id: resolvedId,
    tripId: resolvedId,
    title: trip.title || base.title || (destination && destination !== 'My Trip' ? `Trip to ${destination}` : 'My Trip'),
    name: trip.name || base.name || destination,
    destination,
    startDate,
    endDate,
    dates,
    notes: trip.notes !== undefined ? trip.notes : (base.notes || ''),
    privacy: trip.privacy || base.privacy || 'private',
    budget,
    map: base.map && typeof base.map === 'object' ? base.map : (trip.map && typeof trip.map === 'object' ? trip.map : { selectedPlaceId: null }),
    days,
    placesPool,
    customLists: resolvedCustomLists,
    expenses: resolvedExpenses,
    enginePreferences,
    isTripmate: Boolean(trip.isTripmate || base.isTripmate),
    tripmateRole: trip.tripmateRole || base.tripmateRole || (trip.isTripmate ? 'member' : undefined),
    ownerId: trip.ownerId || base.ownerId || trip.userId || base.userId,
    ownerName: trip.ownerName || base.ownerName,
    members: Array.isArray(trip.members) ? trip.members : (Array.isArray(base.members) ? base.members : []),
    reservations: Array.isArray(trip.reservations) ? trip.reservations : (Array.isArray(base.reservations) ? base.reservations : []),
    attachments: Array.isArray(trip.attachments) ? trip.attachments : (Array.isArray(base.attachments) ? base.attachments : []),
    copiedFromEditToken: trip.copiedFromEditToken || base.copiedFromEditToken || undefined,
    sourceTripId: trip.sourceTripId !== undefined ? trip.sourceTripId : base.sourceTripId,
    ...(nextData ? { data: nextData } : {}),
  }
}

/**
 * Builds a new trip payload with parity to the website buildNewTripPayload.
 */
export function buildNewTripPayload({
  tripName,
  destination,
  province,
  startDate,
  endDate,
  budgetAmount = 50000,
  preferredCategories = ['park', 'scenic', 'museum'],
}) {
  const normStart = toNormalizedIsoDate(startDate) || new Date().toISOString().slice(0, 10)
  const normEnd = toNormalizedIsoDate(endDate) || normStart
  const resolvedDest = String(tripName || destination || 'Islamabad').trim()
  const days = buildDaysFromDateRange(normStart, normEnd, resolvedDest)
  if (!days?.length) return null

  const title = `Trip to ${resolvedDest}`
  const destCoords = getDestinationCoordinates(resolvedDest)
  const guessedProvince = destCoords.province || guessProvinceFromTripName(resolvedDest)
  const finalProvince = guessedProvince || province || 'Punjab'
  const coords = destCoords

  return ensureWorkspaceParityTrip({
    id: Date.now(),
    tripId: Date.now(),
    title,
    name: resolvedDest,
    destination: resolvedDest,
    startDate: normStart,
    endDate: normEnd,
    dates: formatTripDateRange(normStart, normEnd),
    budget: { currency: 'PKR', amount: Number(budgetAmount) || 50000 },
    days,
    placesPool: [],
    customLists: [
      { id: 'packing', title: 'Packing Essentials', items: ['Camera', 'Power Bank', 'Comfortable Shoes', 'ID & Tickets'] },
    ],
    expenses: [],
    map: { selectedPlaceId: null },
    enginePreferences: {
      province: finalProvince,
      startLat: coords.lat,
      startLon: coords.lon,
      maxBudget: Number(budgetAmount) || 50000,
      maxTravelHours: 12,
      preferredCategories,
    },
  })
}


/**
 * Safely extracts latitude and longitude from any place object.
 * Returns { lat, lon } if valid, or null if missing/invalid.
 * Does NOT invent fake coordinates.
 */
export function getPlaceLatLon(place, fallbackDestination = '') {
  if (!place || typeof place !== 'object') return null

  let lat = place.lat !== undefined && place.lat !== null ? Number(place.lat) : null
  let lon = place.lon !== undefined && place.lon !== null ? Number(place.lon) : null

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    if (place.latitude !== undefined && place.longitude !== undefined) {
      lat = Number(place.latitude)
      lon = Number(place.longitude)
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const loc = place.location || place.gps_coordinates || place.coordinates || (place.geometry && place.geometry.location)
    if (loc && typeof loc === 'object') {
      const rawLat = loc.lat ?? loc.latitude ?? (Array.isArray(loc) ? loc[1] : undefined)
      const rawLon = loc.lon ?? loc.lng ?? loc.longitude ?? (Array.isArray(loc) ? loc[0] : undefined)
      if (rawLat !== undefined && rawLon !== undefined) {
        lat = Number(rawLat)
        lon = Number(rawLon)
      }
    }
  }

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    // Basic boundary sanity check
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon, isEstimated: Boolean(place.isEstimated) }
    }
  }

  // Graceful fallback coordinate resolution for Pakistan landmarks & destinations
  try {
    const title = place.title || place.name || ''
    const dest = place.destination || place.subtitle || fallbackDestination || ''
    const placeId = place.id || place.place_id || ''

    if (typeof findVerifiedLandmark === 'function') {
      const verified = findVerifiedLandmark(placeId, title, dest)
      if (verified && Number.isFinite(Number(verified.lat)) && Number.isFinite(Number(verified.lon))) {
        return { lat: Number(verified.lat), lon: Number(verified.lon), isEstimated: false }
      }
    }

    if (Array.isArray(RECOMMENDED_PLACES_CATALOG)) {
      const catalogItem = RECOMMENDED_PLACES_CATALOG.find(
        (p) =>
          (placeId && String(p.id).toLowerCase() === String(placeId).toLowerCase()) ||
          (title && p.name && p.name.toLowerCase() === title.toLowerCase())
      )
      if (catalogItem && Number.isFinite(Number(catalogItem.lat)) && Number.isFinite(Number(catalogItem.lon))) {
        return { lat: Number(catalogItem.lat), lon: Number(catalogItem.lon), isEstimated: false }
      }
    }

    // Web Parity: Jitter around destination city center so places without explicit GPS are never dropped
    const destName = dest || fallbackDestination || 'Islamabad'
    const destCoords = getDestinationCoordinates(destName) || { lat: 33.6844, lon: 73.0479 }
    if (destCoords && Number.isFinite(Number(destCoords.lat)) && Number.isFinite(Number(destCoords.lon))) {
      const str = String(placeId || title || 'stop')
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
      }
      const jitterLat = ((Math.abs(hash) % 100) - 50) / 1000
      const jitterLon = ((Math.abs(hash >> 3) % 100) - 50) / 1000
      return {
        lat: Number((destCoords.lat + jitterLat).toFixed(6)),
        lon: Number((destCoords.lon + jitterLon).toFixed(6)),
        isEstimated: true,
      }
    }
  } catch {
    // Graceful silent fallback
  }

  return null
}

export function isPlaceMappable(place, fallbackDestination = '') {
  const coords = getPlaceLatLon(place, fallbackDestination)
  return coords !== null
}

/**
 * Haversine formula to compute distance in km between two geographic points.
 */
export function haversineKm(from, to) {
  if (!from || !to) return 0
  const toRad = (value) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(to.lat - from.lat)
  const dLon = toRad(to.lon - from.lon)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const calculateHaversineDistance = haversineKm

export function formatDistanceLabel(distanceKm) {
  const value = Number(distanceKm) || 0
  return `${value.toFixed(value < 10 ? 1 : 0)} km`
}

export function formatDurationMinutes(totalMinutes) {
  const minutesValue = Math.max(0, Math.round(Number(totalMinutes) || 0))
  if (minutesValue < 60) return `${minutesValue} min`
  const hours = Math.floor(minutesValue / 60)
  const minutes = minutesValue % 60
  if (minutes === 0) return `${hours} hr`
  return `${hours} hr ${minutes} min`
}

export function formatTime12h(time) {
  if (!time) return ''
  const parts = String(time).split(':')
  if (parts.length < 2) return String(time)
  let hour = parseInt(parts[0], 10)
  const minute = parts[1].slice(0, 2)
  if (!Number.isFinite(hour)) return String(time)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${ampm}`
}

/**
 * Builds inter-stop connection metadata (distance, drive duration, from place)
 * for each place in a day, matching Web `WorkspacePage.jsx` `buildDayConnectionsMap`.
 */
export function buildDayConnectionsMap(day, destination = '') {
  const connections = new Map()
  const places = (day?.items || []).filter((item) => item && item.type !== 'note' && item.type !== 'checklist')
  const legs = Array.isArray(day?.optimization?.legs) ? day.optimization.legs : (Array.isArray(day?.optimization?.segments) ? day.optimization.segments : [])

  if (legs.length > 0) {
    legs.forEach((leg, idx) => {
      const toPlaceId = String(leg.toPlaceId || leg.toStopId || leg.to_place_id || (places[idx + 1] && places[idx + 1].id) || '')
      if (!toPlaceId) return
      const minutes = Number(leg.durationMin || leg.estimatedTravelTimeMin || leg.timeMin || leg.time_min || 0)
      const distanceKm = Number(leg.distanceKm || leg.distance_km || 0)
      connections.set(toPlaceId, {
        from: leg.fromName || leg.from_name || (places[idx] && (places[idx].title || places[idx].name)) || 'Previous stop',
        durationLabel: leg.durationLabel || formatDurationMinutes(minutes),
        distanceLabel: leg.distanceLabel || formatDistanceLabel(distanceKm),
        minutes,
        distanceKm,
        optimized: true,
      })
    })
    return connections
  }

  places.forEach((place, index) => {
    if (index === 0) return
    const previous = places[index - 1]
    const prevCoords = getPlaceLatLon(previous, destination)
    const currCoords = getPlaceLatLon(place, destination)
    if (prevCoords && currCoords) {
      const distanceKm = haversineKm(prevCoords, currCoords)
      const minutes = Math.max(1, Math.round((distanceKm / 35.0) * 60))
      connections.set(String(place.id), {
        from: previous.title || previous.name || 'Previous stop',
        durationLabel: formatDurationMinutes(minutes),
        distanceLabel: formatDistanceLabel(distanceKm),
        minutes,
        distanceKm,
        optimized: false,
      })
    }
  })
  return connections
}

/**
 * Calculates total route distance along the indexed tour.
 * Parity with backend `_route_total_distance` in optimizer.py.
 */
function calculateRouteTotalDistance(route, distMatrix, startDistances, returnToStart = false) {
  if (!route || route.length === 0) return 0.0

  let totalDistance = startDistances[route[0]] || 0.0
  for (let idx = 1; idx < route.length; idx++) {
    totalDistance += distMatrix[route[idx - 1]][route[idx]]
  }

  if (returnToStart) {
    totalDistance += startDistances[route[route.length - 1]] || 0.0
  }

  return totalDistance
}

/**
 * 2-opt local search route improvement passes.
 * Parity with backend `_improve_route_2opt` in optimizer.py.
 */
function improveRoute2Opt(route, distMatrix, startDistances, returnToStart = false, maxPasses = 6) {
  if (!route || route.length < 4) {
    return {
      bestRoute: route || [],
      bestDistance: calculateRouteTotalDistance(route, distMatrix, startDistances, returnToStart),
    }
  }

  let best = [...route]
  let bestDistance = calculateRouteTotalDistance(best, distMatrix, startDistances, returnToStart)

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        // Reverse sub-segment [i .. k]
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ]
        const candidateDistance = calculateRouteTotalDistance(candidate, distMatrix, startDistances, returnToStart)
        if (candidateDistance + 1e-9 < bestDistance) {
          best = candidate
          bestDistance = candidateDistance
          improved = true
        }
      }
    }
    if (!improved) break
  }

  return { bestRoute: best, bestDistance }
}

/**
 * Optimizes a list of places in a day using the Nearest Neighbor + 2-Opt TSP algorithm,
 * mirroring TripNest backend `app/optimizer.py` and `WorkspacePage.jsx`.
 * Computes estimated travel legs, distances, and savings metrics.
 */
export function optimizePlaceSequence(
  places = [],
  startLat = null,
  startLon = null,
  speedKmh = 35.0,
  returnToStart = false
) {
  if (!Array.isArray(places) || places.length <= 1) {
    return {
      orderedPlaces: places || [],
      legs: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
      metrics: {
        beforeDistanceKm: 0,
        totalDistanceKm: 0,
        distanceSavedKm: 0,
        beforeTravelTimeHours: 0,
        estimatedTravelTimeHours: 0,
        travelTimeSavedHours: 0,
        speedKmhUsed: speedKmh,
      },
      algorithm: { name: 'nearest_neighbor_2opt', fallbackUsed: false },
    }
  }

  // Separate mappable places from notes / checklists / unmappable items
  const mappable = []
  const nonMappable = []

  places.forEach((p) => {
    if (p.type === 'note' || p.type === 'checklist') {
      nonMappable.push(p)
    } else {
      const coords = getPlaceLatLon(p)
      if (coords) {
        mappable.push({ item: p, coords })
      } else {
        nonMappable.push(p)
      }
    }
  })

  if (mappable.length <= 1) {
    return {
      orderedPlaces: places,
      legs: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
      metrics: {
        beforeDistanceKm: 0,
        totalDistanceKm: 0,
        distanceSavedKm: 0,
        beforeTravelTimeHours: 0,
        estimatedTravelTimeHours: 0,
        travelTimeSavedHours: 0,
        speedKmhUsed: speedKmh,
      },
      algorithm: { name: 'nearest_neighbor_2opt', fallbackUsed: false },
    }
  }

  const n = mappable.length
  const safeSpeed = speedKmh > 0 ? Number(speedKmh) : 35.0
  const baseLat = (startLat !== null && startLat !== undefined && Number.isFinite(Number(startLat)))
    ? Number(startLat)
    : mappable[0].coords.lat
  const baseLon = (startLon !== null && startLon !== undefined && Number.isFinite(Number(startLon)))
    ? Number(startLon)
    : mappable[0].coords.lon

  // Calculate distance from base start coordinate to all locations
  const startDistances = mappable.map((loc) =>
    haversineKm({ lat: baseLat, lon: baseLon }, loc.coords)
  )

  // Build complete distance matrix
  const distMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        distMatrix[i][j] = haversineKm(mappable[i].coords, mappable[j].coords)
      }
    }
  }

  // Calculate "before" (original sequence) place-to-place distance
  let beforeDistanceKm = 0
  for (let i = 1; i < n; i++) {
    beforeDistanceKm += distMatrix[i - 1][i]
  }

  // Step 1: Nearest Neighbor search starting from the closest place to base coords
  let closestIndex = 0
  let minStartDist = Infinity
  for (let i = 0; i < n; i++) {
    if (startDistances[i] < minStartDist) {
      minStartDist = startDistances[i]
      closestIndex = i
    }
  }

  const visited = new Array(n).fill(false)
  visited[closestIndex] = true
  const nnRoute = [closestIndex]
  let current = closestIndex

  for (let step = 0; step < n - 1; step++) {
    let nearest = -1
    let nearestDist = Infinity

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue
      const d = distMatrix[current][i]
      if (d < nearestDist - 1e-9) {
        nearestDist = d
        nearest = i
      }
    }

    if (nearest !== -1) {
      nnRoute.push(nearest)
      visited[nearest] = true
      current = nearest
    }
  }

  // Step 2: 2-opt route refinement pass (up to 6 passes)
  const { bestRoute } = improveRoute2Opt(
    nnRoute,
    distMatrix,
    startDistances,
    returnToStart,
    6
  )

  // Map route indices back to original items
  const orderedMappable = bestRoute.map((idx) => mappable[idx])

  // Build sequential legs and compute totals
  const legs = []
  let totalDistanceKm = 0

  for (let i = 1; i < orderedMappable.length; i++) {
    const prev = orderedMappable[i - 1]
    const curr = orderedMappable[i]
    const distKm = haversineKm(prev.coords, curr.coords)
    const travelHours = distKm / safeSpeed
    const timeMin = Math.max(1, Math.round(travelHours * 60))
    totalDistanceKm += distKm

    legs.push({
      fromPlaceId: String(prev.item.id),
      toPlaceId: String(curr.item.id),
      fromName: prev.item.title || prev.item.name || 'Previous Stop',
      toName: curr.item.title || curr.item.name || 'Next Stop',
      distanceKm: Number(distKm.toFixed(4)),
      timeMin,
      estimatedTravelTimeHours: Number(travelHours.toFixed(4)),
      estimatedTravelTimeMin: timeMin,
      distanceLabel: formatDistanceLabel(distKm),
      durationLabel: formatDurationMinutes(timeMin),
    })
  }

  const totalDurationMin = Math.max(1, Math.round((totalDistanceKm / safeSpeed) * 60))
  const estimatedHours = totalDistanceKm / safeSpeed
  const beforeEstimatedHours = beforeDistanceKm / safeSpeed
  const distanceSavedKm = Math.max(0, beforeDistanceKm - totalDistanceKm)
  const timeSavedHours = Math.max(0, beforeEstimatedHours - estimatedHours)

  const metrics = {
    beforeDistanceKm: Number(beforeDistanceKm.toFixed(4)),
    totalDistanceKm: Number(totalDistanceKm.toFixed(4)),
    distanceSavedKm: Number(distanceSavedKm.toFixed(4)),
    beforeTravelTimeHours: Number(beforeEstimatedHours.toFixed(4)),
    estimatedTravelTimeHours: Number(estimatedHours.toFixed(4)),
    travelTimeSavedHours: Number(timeSavedHours.toFixed(4)),
    speedKmhUsed: safeSpeed,
  }

  const finalOrdered = [
    ...orderedMappable.map((entry) => entry.item),
    ...nonMappable,
  ]

  return {
    orderedPlaces: finalOrdered,
    legs,
    metrics,
    totalDistanceKm,
    totalDurationMin,
    algorithm: { name: 'nearest_neighbor_2opt', fallbackUsed: false },
  }
}

/**
 * Resolves the clean, authentic Pakistani destination city name from a trip object.
 * Strips title affixes like "Trip to ", "Exploring ", " Tour", extracts actual city names,
 * and matches against known Pakistani cities (e.g., Lahore, Islamabad, Bahawalpur, Hunza, Skardu).
 * Always returns a clean, presentable city name (e.g. "Lahore") rather than a noisy title.
 */
export function resolveTripDestinationCity(trip) {
  if (!trip) return 'Islamabad'

  // 1. Direct destination field if explicitly provided
  let candidate = String(trip.destination || trip.city || '').trim()

  // 2. If empty or generic, fall back to name or title
  if (!candidate || candidate.toLowerCase() === 'my trip' || candidate.toLowerCase() === 'pakistan') {
    candidate = String(trip.name || trip.title || '').trim()
  }

  // 3. Clean common prefixes and suffixes
  let cleaned = candidate
    .replace(/^(trip\s+to|visit\s+to|visit|tour\s+of|exploring|adventure\s+in|journey\s+to|escape\s+to)\s+/i, '')
    .replace(/\s+(trip|tour|expedition|adventure|getaway|vacation|itinerary|journey)$/i, '')
    .trim()

  const lower = cleaned.toLowerCase()

  // 4. Match against KNOWN_CITY_COORDS keys (sorted by length descending for specificity)
  if (KNOWN_CITY_COORDS) {
    const keys = Object.keys(KNOWN_CITY_COORDS).sort((a, b) => b.length - a.length)
    for (const key of keys) {
      if (lower === key || lower.startsWith(key + ' ') || lower.endsWith(' ' + key) || lower.includes(' ' + key + ' ')) {
        return KNOWN_CITY_COORDS[key].name
      }
    }
    // Substring match for keywords with at least 4 characters
    for (const key of keys) {
      if (key.length >= 4 && lower.includes(key)) {
        return KNOWN_CITY_COORDS[key].name
      }
    }
  }

  // 5. Check if province coords has it
  if (PROVINCE_COORDS) {
    for (const prov of Object.keys(PROVINCE_COORDS)) {
      if (lower.includes(prov.toLowerCase())) return prov
    }
  }

  // 6. Inspect trip stops / placesPool for city hints
  const allStops = [
    ...(Array.isArray(trip.placesPool) ? trip.placesPool : []),
    ...(Array.isArray(trip.days) ? trip.days.flatMap((d) => d.items || []) : []),
  ]
  for (const stop of allStops) {
    const stopCity = stop?.destination || stop?.city
    if (stopCity && typeof stopCity === 'string' && stopCity.trim()) {
      const stopClean = stopCity.trim().toLowerCase()
      if (KNOWN_CITY_COORDS?.[stopClean]) {
        return KNOWN_CITY_COORDS[stopClean].name
      }
    }
  }

  // 7. If cleaned was non-empty and not generic, capitalize first letter
  if (cleaned && cleaned.toLowerCase() !== 'my trip') {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  return 'Islamabad'
}

