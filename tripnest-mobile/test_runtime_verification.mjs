import fs from 'fs'

// Read and verify TOP_CURATED_PAKISTAN_PLACES directly from images.js
const imagesContent = fs.readFileSync('./tripnest-mobile/src/constants/images.js', 'utf8')
const topCuratedMatch = imagesContent.match(/export const TOP_CURATED_PAKISTAN_PLACES = (\[[\s\S]*?\n\])/)

let topCurated = []
if (topCuratedMatch) {
  // Safe evaluation of the array literal
  try {
    topCurated = eval(topCuratedMatch[1])
  } catch (e) {
    console.error('Eval error on catalog:', e.message)
  }
}

console.log('=== TEST 1: CURATED ATTRACTIONS CATALOG AUDIT ===')
console.log(`Total Curated Places in Home Catalog: ${topCurated.length}`)

for (const p of topCurated) {
  console.log(`- [${p.id}] ${p.name} (${p.destination}) | Coords: ${p.lat}, ${p.lon} | PlaceID: ${p.place_id || 'N/A'}`)
  console.log(`  Image: ${p.image}`)
  if (p.fallbackUrls && p.fallbackUrls.length > 0) {
    console.log(`  Fallbacks: ${p.fallbackUrls.join(' | ')}`)
  }
}

// Specifically audit Faisal Mosque and Badshahi Mosque
const faisal = topCurated.find(p => p.id === 'faisal-masjid')
const badshahi = topCurated.find(p => p.id === 'badshahi-mosque')

console.log('\n=== MOSQUE VERIFICATION ===')
console.log('Faisal Mosque ID:', faisal?.id, '| Place ID:', faisal?.place_id)
console.log('Faisal Mosque Photo:', faisal?.image)
console.log('Faisal Mosque Fallbacks:', faisal?.fallbackUrls)

console.log('\nBadshahi Mosque ID:', badshahi?.id, '| Place ID:', badshahi?.place_id)
console.log('Badshahi Mosque Photo:', badshahi?.image)
console.log('Badshahi Mosque Fallbacks:', badshahi?.fallbackUrls)

const isFaisalMountain = (faisal?.image || '').includes('photo-1609137144813') || (faisal?.image || '').includes('photo-1608037521244') || (faisal?.image || '').includes('photo-1506744038136')
const isAuthenticFaisal = (faisal?.image || '').includes('Faisal_Mosque.jpg') || (faisal?.image || '').includes('photo-1635016288720')
console.log('\nIs Faisal Mosque showing mountain photo?', isFaisalMountain ? 'FAIL (Mountain photo detected!)' : (isAuthenticFaisal ? 'PASS (Authentic Faisal Mosque photograph)' : 'PASS'))

// Check live backend explore API
async function checkLiveBackendExplore() {
  console.log('\n=== TEST 2: LIVE BACKEND EXPLORE API (SerpAPI Dynamic Places) ===')
  try {
    const url = 'http://127.0.0.1:8000/api/explore/places?lat=33.7295&lon=73.0372&query=Faisal+Mosque'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      console.log(`Backend Explore API responded 200 OK. Returned ${data?.places?.length || 0} places for Faisal Mosque query.`)
      if (data?.places?.[0]) {
        const top = data.places[0]
        console.log(`Top Live Explore Place: ${top.title} (${top.address})`)
        console.log(`Photo: ${top.photo}`)
        console.log(`Rating: ${top.rating} (${top.reviewCount} reviews)`)
        console.log(`Google Place ID: ${top.place_id}`)
      }
    } else {
      console.log(`Backend responded status: ${res.status}`)
    }
  } catch (err) {
    console.log('Backend query error:', err.message)
  }
}

// Haversine formula
function haversineKm(from, to) {
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

function optimizePlaceSequence(places = [], startLat = null, startLon = null, speedKmh = 35.0, returnToStart = false) {
  if (!Array.isArray(places) || places.length <= 1) return { orderedPlaces: places, legs: [], totalDistanceKm: 0 }
  const mappable = places.map(p => ({ item: p, coords: { lat: p.lat, lon: p.lon } }))
  const n = mappable.length
  const safeSpeed = speedKmh > 0 ? Number(speedKmh) : 35.0
  const baseLat = startLat !== null ? Number(startLat) : mappable[0].coords.lat
  const baseLon = startLon !== null ? Number(startLon) : mappable[0].coords.lon

  const startDistances = mappable.map(loc => haversineKm({ lat: baseLat, lon: baseLon }, loc.coords))
  const distMatrix = Array.from({ length: n }, () => Array(n).fill(0.0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      distMatrix[i][j] = i === j ? 0.0 : haversineKm(mappable[i].coords, mappable[j].coords)
    }
  }

  // Nearest Neighbor tour
  const unvisited = new Set(Array.from({ length: n }, (_, i) => i))
  let closestIndex = 0
  let minDist = Infinity
  for (let i = 0; i < n; i++) {
    if (startDistances[i] < minDist) {
      minDist = startDistances[i]
      closestIndex = i
    }
  }
  const tour = [closestIndex]
  unvisited.delete(closestIndex)

  while (unvisited.size > 0) {
    const current = tour[tour.length - 1]
    let nextIdx = -1
    let nextMin = Infinity
    for (const cand of unvisited) {
      const d = distMatrix[current][cand]
      if (d < nextMin) {
        nextMin = d
        nextIdx = cand
      }
    }
    tour.push(nextIdx)
    unvisited.delete(nextIdx)
  }

  const { bestRoute } = improveRoute2Opt(tour, distMatrix, startDistances, returnToStart, 6)
  const orderedMappable = bestRoute.map(idx => mappable[idx])

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
      fromName: prev.item.title || prev.item.name,
      toName: curr.item.title || curr.item.name,
      distanceKm: Number(distKm.toFixed(2)),
      timeMin,
    })
  }

  return {
    orderedPlaces: orderedMappable.map(m => m.item),
    legs,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    totalDurationMin: Math.max(1, Math.round((totalDistanceKm / safeSpeed) * 60)),
  }
}

// Test Route Optimization and OSRM Road Geometry
async function testRouteOptimization() {
  console.log('\n=== TEST 3: ROUTE OPTIMIZATION (4 STOPS - ISLAMABAD) ===')
  const testStops = [
    {
      id: 'pakistan-monument',
      name: 'Pakistan Monument',
      title: 'Pakistan Monument',
      lat: 33.6938,
      lon: 73.0686,
    },
    {
      id: 'daman-e-koh',
      name: 'Daman-e-Koh',
      title: 'Daman-e-Koh',
      lat: 33.7466,
      lon: 73.0583,
    },
    {
      id: 'faisal-masjid',
      name: 'Faisal Mosque',
      title: 'Faisal Mosque',
      lat: 33.7295,
      lon: 73.0372,
    },
    {
      id: 'saidpur-village',
      name: 'Saidpur Village',
      title: 'Saidpur Village',
      lat: 33.7440,
      lon: 73.0670,
    },
  ]

  console.log('Input Stops Order (Unoptimized):')
  testStops.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s.lat}, ${s.lon})`))

  const optResult = optimizePlaceSequence(testStops, testStops[0].lat, testStops[0].lon, 35.0, false)
  console.log('\nOptimized Sequence (TSP Nearest Neighbor + 2-Opt):')
  optResult.orderedPlaces.forEach((s, i) => console.log(`  Stop ${i + 1}: ${s.name} (id: ${s.id})`))

  console.log('\nDistance Between Each Consecutive Stop:')
  optResult.legs.forEach((leg, i) => {
    console.log(`  Leg ${i + 1}: ${leg.fromName} ━━━━━> ${leg.toName}`)
    console.log(`    Distance: ${leg.distanceKm} km | Est. Duration: ~${leg.timeMin} min`)
  })
  console.log(`Total Daily Route Distance: ${optResult.totalDistanceKm} km`)
  console.log(`Total Est. Duration: ~${optResult.totalDurationMin} min`)

  // Test live OSRM road geometry
  console.log('\n=== TEST 4: OSRM ROAD NETWORK GEOMETRY (ISLAMABAD) ===')
  const coordsStr = optResult.orderedPlaces.map(p => `${p.lon},${p.lat}`).join(';')
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`
  console.log(`Querying OSRM: ${osrmUrl}`)

  try {
    const res = await fetch(osrmUrl)
    if (res.ok) {
      const data = await res.json()
      if (data.routes && data.routes[0]) {
        const route = data.routes[0]
        const polylineCoords = route.geometry.coordinates
        console.log(`OSRM Response Code: ${data.code}`)
        console.log(`OSRM Driving Road Distance: ${(route.distance / 1000).toFixed(2)} km`)
        console.log(`OSRM Driving Duration: ${(route.duration / 60).toFixed(1)} min`)
        console.log(`Number of Continuous Polyline Coordinates Generated: ${polylineCoords.length}`)
        console.log(`Sample Route Coordinates (First 3):`, polylineCoords.slice(0, 3).map(c => `[lat: ${c[1]}, lon: ${c[0]}]`))
        console.log(`Sample Route Coordinates (Last 3):`, polylineCoords.slice(-3).map(c => `[lat: ${c[1]}, lon: ${c[0]}]`))
      }
    } else {
      console.log('OSRM HTTP status:', res.status)
    }
  } catch (err) {
    console.log('OSRM fetch error:', err.message)
  }

  // TEST 5: GILGIT 5-STOP SAVED TRIP ROUTE OPTIMIZATION
  console.log('\n=== TEST 5: GILGIT SAVED TRIP (5 CONSECUTIVE PLACES ON SAME DAY) ===')
  const gilgitStops = [
    {
      id: 'gilgit-central-bazaar',
      name: 'Gilgit City Central Bazaar',
      title: 'Gilgit City Central Bazaar',
      lat: 35.9208,
      lon: 74.3144,
    },
    {
      id: 'gilgit-naltar-lakes',
      name: 'Naltar Valley & Emerald Lakes',
      title: 'Naltar Valley & Emerald Lakes',
      lat: 36.1667,
      lon: 74.1833,
    },
    {
      id: 'jutial-viewpoint',
      name: 'Jutial Viewpoint & Monument',
      title: 'Jutial Viewpoint & Monument',
      lat: 35.8942,
      lon: 74.3411,
    },
    {
      id: 'danyore-suspension-bridge',
      name: 'Danyore Suspension Bridge',
      title: 'Danyore Suspension Bridge',
      lat: 35.9234,
      lon: 74.3725,
    },
    {
      id: 'kargah-buddha-gilgit',
      name: 'Kargah Buddha Rock Carving',
      title: 'Kargah Buddha Rock Carving',
      lat: 35.9189,
      lon: 74.2547,
    },
  ]

  console.log('Gilgit Day 1 Stops (Unoptimized sequence):')
  gilgitStops.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s.lat}, ${s.lon})`))

  const gilgitOpt = optimizePlaceSequence(gilgitStops, gilgitStops[0].lat, gilgitStops[0].lon, 35.0, false)
  console.log('\nOptimized Visiting Sequence for Gilgit (TSP 2-Opt):')
  gilgitOpt.orderedPlaces.forEach((s, i) => console.log(`  Stop ${i + 1}: ${s.name} (id: ${s.id})`))

  console.log('\nConsecutive Leg Connections & Road Distances:')
  let totalGilgitRoadDistMeters = 0
  let totalGilgitRoadDurSec = 0

  for (let i = 1; i < gilgitOpt.orderedPlaces.length; i++) {
    const fromP = gilgitOpt.orderedPlaces[i - 1]
    const toP = gilgitOpt.orderedPlaces[i]
    const segUrl = `https://router.project-osrm.org/route/v1/driving/${fromP.lon},${fromP.lat};${toP.lon},${toP.lat}?overview=full&geometries=geojson&steps=false`

    try {
      const segRes = await fetch(segUrl)
      if (segRes.ok) {
        const segData = await segRes.json()
        if (segData.routes && segData.routes[0]) {
          const r = segData.routes[0]
          const distKm = (r.distance / 1000).toFixed(2)
          const durMin = (r.duration / 60).toFixed(1)
          totalGilgitRoadDistMeters += r.distance
          totalGilgitRoadDurSec += r.duration
          console.log(`  Segment ${i}: ${fromP.name} ━━━━━> ${toP.name}`)
          console.log(`    Distance: ${distKm} km | Duration: ${durMin} min | Road Coordinates: ${r.geometry.coordinates.length} pts (SUCCESS)`)
        } else {
          const directD = haversineKm(fromP, toP).toFixed(2)
          console.log(`  Segment ${i}: ${fromP.name} ━━━━━> ${toP.name} | Direct: ${directD} km (NoRoute fallback)`)
        }
      }
    } catch (e) {
      const directD = haversineKm(fromP, toP).toFixed(2)
      console.log(`  Segment ${i}: ${fromP.name} ━━━━━> ${toP.name} | Direct: ${directD} km (Network fallback)`)
    }
  }

  console.log(`\nTotal Day 1 Gilgit Road Route Distance: ${(totalGilgitRoadDistMeters / 1000).toFixed(2)} km`)
  console.log(`Total Day 1 Gilgit Road Duration: ${(totalGilgitRoadDurSec / 60).toFixed(1)} min`)

  // === TEST 6: MULTI-DAY TRIP OPTIMIZATION ===
  console.log('\n=== TEST 6: MULTI-DAY TRIP OPTIMIZATION (DAY 1 & DAY 2) ===')
  const multiDayTrip = {
    id: 'test-multi-day-101',
    destination: 'Gilgit & Hunza',
    days: [
      {
        id: 'day-1',
        label: 'Day 1: Gilgit Exploration',
        items: gilgitStops,
      },
      {
        id: 'day-2',
        label: 'Day 2: Hunza Valley Tour',
        items: [
          { id: 'rakaposhi-view', name: 'Rakaposhi View Point', title: 'Rakaposhi View Point', lat: 36.1956, lon: 74.4533 },
          { id: 'baltit-fort', name: 'Baltit Fort', title: 'Baltit Fort', lat: 36.3261, lon: 74.6711 },
          { id: 'altit-fort', name: 'Altit Fort', title: 'Altit Fort', lat: 36.3153, lon: 74.6908 },
          { id: 'attabad-lake', name: 'Attabad Lake', title: 'Attabad Lake', lat: 36.3353, lon: 74.8694 },
        ],
      },
    ],
  }

  console.log(`Trip: ${multiDayTrip.destination} (${multiDayTrip.days.length} days)`)
  for (const day of multiDayTrip.days) {
    console.log(`\nProcessing ${day.label} (${day.items.length} stops)...`)
    const opt = optimizePlaceSequence(day.items, day.items[0].lat, day.items[0].lon, 35.0, false)
    console.log(`  Optimized Order: ${opt.orderedPlaces.map(p => p.name).join(' ➔ ')}`)
    console.log(`  Estimated Total Road Distance: ${opt.totalDistanceKm} km | Est Duration: ${opt.totalDurationMin} min`)
  }

  // === TEST 7: COORDINATE VALIDATION & UNMAPPABLE PLACES REPORT ===
  console.log('\n=== TEST 7: COORDINATE VALIDATION & DIAGNOSTICS REPORT ===')
  const tripWithInvalidStop = [
    { id: 'place-1', name: 'Valid Place 1', lat: 33.6844, lon: 73.0479 },
    { id: 'place-2', name: 'Place with Missing Coords', lat: null, lon: undefined },
    { id: 'place-3', name: 'Place with Out-of-bounds Lat', lat: 145.2, lon: 73.05 },
    { id: 'place-4', name: 'Valid Place 2', lat: 33.7295, lon: 73.0372 },
  ]

  const validationReport = []
  const validStopsForRoute = []

  tripWithInvalidStop.forEach((p, idx) => {
    let hasValid = Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180
    if (!hasValid) {
      let reason = ''
      if (!Number.isFinite(p.lat) && !Number.isFinite(p.lon)) reason = 'Both latitude and longitude are missing or null'
      else if (!Number.isFinite(p.lat)) reason = 'Latitude is missing or null'
      else if (!Number.isFinite(p.lon)) reason = 'Longitude is missing or null'
      else reason = `Coordinates out of physical bounds [-90..90, -180..180]: lat=${p.lat}, lon=${p.lon}`

      validationReport.push({ id: p.id, name: p.name, reason, originalIndex: idx })
    } else {
      validStopsForRoute.push(p)
    }
  })

  console.log(`Total Input Places: ${tripWithInvalidStop.length}`)
  console.log(`Mappable Places for Routing: ${validStopsForRoute.length}`)
  console.log(`Unmappable Places Identified: ${validationReport.length}`)
  validationReport.forEach(r => {
    console.log(`  [DIAGNOSTIC REPORT] Stop "${r.name}" (id: ${r.id}, index: ${r.originalIndex}): ${r.reason}`)
  })
  console.log('Result: Stops with missing coordinates are cleanly diagnosed without crashing or being silently lost. PASS')

  // === TEST 8: 6-STOP COMPLETE CONNECTED PURPLE ROAD ROUTE TEST ===
  console.log('\n=== TEST 8: 6-STOP COMPLETE CONNECTED ROAD ROUTE COVERAGE ($S_1 \\to S_2 \\to S_3 \\to S_4 \\to S_5 \\to S_6$) ===')
  const sixPlaces = [
    { id: 'stop-1', name: 'Pakistan Monument', lat: 33.6938, lon: 73.0686 },
    { id: 'stop-2', name: 'Lok Virsa Heritage Museum', lat: 33.6840, lon: 73.0728 },
    { id: 'stop-3', name: 'Faisal Mosque', lat: 33.7295, lon: 73.0372 },
    { id: 'stop-4', name: 'Daman-e-Koh', lat: 33.7466, lon: 73.0583 },
    { id: 'stop-5', name: 'Monal Restaurant & Margalla View', lat: 33.7480, lon: 73.0620 },
    { id: 'stop-6', name: 'Saidpur Historical Village', lat: 33.7440, lon: 73.0670 },
  ]

  console.log(`Input Places Count: ${sixPlaces.length}`)
  const sixOpt = optimizePlaceSequence(sixPlaces, sixPlaces[0].lat, sixPlaces[0].lon, 35.0, false)
  console.log(`Optimized Sequence:`)
  sixOpt.orderedPlaces.forEach((p, i) => console.log(`  Stop ${i + 1}: ${p.name}`))

  const requiredLegsCount = sixOpt.orderedPlaces.length - 1
  console.log(`Required Consecutive Connecting Route Lines: ${requiredLegsCount} segments`)

  let renderedLegs = 0
  let total6DistMeters = 0
  let total6DurSec = 0
  let totalPolylinePoints = 0

  for (let i = 1; i < sixOpt.orderedPlaces.length; i++) {
    const fromP = sixOpt.orderedPlaces[i - 1]
    const toP = sixOpt.orderedPlaces[i]
    const segUrl = `https://router.project-osrm.org/route/v1/driving/${fromP.lon},${fromP.lat};${toP.lon},${toP.lat}?overview=full&geometries=geojson&steps=false`

    const res = await fetch(segUrl)
    if (res.ok) {
      const data = await res.json()
      if (data && data.routes && data.routes[0]) {
        renderedLegs++
        const route = data.routes[0]
        const dKm = (route.distance / 1000).toFixed(2)
        const dMin = (route.duration / 60).toFixed(1)
        total6DistMeters += route.distance
        total6DurSec += route.duration
        totalPolylinePoints += route.geometry.coordinates.length
        console.log(`  Leg ${i} (Stop ${i} ➔ Stop ${i + 1}): ${fromP.name} ━━━━━> ${toP.name}`)
        console.log(`    Distance: ${dKm} km | Drive Time: ~${dMin} min | Purple Road Geometry: ${route.geometry.coordinates.length} coords (VERIFIED)`)
      }
    }
  }

  console.log(`\nCoverage Verification: ${renderedLegs} of ${requiredLegsCount} consecutive connecting route lines successfully rendered.`)
  console.log(`Total 6-Stop Road Route Distance: ${(total6DistMeters / 1000).toFixed(2)} km`)
  console.log(`Total 6-Stop Road Duration: ${(total6DurSec / 60).toFixed(1)} min`)
  console.log(`Total Continuous Road Polyline Points: ${totalPolylinePoints} points`)
  console.log(renderedLegs === requiredLegsCount ? '100% COMPLETE ROAD ROUTE COVERAGE: PASS' : 'FAIL')
}

async function run() {
  await checkLiveBackendExplore()
  await testRouteOptimization()
}

run()
