import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { apiService } from '../api/apiService'
import { getCurrentEnvironment, ENVIRONMENTS } from '../config/env.js'
import { appStorage } from '../utils/storage'
import {
  ensureWorkspaceParityTrip,
  buildDaysFromDateRange,
  rebuildTripDays,
  rebuildTripDayMetadata,
  formatTripDateRange,
  optimizePlaceSequence,
  getPlaceLatLon,
  getDestinationCoordinates,
} from '../utils/tripUtils'
import { getTravelerMetaKey } from '../utils/profileUtils.js'
import { optimizeTripDays, optimizeStopSequence, calculateDayRoadRoute } from '../services/routeOptimizationService'

export const DEFAULT_PREFERENCES = {
  language: 'English',
  dateFormat: 'month-day', // 'month-day' | 'day-month'
  distanceFormat: 'kilometers', // 'kilometers' | 'miles'
  timeFormat: '12-hour', // '12-hour' | '24-hour'
  placeDescriptions: 'show-below-custom-notes',
  expertTravelTips: 'enabled',
  photoUpload: 'wifi-only',
  disableEmailNotifications: false,
  disablePushNotifications: false,
  emailNotifications: {
    tripInvitations: true,
    tripUpdates: true,
    sharedItineraryChanges: true,
    tripReminders: true,
    accountSecurity: true,
    productUpdates: true,
    newsAndAnnouncements: true,
  },
  pushNotifications: {
    tripInvitations: true,
    tripUpdates: true,
    sharedItineraryUpdates: true,
    tripReminders: true,
    collaborationActivity: true,
    productAnnouncements: true,
  },
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [savedTrips, setSavedTrips] = useState([])
  const [activeTrip, setActiveTrip] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isHydrating, setIsHydrating] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'error'
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [wishlist, setWishlist] = useState([])

  // Serialized persistence queue to prevent race conditions on rapid saves
  const persistQueueRef = useRef(Promise.resolve())
  const latestTripPendingRef = useRef(null)

  // 1. Startup Boot Hydration (Session token, preferences, traveler meta, wishlist)
  useEffect(() => {
    let isMounted = true
    async function hydrateApp() {
      try {
        const [savedToken, savedPrefs, savedWishlist] = await Promise.all([
          appStorage.getItem('tripnest_auth_token'),
          appStorage.getItem('tripnest_preferences'),
          appStorage.getItem('tripnest_wishlist'),
        ])

        if (!isMounted) return

        if (Array.isArray(savedWishlist)) {
          setWishlist(savedWishlist)
        }

        if (savedPrefs && typeof savedPrefs === 'object') {
          setPreferences((prev) => ({ ...prev, ...savedPrefs }))
        }

        if (savedToken && typeof savedToken === 'string') {
          try {
            const verifyRes = await apiService.verifyToken(savedToken)
            if (verifyRes?.success && verifyRes?.user) {
              const uId = verifyRes.user.id || verifyRes.user.userId || verifyRes.user.username
              const savedMeta = await appStorage.getItem(getTravelerMetaKey(uId)).catch(() => null)
              setToken(savedToken)
              setUser({
                ...verifyRes.user,
                ...(savedMeta && typeof savedMeta === 'object' ? savedMeta : {}),
              })
            } else {
              await appStorage.removeItem('tripnest_auth_token')
            }
          } catch {
            // Expired or unreachable on boot; remove stale token
            await appStorage.removeItem('tripnest_auth_token')
          }
        }
      } catch (err) {
        console.warn('Hydration notice:', err.message)
      } finally {
        if (isMounted) setIsHydrating(false)
      }
    }

    hydrateApp()
    return () => {
      isMounted = false
    }
  }, [])

  function handleAuthExpiry(err) {
    if (token && String(token).startsWith('guest_local_token_')) {
      return false
    }
    if (err?.isAuthExpired || err?.status === 401 || String(err?.message || '').toLowerCase().includes('expired session')) {
      logout()
      Alert.alert('Session Expired', 'Your session has expired. Please sign in again.')
      return true
    }
    return false
  }

  function updatePreference(key, value) {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value }
      appStorage.setItem('tripnest_preferences', next).catch(() => {})
      return next
    })
  }

  function updatePreferences(next) {
    setPreferences((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      const nextPrefs = { ...prev, ...resolved }
      appStorage.setItem('tripnest_preferences', nextPrefs).catch(() => {})
      return nextPrefs
    })
  }

  // Dedicated Shared Budget Subsystem State
  const [sharedBudgetExpenses, setSharedBudgetExpenses] = useState([])
  const [sharedBudgetSettlements, setSharedBudgetSettlements] = useState([])
  const [sharedBudgetLoading, setSharedBudgetLoading] = useState(false)

  // Tripmates Collaboration State
  const [tripMembers, setTripMembers] = useState({ owner: null, members: [], pendingInvites: [] })
  const [userInvitations, setUserInvitations] = useState([])

  // Notifications State
  const [notifications, setNotifications] = useState([])
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)

  // Load trips on initial boot if token exists
  useEffect(() => {
    if (token) {
      loadTrips(token)
      loadNotifications(token)
      loadUserInvitations(token)
    }
  }, [token])

  async function loadTrips(activeToken = token) {
    if (!activeToken) return
    setLoading(true)
    try {
      const ownedRes = await apiService.getTrips(activeToken)
      const sharedRes = await apiService.getSharedTripmateTrips(activeToken)

      const owned = (ownedRes?.trips || []).map(ensureWorkspaceParityTrip)
      const shared = (sharedRes?.trips || []).map(ensureWorkspaceParityTrip)

      // Deterministic deduplication by stable trip ID
      const seenTripIds = new Set()
      const combined = []
      for (const trip of [...owned, ...shared]) {
        const idKey = String(trip.id || trip.tripId)
        if (idKey && !seenTripIds.has(idKey)) {
          seenTripIds.add(idKey)
          combined.push(trip)
        }
      }

      setSavedTrips(combined)

      if (combined.length > 0 && !activeTrip) {
        setActiveTrip(combined[0])
      }
    } catch (err) {
      if (!handleAuthExpiry(err)) {
        console.warn('Failed to load trips:', err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function login(credentials) {
    setLoading(true)
    try {
      const res = await apiService.login(credentials)
      if (res?.success) {
        setToken(res.token)
        const uId = res.user?.id || res.user?.userId || res.user?.username
        const savedMeta = await appStorage.getItem(getTravelerMetaKey(uId)).catch(() => null)
        const mergedUser = {
          ...(res.user || {}),
          ...(savedMeta && typeof savedMeta === 'object' ? savedMeta : {}),
        }
        setUser(mergedUser)
        await appStorage.setItem('tripnest_auth_token', res.token).catch(() => {})
        await loadTrips(res.token)
        return res
      }
      throw new Error(res?.detail || res?.message || res?.error || 'Invalid credentials or login failed')
    } finally {
      setLoading(false)
    }
  }

  async function register(payload) {
    setLoading(true)
    try {
      return await apiService.register(payload)
    } finally {
      setLoading(false)
    }
  }

  async function googleLogin(tokenPayload) {
    setLoading(true)
    try {
      const res = await apiService.googleLogin(tokenPayload)
      if (res?.success) {
        setToken(res.token)
        const uId = res.user?.id || res.user?.userId || res.user?.username
        const savedMeta = await appStorage.getItem(getTravelerMetaKey(uId)).catch(() => null)
        const mergedUser = {
          ...(res.user || {}),
          ...(savedMeta && typeof savedMeta === 'object' ? savedMeta : {}),
        }
        setUser(mergedUser)
        await appStorage.setItem('tripnest_auth_token', res.token).catch(() => {})
        await loadTrips(res.token)
        return res
      }
      throw new Error(res?.detail || res?.message || res?.error || 'Google authentication failed')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    try {
      if (token) {
        await apiService.logout(token).catch(() => {})
      }
    } finally {
      await appStorage.removeItem('tripnest_auth_token').catch(() => {})
      setToken(null)
      setUser(null)
      setActiveTrip(null)
      setSavedTrips([])
      setTripMembers({ owner: null, members: [], pendingInvites: [] })
    }
  }

  async function updateUserProfile(updates) {
    // Persist extended travel style attributes to client storage cache scoped by user
    const metaUpdates = {}
    if (updates.homeCity !== undefined) metaUpdates.homeCity = updates.homeCity
    if (updates.travelStyle !== undefined) metaUpdates.travelStyle = updates.travelStyle
    if (updates.budgetTier !== undefined) metaUpdates.budgetTier = updates.budgetTier
    if (updates.travelInterests !== undefined) metaUpdates.travelInterests = updates.travelInterests

    const uId = user?.id || user?.userId || user?.username
    const metaKey = getTravelerMetaKey(uId)

    if (Object.keys(metaUpdates).length > 0) {
      appStorage.getItem(metaKey).then((existing) => {
        appStorage.setItem(metaKey, {
          ...(existing && typeof existing === 'object' ? existing : {}),
          ...metaUpdates,
        }).catch(() => {})
      }).catch(() => {})
    }

    if (!token) {
      setUser((prev) => (prev ? { ...prev, ...updates } : updates))
      return { success: true, user: updates }
    }

    try {
      const res = await apiService.updateProfile(token, updates)
      if (res?.success && res?.user) {
        setUser((prev) => ({ ...(prev || {}), ...res.user, ...updates }))
        return res
      } else if (res?.success) {
        setUser((prev) => (prev ? { ...prev, ...updates } : updates))
        return res
      } else {
        throw new Error(res?.detail || res?.error || res?.message || 'Failed to update profile')
      }
    } catch (err) {
      if (handleAuthExpiry(err)) throw err
      throw err
    }
  }

  async function deleteAccount(reason = '') {
    if (token) {
      await apiService.deleteAccount(token, { reason })
    }
    await logout()
  }

  /**
   * Internal helper to commit a mutation to activeTrip and update savedTrips
   */
  function commitTripMutation(updater) {
    const current = activeTrip
    if (!current) return
    const updated = typeof updater === 'function' ? updater(current) : updater
    const nextTrip = ensureWorkspaceParityTrip(updated)

    setActiveTrip(nextTrip)
    setSavedTrips((list) =>
      (list || []).map((t) =>
        String(t.id || t.tripId) === String(nextTrip.id || nextTrip.tripId)
          ? nextTrip
          : t
      )
    )
    persistTripAsync(nextTrip)
    return nextTrip
  }

  function persistTripAsync(tripToSave) {
    latestTripPendingRef.current = tripToSave
    persistQueueRef.current = persistQueueRef.current
      .then(async () => {
        const currentTrip = latestTripPendingRef.current
        if (!currentTrip) return
        setSaveStatus('saving')
        try {
          if (currentTrip.isTripmate) {
            await apiService.updateTripmateItinerary(token, currentTrip.id || currentTrip.tripId, {
              days: currentTrip.days || [],
              placesPool: currentTrip.placesPool || [],
              customLists: currentTrip.customLists || [],
            })
          } else {
            await apiService.updateTrip(token, currentTrip.id || currentTrip.tripId, currentTrip)
          }
          setSaveStatus('saved')
        } catch (err) {
          if (getCurrentEnvironment() === ENVIRONMENTS.MOCK) {
            setSaveStatus('saved') // keep optimistic in mock environment
          } else {
            setSaveStatus('error')
            console.warn('Backend trip persistence failed:', err.message)
          }
        }
      })
      .catch((err) => {
        console.warn('Persist queue error:', err)
      })
    return persistQueueRef.current
  }

  // --- TRIP CREATION ---
  async function createTrip(payload) {
    const startDate = payload.startDate || '2026-06-01'
    const endDate = payload.endDate || '2026-06-05'
    const destination = payload.destination || 'Islamabad'

    // Dynamically build days for ANY duration (1 to N days)
    const initialDays = Array.isArray(payload.days) && payload.days.length > 0
      ? payload.days
      : buildDaysFromDateRange(startDate, endDate, destination)

    const newTrip = ensureWorkspaceParityTrip({
      id: payload.id || Date.now(),
      tripId: payload.tripId || payload.id || Date.now(),
      title: payload.title || `Trip to ${destination}`,
      name: destination,
      destination,
      startDate,
      endDate,
      dates: formatTripDateRange(startDate, endDate),
      privacy: payload.privacy || 'private',
      notes: payload.notes || '',
      budget: { currency: 'PKR', amount: Number(payload.budgetAmount) || 50000 },
      isTripmate: Boolean(payload.isTripmate),
      days: initialDays,
      placesPool: Array.isArray(payload.placesPool) ? payload.placesPool : [],
      customLists: Array.isArray(payload.customLists) ? payload.customLists : [
        { id: 'packing', title: 'Packing Essentials', items: ['Camera', 'Power Bank', 'Comfortable Shoes', 'ID & Tickets'] },
      ],
      expenses: [],
      map: { selectedPlaceId: null },
      enginePreferences: payload.enginePreferences || {
        province: 'Punjab',
        startLat: 33.6844,
        startLon: 73.0479,
        maxBudget: 50000,
        maxTravelHours: 12,
        preferredCategories: ['park', 'scenic', 'museum'],
      },
    })

    let tripToSaveAndReturn = newTrip
    try {
      if (token) {
        const res = await apiService.createTrip(token, newTrip)
        if (res?.trip) {
          tripToSaveAndReturn = ensureWorkspaceParityTrip(res.trip)
        }
      }
      setSaveStatus('saved')
    } catch (err) {
      if (getCurrentEnvironment() === ENVIRONMENTS.MOCK) {
        setSaveStatus('saved')
      } else {
        setSaveStatus('error')
        throw err
      }
    }

    setSavedTrips((prev) => {
      const newId = String(tripToSaveAndReturn.id || tripToSaveAndReturn.tripId)
      const filtered = prev.filter((t) => String(t.id || t.tripId) !== newId)
      return [tripToSaveAndReturn, ...filtered]
    })
    setActiveTrip(tripToSaveAndReturn)
    return tripToSaveAndReturn
  }

  // --- DAY MANAGEMENT ---

  function addDay() {
    commitTripMutation((prev) => {
      const nextIndex = (prev.days || []).length + 1
      const anchorDate = prev.endDate ? new Date(prev.endDate) : new Date()
      anchorDate.setDate(anchorDate.getDate() + 1)
      const dateStr = anchorDate.toDateString()

      const newDay = {
        id: `day-${Date.now()}`,
        label: `Day ${nextIndex}`,
        shortLabel: `Day ${nextIndex}`,
        date: dateStr,
        isoDate: anchorDate.toISOString().slice(0, 10),
        items: [],
      }

      return rebuildTripDayMetadata(prev, [...(prev.days || []), newDay])
    })
  }

  function insertDayAfter(dayId) {
    commitTripMutation((prev) => {
      const existing = prev.days || []
      const index = existing.findIndex((d) => d.id === dayId)
      if (index === -1) return prev

      const nextDays = [...existing]
      nextDays.splice(index + 1, 0, {
        id: `day-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '',
        shortLabel: '',
        date: '',
        items: [],
      })

      return rebuildTripDayMetadata(prev, nextDays)
    })
  }

  function deleteDay(dayId) {
    commitTripMutation((prev) => {
      const existing = prev.days || []
      if (existing.length <= 1) return prev // prevent deleting the only day

      const targetDay = existing.find((d) => d.id === dayId)
      if (!targetDay) return prev

      // Safely preserve items by moving them to Places Pool
      const preservedItems = Array.isArray(targetDay.items) ? targetDay.items : []
      const remainingDays = existing.filter((d) => d.id !== dayId)

      const nextTrip = {
        ...prev,
        placesPool: [...(prev.placesPool || []), ...preservedItems],
        days: remainingDays,
      }

      return rebuildTripDayMetadata(nextTrip, remainingDays)
    })
  }

  function updateTripDates(newStartDate, newEndDate) {
    commitTripMutation((prev) => {
      const rebuiltDays = rebuildTripDays(prev.days || [], newStartDate, newEndDate, prev.startDate)
      const formattedDates = formatTripDateRange(newStartDate, newEndDate)

      // Preserve removed-day stops in placesPool when shortening date range
      const retainedItemIds = new Set()
      rebuiltDays.forEach((day) => {
        ;(day.items || []).forEach((item) => {
          if (item?.id) retainedItemIds.add(String(item.id))
        })
      })

      const droppedStops = []
      ;(prev.days || []).forEach((day) => {
        ;(day.items || []).forEach((item) => {
          if (item?.id && !retainedItemIds.has(String(item.id))) {
            droppedStops.push(item)
          }
        })
      })

      const existingPool = Array.isArray(prev.placesPool) ? prev.placesPool : []
      const nextPool = droppedStops.length > 0 ? [...existingPool, ...droppedStops] : existingPool

      const nextData = prev.data && typeof prev.data === 'object'
        ? {
            ...prev.data,
            startDate: newStartDate,
            endDate: newEndDate,
            dates: formattedDates,
            days: rebuiltDays,
            placesPool: nextPool,
          }
        : undefined

      return {
        ...prev,
        startDate: newStartDate,
        endDate: newEndDate,
        dates: formattedDates,
        days: rebuiltDays,
        placesPool: nextPool,
        ...(nextData ? { data: nextData } : {}),
      }
    })
  }

  // --- PLACE MANAGEMENT ---

  function addPlaceToDay(dayId, item, tripId = null) {
    const targetPlaceId = String(item.place_id || item.id || '').replace(/^serp-/, '')
    const targetTitle = String(item.title || item.name || '').trim().toLowerCase()

    const isMatch = (existing) => {
      if (!existing) return false
      const exId = String(existing.place_id || existing.id || '').replace(/^serp-/, '')
      const exTitle = String(existing.title || existing.name || '').trim().toLowerCase()
      return (targetPlaceId && exId && targetPlaceId === exId) || (targetTitle && exTitle && targetTitle === exTitle)
    }

    commitTripMutation((prev) => {
      const parsedCoords = getPlaceLatLon(item)
      const newStop = {
        id: item.id || `stop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        place_id: item.place_id || item.id || '',
        data_id: item.data_id || '',
        title: item.title || item.name || 'New Place',
        subtitle: item.subtitle || item.address || item.destination || '',
        category: item.category || 'attraction',
        lat: parsedCoords ? parsedCoords.lat : null,
        lon: parsedCoords ? parsedCoords.lon : null,
        unresolvedCoordinates: !parsedCoords,
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        note: item.note || '',
        image: item.image || item.photo || '',
        photo: item.photo || item.image || '',
        imageSource: item.imageSource || 'tripnest_place',
        imageAttribution: item.imageAttribution || '',
        imageVerified: item.imageVerified !== undefined ? item.imageVerified : true,
        rating: item.rating || null,
        reviews: item.reviews || null,
        type: item.type || 'place',
        content: item.content || '',
        items: Array.isArray(item.items) ? item.items : undefined,
        visitDetails: item.visitDetails || { visited: false, notes: '' },
      }

      // 1. Remove duplicate from pool and all days
      const cleanedPool = (prev.placesPool || []).filter((p) => !isMatch(p))
      const updatedDays = (prev.days || []).map((day) => {
        const remaining = (day.items || []).filter((p) => !isMatch(p))
        if (day.id === dayId) {
          return { ...day, items: [...remaining, newStop] }
        }
        return { ...day, items: remaining }
      })

      return {
        ...prev,
        days: updatedDays,
        placesPool: cleanedPool,
        map: {
          ...(prev.map || {}),
          selectedPlaceId: newStop.id,
        },
      }
    })
  }

  function removePlaceFromDay(dayId, placeId) {
    commitTripMutation((prev) => {
      const updatedDays = (prev.days || []).map((day) => {
        if (day.id !== dayId) return day
        const filtered = (day.items || []).filter((item) => String(item.id) !== String(placeId))
        return { ...day, items: filtered }
      })

      return {
        ...prev,
        days: updatedDays,
        map: {
          ...(prev.map || {}),
          selectedPlaceId: String(prev.map?.selectedPlaceId) === String(placeId) ? null : prev.map?.selectedPlaceId,
        },
      }
    })
  }

  function movePlace(sourceContainerId, placeId, targetContainerId, targetIndex = null) {
    commitTripMutation((prev) => {
      let movedItem = null

      // 1. Remove from source
      let updatedPool = Array.isArray(prev.placesPool) ? [...prev.placesPool] : []
      let updatedDays = (prev.days || []).map((day) => {
        const remaining = (day.items || []).filter((item) => {
          if (String(item.id) === String(placeId) && (sourceContainerId === 'all' || sourceContainerId === day.id)) {
            movedItem = item
            return false
          }
          return true
        })
        return { ...day, items: remaining }
      })

      if (!movedItem && (sourceContainerId === 'pool' || sourceContainerId === 'all')) {
        updatedPool = updatedPool.filter((item) => {
          if (String(item.id) === String(placeId)) {
            movedItem = item
            return false
          }
          return true
        })
      }

      if (!movedItem) return prev

      // 2. Insert into target
      if (targetContainerId === 'pool') {
        const insertAt = Number.isFinite(targetIndex) ? targetIndex : updatedPool.length
        updatedPool.splice(insertAt, 0, movedItem)
      } else {
        updatedDays = updatedDays.map((day) => {
          if (day.id === targetContainerId) {
            const items = [...(day.items || [])]
            const insertAt = Number.isFinite(targetIndex) ? targetIndex : items.length
            items.splice(insertAt, 0, movedItem)
            return { ...day, items }
          }
          return day
        })
      }

      return {
        ...prev,
        days: updatedDays,
        placesPool: updatedPool,
        map: {
          ...(prev.map || {}),
          selectedPlaceId: movedItem.id,
        },
      }
    })
  }

  function reorderPlaceInDay(dayId, fromIndex, toIndex) {
    commitTripMutation((prev) => {
      const updatedDays = (prev.days || []).map((day) => {
        if (day.id !== dayId) return day
        const items = [...(day.items || [])]
        if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
          return day
        }
        const [moved] = items.splice(fromIndex, 1)
        items.splice(toIndex, 0, moved)
        return { ...day, items }
      })
      return { ...prev, days: updatedDays }
    })
  }

  function updatePlaceDetails(placeId, updates) {
    commitTripMutation((prev) => {
      const updateItem = (item) => {
        if (String(item.id) !== String(placeId)) return item
        return { ...item, ...updates }
      }

      const updatedDays = (prev.days || []).map((day) => ({
        ...day,
        items: (day.items || []).map(updateItem),
      }))

      const updatedPool = (prev.placesPool || []).map(updateItem)

      return {
        ...prev,
        days: updatedDays,
        placesPool: updatedPool,
      }
    })
  }

  function togglePlaceVisited(dayId, placeId) {
    commitTripMutation((prev) => {
      const updatedDays = (prev.days || []).map((day) => {
        if (dayId !== 'all' && day.id !== dayId) return day

        const updatedItems = (day.items || []).map((item) => {
          if (String(item.id) !== String(placeId)) return item
          const currentVisited = Boolean(item.visitDetails?.visited)
          return {
            ...item,
            visitDetails: {
              ...item.visitDetails,
              visited: !currentVisited,
              visitedDate: !currentVisited ? new Date().toISOString().split('T')[0] : null,
              visitedTime: !currentVisited ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
            },
          }
        })

        return { ...day, items: updatedItems }
      })

      return { ...prev, days: updatedDays }
    })
  }

  async function optimizeDayRoute(dayId) {
    if (!activeTrip) throw new Error('No active trip found')
    const day = (activeTrip.days || []).find((d) => d.id === dayId)
    if (!day) throw new Error(`Day ${dayId} not found in active trip`)

    // Extract places with verified coordinates (excluding notes, checklists, and unresolved stops)
    const allItems = day.items || []
    const mappablePlaces = []
    const unmappablePlaces = []
    const nonPlaceItems = []

    allItems.forEach((item) => {
      if (!item) return
      if (item.type === 'note' || item.type === 'checklist') {
        nonPlaceItems.push(item)
      } else {
        const coords = getPlaceLatLon(item, activeTrip?.destination)
        if (coords) {
          mappablePlaces.push({
            ...item,
            lat: coords.lat,
            lon: coords.lon,
            isEstimated: Boolean(coords.isEstimated),
          })
        } else {
          unmappablePlaces.push(item)
        }
      }
    })

    if (mappablePlaces.length < 2) {
      throw new Error('Need at least two places in this day to optimize the visiting route.')
    }

    const prefs = activeTrip.enginePreferences || {}
    const startCoord = (Number.isFinite(Number(prefs.startLat)) && Number.isFinite(Number(prefs.startLon)))
      ? { lat: Number(prefs.startLat), lon: Number(prefs.startLon) }
      : { lat: mappablePlaces[0].lat, lon: mappablePlaces[0].lon }

    const payload = {
      tripId: activeTrip.id ? String(activeTrip.id) : undefined,
      dayId: String(dayId),
      start: startCoord,
      options: {
        algorithm: 'nearest_neighbor',
        returnToStart: false,
        speedKmh: 30.0,
        roadAware: true,
      },
      locations: mappablePlaces.map((place) => ({
        id: String(place.id),
        name: place.title || place.name || 'Stop',
        lat: Number(place.lat),
        lon: Number(place.lon),
      })),
    }

    let response
    try {
      response = await apiService.sequenceDay(payload)
      if (!response || !Array.isArray(response.order) || response.order.length === 0) {
        throw new Error((response && response.errors && response.errors[0]) || 'Day optimization failed')
      }
    } catch (networkOrApiErr) {
      // Robust offline / mock fallback via local optimizePlaceSequence
      const localOpt = optimizePlaceSequence(
        mappablePlaces,
        startCoord.lat,
        startCoord.lon,
        30.0,
        false
      )
      response = {
        success: true,
        dayId: String(dayId),
        order: localOpt.orderedPlaces.map((p) => String(p.id)),
        metrics: {
          totalDistanceKm: localOpt.totalDistanceKm,
          estimatedTravelTimeHours: (localOpt.totalDurationMin || 0) / 60,
          distanceSavedKm: localOpt.distanceSavedKm || 0,
        },
        legs: localOpt.legs || [],
        algorithm: { name: 'TSP 2-Opt', version: '1.0' },
      }
    }

    const order = response.order.map((id) => String(id))
    const placeMap = new Map(mappablePlaces.map((p) => [String(p.id), p]))
    const orderedPlaces = order.map((id) => placeMap.get(id)).filter(Boolean)
    const remainingPlaces = mappablePlaces.filter((p) => !order.includes(String(p.id)))

    // Update times sequentially (matching web generate_itinerary)
    let currentMin = 9 * 60 + 30 // 09:30 AM
    const timedPlaces = orderedPlaces.map((p, idx) => {
      if (idx > 0 && response.legs && response.legs[idx - 1]) {
        currentMin += Math.max(10, Number(response.legs[idx - 1].estimatedTravelTimeMin || response.legs[idx - 1].timeMin || 15))
      }
      const sH = Math.floor(currentMin / 60)
      const sM = currentMin % 60
      const startTime = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`
      currentMin += 90 // 1.5 hr visit duration
      const eH = Math.floor(currentMin / 60)
      const eM = currentMin % 60
      const endTime = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`
      return {
        ...p,
        startTime: p.startTime || startTime,
        endTime: p.endTime || endTime,
      }
    })

    const finalItems = [...timedPlaces, ...remainingPlaces, ...unmappablePlaces, ...nonPlaceItems]

    commitTripMutation((prev) => {
      const updatedDays = (prev.days || []).map((d) => {
        if (d.id !== dayId) return d
        return {
          ...d,
          items: finalItems,
          optimization: response,
        }
      })
      return { ...prev, days: updatedDays }
    })

    return response
  }

  /**
   * Optimizes route for ALL places across the entire trip itinerary.
   * Mirrors web WorkspacePage.jsx / optimizer.py functionality.
   */
  async function optimizeTripItinerary() {
    if (!activeTrip || !Array.isArray(activeTrip.days) || activeTrip.days.length === 0) {
      throw new Error('No active trip itinerary to optimize.')
    }

    const allDays = activeTrip.days
    let totalPlacesCount = 0
    allDays.forEach((d) => {
      totalPlacesCount += (d.items || []).filter((i) => i && i.type !== 'note' && i.type !== 'checklist').length
    })

    if (totalPlacesCount < 2) {
      throw new Error('Need at least 2 places in the itinerary to optimize the route.')
    }

    const optResult = await optimizeTripDays(activeTrip, 35.0)

    commitTripMutation(() => optResult.trip)

    return {
      success: true,
      totalDistanceKm: optResult.totalDistanceKm,
      distanceSavedKm: optResult.distanceSavedKm,
      totalDurationMin: optResult.totalDurationMin,
      daysOptimized: optResult.daysOptimized,
      totalPlacesCount,
      unmappableReport: optResult.unmappableReport,
    }
  }

  // --- PLACES POOL ---

  function addPlaceToPool(place, tripId = null) {
    const targetPlaceId = String(place.place_id || place.id || '').replace(/^serp-/, '')
    const targetTitle = String(place.title || place.name || '').trim().toLowerCase()

    const isMatch = (existing) => {
      if (!existing) return false
      const exId = String(existing.place_id || existing.id || '').replace(/^serp-/, '')
      const exTitle = String(existing.title || existing.name || '').trim().toLowerCase()
      return (targetPlaceId && exId && targetPlaceId === exId) || (targetTitle && exTitle && targetTitle === exTitle)
    }

    const parsedCoords = getPlaceLatLon(place)
    const poolItem = {
      id: place.id || `pool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      place_id: place.place_id || place.id || '',
      data_id: place.data_id || '',
      title: place.name || place.title || 'Saved Place',
      subtitle: place.address || place.subtitle || place.destination || '',
      category: place.category || 'attraction',
      lat: parsedCoords ? parsedCoords.lat : null,
      lon: parsedCoords ? parsedCoords.lon : null,
      unresolvedCoordinates: !parsedCoords,
      note: place.note || 'Saved from Explore',
      image: place.image || place.photo || '',
      photo: place.photo || place.image || '',
      imageSource: place.imageSource || 'tripnest_place',
      imageAttribution: place.imageAttribution || '',
      imageVerified: place.imageVerified !== undefined ? place.imageVerified : true,
      rating: place.rating || null,
      reviews: place.reviews || null,
      type: 'place',
      visitDetails: place.visitDetails || { visited: false, notes: '' },
    }

    commitTripMutation((prev) => {
      const cleanedPool = (prev.placesPool || []).filter((p) => !isMatch(p))
      const updatedDays = (prev.days || []).map((day) => ({
        ...day,
        items: (day.items || []).filter((p) => !isMatch(p)),
      }))

      return {
        ...prev,
        days: updatedDays,
        placesPool: [...cleanedPool, poolItem],
        map: {
          ...(prev.map || {}),
          selectedPlaceId: poolItem.id,
        },
      }
    })
  }

  function removePlaceFromPool(placeId) {
    commitTripMutation((prev) => {
      const remainingPool = (prev.placesPool || []).filter((p) => String(p.id) !== String(placeId))
      return { ...prev, placesPool: remainingPool }
    })
  }

  function setSelectedMapPlace(placeId) {
    commitTripMutation((prev) => ({
      ...prev,
      map: {
        ...(prev.map || {}),
        selectedPlaceId: placeId,
      },
    }))
  }

  // --- CUSTOM LISTS & EXPENSES ---

  function addExpense(expense) {
    commitTripMutation((prev) => {
      const newExp = {
        id: expense.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: expense.name || expense.title || expense.category || 'Expense',
        amount: Number(expense.amount) || 0,
        category: expense.category || 'Misc',
        date: expense.date || new Date().toISOString().split('T')[0],
        note: expense.note || '',
        placeId: expense.placeId || null,
      }
      return {
        ...prev,
        expenses: [...(prev.expenses || []), newExp],
      }
    })
  }

  function removeExpense(expenseId) {
    commitTripMutation((prev) => ({
      ...prev,
      expenses: (prev.expenses || []).filter((e) => String(e.id) !== String(expenseId)),
    }))
  }

  function updateExpense(expenseId, updatedFields) {
    commitTripMutation((prev) => {
      const nextExpenses = (prev.expenses || []).map((exp) => {
        if (String(exp.id) !== String(expenseId)) return exp
        return {
          ...exp,
          ...updatedFields,
          name: updatedFields.name ?? exp.name ?? 'Expense',
          amount: Number(updatedFields.amount ?? exp.amount) || 0,
          category: updatedFields.category ?? exp.category ?? 'Misc',
          date: updatedFields.date ?? exp.date,
          note: updatedFields.note !== undefined ? updatedFields.note : (exp.note || ''),
          placeId: updatedFields.placeId !== undefined ? updatedFields.placeId : exp.placeId,
        }
      })
      return { ...prev, expenses: nextExpenses }
    })
  }

  function updateTripBudget(amount, currency = 'PKR') {
    commitTripMutation((prev) => ({
      ...prev,
      budget: {
        ...(typeof prev.budget === 'object' ? prev.budget : { currency: 'PKR' }),
        amount: Number(amount) || 0,
        currency: currency || prev.budget?.currency || 'PKR',
      },
    }))
  }

  async function updateTrip(updatedTrip) {
    const nextTrip = ensureWorkspaceParityTrip(updatedTrip)
    const idStr = String(nextTrip.id || nextTrip.tripId)
    setSavedTrips((prev) =>
      prev.map((t) => (String(t.id || t.tripId) === idStr ? nextTrip : t))
    )
    if (activeTrip && String(activeTrip.id || activeTrip.tripId) === idStr) {
      setActiveTrip(nextTrip)
    }
    await persistTripAsync(nextTrip)
  }

  async function deleteTrip(tripId) {
    const idStr = String(tripId)
    const tripRecord = (savedTrips || []).find((t) => String(t.id || t.tripId) === idStr)
    if (tripRecord?.isTripmate) {
      throw new Error('Tripmate members cannot delete shared trips.')
    }

    setSavedTrips((prev) => {
      const remaining = prev.filter((t) => String(t.id || t.tripId) !== idStr)
      if (activeTrip && String(activeTrip.id || activeTrip.tripId) === idStr) {
        setActiveTrip(remaining.length > 0 ? remaining[0] : null)
      }
      return remaining
    })

    try {
      await apiService.deleteTrip(token, tripId)
    } catch {
      // offline fallback
    }
  }

  // --- GLOBAL WISHLIST / BOOKMARKS ---
  function addToWishlist(place) {
    if (!place) return
    const targetPlaceId = String(place.place_id || place.id || '').replace(/^serp-/, '')
    const targetTitle = String(place.title || place.name || '').trim().toLowerCase()

    setWishlist((prev) => {
      const exists = prev.some((p) => {
        const pId = String(p.place_id || p.id || '').replace(/^serp-/, '')
        const pTitle = String(p.title || p.name || '').trim().toLowerCase()
        return (targetPlaceId && pId && targetPlaceId === pId) || (targetTitle && pTitle && targetTitle === pTitle)
      })
      if (exists) return prev

      const parsedCoords = getPlaceLatLon(place)
      const newItem = {
        id: place.id || `wish_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        place_id: place.place_id || place.id || '',
        data_id: place.data_id || '',
        title: place.title || place.name || 'Saved Place',
        subtitle: place.subtitle || place.address || place.destination || '',
        category: place.category || 'attraction',
        lat: parsedCoords ? parsedCoords.lat : null,
        lon: parsedCoords ? parsedCoords.lon : null,
        unresolvedCoordinates: !parsedCoords,
        note: place.note || 'Saved to Wishlist',
        image: place.image || place.photo || '',
        photo: place.photo || place.image || '',
        rating: place.rating || null,
        reviews: place.reviews || null,
        type: 'place',
        savedAt: new Date().toISOString(),
      }
      const updated = [newItem, ...prev]
      void appStorage.setItem('tripnest_wishlist', updated).catch(() => {})
      return updated
    })
  }

  function removeFromWishlist(placeId) {
    const pIdStr = String(placeId).replace(/^serp-/, '')
    setWishlist((prev) => {
      const updated = prev.filter((p) => {
        const pId = String(p.id || '').replace(/^serp-/, '')
        const pPlaceId = String(p.place_id || '').replace(/^serp-/, '')
        return pId !== pIdStr && pPlaceId !== pIdStr
      })
      void appStorage.setItem('tripnest_wishlist', updated).catch(() => {})
      return updated
    })
  }

  function isPlaceInWishlist(place) {
    if (!place) return false
    const targetPlaceId = String(place.place_id || place.id || '').replace(/^serp-/, '')
    const targetTitle = String(place.title || place.name || '').trim().toLowerCase()
    return wishlist.some((p) => {
      const pId = String(p.place_id || p.id || '').replace(/^serp-/, '')
      const pTitle = String(p.title || p.name || '').trim().toLowerCase()
      return (targetPlaceId && pId && targetPlaceId === pId) || (targetTitle && pTitle && targetTitle === pTitle)
    })
  }

  // --- CUSTOM LISTS & CONTAINER MANAGEMENT (PARITY WITH WEBSITE) ---

  function addCustomList(title, description = '', color = '#10b981') {
    if (!title.trim()) return
    commitTripMutation((prev) => ({
      ...prev,
      customLists: [
        ...(prev.customLists || []),
        {
          id: `list_${Date.now()}`,
          title: title.trim(),
          name: title.trim(),
          description: (description || '').trim(),
          color,
          items: [],
        },
      ],
    }))
  }

  function updateCustomList(listId, updates = {}) {
    commitTripMutation((prev) => ({
      ...prev,
      customLists: (prev.customLists || []).map((l) => {
        if (l.id !== listId) return l
        const title = ((updates.title ?? updates.name ?? l.title ?? l.name) || '').trim()
        const description = (updates.description !== undefined ? updates.description : (l.description || '')).trim()
        const color = updates.color || l.color || '#10b981'
        return {
          ...l,
          ...updates,
          title,
          name: title,
          description,
          color,
        }
      }),
    }))
  }

  function deleteCustomList(listId) {
    commitTripMutation((prev) => ({
      ...prev,
      customLists: (prev.customLists || []).filter((l) => l.id !== listId),
    }))
  }

  function addPlaceToCustomList(listId, place) {
    if (!place) return
    const targetPlaceId = String(place.place_id || place.id || '').replace(/^serp-/, '')
    const targetTitle = String(place.title || place.name || '').trim().toLowerCase()

    const isMatch = (existing) => {
      if (!existing || typeof existing === 'string') return false
      const exId = String(existing.place_id || existing.id || '').replace(/^serp-/, '')
      const exTitle = String(existing.title || existing.name || '').trim().toLowerCase()
      return (targetPlaceId && exId && targetPlaceId === exId) || (targetTitle && exTitle && targetTitle === exTitle)
    }

    const parsedCoords = getPlaceLatLon(place)
    const placeItem = typeof place === 'object' && (place.title || place.name)
      ? {
          id: place.id || `custom_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          place_id: place.place_id || place.id || '',
          data_id: place.data_id || '',
          title: place.title || place.name || 'Custom Place',
          subtitle: place.subtitle || place.address || place.destination || '',
          category: place.category || 'attraction',
          lat: parsedCoords ? parsedCoords.lat : null,
          lon: parsedCoords ? parsedCoords.lon : null,
          unresolvedCoordinates: !parsedCoords,
          note: place.note || '',
          image: place.image || place.photo || '',
          photo: place.photo || place.image || '',
          rating: place.rating || null,
          reviews: place.reviews || null,
          type: 'place',
        }
      : place

    commitTripMutation((prev) => ({
      ...prev,
      customLists: (prev.customLists || []).map((list) => {
        if (list.id !== listId) return list
        const remaining = (list.items || []).filter((it) => !isMatch(it))
        return {
          ...list,
          items: [...remaining, placeItem],
        }
      }),
    }))
  }

  function removePlaceFromCustomList(listId, itemIdOrIndex) {
    commitTripMutation((prev) => ({
      ...prev,
      customLists: (prev.customLists || []).map((list) => {
        if (list.id !== listId) return list
        return {
          ...list,
          items: (list.items || []).filter((it, idx) => {
            if (typeof it === 'object' && it?.id) {
              return String(it.id) !== String(itemIdOrIndex) && idx !== itemIdOrIndex
            }
            return idx !== itemIdOrIndex && it !== itemIdOrIndex
          }),
        }
      }),
    }))
  }

  function addCustomListItem(listId, itemText) {
    if (!itemText) return
    commitTripMutation((prev) => ({
      ...prev,
      customLists: (prev.customLists || []).map((list) =>
        list.id === listId ? { ...list, items: [...(list.items || []), itemText] } : list
      ),
    }))
  }

  function removeCustomListItem(listId, itemIndex) {
    commitTripMutation((prev) => ({
      ...prev,
      customLists: (prev.customLists || []).map((list) => {
        if (list.id !== listId) return list
        return { ...list, items: (list.items || []).filter((_, idx) => idx !== itemIndex) }
      }),
    }))
  }

  function getContainerItems(trip, containerId) {
    if (containerId === 'pool') return Array.isArray(trip?.placesPool) ? trip.placesPool : []
    if (String(containerId).startsWith('custom:')) {
      const listId = String(containerId).slice('custom:'.length)
      return (trip?.customLists || []).find((entry) => entry.id === listId)?.items || []
    }
    const day = (trip?.days || []).find((entry) => entry.id === containerId)
    return Array.isArray(day?.items) ? day.items : []
  }

  function setContainerItems(trip, containerId, items) {
    if (containerId === 'pool') {
      return { ...trip, placesPool: items }
    }
    if (String(containerId).startsWith('custom:')) {
      const listId = String(containerId).slice('custom:'.length)
      return {
        ...trip,
        customLists: (trip.customLists || []).map((list) => (list.id === listId ? { ...list, items } : list)),
      }
    }
    return {
      ...trip,
      days: (trip.days || []).map((day) => (day.id === containerId ? { ...day, items } : day)),
    }
  }

  function moveItemBetweenContainers(sourceContainerId, itemId, targetContainerId, targetIndex = null) {
    commitTripMutation((prev) => {
      const sourceItems = [...getContainerItems(prev, sourceContainerId)]
      const sourceIndex = sourceItems.findIndex((item) => String(item.id || item.place_id || item) === String(itemId))
      if (sourceIndex === -1) return prev
      const [item] = sourceItems.splice(sourceIndex, 1)
      let nextTrip = setContainerItems(prev, sourceContainerId, sourceItems)

      const targetItems = [...getContainerItems(nextTrip, targetContainerId)]
      let insertAt = Number.isFinite(targetIndex) ? targetIndex : targetItems.length
      if (sourceContainerId === targetContainerId && sourceIndex < insertAt) {
        insertAt -= 1
      }
      insertAt = Math.max(0, Math.min(insertAt, targetItems.length))
      targetItems.splice(insertAt, 0, item)
      nextTrip = setContainerItems(nextTrip, targetContainerId, targetItems)

      return {
        ...nextTrip,
        map: {
          ...(nextTrip.map || {}),
          selectedPlaceId: (typeof item === 'object' && item?.id) ? item.id : nextTrip.map?.selectedPlaceId || null,
        },
      }
    })
  }

  function toggleChecklistItem(listId, itemIndex) {
    const key = `${listId}_${itemIndex}`
    commitTripMutation((prev) => {
      const currentChecked = prev.checklistChecked || {}
      return {
        ...prev,
        checklistChecked: {
          ...currentChecked,
          [key]: !currentChecked[key],
        },
      }
    })
  }

  // --- REAL RESERVATIONS (Preserved in trip schema) ---
  function addReservation(reservation) {
    if (!reservation?.title) return
    commitTripMutation((prev) => {
      const newRes = {
        id: `res_${Date.now()}`,
        type: reservation.type || 'hotel',
        title: reservation.title.trim(),
        confirmationCode: (reservation.confirmationCode || '').trim(),
        checkInDate: reservation.checkInDate || prev.startDate || '',
        checkOutDate: reservation.checkOutDate || prev.endDate || '',
        notes: (reservation.notes || '').trim(),
      }
      return {
        ...prev,
        reservations: [...(prev.reservations || []), newRes],
      }
    })
  }

  function removeReservation(arg1, arg2) {
    const reservationId = arg2 !== undefined ? arg2 : arg1
    commitTripMutation((prev) => ({
      ...prev,
      reservations: (prev.reservations || []).filter((r) => String(r.id) !== String(reservationId)),
    }))
  }

  // --- DEDICATED SHARED BUDGET SUBSYSTEM ---
  async function loadSharedBudget(tripId) {
    if (!tripId) return
    setSharedBudgetLoading(true)
    try {
      const [expRes, stlRes] = await Promise.all([
        apiService.listSharedBudgetExpenses(token, tripId),
        apiService.listSharedBudgetSettlements(token, tripId),
      ])
      setSharedBudgetExpenses(expRes?.expenses || [])
      setSharedBudgetSettlements(stlRes?.settlements || [])
    } catch (err) {
      console.warn('Failed to load shared budget:', err.message)
    } finally {
      setSharedBudgetLoading(false)
    }
  }

  async function addSharedBudgetExpense(tripId, payload) {
    const res = await apiService.createSharedBudgetExpense(token, tripId, payload)
    if (res?.expense) {
      setSharedBudgetExpenses((prev) => [res.expense, ...prev])
    }
    return res
  }

  async function updateSharedBudgetExpense(tripId, expenseId, payload) {
    const res = await apiService.updateSharedBudgetExpense(token, tripId, expenseId, payload)
    if (res?.expense) {
      setSharedBudgetExpenses((prev) =>
        prev.map((e) => (String(e.id) === String(expenseId) ? res.expense : e))
      )
    }
    return res
  }

  async function deleteSharedBudgetExpense(tripId, expenseId) {
    await apiService.deleteSharedBudgetExpense(token, tripId, expenseId)
    setSharedBudgetExpenses((prev) => prev.filter((e) => String(e.id) !== String(expenseId)))
  }

  async function addSharedBudgetSettlement(tripId, payload) {
    const res = await apiService.createSharedBudgetSettlement(token, tripId, payload)
    if (res?.settlement) {
      setSharedBudgetSettlements((prev) => [res.settlement, ...prev])
    }
    return res
  }

  async function deleteSharedBudgetSettlement(tripId, settlementId) {
    await apiService.deleteSharedBudgetSettlement(token, tripId, settlementId)
    setSharedBudgetSettlements((prev) => prev.filter((s) => String(s.id) !== String(settlementId)))
  }

  // --- TRIPMATES COLLABORATION ---
  async function loadTripMembers(tripId) {
    if (!tripId) return
    try {
      const res = await apiService.getTripMembers(token, tripId)
      if (res?.success) {
        setTripMembers({
          owner: res.owner,
          members: res.members || [],
          pendingInvites: res.pendingInvites || [],
        })
      }
    } catch (err) {
      console.warn('Failed to load trip members:', err.message)
    }
  }

  async function inviteTripMember(tripId, identifier) {
    const res = await apiService.inviteTripMember(token, tripId, identifier)
    if (res?.invitation) {
      setTripMembers((prev) => ({
        ...prev,
        pendingInvites: [res.invitation, ...prev.pendingInvites],
      }))
    }
    return res
  }

  async function loadUserInvitations() {
    try {
      const res = await apiService.getUserInvitations(token)
      if (res?.invitations) {
        setUserInvitations(res.invitations)
      }
    } catch (err) {
      console.warn('Failed to load user invitations:', err.message)
    }
  }

  async function respondToInvitation(inviteId, action) {
    const res = await apiService.respondToTripInvitation(token, inviteId, action)
    setUserInvitations((prev) => prev.filter((inv) => String(inv.id) !== String(inviteId)))
    if (action === 'accept') {
      await loadTrips(token)
    }
    return res
  }

  async function removeTripMember(tripId, userId) {
    await apiService.removeTripMember(token, tripId, userId)
    setTripMembers((prev) => ({
      ...prev,
      members: prev.members.filter((m) => String(m.id || m.userId) !== String(userId)),
      pendingInvites: prev.pendingInvites.filter((inv) => String(inv.id || inv.invitedUserId) !== String(userId)),
    }))
  }

  // --- NOTIFICATIONS ---
  async function loadNotifications() {
    try {
      const res = await apiService.getNotifications(token)
      if (res?.notifications) {
        setNotifications(res.notifications)
        setUnreadNotificationsCount(res.unreadCount ?? res.notifications.filter((n) => !n.read).length)
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err.message)
    }
  }

  async function markNotificationRead(notificationId) {
    await apiService.markNotificationRead(token, notificationId)
    setNotifications((prev) =>
      prev.map((n) => (String(n.id) === String(notificationId) ? { ...n, read: true } : n))
    )
    setUnreadNotificationsCount((count) => Math.max(0, count - 1))
  }

  async function markAllNotificationsRead() {
    await apiService.markAllNotificationsRead(token)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadNotificationsCount(0)
  }

  // --- ACTIVITY HISTORY ---
  const [activityHistory, setActivityHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  async function loadHistory(activeToken = token) {
    if (!activeToken) return
    setHistoryLoading(true)
    try {
      const res = await apiService.getHistory(activeToken)
      if (res?.success && Array.isArray(res.activities)) {
        setActivityHistory(res.activities)
      }
    } catch (err) {
      console.warn('Failed to load history:', err.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  // --- SOCIAL & FOLLOW ---
  async function followUser(username) {
    return apiService.followUser(token, username)
  }

  async function unfollowUser(username) {
    return apiService.unfollowUser(token, username)
  }

  async function getFollowStatus(username) {
    return apiService.getFollowStatus(username, token)
  }

  // --- AI ASSISTANT ---
  async function askAiAssistant(prompt, tripContext = '') {
    return apiService.chatWithAi(prompt, tripContext)
  }

  const value = {
    token,
    user,
    isHydrating,
    isAuthenticated: Boolean(token && user),
    savedTrips,
    activeTrip,
    loading,
    saveStatus,
    login,
    register,
    googleLogin,
    logout,
    updateUserProfile,
    deleteAccount,
    loadTrips,
    setActiveTrip,
    createTrip,
    updateTrip,
    deleteTrip,
    // Days
    addDay,
    insertDayAfter,
    deleteDay,
    updateTripDates,
    // Places
    addPlaceToDay,
    removePlaceFromDay,
    movePlace,
    reorderPlaceInDay,
    updatePlaceDetails,
    togglePlaceVisited,
    optimizeDayRoute,
    optimizeTripItinerary,
    // Pool & Map
    addPlaceToPool,
    removePlaceFromPool,
    setSelectedMapPlace,
    // Expenses & Lists
    addExpense,
    updateExpense,
    removeExpense,
    updateTripBudget,
    addCustomList,
    updateCustomList,
    deleteCustomList,
    addPlaceToCustomList,
    removePlaceFromCustomList,
    addCustomListItem,
    removeCustomListItem,
    toggleChecklistItem,
    getContainerItems,
    setContainerItems,
    moveItemBetweenContainers,
    // Wishlist / Global Saved
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isPlaceInWishlist,
    // Reservations
    addReservation,
    removeReservation,
    // Shared Budget
    sharedBudgetExpenses,
    sharedBudgetSettlements,
    sharedBudgetLoading,
    loadSharedBudget,
    addSharedBudgetExpense,
    updateSharedBudgetExpense,
    deleteSharedBudgetExpense,
    addSharedBudgetSettlement,
    deleteSharedBudgetSettlement,
    // Tripmates
    tripMembers,
    userInvitations,
    loadTripMembers,
    inviteTripMember,
    loadUserInvitations,
    respondToInvitation,
    removeTripMember,
    // Notifications
    notifications,
    unreadNotificationsCount,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    // History
    activityHistory,
    historyLoading,
    loadHistory,
    // Social
    followUser,
    unfollowUser,
    getFollowStatus,
    // Preferences
    preferences,
    updatePreference,
    updatePreferences,
    // AI
    askAiAssistant,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside an AppProvider')
  return ctx
}
