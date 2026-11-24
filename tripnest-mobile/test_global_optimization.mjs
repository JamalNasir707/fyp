import fs from 'fs'
import {
  getPlaceLatLon,
  isPlaceMappable,
  haversineKm,
  optimizePlaceSequence,
  buildDayConnectionsMap,
  formatDistanceLabel,
  formatDurationMinutes,
  getDestinationCoordinates,
} from './src/utils/tripUtils.js'
import { findVerifiedLandmark } from './src/services/imageService.js'
import { RECOMMENDED_PLACES_CATALOG } from './src/constants/images.js'

console.log('================================================================================')
console.log('TRIPNEST MOBILE — GLOBAL ROUTE OPTIMIZATION AUDIT & RUNTIME VERIFICATION')
console.log('================================================================================\n')

let passCount = 0
let failCount = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`)
    passCount++
  } else {
    console.error(`  [FAIL] ${message}`)
    failCount++
  }
}

// Helper to query OSRM driving geometry
async function fetchOsrmGeometry(points) {
  if (points.length < 2) return null
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)
    const json = await res.json()
    const coordinates = json?.routes?.[0]?.geometry?.coordinates || []
    const distanceMeters = json?.routes?.[0]?.distance || 0
    const durationSeconds = json?.routes?.[0]?.duration || 0
    return {
      coordinates: coordinates.map(([lon, lat]) => [lat, lon]),
      distanceKm: distanceMeters / 1000,
      durationMin: Math.round(durationSeconds / 60),
    }
  } catch (err) {
    return { error: err.message, coordinates: points.map(p => [p.lat, p.lon]) }
  }
}

// ============================================================================
// TEST SCENARIO 1: Existing Saved Trip from Local Storage / MongoDB
// ============================================================================
console.log('>>> TEST SCENARIO 1: Existing Saved Trip (MongoDB / Storage Model)')
const savedTripFixture = {
  id: 'saved_trip_islamabad_001',
  tripId: 'saved_trip_islamabad_001',
  title: 'Capital Discovery Tour',
  destination: 'Islamabad',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  status: 'active',
  days: [
    {
      id: 'day-1',
      label: 'Day 1 - Modern Architectural Highlights',
      items: [
        { id: 'stop-101', name: 'Faisal Mosque', lat: 33.7295, lon: 73.0372, category: 'mosque' },
        { id: 'stop-102', name: 'Pakistan Monument', lat: 33.6934, lon: 73.0684, category: 'historic' },
        { id: 'stop-103', name: 'Lok Virsa Museum', lat: 33.6908, lon: 73.0706, category: 'museum' },
      ],
    },
    {
      id: 'day-2',
      label: 'Day 2 - Scenic Nature & Hills',
      items: [
        { id: 'stop-201', name: 'Daman-e-Koh', lat: 33.7388, lon: 73.0583, category: 'scenic' },
        { id: 'stop-202', name: 'Monal Margalla', lat: 33.7447, lon: 73.0674, category: 'dining' },
        { id: 'stop-203', name: 'Rawal Lake View Park', lat: 33.7042, lon: 73.1256, category: 'park' },
      ],
    },
  ],
}

assert(savedTripFixture.days.length === 2, 'Scenario 1: Found 2 itinerary days')
let s1TotalPlaces = 0
let s1MappablePlaces = 0
savedTripFixture.days.forEach(d => {
  d.items.forEach(item => {
    s1TotalPlaces++
    const coords = getPlaceLatLon(item, savedTripFixture.destination)
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)) {
      s1MappablePlaces++
    }
  })
})
assert(s1TotalPlaces === 6, `Scenario 1: Found 6 total places across 2 days`)
assert(s1MappablePlaces === 6, `Scenario 1: All 6 places resolved valid coordinates (100% mappable)`)

// Optimize Day 1
const s1Day1Coords = savedTripFixture.days[0].items.map(p => ({ ...p, ...getPlaceLatLon(p, savedTripFixture.destination) }))
const s1OptDay1 = optimizePlaceSequence(s1Day1Coords, s1Day1Coords[0].lat, s1Day1Coords[0].lon, 30.0, false)
assert(s1OptDay1.orderedPlaces.length === 3, 'Scenario 1: Day 1 optimized 3 places into valid sequence')
assert(s1OptDay1.totalDistanceKm > 0, `Scenario 1: Day 1 total distance computed: ${s1OptDay1.totalDistanceKm.toFixed(2)} km`)

// ============================================================================
// TEST SCENARIO 2: Newly Created Trip (TripCreationWizard / Manual Creation)
// ============================================================================
console.log('\n>>> TEST SCENARIO 2: Newly Created Trip (Wizard / Manual Creation)')
const wizardTripFixture = {
  id: 'new_trip_lahore_99',
  title: 'Cultural Lahore Weekend',
  destination: 'Lahore',
  startDate: '2026-08-10',
  endDate: '2026-08-10',
  days: [
    {
      id: 'day-1',
      label: 'Day 1 - Walled City Exploration',
      items: [
        { id: 'wiz-1', title: 'Badshahi Mosque', lat: 31.5882, lon: 74.3097, category: 'mosque' },
        { id: 'wiz-2', title: 'Lahore Fort (Shahi Qila)', lat: 31.5883, lon: 74.3155, category: 'historic' },
        { id: 'wiz-3', title: 'Delhi Gate & Shahi Hammam', lat: 31.5828, lon: 74.3228, category: 'historic' },
        { id: 'wiz-4', title: 'Wazir Khan Mosque', lat: 31.5834, lon: 74.3216, category: 'mosque' },
      ],
    },
  ],
}

assert(wizardTripFixture.days[0].items.length === 4, 'Scenario 2: Newly created trip has 4 planned stops')
const s2Coords = wizardTripFixture.days[0].items.map(p => ({ ...p, ...getPlaceLatLon(p, wizardTripFixture.destination) }))
const s2Opt = optimizePlaceSequence(s2Coords, s2Coords[0].lat, s2Coords[0].lon, 30.0, false)
assert(s2Opt.orderedPlaces.length === 4, 'Scenario 2: Sequence optimization preserves all 4 stops')
assert(s2Opt.legs.length === 3, 'Scenario 2: 4 stops produced exactly 3 connecting legs')

const s2Connections = buildDayConnectionsMap({ items: s2Opt.orderedPlaces, optimization: s2Opt }, wizardTripFixture.destination)
assert(s2Connections.size === 3, `Scenario 2: Inter-stop connections map generated 3 leg badges`)

// ============================================================================
// TEST SCENARIO 3: Smart Trip Planner Generated Trip
// ============================================================================
console.log('\n>>> TEST SCENARIO 3: Smart Trip Planner Generated Trip')
const plannerTripFixture = {
  id: 'planner_trip_hunza_777',
  title: 'AI Smart Plan: Hunza Mountain Escape',
  destination: 'Hunza',
  startDate: '2026-09-01',
  endDate: '2026-09-03',
  enginePreferences: {
    startLat: 36.3167,
    startLon: 74.65,
    speedKmh: 35.0,
  },
  days: [
    {
      id: 'day-1',
      label: 'Day 1 - Central Hunza Forts',
      items: [
        { id: 'pl-1', title: 'Baltit Fort', lat: 36.3256, lon: 74.6708 },
        { id: 'pl-2', title: 'Altit Fort', lat: 36.3142, lon: 74.6908 },
        { id: 'pl-3', title: 'Karimabad Bazaar', lat: 36.3214, lon: 74.6642 },
      ],
    },
    {
      id: 'day-2',
      label: 'Day 2 - Turquoise Waters & Glaciers',
      items: [
        { id: 'pl-4', title: 'Attabad Lake', lat: 36.3353, lon: 74.8672 },
        { id: 'pl-5', title: 'Passu Cones', lat: 36.4719, lon: 74.8875 },
        { id: 'pl-6', title: 'Hussaini Suspension Bridge', lat: 36.4251, lon: 74.8883 },
      ],
    },
  ],
}

assert(plannerTripFixture.days.length === 2, 'Scenario 3: Smart Trip Planner has 2 days')
let s3TotalStops = 0
plannerTripFixture.days.forEach(d => {
  const dayCoords = d.items.map(p => ({ ...p, ...getPlaceLatLon(p, plannerTripFixture.destination) }))
  const dayOpt = optimizePlaceSequence(dayCoords, dayCoords[0].lat, dayCoords[0].lon, 35.0, false)
  assert(dayOpt.orderedPlaces.length === d.items.length, `Scenario 3: ${d.label} preserved all ${d.items.length} places`)
  s3TotalStops += dayOpt.orderedPlaces.length
})
assert(s3TotalStops === 6, 'Scenario 3: Total 6 stops preserved and sequenced across Hunza trip')

// ============================================================================
// TEST SCENARIO 4: Itinerary Containing At Least 5 Places on Same Day
// ============================================================================
console.log('\n>>> TEST SCENARIO 4: 5-Place Same-Day Itinerary (Deep Road Geometry & TSP Audit)')
const fivePlacesDayFixture = {
  id: 'day-islamabad-grand',
  label: 'Day 1 - Grand Islamabad Circuit (5 Stops)',
  destination: 'Islamabad',
  items: [
    { id: 'stop-p1', title: 'Faisal Mosque', subtitle: 'F-8/Margalla, Islamabad', lat: 33.7295, lon: 73.0372, category: 'mosque' },
    { id: 'stop-p2', title: 'Daman-e-Koh', subtitle: 'Margalla Hills Viewpoint', lat: 33.7388, lon: 73.0583, category: 'scenic' },
    { id: 'stop-p3', title: 'Pakistan Monument', subtitle: 'Shakarparian Hills', lat: 33.6934, lon: 73.0684, category: 'historic' },
    { id: 'stop-p4', title: 'Lok Virsa Heritage Museum', subtitle: 'Garden Avenue', lat: 33.6908, lon: 73.0706, category: 'museum' },
    { id: 'stop-p5', title: 'Rawal Lake View Park', subtitle: 'Club Road', lat: 33.7042, lon: 73.1256, category: 'park' },
  ],
}

assert(fivePlacesDayFixture.items.length >= 5, `Scenario 4: Day contains ${fivePlacesDayFixture.items.length} places (meets >= 5 requirement)`)

// 1. Identify every place and validate coordinates
fivePlacesDayFixture.items.forEach((p, idx) => {
  const coords = getPlaceLatLon(p, fivePlacesDayFixture.destination)
  assert(coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon),
    `Scenario 4 [Stop ${idx + 1}]: "${p.title}" resolved valid coordinates: (${coords.lat}, ${coords.lon})`)
})

// 2. Run TSP Nearest Neighbor + 2-Opt local search
const s4InputPlaces = fivePlacesDayFixture.items.map(p => ({ ...p, ...getPlaceLatLon(p, fivePlacesDayFixture.destination) }))
const s4Opt = optimizePlaceSequence(s4InputPlaces, s4InputPlaces[0].lat, s4InputPlaces[0].lon, 30.0, false)

assert(s4Opt.orderedPlaces.length === 5, 'Scenario 4: TSP 2-Opt optimization retained all 5 places')
assert(s4Opt.legs.length === 4, 'Scenario 4: 5 consecutive stops produced exactly 4 connecting legs')
assert(s4Opt.totalDistanceKm > 0, `Scenario 4: Total optimized route distance: ${s4Opt.totalDistanceKm.toFixed(2)} km`)

console.log('\n  --- Leg by Leg Route Sequence ---')
s4Opt.legs.forEach((leg, i) => {
  console.log(`  Leg ${i + 1}: ${leg.fromName}  ━━━ (${leg.distanceKm.toFixed(2)} km, ~${leg.timeMin} min) ━━━▶  ${leg.toName}`)
})

// 3. Connect places with live OSRM road geometry
console.log('\n  Requesting live OSRM driving geometry for 5 consecutive stops...')
const osrmResult = await fetchOsrmGeometry(s4Opt.orderedPlaces)
if (osrmResult && !osrmResult.error) {
  assert(osrmResult.coordinates.length > 50, `Scenario 4: Live OSRM returned high-resolution road polyline with ${osrmResult.coordinates.length} vertices!`)
  assert(osrmResult.distanceKm > 0, `Scenario 4: OSRM actual driving road distance: ${osrmResult.distanceKm.toFixed(2)} km (~${osrmResult.durationMin} min drive)`)
} else {
  console.log(`  OSRM fallback to straight-line connection: ${osrmResult?.error}`)
}

// 4. Verify inter-stop connections map
const s4Connections = buildDayConnectionsMap({ items: s4Opt.orderedPlaces, optimization: s4Opt }, fivePlacesDayFixture.destination)
assert(s4Connections.size === 4, `Scenario 4: Inter-stop driving badges map created 4 connections for 5 stops`)

// ============================================================================
// TEST SCENARIO 5: Trip Containing Multiple Itinerary Days
// ============================================================================
console.log('\n>>> TEST SCENARIO 5: Multi-Day Trip (Day-wise Route Separation & Total Distance)')
const multiDayTripFixture = {
  id: 'multi_day_skardu_3days',
  title: 'Skardu High-Altitude Expedition',
  destination: 'Skardu',
  startDate: '2026-09-10',
  endDate: '2026-09-12',
  days: [
    {
      id: 'day-1',
      label: 'Day 1 - Shangrila & Lower Kachura',
      items: [
        { id: 'sk-1', title: 'Shangrila Resort', lat: 35.4222, lon: 75.4528 },
        { id: 'sk-2', title: 'Upper Kachura Lake', lat: 35.4458, lon: 75.4464 },
      ],
    },
    {
      id: 'day-2',
      label: 'Day 2 - Cold Desert & Historic Fort',
      items: [
        { id: 'sk-3', title: 'Katpana Cold Desert', lat: 35.3347, lon: 75.6028 },
        { id: 'sk-4', title: 'Kharpocho Fort', lat: 35.3056, lon: 75.6361 },
        { id: 'sk-5', title: 'Sadpara Lake', lat: 35.2333, lon: 75.6333 },
      ],
    },
    {
      id: 'day-3',
      label: 'Day 3 - Land of Giants',
      items: [
        { id: 'sk-6', title: 'Deosai National Park Entrance', lat: 35.0503, lon: 75.4517 },
        { id: 'sk-7', title: 'Sheosar Lake Deosai', lat: 34.9961, lon: 75.2458 },
      ],
    },
  ],
}

assert(multiDayTripFixture.days.length === 3, 'Scenario 5: Multi-day trip contains 3 days')
let multiDayTotalKm = 0
let multiDayTotalStops = 0

for (let dIdx = 0; dIdx < multiDayTripFixture.days.length; dIdx++) {
  const day = multiDayTripFixture.days[dIdx]
  const stops = day.items.map(p => ({ ...p, ...getPlaceLatLon(p, multiDayTripFixture.destination) }))
  const opt = optimizePlaceSequence(stops, stops[0].lat, stops[0].lon, 30.0, false)
  multiDayTotalKm += opt.totalDistanceKm
  multiDayTotalStops += opt.orderedPlaces.length

  assert(opt.orderedPlaces.length === day.items.length, `Scenario 5 [Day ${dIdx + 1}]: Preserved ${day.items.length} places`)
  assert(opt.legs.length === day.items.length - 1, `Scenario 5 [Day ${dIdx + 1}]: Formed ${day.items.length - 1} connecting legs`)
}

assert(multiDayTotalStops === 7, `Scenario 5: Total 7 stops mapped across 3 days`)
assert(multiDayTotalKm > 0, `Scenario 5: Total multi-day trip route distance computed: ${multiDayTotalKm.toFixed(2)} km`)

// ============================================================================
// TEST SCENARIO 6: Missing / Non-Numeric Coordinates Fallback Resilience
// ============================================================================
console.log('\n>>> TEST SCENARIO 6: Coordinate Validation & Resilient Fallback Handling')
const legacyUnresolvedStop = {
  id: 'legacy-stop-no-gps',
  title: 'Local Craft Market',
  subtitle: 'Islamabad',
}
const resolvedFallback = getPlaceLatLon(legacyUnresolvedStop, 'Islamabad')
assert(resolvedFallback !== null, 'Scenario 6: Place with missing GPS coordinates was not dropped')
assert(resolvedFallback.isEstimated === true, 'Scenario 6: Fallback properly flagged as isEstimated: true')
assert(resolvedFallback.lat >= 33.0 && resolvedFallback.lat <= 34.0, 'Scenario 6: Jitter coordinate accurately positioned near destination Islamabad')

// Final Audit Summary
console.log('\n================================================================================')
console.log(`TEST SUITE RESULTS: ${passCount} PASSED, ${failCount} FAILED`)
console.log('================================================================================')

if (failCount > 0) {
  process.exit(1)
} else {
  console.log('ALL 6 AUDIT SCENARIOS PASSED WITH 100% SUCCESS.')
}

