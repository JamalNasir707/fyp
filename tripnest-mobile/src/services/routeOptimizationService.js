/**
 * TripNest Centralized Route Optimization & OSRM Road Geometry Service
 * 
 * STRICT ARCHITECTURE REQUIREMENTS:
 * 1. GLOBAL COVERAGE: Supports all trips (saved, new, manual, Smart Trip Planner, MongoDB).
 * 2. COORDINATE ORDER & NORMALIZATION:
 *    - App/Leaflet format: [latitude, longitude]
 *    - OSRM URL format: longitude,latitude (LON1,LAT1;LON2,LAT2)
 *    - OSRM GeoJSON geometry format: [longitude, latitude] -> convert to Leaflet [latitude, longitude]
 *    - Validates -90 <= lat <= 90 and -180 <= lon <= 180, finite numbers.
 * 3. VISIBLE CONNECTED ROAD ROUTES:
 *    - Calculates and decodes actual road-following curves for every consecutive pair (A -> B -> C...).
 *    - Segments are routed individually so remote/unrouted segments fall back gracefully without
 *      breaking the road geometry of other valid segments.
 * 4. TRAVEL METRICS:
 *    - Distance in km (meters / 1000)
 *    - Estimated duration in minutes (seconds / 60)
 *    - Consecutive leg badges: Place A ━━━━> Place B: X km, Y min
 * 5. TWO-WAY SYNCHRONIZATION:
 *    - Markers 1, 2, 3... match itinerary stop sequence exactly.
 */

import { haversineKm, getPlaceLatLon, getDestinationCoordinates } from '../utils/tripUtils.js'
import { findVerifiedLandmark } from './imageService.js'

// In-memory cache for OSRM segment responses to ensure instant rendering & offline resiliency
const OSRM_SEGMENT_CACHE = new Map()

/**
 * Normalizes an itinerary stop into a clean, validated route-stop object.
 * Does not lose original place ID or any itinerary fields.
 */
export function normalizeRouteStop(rawItem, fallbackDestination = '', dayId = 'day-1', originalIndex = 0, tripId = '') {
  if (!rawItem || typeof rawItem !== 'object') {
    return {
      tripId: String(tripId || ''),
      dayId: String(dayId || 'day-1'),
      stopId: `invalid-${originalIndex}`,
      stopName: 'Invalid Stop',
      latitude: null,
      longitude: null,
      originalIndex,
      optimizedIndex: originalIndex,
      hasValidCoords: false,
      missingField: 'Entire stop item is missing or invalid',
      rawItem: null,
    }
  }

  // Check all coordinate field variations
  let lat = rawItem.lat !== undefined && rawItem.lat !== null ? Number(rawItem.lat) : null
  let lon = rawItem.lon !== undefined && rawItem.lon !== null ? Number(rawItem.lon) : null

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    if (rawItem.latitude !== undefined && rawItem.longitude !== undefined) {
      lat = Number(rawItem.latitude)
      lon = Number(rawItem.longitude)
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const loc = rawItem.location || rawItem.gps_coordinates || rawItem.coordinates || (rawItem.geometry && rawItem.geometry.location)
    if (loc && typeof loc === 'object') {
      const rawLat = loc.lat ?? loc.latitude ?? (Array.isArray(loc) ? loc[1] : undefined)
      const rawLon = loc.lon ?? loc.lng ?? loc.longitude ?? (Array.isArray(loc) ? loc[0] : undefined)
      if (rawLat !== undefined && rawLon !== undefined) {
        lat = Number(rawLat)
        lon = Number(rawLon)
      }
    }
  }

  let isEstimated = Boolean(rawItem.isEstimated)
  let missingField = null

  // Validate range
  let hasValidCoords = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180

  if (!hasValidCoords) {
    if (!Number.isFinite(lat) && !Number.isFinite(lon)) {
      missingField = 'latitude and longitude'
    } else if (!Number.isFinite(lat)) {
      missingField = 'latitude'
    } else if (!Number.isFinite(lon)) {
      missingField = 'longitude'
    } else {
      missingField = 'coordinates out of valid bounds [-90..90, -180..180]'
    }

    // Try fallback lookup from verified landmark registry or destination coords
    const fallbackCoords = getPlaceLatLon(rawItem, fallbackDestination)
    if (fallbackCoords && Number.isFinite(fallbackCoords.lat) && Number.isFinite(fallbackCoords.lon)) {
      lat = fallbackCoords.lat
      lon = fallbackCoords.lon
      hasValidCoords = true
      isEstimated = Boolean(fallbackCoords.isEstimated)
      missingField = null
    }
  }

  const stopId = String(rawItem.id || rawItem.place_id || `stop-${originalIndex}`)
  const stopName = rawItem.title || rawItem.name || 'Unnamed Stop'

  return {
    tripId: String(tripId || ''),
    dayId: String(dayId || 'day-1'),
    stopId,
    stopName,
    latitude: hasValidCoords ? Number(lat.toFixed(6)) : null,
    longitude: hasValidCoords ? Number(lon.toFixed(6)) : null,
    originalIndex,
    optimizedIndex: originalIndex,
    hasValidCoords,
    missingField,
    isEstimated,
    category: rawItem.category || 'attraction',
    rawItem,
  }
}

/**
 * Calculates total route distance along an indexed tour.
 */
function calculateTourDistance(tour, distMatrix, startDistances, returnToStart = false) {
  if (!tour || tour.length === 0) return 0.0
  let total = startDistances[tour[0]] || 0.0
  for (let i = 1; i < tour.length; i++) {
    total += distMatrix[tour[i - 1]][tour[i]]
  }
  if (returnToStart) {
    total += startDistances[tour[tour.length - 1]] || 0.0
  }
  return total
}

/**
 * 2-Opt local search refinement (TSP).
 * Matches backend optimizer.py and web WorkspacePage.jsx.
 */
function run2OptRefinement(tour, distMatrix, startDistances, returnToStart = false, maxPasses = 6) {
  if (!tour || tour.length < 4) {
    return tour || []
  }

  let best = [...tour]
  let bestDist = calculateTourDistance(best, distMatrix, startDistances, returnToStart)

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ]
        const candDist = calculateTourDistance(candidate, distMatrix, startDistances, returnToStart)
        if (candDist + 1e-9 < bestDist) {
          best = candidate
          bestDist = candDist
          improved = true
        }
      }
    }
    if (!improved) break
  }

  return best
}

/**
 * Optimizes the sequence of stops on a day using Nearest Neighbor + 2-Opt TSP.
 */
export function optimizeStopSequence(stops = [], startCoord = null, speedKmh = 35.0, returnToStart = false) {
  if (!Array.isArray(stops) || stops.length <= 1) {
    return {
      orderedStops: stops || [],
      beforeDistanceKm: 0,
      totalDistanceKm: 0,
      distanceSavedKm: 0,
      totalDurationMin: 0,
      legs: [],
    }
  }

  const validStops = stops.filter((s) => s.hasValidCoords)
  const invalidStops = stops.filter((s) => !s.hasValidCoords)

  if (validStops.length <= 1) {
    return {
      orderedStops: [...validStops, ...invalidStops],
      beforeDistanceKm: 0,
      totalDistanceKm: 0,
      distanceSavedKm: 0,
      totalDurationMin: 0,
      legs: [],
    }
  }

  const n = validStops.length
  const baseLat = (startCoord && Number.isFinite(startCoord.lat)) ? startCoord.lat : validStops[0].latitude
  const baseLon = (startCoord && Number.isFinite(startCoord.lon)) ? startCoord.lon : validStops[0].longitude

  const startDistances = validStops.map((s) =>
    haversineKm({ lat: baseLat, lon: baseLon }, { lat: s.latitude, lon: s.longitude })
  )

  const distMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        distMatrix[i][j] = haversineKm(
          { lat: validStops[i].latitude, lon: validStops[i].longitude },
          { lat: validStops[j].latitude, lon: validStops[j].longitude }
        )
      }
    }
  }

  // Before distance along original sequence
  let beforeDistanceKm = 0
  for (let i = 1; i < n; i++) {
    beforeDistanceKm += distMatrix[i - 1][i]
  }

  // Step 1: Nearest Neighbor
  let startIdx = 0
  let minDist = Infinity
  for (let i = 0; i < n; i++) {
    if (startDistances[i] < minDist) {
      minDist = startDistances[i]
      startIdx = i
    }
  }

  const visited = new Array(n).fill(false)
  visited[startIdx] = true
  const nnTour = [startIdx]
  let curr = startIdx

  for (let step = 0; step < n - 1; step++) {
    let nearest = -1
    let nearestDist = Infinity
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue
      const d = distMatrix[curr][i]
      if (d < nearestDist - 1e-9) {
        nearestDist = d
        nearest = i
      }
    }
    if (nearest !== -1) {
      nnTour.push(nearest)
      visited[nearest] = true
      curr = nearest
    }
  }

  // Step 2: 2-Opt local search
  const bestTour = run2OptRefinement(nnTour, distMatrix, startDistances, returnToStart, 6)

  const orderedValid = bestTour.map((idx, newIdx) => ({
    ...validStops[idx],
    optimizedIndex: newIdx,
  }))

  let totalDistanceKm = 0
  const legs = []

  for (let i = 1; i < orderedValid.length; i++) {
    const prev = orderedValid[i - 1]
    const current = orderedValid[i]
    const dKm = haversineKm(
      { lat: prev.latitude, lon: prev.longitude },
      { lat: current.latitude, lon: current.longitude }
    )
    totalDistanceKm += dKm
    const durationMin = Math.max(1, Math.round((dKm / speedKmh) * 60))

    legs.push({
      segmentIndex: i,
      fromStopId: prev.stopId,
      fromName: prev.stopName,
      toStopId: current.stopId,
      toName: current.stopName,
      distanceKm: Number(dKm.toFixed(2)),
      distanceLabel: `${dKm.toFixed(1)} km`,
      durationMin,
      durationLabel: durationMin >= 60 ? `${Math.floor(durationMin / 60)} hr ${durationMin % 60} min` : `${durationMin} min`,
    })
  }

  const distanceSavedKm = Math.max(0, beforeDistanceKm - totalDistanceKm)
  const totalDurationMin = Math.max(1, Math.round((totalDistanceKm / speedKmh) * 60))

  return {
    orderedStops: [...orderedValid, ...invalidStops],
    beforeDistanceKm: Number(beforeDistanceKm.toFixed(2)),
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    distanceSavedKm: Number(distanceSavedKm.toFixed(2)),
    totalDurationMin,
    legs,
  }
}

/**
 * Fetches real OSRM road geometry and travel metrics for a single consecutive stop pair (fromStop -> toStop).
 * CRUCIAL: OSRM uses [lon, lat], Leaflet uses [lat, lon].
 */
export async function fetchSegmentRoadRoute(fromStop, toStop, timeoutMs = 4000) {
  if (!fromStop || !toStop || !fromStop.hasValidCoords || !toStop.hasValidCoords) {
    return null
  }

  const lon1 = fromStop.longitude
  const lat1 = fromStop.latitude
  const lon2 = toStop.longitude
  const lat2 = toStop.latitude

  const cacheKey = `${lon1.toFixed(5)},${lat1.toFixed(5)}-${lon2.toFixed(5)},${lat2.toFixed(5)}`
  if (OSRM_SEGMENT_CACHE.has(cacheKey)) {
    return OSRM_SEGMENT_CACHE.get(cacheKey)
  }

  // Straight line fallback coordinates: [[lat1, lon1], [lat2, lon2]]
  const straightCoords = [[lat1, lon1], [lat2, lon2]]
  const straightDistKm = haversineKm({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 })
  const straightDurationMin = Math.max(1, Math.round((straightDistKm / 35.0) * 60))

  const fallbackResult = {
    fromStopId: fromStop.stopId,
    fromName: fromStop.stopName,
    toStopId: toStop.stopId,
    toName: toStop.stopName,
    distanceKm: Number(straightDistKm.toFixed(2)),
    distanceLabel: `${straightDistKm.toFixed(1)} km`,
    durationMin: straightDurationMin,
    durationLabel: straightDurationMin >= 60 ? `${Math.floor(straightDurationMin / 60)} hr ${straightDurationMin % 60} min` : `${straightDurationMin} min`,
    geometry: straightCoords,
    isRoadRoute: false,
    routingNote: 'Direct segment (road network unavailable)',
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // OSRM URL format: LON1,LAT1;LON2,LAT2
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson&steps=false`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      if (data && data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0]
        const distKm = (route.distance || 0) / 1000
        const durMin = Math.max(1, Math.round((route.duration || 0) / 60))
        const rawCoords = route.geometry && Array.isArray(route.geometry.coordinates) ? route.geometry.coordinates : []

        // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
        const leafletCoords = rawCoords.map(([lon, lat]) => [lat, lon])

        const finalResult = {
          fromStopId: fromStop.stopId,
          fromName: fromStop.stopName,
          toStopId: toStop.stopId,
          toName: toStop.stopName,
          distanceKm: Number(distKm.toFixed(2)),
          distanceLabel: `${distKm.toFixed(1)} km`,
          durationMin: durMin,
          durationLabel: durMin >= 60 ? `${Math.floor(durMin / 60)} hr ${durMin % 60} min` : `${durMin} min`,
          geometry: leafletCoords.length >= 2 ? leafletCoords : straightCoords,
          isRoadRoute: leafletCoords.length >= 2,
          routingNote: leafletCoords.length >= 2 ? 'Real OSRM road geometry' : 'OSRM road route',
        }

        OSRM_SEGMENT_CACHE.set(cacheKey, finalResult)
        return finalResult
      }
    }
  } catch (err) {
    // Network / timeout: use fallback straight line
  }

  OSRM_SEGMENT_CACHE.set(cacheKey, fallbackResult)
  return fallbackResult
}

/**
 * Calculates complete road route and travel metrics for ALL consecutive stops on an itinerary day.
 * Returns full multi-stop polyline and segment-by-segment connections.
 */
export async function calculateDayRoadRoute(day, destination = '', tripId = '') {
  if (!day || !Array.isArray(day.items) || day.items.length === 0) {
    return {
      dayId: String(day?.id || ''),
      dayLabel: day?.label || 'Day',
      stops: [],
      segments: [],
      fullPolyline: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
      unmappableStops: [],
    }
  }

  // 1. Extract and normalize stops
  const items = day.items.filter((it) => it && it.type !== 'note' && it.type !== 'checklist')
  const stops = items.map((item, idx) =>
    normalizeRouteStop(item, destination, day.id, idx, tripId)
  )

  const mappableStops = stops.filter((s) => s.hasValidCoords)
  const unmappableStops = stops.filter((s) => !s.hasValidCoords)

  if (mappableStops.length < 2) {
    return {
      dayId: String(day.id),
      dayLabel: day.label || 'Day',
      stops: mappableStops,
      segments: [],
      fullPolyline: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
      unmappableStops,
    }
  }

  // 2. Fetch road route for each consecutive pair
  const segments = []
  let fullPolyline = []
  let totalDistMeters = 0
  let totalDurMin = 0

  for (let i = 1; i < mappableStops.length; i++) {
    const prev = mappableStops[i - 1]
    const curr = mappableStops[i]
    const segment = await fetchSegmentRoadRoute(prev, curr)

    if (segment) {
      segments.push({
        ...segment,
        segmentIndex: i,
      })
      totalDistMeters += segment.distanceKm * 1000
      totalDurMin += segment.durationMin

      if (segment.geometry && segment.geometry.length > 0) {
        if (fullPolyline.length === 0) {
          fullPolyline = [...segment.geometry]
        } else {
          // Avoid duplicate junction points
          fullPolyline.push(...segment.geometry.slice(1))
        }
      }
    }
  }

  const totalDistanceKm = Number((totalDistMeters / 1000).toFixed(2))

  return {
    dayId: String(day.id),
    dayLabel: day.label || 'Day',
    stops: mappableStops,
    segments,
    fullPolyline,
    totalDistanceKm,
    totalDurationMin: totalDurMin,
    unmappableStops,
  }
}

/**
 * Automatically optimizes the sequence of places and builds road route metadata
 * for EVERY day in a trip. Works across all trip types (saved MongoDB, new, manual, Smart Trip Planner).
 * Preserves notes, checklists, and unmappable places while reporting them with specific diagnostic reasons.
 */
export async function optimizeTripDays(trip, speedKmh = 35.0) {
  if (!trip || !Array.isArray(trip.days) || trip.days.length === 0) {
    return {
      trip: trip || {},
      daysOptimized: 0,
      totalDistanceKm: 0,
      totalDurationMin: 0,
      distanceSavedKm: 0,
      unmappableReport: [],
    }
  }

  const destination = trip.destination || trip.name || 'Pakistan'
  const destCoords = getDestinationCoordinates(destination)
  const prefs = trip.enginePreferences || {}
  const startCoord = (Number.isFinite(Number(prefs.startLat)) && Number.isFinite(Number(prefs.startLon)))
    ? { lat: Number(prefs.startLat), lon: Number(prefs.startLon) }
    : destCoords

  let daysOptimizedCount = 0
  let grandTotalDistanceKm = 0
  let grandTotalDurationMin = 0
  let grandTotalSavedKm = 0
  const unmappableReport = []

  const updatedDays = await Promise.all(
    trip.days.map(async (day, dayIdx) => {
      const items = Array.isArray(day.items) ? day.items : []
      const nonPlaceItems = []
      const rawPlaces = []

      items.forEach((item) => {
        if (!item) return
        if (item.type === 'note' || item.type === 'checklist') {
          nonPlaceItems.push(item)
        } else {
          rawPlaces.push(item)
        }
      })

      const normalizedStops = rawPlaces.map((p, idx) =>
        normalizeRouteStop(p, destination, day.id, idx, trip.id || trip.tripId)
      )

      const validStops = normalizedStops.filter((s) => s.hasValidCoords)
      const invalidStops = normalizedStops.filter((s) => !s.hasValidCoords)

      invalidStops.forEach((inv) => {
        unmappableReport.push({
          dayId: day.id,
          dayIndex: dayIdx + 1,
          placeId: inv.stopId,
          placeName: inv.stopName,
          reason: inv.missingField || 'Missing valid coordinates',
        })
      })

      if (validStops.length >= 2) {
        daysOptimizedCount += 1
        const optResult = optimizeStopSequence(validStops, startCoord, speedKmh, false)
        const dayRoadRoute = await calculateDayRoadRoute(
          { id: day.id, label: day.label, items: optResult.orderedStops.map((s) => s.rawItem) },
          destination,
          trip.id || trip.tripId
        )

        grandTotalDistanceKm += dayRoadRoute.totalDistanceKm || optResult.totalDistanceKm || 0
        grandTotalDurationMin += dayRoadRoute.totalDurationMin || optResult.totalDurationMin || 0
        grandTotalSavedKm += optResult.distanceSavedKm || 0

        // Build sequenced items with updated visiting schedule
        let currentMin = 9 * 60 + 30 // 09:30 AM
        const sequencedItems = optResult.orderedStops.map((stop, sIdx) => {
          const raw = stop.rawItem
          if (sIdx > 0 && dayRoadRoute.segments && dayRoadRoute.segments[sIdx - 1]) {
            currentMin += Math.max(10, dayRoadRoute.segments[sIdx - 1].durationMin || 15)
          }
          const sH = Math.floor(currentMin / 60)
          const sM = currentMin % 60
          const startStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`
          currentMin += 90 // 1.5 hr visit
          const eH = Math.floor(currentMin / 60)
          const eM = currentMin % 60
          const endStr = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`

          return {
            ...raw,
            lat: stop.latitude,
            lon: stop.longitude,
            startTime: raw.startTime || startStr,
            endTime: raw.endTime || endStr,
          }
        })

        const preservedInvalid = invalidStops.map((s) => s.rawItem)
        const finalItems = [...sequencedItems, ...preservedInvalid, ...nonPlaceItems]

        return {
          ...day,
          items: finalItems,
          optimization: {
            success: true,
            dayId: String(day.id),
            order: sequencedItems.map((s) => String(s.id)),
            metrics: {
              beforeDistanceKm: optResult.beforeDistanceKm,
              totalDistanceKm: dayRoadRoute.totalDistanceKm,
              distanceSavedKm: optResult.distanceSavedKm,
              estimatedTravelTimeHours: Number((dayRoadRoute.totalDurationMin / 60).toFixed(2)),
              speedKmhUsed: speedKmh,
            },
            legs: dayRoadRoute.segments || [],
            algorithm: { name: 'TSP 2-Opt (Web Parity)', version: '2.0' },
            updatedAt: Date.now(),
          },
        }
      }

      return day
    })
  )

  const updatedTrip = {
    ...trip,
    days: updatedDays,
    totalDistanceKm: Number(grandTotalDistanceKm.toFixed(2)),
    totalDurationMin: grandTotalDurationMin,
  }

  return {
    trip: updatedTrip,
    daysOptimized: daysOptimizedCount,
    totalDistanceKm: Number(grandTotalDistanceKm.toFixed(2)),
    totalDurationMin: grandTotalDurationMin,
    distanceSavedKm: Number(grandTotalSavedKm.toFixed(2)),
    unmappableReport,
  }
}


