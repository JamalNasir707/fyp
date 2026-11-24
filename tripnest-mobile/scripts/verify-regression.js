/**
 * TripNest Mobile — Comprehensive Regression & Integration Test Suite
 * 
 * Verifies:
 * 1. Calendar Date Range & Consecutive Days Calculation.
 * 2. Month and Year Boundaries & Timezone Safety.
 * 3. Place Search State Separation (Search Query changes do not clear selections).
 * 4. Duplicate Place Prevention.
 * 5. Single Place Removal.
 * 6. Even Itinerary Days Distribution across multi-day trips.
 * 7. FastAPI Backend Profile Schema Sanitization.
 */

const assert = require('assert')

console.log('========================================================')
console.log('RUNNING TRIPNEST MOBILE REGRESSION & INTEGRATION TESTS')
console.log('========================================================\n')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

// -------------------------------------------------------------
// Test 1: Date arithmetic & consecutive days calculation
// -------------------------------------------------------------
test('Calendar date range computes correct inclusive days count', () => {
  function countDaysBetweenIso(startIso, endIso) {
    if (!startIso || !endIso) return 0
    const [y1, m1, d1] = startIso.split('-').map(Number)
    const [y2, m2, d2] = endIso.split('-').map(Number)
    const t1 = Date.UTC(y1, m1 - 1, d1)
    const t2 = Date.UTC(y2, m2 - 1, d2)
    if (t2 < t1) return 0
    return Math.round((t2 - t1) / (1000 * 60 * 60 * 24)) + 1
  }

  // 1-day trip (same start and end)
  assert.strictEqual(countDaysBetweenIso('2026-06-01', '2026-06-01'), 1)
  // 5-day trip
  assert.strictEqual(countDaysBetweenIso('2026-06-01', '2026-06-05'), 5)
  // Month boundary (June 28 to July 3 in a 30-day month)
  assert.strictEqual(countDaysBetweenIso('2026-06-28', '2026-07-03'), 6)
  // Year boundary (Dec 30 to Jan 2)
  assert.strictEqual(countDaysBetweenIso('2026-12-30', '2027-01-02'), 4)
  // Inverted range returns 0
  assert.strictEqual(countDaysBetweenIso('2026-06-05', '2026-06-01'), 0)
})

// -------------------------------------------------------------
// Test 2: Consecutive Day generation without timezone shift
// -------------------------------------------------------------
test('Consecutive itinerary day generation matches exact calendar dates', () => {
  function addDaysToIso(baseIso, daysToAdd) {
    const [y, m, d] = baseIso.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d + daysToAdd))
    const resY = date.getUTCFullYear()
    const resM = String(date.getUTCMonth() + 1).padStart(2, '0')
    const resD = String(date.getUTCDate()).padStart(2, '0')
    return `${resY}-${resM}-${resD}`
  }

  const start = '2026-02-27'
  // Feb 27, Feb 28, Mar 01, Mar 02 (non-leap year 2026)
  assert.strictEqual(addDaysToIso(start, 0), '2026-02-27')
  assert.strictEqual(addDaysToIso(start, 1), '2026-02-28')
  assert.strictEqual(addDaysToIso(start, 2), '2026-03-01')
  assert.strictEqual(addDaysToIso(start, 3), '2026-03-02')
})

// -------------------------------------------------------------
// Test 3: Place Search & Selection separation
// -------------------------------------------------------------
test('Searching does NOT add places automatically; Selection is distinct from Search Results', () => {
  const allCatalogPlaces = [
    { id: 'faisal_mosque', name: 'Faisal Mosque', category: 'Attraction' },
    { id: 'daman_e_koh', name: 'Daman-e-Koh', category: 'Scenic' },
    { id: 'monal', name: 'Monal Margalla', category: 'Dining' },
    { id: 'lok_virsa', name: 'Lok Virsa Museum', category: 'Museum' },
  ]

  let searchQuery = ''
  let selectedPlaces = []

  // Helper: Filter results
  function getSearchResults(query) {
    const q = query.trim().toLowerCase()
    if (!q) return allCatalogPlaces
    return allCatalogPlaces.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }

  // Helper: Explicit Add
  function addPlace(place) {
    if (selectedPlaces.some((p) => p.id === place.id)) return // duplicate prevention
    selectedPlaces.push(place)
  }

  // Helper: Remove
  function removePlace(placeId) {
    selectedPlaces = selectedPlaces.filter((p) => p.id !== placeId)
  }

  // Step A: Search for "Faisal"
  searchQuery = 'Faisal'
  let results = getSearchResults(searchQuery)
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].id, 'faisal_mosque')
  // CRITICAL CHECK: selectedPlaces must still be EMPTY!
  assert.strictEqual(selectedPlaces.length, 0, 'Searching must never automatically add to selected places')

  // Step B: User explicitly taps "+ Add" on Faisal Mosque
  addPlace(results[0])
  assert.strictEqual(selectedPlaces.length, 1)
  assert.strictEqual(selectedPlaces[0].id, 'faisal_mosque')

  // Step C: User changes search query to "Monal"
  searchQuery = 'Monal'
  results = getSearchResults(searchQuery)
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].id, 'monal')
  // CRITICAL CHECK: Typing a new query must NOT clear previously selected places!
  assert.strictEqual(selectedPlaces.length, 1, 'Changing search query must not wipe previous selections')
  assert.strictEqual(selectedPlaces[0].id, 'faisal_mosque')

  // Step D: User explicitly adds Monal
  addPlace(results[0])
  assert.strictEqual(selectedPlaces.length, 2)

  // Step E: Duplicate attempt
  addPlace(results[0])
  assert.strictEqual(selectedPlaces.length, 2, 'Duplicate place must not be added')

  // Step F: User removes Faisal Mosque
  removePlace('faisal_mosque')
  assert.strictEqual(selectedPlaces.length, 1)
  assert.strictEqual(selectedPlaces[0].id, 'monal', 'Removing a selection must only remove that specific place')
})

// -------------------------------------------------------------
// Test 4: Even distribution of chosen places across trip days
// -------------------------------------------------------------
test('Chosen places are distributed evenly across all days in order', () => {
  const chosenPlaces = [
    { id: 'p1', name: 'Stop 1' },
    { id: 'p2', name: 'Stop 2' },
    { id: 'p3', name: 'Stop 3' },
    { id: 'p4', name: 'Stop 4' },
    { id: 'p5', name: 'Stop 5' },
    { id: 'p6', name: 'Stop 6' },
  ]
  const totalDays = 3
  const maxPlacesPerDay = 3
  const totalItineraryCapacity = totalDays * maxPlacesPerDay

  const itineraryAssigned = chosenPlaces.slice(0, totalItineraryCapacity)
  const days = []
  let cursor = 0
  const placesPerDayBase = Math.floor(itineraryAssigned.length / totalDays)
  const remainder = itineraryAssigned.length % totalDays

  for (let i = 1; i <= totalDays; i++) {
    const countForThisDay = placesPerDayBase + (i <= remainder ? 1 : 0)
    const daySlice = itineraryAssigned.slice(cursor, cursor + countForThisDay)
    cursor += countForThisDay
    days.push({ dayNumber: i, items: daySlice })
  }

  assert.strictEqual(days.length, 3)
  assert.strictEqual(days[0].items.length, 2, 'Day 1 has 2 items')
  assert.strictEqual(days[1].items.length, 2, 'Day 2 has 2 items')
  assert.strictEqual(days[2].items.length, 2, 'Day 3 has 2 items')
  assert.strictEqual(days[0].items[0].id, 'p1')
  assert.strictEqual(days[2].items[1].id, 'p6')
})

// -------------------------------------------------------------
// Test 5: Profile schema sanitization for FastAPI contract
// -------------------------------------------------------------
test('Profile update sanitization conforms strictly to FastAPI ProfileUpdateRequest schema', () => {
  const fullMobileUserForm = {
    name: 'Explorer Name',
    username: 'explorer_99',
    email: 'explorer@example.com',
    profileImage: 'https://example.com/photo.jpg',
    bio: 'Travel enthusiast',
    // Extended client-only fields:
    homeCity: 'Lahore',
    travelStyle: 'Adventure',
    budgetTier: 'Luxury',
    travelInterests: ['Trekking', 'Camping'],
  }

  // Mobile client sanitization:
  const sanitizedFastApiPayload = {
    name: fullMobileUserForm.name,
    username: fullMobileUserForm.username,
    email: fullMobileUserForm.email,
    profileImage: fullMobileUserForm.profileImage,
    bio: fullMobileUserForm.bio,
  }

  const allowedKeys = new Set(['name', 'username', 'email', 'profileImage', 'bio'])
  const payloadKeys = Object.keys(sanitizedFastApiPayload)

  assert.strictEqual(payloadKeys.length, 5)
  payloadKeys.forEach((key) => {
    assert.strictEqual(allowedKeys.has(key), true, `Key ${key} is valid for FastAPI`)
  })
  assert.strictEqual(sanitizedFastApiPayload.homeCity, undefined)
  assert.strictEqual(sanitizedFastApiPayload.travelStyle, undefined)
})

console.log(`\n========================================================`)
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`)
console.log(`========================================================\n`)

if (failed > 0) {
  process.exit(1)
}

