import {
  ACTIVE_WORKSPACE_KEY,
  BOOTSTRAP_LOAD_KEY,
  BOOTSTRAP_NEW_KEY,
  PRINT_SNAPSHOT_KEY,
  PROVINCE_COORDS,
  TRIPS_STORAGE_KEY,
} from './constants'

export function defaultEnginePreferences() {
  return {
    province: 'Punjab',
    startLat: 31.5204,
    startLon: 74.3587,
    useBudget: true,
    maxBudget: 5000,
    useTimeLimit: true,
    maxTravelHours: 12,
    useCategories: true,
    preferredCategories: ['park', 'scenic'],
    useCrowdFilter: false,
    scoreWeight: 1,
    timeWeight: 0.5,
    costWeight: 0.01,
    questionnaire: {
      budgetLevel: 'Medium',
      tripDuration: '2-3 Days',
      travelCompanions: 'Friends',
      travelStyle: 'Mixed',
      personality: 'Extrovert',
      environment: 'Nature',
      crowdPreference: 'Neutral',
      physicalCondition: 'No issues',
    },
  }
}

export function createEmptyTripTemplate() {
  return {
    id: Date.now(),
    title: 'My Trip',
    name: 'My Trip',
    dates: '',
    notes: '',
    placesPool: [],
    customLists: [],
    days: [],
    expenses: [],
    budget: { currency: 'PKR', amount: 0 },
    map: { selectedPlaceId: null },
    enginePreferences: defaultEnginePreferences(),
    privacy: 'private',
  }
}

function createDemoPlace(id, title, category, subtitle, lat, lon) {
  return {
    id,
    title,
    category,
    subtitle,
    lat,
    lon,
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
}

export function createLegacyDemoTripTemplate() {
  const prefs = defaultEnginePreferences()
  prefs.province = 'Punjab'
  prefs.startLat = 33.6844
  prefs.startLon = 73.0479

  return {
    ...createEmptyTripTemplate(),
    id: Date.now(),
    title: 'Trip to Islamabad',
    name: 'Islamabad',
    dates: '4/4 - 9/4',
    startDate: '2026-04-04',
    endDate: '2026-04-09',
    days: [
      { id: 'day-1', label: 'Saturday, 4th April', shortLabel: 'Sat 4/4', date: 'Sat Apr 04 2026', items: [createDemoPlace('centaurus-mall', 'Centaurus Mall', 'shopping', 'Blue Area', 33.7073, 73.0498)] },
      { id: 'day-2', label: 'Sunday, 5th April', shortLabel: 'Sun 5/4', date: 'Sun Apr 05 2026', items: [createDemoPlace('faisal-masjid', 'Faisal Masjid', 'attraction', 'Islamabad landmark', 33.7295, 73.0372)] },
      { id: 'day-3', label: 'Monday, 6th April', shortLabel: 'Mon 6/4', date: 'Mon Apr 06 2026', items: [createDemoPlace('rawalpindi-railway-station', 'Rawalpindi Railway Station', 'transit', 'Placeholder details', 33.5959, 73.0479)] },
      { id: 'day-4', label: 'Tuesday, 7th April', shortLabel: 'Tue 7/4', date: 'Tue Apr 07 2026', items: [createDemoPlace('ayub-park', 'Ayub Park', 'park', 'Rawalpindi', 33.6261, 73.0719)] },
      { id: 'day-5', label: 'Wednesday, 8th April', shortLabel: 'Wed 8/4', date: 'Wed Apr 08 2026', items: [createDemoPlace('pakistan-monument', 'Pakistan Monument', 'museum', 'Shakarparian', 33.6938, 73.0686)] },
      { id: 'day-6', label: 'Thursday, 9th April', shortLabel: 'Thu 9/4', date: 'Thu Apr 09 2026', items: [] },
    ],
    placesPool: [
      createDemoPlace('lok-virsa', 'Lok Virsa Heritage Museum', 'museum', 'Cultural museum', 33.6840, 73.0728),
      createDemoPlace('margalla-hills', 'Margalla Hills', 'scenic', 'Hiking and viewpoints', 33.7430, 73.0551),
      createDemoPlace('rawal-lake', 'Rawal Lake', 'scenic', 'Lakeside views', 33.6930, 73.1235),
    ],
    enginePreferences: prefs,
  }
}

export function ensureWorkspaceParityTrip(trip) {
  if (!trip) return createEmptyTripTemplate()
  return {
    ...createEmptyTripTemplate(),
    ...trip,
    copiedFromEditToken: trip.copiedFromEditToken || trip.data?.copiedFromEditToken || undefined,
    sourceTripId: trip.sourceTripId !== undefined ? trip.sourceTripId : trip.data?.sourceTripId,
    privacy: trip.privacy || trip.data?.privacy || trip.visibility || 'private',
    budget: trip.budget && typeof trip.budget === 'object' ? trip.budget : { currency: 'PKR', amount: 0 },
    map: trip.map && typeof trip.map === 'object' ? trip.map : { selectedPlaceId: null },
    placesPool: Array.isArray(trip.placesPool) ? trip.placesPool : [],
    customLists: Array.isArray(trip.customLists) ? trip.customLists : [],
    days: Array.isArray(trip.days) ? trip.days : [],
    expenses: Array.isArray(trip.expenses) ? trip.expenses : [],
    enginePreferences: trip.enginePreferences && typeof trip.enginePreferences === 'object'
      ? { ...defaultEnginePreferences(), ...trip.enginePreferences }
      : defaultEnginePreferences(),
  }
}

export function normalizeSavedTripForWorkspace(record) {
  const rec = record && typeof record === 'object' ? record : null
  const recData = rec?.data && typeof rec.data === 'object' ? rec.data : null
  const nested = recData?.data && typeof recData.data === 'object' ? recData.data : null
  const nestedMoreDetailed = nested && Object.keys(nested).length > Object.keys(recData || {}).length
  const base = (nestedMoreDetailed ? nested : recData) || rec || {}

  const destination = String(base.destination || base.name || rec?.name || base.title || 'My Trip').trim() || 'My Trip'
  const startDate = base.startDate || rec?.startDate || ''
  const endDate = base.endDate || rec?.endDate || ''
  const privacy = base.privacy || recData?.privacy || rec?.privacy || base.visibility || rec?.visibility || 'private'
  const copiedFromEditToken = base.copiedFromEditToken || rec?.copiedFromEditToken || recData?.copiedFromEditToken || undefined
  const sourceTripId = base.sourceTripId !== undefined ? base.sourceTripId : (rec?.sourceTripId !== undefined ? rec.sourceTripId : recData?.sourceTripId)
  const ownerId = base.ownerId || rec?.ownerId || base.userId || rec?.userId || undefined
  const members = Array.isArray(base.members) ? base.members : (Array.isArray(rec?.members) ? rec.members : (Array.isArray(base.data?.members) ? base.data.members : []))

  const days = Array.isArray(base.days)
    ? base.days
    : Array.isArray(base.itinerary)
      ? base.itinerary
      : Array.isArray(base.data?.itinerary)
        ? base.data.itinerary
        : null

  const placesPool = Array.isArray(base.placesPool)
    ? base.placesPool
    : Array.isArray(base.locations)
      ? base.locations
      : Array.isArray(base.places)
        ? base.places
        : Array.isArray(base.data?.locations)
          ? base.data.locations
          : []

  const enginePreferences = base.enginePreferences && typeof base.enginePreferences === 'object'
    ? base.enginePreferences
    : base.preferences && typeof base.preferences === 'object'
      ? base.preferences
      : base.data?.preferences && typeof base.data.preferences === 'object'
        ? base.data.preferences
        : null

  const rawId = base.id || rec?.id || rec?.tripId
  const parsedNumericId = rawId !== undefined && rawId !== null && rawId !== '' ? Number(rawId) : NaN
  const resolvedId = Number.isFinite(parsedNumericId) ? parsedNumericId : (rawId || Date.now())

  const next = {
    ...base,
    id: resolvedId,
    tripId: base.tripId || rec?.tripId || resolvedId,
    name: base.name || destination,
    title: base.title || (destination && destination !== 'My Trip' ? `Trip to ${destination}` : 'My Trip'),
    startDate,
    endDate,
    dates: base.dates || formatTripDateRange(startDate, endDate),
    privacy,
    copiedFromEditToken,
    sourceTripId,
    ownerId,
    members,
    isTripmate: Boolean(rec?.isTripmate || base?.isTripmate),
    tripmateRole: rec?.tripmateRole || base?.tripmateRole || undefined,
    days: Array.isArray(days) ? days : (buildDaysFromDateRange(startDate, endDate) || []),
    placesPool,
    customLists: Array.isArray(base.customLists) ? base.customLists : [],
    expenses: Array.isArray(base.expenses) ? base.expenses : [],
    enginePreferences: enginePreferences || base.enginePreferences,
  }

  return ensureWorkspaceParityTrip(next)
}

export function guessProvinceFromTripName(name) {
  const value = String(name || '').toLowerCase()
  if (value.includes('karachi') || value.includes('sindh')) return 'Sindh'
  if (value.includes('islamabad') || value.includes('lahore') || value.includes('punjab')) return 'Punjab'
  if (value.includes('peshawar') || value.includes('swat')) return 'Khyber Pakhtunkhwa'
  if (value.includes('gilgit') || value.includes('hunza')) return 'Gilgit-Baltistan'
  if (value.includes('muzaffarabad') || value.includes('kashmir')) return 'Azad Kashmir'
  if (value.includes('quetta') || value.includes('baloch')) return 'Balochistan'
  return null
}

export function formatTripDateRange(startDate, endDate) {
  if (!startDate && !endDate) return ''
  if (startDate && endDate) return `${startDate} - ${endDate}`
  return startDate || endDate || ''
}

export function buildDaysFromDateRange(startInput, endInput) {
  const start = new Date(startInput)
  const end = new Date(endInput)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null
  const days = []
  let current = new Date(start)
  let index = 1
  while (current <= end) {
    days.push({
      id: `day-${index}`,
      label: `Day ${index}`,
      shortLabel: `Day ${index}`,
      date: current.toDateString(),
      items: [],
    })
    current.setDate(current.getDate() + 1)
    index += 1
  }
  return days
}

export function getSavedTrips() {
  try {
    return JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function setSavedTrips(trips) {
  localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips))
}

export function saveTripRecord(trip) {
  const trips = getSavedTrips()
  const record = {
    id: Number(trip.id) || Date.now(),
    name: trip.name || trip.title || 'My Trip',
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
    data: trip,
  }
  const index = trips.findIndex((entry) => Number(entry.id) === Number(record.id))
  if (index >= 0) trips[index] = record
  else trips.unshift(record)
  setSavedTrips(trips)
  persistActiveWorkspace(trip)
  return record
}

export function deleteSavedTrip(tripId) {
  const next = getSavedTrips().filter((entry) => Number(entry.id) !== Number(tripId))
  setSavedTrips(next)
  return next
}

export function queueNewTrip(payload) {
  sessionStorage.setItem(BOOTSTRAP_NEW_KEY, JSON.stringify(payload))
  sessionStorage.removeItem(BOOTSTRAP_LOAD_KEY)
}

export function queueLoadTrip(tripId) {
  sessionStorage.setItem(BOOTSTRAP_LOAD_KEY, String(tripId))
  sessionStorage.removeItem(BOOTSTRAP_NEW_KEY)
}

export function consumeQueuedTrip() {
  const loadId = sessionStorage.getItem(BOOTSTRAP_LOAD_KEY)
  if (loadId) {
    sessionStorage.removeItem(BOOTSTRAP_LOAD_KEY)
    const record = getSavedTrips().find((entry) => Number(entry.id) === Number(loadId))
    if (record?.data) return ensureWorkspaceParityTrip(structuredClone(record.data))
  }

  const newTripRaw = sessionStorage.getItem(BOOTSTRAP_NEW_KEY)
  if (newTripRaw) {
    sessionStorage.removeItem(BOOTSTRAP_NEW_KEY)
    try {
      return ensureWorkspaceParityTrip(JSON.parse(newTripRaw))
    } catch {
      return null
    }
  }

  return ensureWorkspaceParityTrip(readActiveWorkspace())
}

export function persistActiveWorkspace(trip) {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(trip))
}

export function clearActiveWorkspace() {
  localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
}

export function readActiveWorkspace() {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    return raw ? ensureWorkspaceParityTrip(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function queuePrintSnapshot(trip) {
  const raw = JSON.stringify(trip)
  localStorage.setItem(PRINT_SNAPSHOT_KEY, raw)
  sessionStorage.setItem(PRINT_SNAPSHOT_KEY, raw)
  persistActiveWorkspace(trip)
}

export function clearPrintSnapshot() {
  localStorage.removeItem(PRINT_SNAPSHOT_KEY)
  sessionStorage.removeItem(PRINT_SNAPSHOT_KEY)
}

export function readPrintSnapshot() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(PRINT_SNAPSHOT_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  return readActiveWorkspace()
}

export function countTripPlaces(tripData) {
  if (!tripData || !Array.isArray(tripData.days)) return 0
  return tripData.days.reduce((sum, day) => {
    const items = Array.isArray(day.items) ? day.items : []
    return sum + items.filter((item) => item && item.type !== 'note' && item.type !== 'checklist').length
  }, 0)
}

export function getTripCoverImage() {
  return 'assets/images/trip-pakistan.jpg'
}

export function buildNewTripPayload({ tripName, province, startDate, endDate }) {
  const days = buildDaysFromDateRange(startDate, endDate)
  if (!days?.length) return null
  const title = tripName ? `Trip to ${tripName}` : 'My Trip'
  const guessed = guessProvinceFromTripName(tripName)
  const finalProvince = guessed || province || 'Punjab'
  const prefs = defaultEnginePreferences()
  prefs.province = finalProvince
  const coords = PROVINCE_COORDS[finalProvince]
  if (coords) {
    prefs.startLat = coords.lat
    prefs.startLon = coords.lon
  }
  return {
    ...createEmptyTripTemplate(),
    id: Date.now(),
    title,
    name: tripName || 'My Trip',
    dates: formatTripDateRange(startDate, endDate),
    startDate,
    endDate,
    days,
    enginePreferences: prefs,
  }
}
