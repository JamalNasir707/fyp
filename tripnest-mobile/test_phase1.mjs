// Phase 1 Isolated Static and Unit Tests
import assert from 'node:assert'

// 1. Test Places Catalog and Regional Filtering
import {
  RECOMMENDED_PLACES_CATALOG,
  getPlacesForDestination,
  DESTINATION_CATALOG,
} from './src/constants/images.js'

console.log('--- TEST SUITE 1: Regional Catalog Filtering ---')
const lahorePlaces = getPlacesForDestination('Lahore')
assert(lahorePlaces.length > 0, 'Lahore places should not be empty')
lahorePlaces.forEach((p) => {
  const dest = (p.destination || '').toLowerCase()
  const addr = (p.address || '').toLowerCase()
  assert(dest.includes('lahore') || addr.includes('lahore'), `Place ${p.name} should belong to Lahore`)
  assert(Number.isFinite(p.lat), `Place ${p.name} must have numeric lat`)
  assert(Number.isFinite(p.lon), `Place ${p.name} must have numeric lon`)
  // Ensure not Islamabad coordinates
  assert(Math.abs(p.lat - 33.6844) > 0.05, `Lahore place ${p.name} must not have Islamabad latitude`)
})
console.log(`✓ Lahore regional filtering verified (${lahorePlaces.length} places, zero Islamabad bleed)`)

const hunzaPlaces = getPlacesForDestination('Hunza')
assert(hunzaPlaces.length > 0, 'Hunza places should not be empty')
hunzaPlaces.forEach((p) => {
  assert(Number.isFinite(p.lat), `Hunza place ${p.name} must have numeric lat`)
  assert(Number.isFinite(p.lon), `Hunza place ${p.name} must have numeric lon`)
  assert(p.lat > 35.5, `Hunza place ${p.name} latitude should be northern (> 35.5)`)
})
console.log(`✓ Hunza regional filtering verified (${hunzaPlaces.length} places, northern latitude > 35.5)`)

const skarduPlaces = getPlacesForDestination('Skardu')
assert(skarduPlaces.length > 0, 'Skardu places should not be empty')
skarduPlaces.forEach((p) => {
  assert(Number.isFinite(p.lat), `Skardu place ${p.name} must have numeric lat`)
  assert(Number.isFinite(p.lon), `Skardu place ${p.name} must have numeric lon`)
  assert(p.lat > 35.0, `Skardu place ${p.name} latitude should be northern (> 35.0)`)
})
console.log(`✓ Skardu regional filtering verified (${skarduPlaces.length} places)`)

// 2. Test City Coordinates and Fallback Elimination
import {
  KNOWN_CITY_COORDS,
  getDestinationCoordinates,
} from './src/utils/locationService.js'

console.log('\n--- TEST SUITE 2: Destination Coordinate Resolution ---')
const lahoreCoords = getDestinationCoordinates('Lahore')
assert.strictEqual(lahoreCoords.city, 'Lahore')
assert.strictEqual(lahoreCoords.lat, 31.5204)
assert.strictEqual(lahoreCoords.lon, 74.3587)
console.log('✓ Lahore coordinates correct:', lahoreCoords)

const murreeCoords = getDestinationCoordinates('Murree')
assert.strictEqual(murreeCoords.city, 'Murree')
assert.strictEqual(murreeCoords.lat, 33.907)
assert.strictEqual(murreeCoords.lon, 73.3943)
console.log('✓ Murree coordinates correct (not defaulted to provincial Lahore or Islamabad):', murreeCoords)

const hunzaCoords = getDestinationCoordinates('Hunza Valley')
assert.strictEqual(hunzaCoords.lat, 36.3167)
assert.strictEqual(hunzaCoords.lon, 74.65)
console.log('✓ Hunza coordinates correct:', hunzaCoords)

const skarduCoords = getDestinationCoordinates('Skardu')
assert.strictEqual(skarduCoords.lat, 35.2971)
assert.strictEqual(skarduCoords.lon, 75.6333)
console.log('✓ Skardu coordinates correct:', skarduCoords)

// 3. Test Coordinate Extraction & No Fabrication
import {
  getPlaceLatLon,
  optimizePlaceSequence,
  buildNewTripPayload,
  ensureWorkspaceParityTrip,
} from './src/utils/tripUtils.js'

console.log('\n--- TEST SUITE 3: Coordinate Extraction (No Fabrication) ---')
// Real catalog place
const sampleFaisal = RECOMMENDED_PLACES_CATALOG.find((p) => p.id === 'faisal-masjid')
const coordsFaisal = getPlaceLatLon(sampleFaisal)
assert.deepStrictEqual(coordsFaisal, { lat: 33.7295, lon: 73.0372 })
console.log('✓ Catalog place coordinates preserved accurately')

// Unresolved / custom place without coordinates
const customUnmapped = { id: 'manual_1', title: 'Grandma Tea Shop' }
const coordsUnmapped = getPlaceLatLon(customUnmapped)
assert.strictEqual(coordsUnmapped, null, 'Unmapped stop must return null coordinates and NOT fabricate Islamabad')
console.log('✓ Custom unmapped stop correctly returns null coordinates without fabrication')

// 4. Test Exclusion of Unresolved Stops from Route Optimization
console.log('\n--- TEST SUITE 4: TSP Route Optimization & Exclusion of Unresolved Stops ---')
const testPlaces = [
  { id: 'stop_1', title: 'Badshahi Mosque', lat: 31.5882, lon: 74.3096 },
  { id: 'stop_2', title: 'Lahore Fort', lat: 31.5880, lon: 74.3152 },
  { id: 'stop_3', title: 'Shalimar Gardens', lat: 31.5861, lon: 74.3824 },
  { id: 'unmapped_custom', title: 'Random Street Food', lat: null, lon: null },
  { id: 'note_1', type: 'note', content: 'Buy bottled water' },
]

const optResult = optimizePlaceSequence(testPlaces, 31.5204, 74.3587, 30.0, false)
assert(optResult.orderedPlaces.length === 5, 'All items must be preserved in day')
assert.strictEqual(optResult.metrics.totalDistanceKm > 0, true, 'Route distance must be calculated')
assert(optResult.legs.length === 2, 'Only 2 legs generated between the 3 mappable places')

// Verify unmapped place and note are placed at the end without being thrown into TSP
const lastTwo = optResult.orderedPlaces.slice(-2)
assert.strictEqual(lastTwo[0].id, 'unmapped_custom', 'Unmapped stop must be kept intact and appended after optimized tour')
assert.strictEqual(lastTwo[1].id, 'note_1', 'Note must be preserved at end')
console.log(`✓ Optimization correctly excluded unmapped stop and note from TSP tour (Total Distance: ${optResult.totalDistanceKm.toFixed(2)} km, Legs: ${optResult.legs.length})`)

// 5. Test Trip Payload Creation with Destination Coordinates
console.log('\n--- TEST SUITE 5: Trip Creation Coordinates Integrity ---')
const lahoreTrip = buildNewTripPayload({
  destination: 'Lahore',
  startDate: '2026-11-01',
  endDate: '2026-11-04',
})
assert.strictEqual(lahoreTrip.destination, 'Lahore')
assert.strictEqual(lahoreTrip.enginePreferences.startLat, 31.5204, 'Lahore trip must use Lahore startLat')
assert.strictEqual(lahoreTrip.enginePreferences.startLon, 74.3587, 'Lahore trip must use Lahore startLon')
console.log('✓ New trip payload for Lahore accurately uses Lahore start coordinates (31.5204, 74.3587)')

const skarduTrip = buildNewTripPayload({
  destination: 'Skardu',
  startDate: '2026-11-01',
  endDate: '2026-11-05',
})
assert.strictEqual(skarduTrip.destination, 'Skardu')
assert.strictEqual(skarduTrip.enginePreferences.startLat, 35.2971, 'Skardu trip must use Skardu startLat')
assert.strictEqual(skarduTrip.enginePreferences.startLon, 75.6333, 'Skardu trip must use Skardu startLon')
console.log('✓ New trip payload for Skardu accurately uses Skardu start coordinates (35.2971, 75.6333)')

console.log('\n========================================')
console.log('ALL PHASE 1 ISOLATED TESTS PASSED (7/7)!')
console.log('========================================')

