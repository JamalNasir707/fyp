import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearSession,
  createTripRequest,
  deleteAccountRequest,
  deleteTripRequest,
  fetchTripsRequest,
  fetchMySharedTripmateTripsRequest,
  googleLoginRequest,
  loginRequest,
  logoutRequest,
  persistSession,
  readStoredToken,
  readStoredUser,
  registerRequest,
  updateProfileRequest,
  updateTripRequest,
  updateTripmateItineraryRequest,
  verifyTokenRequest,
} from '../lib/session'
import {
  clearActiveWorkspace,
  clearPrintSnapshot,
  consumeQueuedTrip,
  createEmptyTripTemplate,
  ensureWorkspaceParityTrip,
  normalizeSavedTripForWorkspace,
  persistActiveWorkspace,
  queuePrintSnapshot,
  readActiveWorkspace,
} from '../lib/trips'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken())
  const [user, setUser] = useState(() => readStoredUser())
  const [savedTrips, setSavedTripsState] = useState([])
  const [activeTrip, setActiveTripState] = useState(() => ensureWorkspaceParityTrip(readActiveWorkspace()))
  const [bootstrappedWorkspace, setBootstrappedWorkspace] = useState(false)

  useEffect(() => {
    const queued = consumeQueuedTrip()
    if (queued) {
      const next = ensureWorkspaceParityTrip(queued)
      setActiveTripState(next)
      persistActiveWorkspace(next)
    }
    setBootstrappedWorkspace(true)
  }, [])

  async function fetchCombinedUserTrips(authToken) {
    let owned = []
    let shared = []
    try {
      const ownedRes = await fetchTripsRequest(authToken)
      owned = ownedRes.trips || []
    } catch {
      owned = []
    }
    try {
      const sharedRes = await fetchMySharedTripmateTripsRequest(authToken)
      if (sharedRes?.success && Array.isArray(sharedRes?.trips)) {
        shared = sharedRes.trips
      }
    } catch {
      shared = []
    }

    const normalizedShared = shared.map((t) => {
      const normalized = normalizeSavedTripForWorkspace({
        ...t,
        isTripmate: true,
        tripmateRole: t.tripmateRole || 'member',
      })
      return {
        ...normalized,
        isTripmate: true,
        tripmateRole: t.tripmateRole || 'member',
      }
    })

    const currentUserId = String(user?.user_id || user?.id || user?._id || '')
    const sharedMap = new Map()
    normalizedShared.forEach((t) => {
      const keyId = String(t.id || '')
      const keyTripId = String(t.tripId || '')
      if (keyId) sharedMap.set(keyId, t)
      if (keyTripId) sharedMap.set(keyTripId, t)
    })

    const processedOwned = owned.map((t) => {
      const keyId = String(t.id || '')
      const keyTripId = String(t.tripId || '')
      const sharedMatch = (keyId && sharedMap.get(keyId)) || (keyTripId && sharedMap.get(keyTripId))
      if (sharedMatch) {
        const canonicalOwnerId = String(sharedMatch.ownerId || sharedMatch.userId || t.ownerId || '')
        const isOwner = currentUserId && canonicalOwnerId && canonicalOwnerId === currentUserId
        if (!isOwner) {
          return {
            ...t,
            ...sharedMatch,
            isTripmate: true,
            tripmateRole: sharedMatch.tripmateRole || 'member',
          }
        }
      }
      return t
    })

    const ownedIds = new Set()
    processedOwned.forEach((t) => {
      if (t.id) ownedIds.add(String(t.id))
      if (t.tripId) ownedIds.add(String(t.tripId))
    })

    const filteredShared = normalizedShared.filter((t) => {
      const keyId = String(t.id || '')
      const keyTripId = String(t.tripId || '')
      return (!keyId || !ownedIds.has(keyId)) && (!keyTripId || !ownedIds.has(keyTripId))
    })

    return [...processedOwned, ...filteredShared]
  }

  useEffect(() => {
    let cancelled = false

    async function loadTrips() {
      if (!token) {
        if (!cancelled) setSavedTripsState([])
        return
      }
      try {
        const combined = await fetchCombinedUserTrips(token)
        if (!cancelled) setSavedTripsState(combined)
      } catch {
        if (!cancelled) setSavedTripsState([])
      }
    }

    loadTrips()
    return () => {
      cancelled = true
    }
  }, [token])

  async function login(credentials) {
    const data = await loginRequest(credentials)
    persistSession(data.token, data.user)
    setToken(data.token)
    setUser(data.user)
    const trips = await fetchCombinedUserTrips(data.token)
    setSavedTripsState(trips)
    return data
  }

  async function register(payload) {
    return registerRequest(payload)
  }

  async function googleLogin(accessToken) {
    const data = await googleLoginRequest(accessToken)
    persistSession(data.token, data.user)
    setToken(data.token)
    setUser(data.user)
    const trips = await fetchCombinedUserTrips(data.token)
    setSavedTripsState(trips)
    return data
  }

  async function verify() {
    if (!token) return false
    try {
      const data = await verifyTokenRequest(token)
      if (data.user) {
        setUser(data.user)
        persistSession(token, data.user)
      }
      const trips = await fetchCombinedUserTrips(token)
      setSavedTripsState(trips)
      return true
    } catch {
      clearSession()
      clearActiveWorkspace()
      clearPrintSnapshot()
      setToken(null)
      setUser(null)
      setSavedTripsState([])
      setActiveTripState(createEmptyTripTemplate())
      return false
    }
  }

  async function logout() {
    if (token) await logoutRequest(token)
    clearSession()
    clearActiveWorkspace()
    clearPrintSnapshot()
    setToken(null)
    setUser(null)
    setSavedTripsState([])
    setActiveTripState(createEmptyTripTemplate())
  }

  async function updateProfile(payload) {
    if (!token) throw new Error('Please sign in again.')
    const data = await updateProfileRequest(token, payload)
    persistSession(token, data.user)
    setUser(data.user)
    return data
  }

  async function deleteAccount(payload) {
    if (!token) throw new Error('Please sign in again.')
    await deleteAccountRequest(token, payload)
    clearSession()
    clearActiveWorkspace()
    clearPrintSnapshot()
    setToken(null)
    setUser(null)
    setSavedTripsState([])
    setActiveTripState(createEmptyTripTemplate())
  }

  function updateTrip(updater) {
    setActiveTripState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      // #region debug-point B:update-trip
      ;(() => {
        const traceId = `${String(next?.id || prev?.id || 'unknown')}-${Date.now()}`
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'saved-trip-open',
            runId: 'post-fix',
            hypothesisId: 'B',
            location: 'AppContext.jsx:updateTrip',
            msg: '[DEBUG] updateTrip applied',
            traceId,
            ts: Date.now(),
            data: {
              updaterType: typeof updater,
              prevKeys: prev ? Object.keys(prev) : null,
              nextKeys: next ? Object.keys(next) : null,
              nextHasDays: Array.isArray(next?.days),
              nextDaysLen: Array.isArray(next?.days) ? next.days.length : null,
              nextHasItinerary: Array.isArray(next?.itinerary),
              nextItineraryLen: Array.isArray(next?.itinerary) ? next.itinerary.length : null,
              nextHasPlacesPool: Array.isArray(next?.placesPool),
              nextPlacesPoolLen: Array.isArray(next?.placesPool) ? next.placesPool.length : null,
              nextStartDate: next?.startDate,
              nextEndDate: next?.endDate,
              nextName: next?.name,
              nextTitle: next?.title,
              nextNestedDataKeys: next?.data ? Object.keys(next.data) : null,
            },
          }),
        }).catch(() => {})
      })()
      // #endregion
      persistActiveWorkspace(next)
      return next
    })
  }

  function upsertSavedTrip(nextRecord) {
    setSavedTripsState((prev) => {
      const next = [...prev]
      const targetId = String(nextRecord.id || nextRecord.tripId || '')
      const targetTripId = String(nextRecord.tripId || nextRecord.id || '')

      const index = next.findIndex((entry) => {
        const entryId = String(entry.id || entry.tripId || '')
        const entryTripId = String(entry.tripId || entry.id || '')
        return (
          (targetId && (entryId === targetId || entryTripId === targetId)) ||
          (targetTripId && (entryId === targetTripId || entryTripId === targetTripId))
        )
      })

      const existingEntry = index >= 0 ? next[index] : null
      const isTripmate = Boolean(nextRecord.isTripmate || existingEntry?.isTripmate)
      const tripmateRole = nextRecord.tripmateRole || existingEntry?.tripmateRole || (isTripmate ? 'member' : undefined)

      const mergedRecord = {
        ...nextRecord,
        ...(isTripmate ? { isTripmate: true, tripmateRole: tripmateRole || 'member' } : {}),
      }

      if (index >= 0) {
        next[index] = mergedRecord
      } else {
        next.unshift(mergedRecord)
      }
      return next
    })
  }

  async function reloadTrips(overrideToken) {
    const activeToken = overrideToken || token
    if (!activeToken) {
      setSavedTripsState([])
      return []
    }
    try {
      const combined = await fetchCombinedUserTrips(activeToken)
      setSavedTripsState(combined)
      return combined
    } catch {
      setSavedTripsState([])
      return []
    }
  }

  function openSavedTrip(tripId, tripListOverride) {
    const sourceList = Array.isArray(tripListOverride) ? tripListOverride : savedTrips
    const record = sourceList.find((entry) => String(entry.id || entry.tripId) === String(tripId))
    if (!record) return null

    const openedAt = new Date().toISOString()
    const isTripmate = Boolean(record.isTripmate)

    const nextTrip = ensureWorkspaceParityTrip({
      ...normalizeSavedTripForWorkspace(record),
      isTripmate,
      lastOpened: openedAt,
    })

    const nextRecord = {
      ...record,
      lastOpened: openedAt,
      data: {
        ...(record.data && typeof record.data === 'object' ? record.data : {}),
        lastOpened: openedAt,
      },
    }

    persistActiveWorkspace(nextTrip)
    setActiveTripState(nextTrip)
    upsertSavedTrip(nextRecord)

    if (token && !isTripmate) {
      updateTripRequest(token, nextTrip)
        .then((response) => {
          const resolvedTrip = ensureWorkspaceParityTrip(response.trip?.data || nextTrip)
          persistActiveWorkspace(resolvedTrip)
          setActiveTripState(resolvedTrip)
          if (response.trip) upsertSavedTrip(response.trip)
        })
        .catch(() => {
          // Keep the optimistic lastOpened update locally even if the background sync fails.
        })
    }

    return nextTrip
  }

  async function createTrip(trip) {
    if (!token) throw new Error('Please sign in again.')
    const response = await createTripRequest(token, trip)
    const nextTrip = ensureWorkspaceParityTrip(response.trip?.data || trip)
    persistActiveWorkspace(nextTrip)
    setActiveTripState(nextTrip)
    if (response.trip) upsertSavedTrip(response.trip)
    return response.trip
  }

  async function saveTrip(tripOverride) {
    if (!token) throw new Error('Please sign in again.')
    const tripToSave = ensureWorkspaceParityTrip(tripOverride || activeTrip)
    if (tripToSave.isTripmate) {
      const targetTripId = tripToSave.id || tripToSave.tripId
      const payload = {
        days: Array.isArray(tripToSave.days) ? tripToSave.days : [],
        placesPool: Array.isArray(tripToSave.placesPool) ? tripToSave.placesPool : [],
        customLists: Array.isArray(tripToSave.customLists) ? tripToSave.customLists : [],
      }
      const response = await updateTripmateItineraryRequest(token, targetTripId, payload)
      if (!response || response.success === false) {
        throw new Error(response?.error || response?.detail || 'Failed to save Tripmate itinerary')
      }
      const returnedDoc = response.trip || response.data || tripToSave
      const resolvedTrip = ensureWorkspaceParityTrip({
        ...normalizeSavedTripForWorkspace(returnedDoc),
        ...tripToSave,
        days: payload.days,
        placesPool: payload.placesPool,
        customLists: payload.customLists,
        isTripmate: true,
      })
      persistActiveWorkspace(resolvedTrip)
      setActiveTripState(resolvedTrip)
      if (response.trip) {
        const savedRecord = {
          ...response.trip,
          isTripmate: true,
          tripmateRole: tripToSave.tripmateRole || 'member',
          ownerId: tripToSave.ownerId || response.trip.ownerId || response.trip.userId,
        }
        upsertSavedTrip(savedRecord)
      }
      return resolvedTrip
    }
    const response = await updateTripRequest(token, tripToSave)
    const nextTrip = ensureWorkspaceParityTrip(response.trip?.data || tripToSave)
    persistActiveWorkspace(nextTrip)
    setActiveTripState(nextTrip)
    if (response.trip) upsertSavedTrip(response.trip)
    return response.trip
  }

  async function removeTrip(tripId) {
    if (!token) throw new Error('Please sign in again.')
    const record = savedTrips.find((entry) => String(entry.id || entry.tripId) === String(tripId))
    if (record?.isTripmate) {
      throw new Error('Tripmate members cannot delete shared trips.')
    }
    await deleteTripRequest(token, tripId)
    setSavedTripsState((prev) => prev.filter((entry) => String(entry.id || entry.tripId) !== String(tripId)))
  }

  function queuePrint() {
    queuePrintSnapshot(activeTrip)
  }

  const value = useMemo(() => ({
    token,
    user,
    isAuthenticated: Boolean(token && user),
    savedTrips,
    activeTrip,
    bootstrappedWorkspace,
    login,
    register,
    googleLogin,
    verify,
    logout,
    updateProfile,
    deleteAccount,
    updateTrip,
    openSavedTrip,
    reloadTrips,
    createTrip,
    saveTrip,
    removeTrip,
    queuePrint,
  }), [token, user, savedTrips, activeTrip, bootstrappedWorkspace, reloadTrips])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
