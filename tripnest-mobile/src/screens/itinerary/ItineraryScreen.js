import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useIsFocused } from '@react-navigation/native'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { useApp } from '../../context/AppContext'
import { apiService } from '../../api/apiService'
import { apiClient } from '../../api/client'
import { RECOMMENDED_PLACES_CATALOG, getPlacesForDestination } from '../../constants/images'
import { getDayColor, formatTime12h, getPlaceLatLon, formatTripDateRange, buildDayConnectionsMap } from '../../utils/tripUtils'
import { getDestinationCoordinates, geocodePlaceQuery } from '../../utils/locationService'
import { findVerifiedLandmark, getAuthenticPlaceImageSync } from '../../services/imageService'
import DaySectionCard from '../../components/trips/DaySectionCard'
import PlaceItemCard from '../../components/places/PlaceItemCard'
import InteractiveMap from '../../components/map/InteractiveMap'
import ModalSheet from '../../components/common/ModalSheet'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import Badge from '../../components/common/Badge'
import { CalendarPicker } from '../../components/common/CalendarPicker'
import AiAssistantModal from '../../components/ai/AiAssistantModal'

export function ItineraryScreen({ navigation, route }) {
  const {
    activeTrip,
    saveStatus,
    addDay,
    insertDayAfter,
    deleteDay,
    updateTripDates,
    addPlaceToDay,
    removePlaceFromDay,
    movePlace,
    reorderPlaceInDay,
    updatePlaceDetails,
    togglePlaceVisited,
    optimizeDayRoute,
    optimizeTripItinerary,
    addPlaceToPool,
    removePlaceFromPool,
    setSelectedMapPlace,
    updateTrip,
    setActiveTrip,
    savedTrips,
  } = useApp()

  const isFocused = useIsFocused()
  const routeTripId = route?.params?.tripId
  useEffect(() => {
    if (isFocused && routeTripId && Array.isArray(savedTrips) && savedTrips.length > 0) {
      const currentId = activeTrip?.id || activeTrip?.tripId
      if (!currentId || String(currentId) !== String(routeTripId)) {
        const match = savedTrips.find((t) => String(t.id || t.tripId) === String(routeTripId))
        if (match) {
          setActiveTrip(match)
        }
      }
    }
  }, [isFocused, routeTripId])

  // Layout view mode: 'list' | 'split'
  const [viewMode, setViewMode] = useState(route?.params?.initialViewMode || 'list')
  const [selectedDayId, setSelectedDayId] = useState('all') // 'all' | day.id | 'pool'
  const [toastMessage, setToastMessage] = useState('')
  const [optimizingDayId, setOptimizingDayId] = useState(null)

  // Add Place Modal state
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [targetContainerForAdd, setTargetContainerForAdd] = useState('day-1') // day.id or 'pool'
  const [placeSearchQuery, setPlaceSearchQuery] = useState('')
  const [liveExplorePlaces, setLiveExplorePlaces] = useState([])
  const [liveExploreLoading, setLiveExploreLoading] = useState(false)
  const modalSearchTimerRef = useRef(null)
  const [stopTitle, setStopTitle] = useState('')
  const [stopSubtitle, setStopSubtitle] = useState('')
  const [stopStartTime, setStopStartTime] = useState('')
  const [stopEndTime, setStopEndTime] = useState('')
  const [stopCategory, setStopCategory] = useState('attraction')
  const [stopNote, setStopNote] = useState('')
  const [itemTypeToAdd, setItemTypeToAdd] = useState('place') // 'place' | 'note' | 'checklist'
  const [noteContent, setNoteContent] = useState('')

  // Time Editor Modal state
  const [timeModalVisible, setTimeModalVisible] = useState(false)
  const [timeEditingPlace, setTimeEditingPlace] = useState(null)
  const [draftStartTime, setDraftStartTime] = useState('')
  const [draftEndTime, setDraftEndTime] = useState('')

  // Move Place Modal state
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [movingPlaceMeta, setMovingPlaceMeta] = useState(null) // { placeId, sourceContainerId }

  // Dates Editor Modal state
  const [datesModalVisible, setDatesModalVisible] = useState(false)
  const [aiModalVisible, setAiModalVisible] = useState(false)
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')

  // Place Details & Visit Journal Modal state (Parity with PlaceDetailsPanel.jsx)
  const [detailsModalVisible, setDetailsModalVisible] = useState(false)
  const [editingPlace, setEditingPlace] = useState(null)
  const [editingContainerId, setEditingContainerId] = useState(null)
  const [draftPlaceStartTime, setDraftPlaceStartTime] = useState('')
  const [draftPlaceEndTime, setDraftPlaceEndTime] = useState('')
  const [draftPlaceNote, setDraftPlaceNote] = useState('')
  const [draftVisited, setDraftVisited] = useState(false)
  const [draftVisitedDate, setDraftVisitedDate] = useState('')
  const [draftVisitedTime, setDraftVisitedTime] = useState('')
  const [draftVisitLocation, setDraftVisitLocation] = useState('')
  const [draftJournalNotes, setDraftJournalNotes] = useState('')

  // Day / Trip Completion Modal State (Game-style End & Next System)
  const [completionModal, setCompletionModal] = useState({
    visible: false,
    dayId: null,
    dayIndex: 0,
    dayLabel: '',
    visitedCount: 0,
    totalCount: 0,
    hasNextDay: false,
    isTripComplete: false,
  })

  function showToast(msg) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2500)
  }

  function handleToggleVisited(dayId, itemId) {
    togglePlaceVisited(dayId, itemId)

    const targetDay = days.find((d) => d.id === dayId)
    if (!targetDay) return

    const places = (targetDay.items || []).filter((i) => i.type !== 'note' && i.type !== 'checklist')
    if (places.length === 0) return

    const currentItem = places.find((i) => String(i.id) === String(itemId))
    const wasVisited = Boolean(currentItem?.visitDetails?.visited)

    // When marking a place as visited
    if (!wasVisited) {
      const remainingUnvisited = places.filter(
        (p) => String(p.id) !== String(itemId) && !p.visitDetails?.visited
      )

      // If all stops are now completed, trigger the celebration modal!
      if (remainingUnvisited.length === 0) {
        const dayIdx = days.findIndex((d) => d.id === dayId)
        const hasNext = dayIdx < days.length - 1
        const isLast = dayIdx === days.length - 1

        setTimeout(() => {
          setCompletionModal({
            visible: true,
            dayId: dayId,
            dayIndex: dayIdx,
            dayLabel: targetDay.label || `Day ${dayIdx + 1}`,
            visitedCount: places.length,
            totalCount: places.length,
            hasNextDay: hasNext,
            isTripComplete: isLast,
          })
        }, 300)
      }
    }
  }

  function handleOpenCompletionModal(day, dayIndex) {
    const places = (day.items || []).filter((i) => i.type !== 'note' && i.type !== 'checklist')
    const vCount = places.filter((i) => Boolean(i.visitDetails?.visited)).length
    const hasNext = dayIndex < days.length - 1
    const isLast = dayIndex === days.length - 1

    setCompletionModal({
      visible: true,
      dayId: day.id,
      dayIndex: dayIndex,
      dayLabel: day.label || `Day ${dayIndex + 1}`,
      visitedCount: vCount,
      totalCount: places.length,
      hasNextDay: hasNext,
      isTripComplete: isLast,
    })
  }

  function handleEndTripAction() {
    setCompletionModal((prev) => ({ ...prev, visible: false }))
    if (activeTrip) {
      updateTrip({
        ...activeTrip,
        status: 'completed',
      })
    }
    showToast('🏆 Trip Completed! Great journey!')
    Alert.alert(
      'Trip Completed! 🎉',
      'Congratulations on completing your itinerary! What would you like to do next?',
      [
        { text: 'View All Trips', onPress: () => navigation.navigate('MainTabs', { screen: 'TripsTab' }) },
        { text: 'Plan Next Trip', onPress: () => navigation.navigate('MainTabs', { screen: 'TripsTab', params: { openWizard: true } }) },
      ]
    )
  }

  function handleNextDayAction() {
    const currentIdx = completionModal.dayIndex
    setCompletionModal((prev) => ({ ...prev, visible: false }))

    if (completionModal.hasNextDay && days[currentIdx + 1]) {
      const nextDay = days[currentIdx + 1]
      setSelectedDayId(nextDay.id)
      showToast(`🚀 Switched to Day ${currentIdx + 2}: ${nextDay.label || `Day ${currentIdx + 2}`}`)
    } else {
      setSelectedDayId('all')
      showToast('✨ All itinerary days completed!')
    }
  }

  function handleOpenDetailsModal(place, containerId) {
    if (!place || place.type === 'note' || place.type === 'checklist') return
    setEditingPlace(place)
    setEditingContainerId(containerId)
    setDraftPlaceStartTime(place.startTime || '')
    setDraftPlaceEndTime(place.endTime || '')
    setDraftPlaceNote(place.note || '')
    setDraftVisited(Boolean(place.visitDetails?.visited))
    setDraftVisitedDate(place.visitDetails?.visitedDate || new Date().toISOString().split('T')[0])
    setDraftVisitedTime(place.visitDetails?.visitedTime || '')
    setDraftVisitLocation(place.visitLocation || place.visitDetails?.location || '')
    setDraftJournalNotes(place.visitDetails?.notes || '')
    setDetailsModalVisible(true)
  }

  function handleSaveDetailsModal() {
    if (!editingPlace) return
    updatePlaceDetails(editingPlace.id, {
      startTime: draftPlaceStartTime.trim(),
      endTime: draftPlaceEndTime.trim(),
      note: draftPlaceNote.trim(),
      visitLocation: draftVisitLocation.trim(),
      visitDetails: {
        visited: draftVisited,
        visitedDate: draftVisited ? draftVisitedDate.trim() : null,
        visitedTime: draftVisited ? draftVisitedTime.trim() : null,
        location: draftVisitLocation.trim(),
        notes: draftJournalNotes.trim(),
      },
    })
    setDetailsModalVisible(false)
    showToast('✓ Visit & Journal details saved')
  }

  const days = Array.isArray(activeTrip?.days) ? activeTrip.days : []
  const placesPool = Array.isArray(activeTrip?.placesPool) ? activeTrip.placesPool : []
  const totalStops = days.flatMap((d) => d.items || []).filter((s) => s.type !== 'note' && s.type !== 'checklist').length
  const visitedStops = days.flatMap((d) => d.items || []).filter((s) => s.visitDetails?.visited || s.visited).length
  const isAllVisited = totalStops > 0 && visitedStops === totalStops
  const isTripCompleted = activeTrip?.status === 'completed' || isAllVisited

  function handleToggleTripStatus() {
    const nextStatus = activeTrip?.status === 'completed' ? 'active' : 'completed'
    if (activeTrip) {
      updateTrip({ ...activeTrip, status: nextStatus })
      showToast(nextStatus === 'completed' ? '🎉 Trip marked as Completed!' : 'Trip marked as Active')
    }
  }

  // Filtered days to render
  const displayedDays = selectedDayId === 'all'
    ? days
    : selectedDayId === 'pool'
    ? []
    : days.filter((d) => d.id === selectedDayId)

  // Map expenses to place IDs
  const expenseMap = useMemo(() => {
    const map = new Map()
    ;(activeTrip?.expenses || []).forEach((exp) => {
      if (exp.placeId) {
        map.set(String(exp.placeId), (map.get(String(exp.placeId)) || 0) + Number(exp.amount || 0))
      }
    })
    return map
  }, [activeTrip?.expenses])

  // Active trip destination catalog
  const destinationCatalog = useMemo(() => {
    const dest = activeTrip?.destination || activeTrip?.name || 'Islamabad'
    const places = getPlacesForDestination(dest)
    return places.length > 0 ? places : RECOMMENDED_PLACES_CATALOG
  }, [activeTrip?.destination, activeTrip?.name])

  // Catalog & live explore suggestions strictly scoped to active destination
  const catalogSuggestions = useMemo(() => {
    if (!placeSearchQuery.trim()) return destinationCatalog.slice(0, 8)
    const q = placeSearchQuery.toLowerCase().trim()
    return destinationCatalog.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.destination && p.destination.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
    )
  }, [placeSearchQuery, destinationCatalog])

  const displayedAddSuggestions = liveExplorePlaces.length > 0
    ? liveExplorePlaces.slice(0, 10)
    : catalogSuggestions

  async function fetchLivePlacesForModal(queryText = '') {
    if (!activeTrip) return
    setLiveExploreLoading(true)
    try {
      const dest = activeTrip.destination || activeTrip.name || 'Islamabad'
      const trimmed = queryText.trim()

      // 1. Live database search against 44,989 Pakistan locations in Atlas
      try {
        const searchQ = trimmed || dest
        const res = await apiClient.searchLocations(searchQ, { limit: 12 })
        if (res?.locations && Array.isArray(res.locations) && res.locations.length > 0) {
          const dbPlaces = res.locations.map((loc) => ({
            id: loc.id || loc._id || loc.poi_id,
            name: loc.name,
            title: loc.name,
            destination: loc.city || dest,
            address: `${loc.name}, ${loc.city || ''}, ${loc.province || 'Pakistan'}`.replace(/,\s*,/g, ','),
            category: loc.category || 'attraction',
            lat: loc.lat || (loc.coordinates && loc.coordinates[1]),
            lon: loc.lon || (loc.coordinates && loc.coordinates[0]),
            rating: loc.rating || 4.6,
            reviews: loc.reviews || loc.reviews_count || 120,
            image: loc.image || getAuthenticPlaceImageSync(loc.name, loc.category),
            photo: loc.image || getAuthenticPlaceImageSync(loc.name, loc.category),
            imageSource: 'verified_dataset',
            description: `${loc.category || 'Point of Interest'} in ${loc.city || dest}, ${loc.province || 'Pakistan'}`,
          }))
          setLiveExplorePlaces(dbPlaces)
          return
        }
      } catch (dbErr) {
        // Fall back to explore API
      }

      // 2. Fallback to apiService
      const coords = getDestinationCoordinates(dest)
      const q = trimmed ? `${trimmed} in ${dest}` : `tourist attractions in ${dest}`
      const res = await apiService.getExplorePlaces(coords.lat, coords.lon, q)
      if (res?.places && Array.isArray(res.places) && res.places.length > 0) {
        setLiveExplorePlaces(res.places)
      } else {
        setLiveExplorePlaces([])
      }
    } catch {
      setLiveExplorePlaces([])
    } finally {
      setLiveExploreLoading(false)
    }
  }

  function handlePlaceSearchQueryChange(text) {
    setPlaceSearchQuery(text)
    if (modalSearchTimerRef.current) clearTimeout(modalSearchTimerRef.current)
    modalSearchTimerRef.current = setTimeout(() => {
      fetchLivePlacesForModal(text)
    }, 450)
  }

  // --- Handlers ---

  function handleOpenAddModal(containerId = null) {
    setTargetContainerForAdd(containerId || (days[0] && days[0].id) || 'pool')
    setPlaceSearchQuery('')
    setStopTitle('')
    setStopSubtitle('')
    setStopStartTime('')
    setStopEndTime('')
    setStopNote('')
    setItemTypeToAdd('place')
    setNoteContent('')
    setAddModalVisible(true)
    fetchLivePlacesForModal('')
  }

  function handleSelectCatalogPlace(catalogPlace) {
    const target = targetContainerForAdd
    const coords = getPlaceLatLon(catalogPlace)
    const newPlace = {
      id: catalogPlace.id || `place_${Date.now()}`,
      place_id: catalogPlace.place_id || catalogPlace.id || '',
      data_id: catalogPlace.data_id || '',
      title: catalogPlace.name || catalogPlace.title,
      subtitle: catalogPlace.address || catalogPlace.destination || activeTrip?.destination || '',
      category: catalogPlace.category || 'attraction',
      lat: coords ? coords.lat : null,
      lon: coords ? coords.lon : null,
      unresolvedCoordinates: !coords,
      image: catalogPlace.image || catalogPlace.photo || '',
      photo: catalogPlace.photo || catalogPlace.image || '',
      imageSource: catalogPlace.imageSource || 'verified_catalog',
      imageAttribution: catalogPlace.imageAttribution || '',
      imageVerified: catalogPlace.imageVerified !== undefined ? catalogPlace.imageVerified : true,
      rating: catalogPlace.rating,
      reviews: catalogPlace.reviews || catalogPlace.reviewsCount,
      startTime: stopStartTime || '',
      endTime: stopEndTime || '',
      note: stopNote || catalogPlace.description || '',
      type: 'place',
    }

    if (target === 'pool') {
      addPlaceToPool(newPlace)
      showToast(`✓ Added ${newPlace.title} to Places to Visit`)
    } else {
      addPlaceToDay(target, newPlace)
      showToast(`✓ Added ${newPlace.title}`)
    }

    setAddModalVisible(false)
  }

  async function handleCreateManualPlaceSubmit() {
    if (itemTypeToAdd === 'note') {
      if (!noteContent.trim()) {
        Alert.alert('Content required', 'Please enter some text for your note')
        return
      }
      const noteItem = {
        id: `note_${Date.now()}`,
        type: 'note',
        title: 'Note',
        content: noteContent.trim(),
      }
      if (targetContainerForAdd === 'pool') {
        addPlaceToPool(noteItem)
      } else {
        addPlaceToDay(targetContainerForAdd, noteItem)
      }
      setAddModalVisible(false)
      showToast('✓ Note added')
      return
    }

    if (itemTypeToAdd === 'checklist') {
      const checklistItem = {
        id: `checklist_${Date.now()}`,
        type: 'checklist',
        title: stopTitle.trim() || 'Checklist',
        items: [
          { id: `row_1`, text: stopSubtitle.trim() || 'First item', checked: false },
          { id: `row_2`, text: 'Second item', checked: false },
        ],
      }
      if (targetContainerForAdd === 'pool') {
        addPlaceToPool(checklistItem)
      } else {
        addPlaceToDay(targetContainerForAdd, checklistItem)
      }
      setAddModalVisible(false)
      showToast('✓ Checklist added')
      return
    }

    if (!stopTitle.trim()) {
      Alert.alert('Title required', 'Please enter a name for this stop')
      return
    }

    const title = stopTitle.trim()
    const subtitle = stopSubtitle.trim()
    const dest = activeTrip?.destination || activeTrip?.name || ''
    const resolvedCoords = await geocodePlaceQuery(title, dest)

    // Resolve authentic photo using central image architecture
    const verified = findVerifiedLandmark('', title, dest)
    const imgObj = verified || getAuthenticPlaceImageSync('', stopCategory, title, dest)

    const manualPlace = {
      id: `manual_${Date.now()}`,
      title,
      subtitle: subtitle || dest || 'Custom Stop',
      category: stopCategory,
      image: imgObj.imageUrl,
      photo: imgObj.imageUrl,
      imageSource: imgObj.imageSource,
      imageAttribution: imgObj.imageAttribution,
      imageVerified: Boolean(imgObj.imageVerified),
      lat: resolvedCoords ? resolvedCoords.lat : (verified?.lat || null),
      lon: resolvedCoords ? resolvedCoords.lon : (verified?.lon || null),
      unresolvedCoordinates: !resolvedCoords && !verified?.lat,
      startTime: stopStartTime.trim(),
      endTime: stopEndTime.trim(),
      note: stopNote.trim(),
      type: 'place',
    }

    if (targetContainerForAdd === 'pool') {
      addPlaceToPool(manualPlace)
      showToast(`✓ Added ${manualPlace.title} to Places to Visit`)
    } else {
      addPlaceToDay(targetContainerForAdd, manualPlace)
      showToast(`✓ Added ${manualPlace.title}`)
    }

    setAddModalVisible(false)
  }

  function handleOpenTimeEditor(place) {
    setTimeEditingPlace(place)
    setDraftStartTime(place.startTime || '')
    setDraftEndTime(place.endTime || '')
    setTimeModalVisible(true)
  }

  function handleSaveTime() {
    if (timeEditingPlace) {
      updatePlaceDetails(timeEditingPlace.id, {
        startTime: draftStartTime.trim(),
        endTime: draftEndTime.trim(),
      })
      showToast('✓ Visit time updated')
    }
    setTimeModalVisible(false)
  }

  function handleOpenMoveModal(placeId, sourceContainerId) {
    setMovingPlaceMeta({ placeId, sourceContainerId })
    setMoveModalVisible(true)
  }

  function handlePerformMove(targetContainerId) {
    if (!movingPlaceMeta) return
    movePlace(movingPlaceMeta.sourceContainerId, movingPlaceMeta.placeId, targetContainerId)
    setMoveModalVisible(false)
    showToast('✓ Place moved')
  }

  async function handleOptimizeCurrentView() {
    if (optimizingDayId) return
    const isSingleDay = selectedDayId !== 'all' && selectedDayId !== 'pool'
    setOptimizingDayId(isSingleDay ? selectedDayId : 'all')
    showToast(isSingleDay ? '⚡ Running route optimization for this day...' : '⚡ Running route optimization for all itinerary stops...')

    try {
      if (isSingleDay) {
        const res = await optimizeDayRoute(selectedDayId)
        if (res && res.metrics) {
          const dist = Number(res.metrics.totalDistanceKm || 0).toFixed(1)
          const mins = Math.max(1, Math.round(Number(res.metrics.estimatedTravelTimeHours || 0) * 60))
          const saved = Number(res.metrics.distanceSavedKm || 0)
          const savedText = saved > 0.05 ? ` • Saved ${saved.toFixed(1)} km` : ''
          const algo = res.algorithm?.name || 'TSP 2-Opt'
          showToast(`⚡ Day optimized (${algo}): ${dist} km (~${mins} min)${savedText}`)
        } else {
          showToast('⚡ Day order optimized via backend')
        }
      } else {
        const res = await optimizeTripItinerary()
        if (res) {
          const dist = Number(res.totalDistanceKm || 0).toFixed(1)
          const mins = Math.max(1, Math.round(Number(res.totalDurationMin || 0)))
          const saved = Number(res.distanceSavedKm || 0)
          const savedText = saved > 0.05 ? ` • Saved ${saved.toFixed(1)} km` : ''
          showToast(`⚡ Route optimized for ${res.totalPlacesCount || 'all'} places: ${dist} km (~${mins} min)${savedText}`)
        } else {
          showToast('⚡ Route optimized for all itinerary places')
        }
      }
    } catch (err) {
      Alert.alert(
        'Route Optimization',
        err.message || 'Failed to optimize route. Verify that your itinerary has at least 2 places.'
      )
    } finally {
      setOptimizingDayId(null)
    }
  }

  async function handleOptimizeDay(dayId) {
    if (optimizingDayId) return
    setOptimizingDayId(dayId)
    showToast('⚡ Running backend route optimization...')

    try {
      const res = await optimizeDayRoute(dayId)
      if (res && res.metrics) {
        const dist = Number(res.metrics.totalDistanceKm || 0).toFixed(1)
        const mins = Math.max(1, Math.round(Number(res.metrics.estimatedTravelTimeHours || 0) * 60))
        const saved = Number(res.metrics.distanceSavedKm || 0)
        const savedText = saved > 0.05 ? ` • Saved ${saved.toFixed(1)} km` : ''
        const algo = res.algorithm?.name || 'TSP 2-Opt'
        showToast(`⚡ Day optimized (${algo}): ${dist} km (~${mins} min)${savedText}`)
      } else {
        showToast('⚡ Day order optimized via backend')
      }
    } catch (err) {
      Alert.alert(
        'Route Optimization',
        err.message || 'Failed to optimize route. Verify that this day has at least 2 places with coordinates.'
      )
    } finally {
      setOptimizingDayId(null)
    }
  }

  function handleOpenDatesModal() {
    setDraftStartDate(activeTrip.startDate || '2026-06-01')
    setDraftEndDate(activeTrip.endDate || '2026-06-05')
    setDatesModalVisible(true)
  }

  function handleSaveDates() {
    if (!draftStartDate || !draftEndDate) {
      Alert.alert('Dates Required', 'Please enter both start and end dates.')
      return
    }
    if (draftEndDate < draftStartDate) {
      Alert.alert('Invalid Range', 'End date must be on or after start date.')
      return
    }
    updateTripDates(draftStartDate, draftEndDate)
    setDatesModalVisible(false)
    showToast('✓ Trip dates & days updated')
  }

  if (!activeTrip || !Array.isArray(activeTrip.days) || activeTrip.days.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack()
              } else {
                navigation.navigate('MainTabs')
              }
            }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Itinerary</Text>
          <View style={{ width: 28 }} />
        </View>
        <EmptyState
          iconName="calendar-outline"
          title="No Days Scheduled"
          description="This trip doesn't have any days created yet."
          actionTitle="Add First Day"
          onActionPress={addDay}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack()
            } else {
              navigation.navigate('MainTabs', { screen: 'TripsTab' })
            }
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {activeTrip.title || activeTrip.destination || 'Itinerary'}
          </Text>
          <TouchableOpacity onPress={handleOpenDatesModal} style={styles.dateRangeRow}>
            <Text style={styles.navSub}>
              {activeTrip.dates || formatTripDateRange(activeTrip.startDate, activeTrip.endDate)}
            </Text>
            <Ionicons name="pencil-sharp" size={11} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.rightNavActions}>
          {/* Ask AI Guide */}
          <TouchableOpacity
            onPress={() => setAiModalVisible(true)}
            style={styles.aiNavBtn}
            activeOpacity={0.8}
            accessibilityLabel="Ask AI Travel Guide"
          >
            <Ionicons name="sparkles" size={14} color="#0E442B" />
            <Text style={styles.aiNavBtnText}>AI</Text>
            <Ionicons name="mic" size={11} color="#059669" />
          </TouchableOpacity>
          {/* Save Status Pill */}
          <View
            style={[
              styles.saveBadge,
              saveStatus === 'error' && { borderColor: colors.error, backgroundColor: '#FEE2E2' },
            ]}
          >
            <Ionicons
              name={
                saveStatus === 'saving'
                  ? 'sync'
                  : saveStatus === 'error'
                  ? 'alert-circle'
                  : 'checkmark-circle'
              }
              size={12}
              color={
                saveStatus === 'saving'
                  ? colors.accentDark
                  : saveStatus === 'error'
                  ? colors.error
                  : colors.success
              }
            />
            <Text
              style={[
                styles.saveBadgeText,
                saveStatus === 'error' && { color: colors.error },
              ]}
            >
              {saveStatus === 'saving' ? 'Saving' : saveStatus === 'error' ? 'Failed' : 'Saved'}
            </Text>
          </View>

          {/* Quick Route Optimization Button */}
          <TouchableOpacity
            onPress={handleOptimizeCurrentView}
            style={[styles.optimizeQuickBtn, optimizingDayId && { opacity: 0.7 }]}
            activeOpacity={0.8}
            accessibilityLabel="Optimize Route"
          >
            {optimizingDayId ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <Ionicons name="flash" size={15} color="#D97706" />
            )}
            <Text style={styles.optimizeQuickBtnText}>
              {optimizingDayId ? 'Routing...' : 'Optimize'}
            </Text>
          </TouchableOpacity>

          {/* Toggle Split Map View */}
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'list' ? 'split' : 'list')}
            style={[styles.mapToggleBtn, viewMode === 'split' && styles.mapToggleBtnActive]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={viewMode === 'split' ? 'list' : 'map'}
              size={15}
              color={viewMode === 'split' ? colors.textWhite : colors.primaryDark}
            />
          </TouchableOpacity>

          {/* Print & Export Itinerary */}
          <TouchableOpacity
            onPress={() => navigation.navigate('PrintTrip', { trip: activeTrip })}
            style={styles.fullMapBtn}
            activeOpacity={0.8}
            accessibilityLabel="Print or Export Trip"
          >
            <Ionicons name="print-outline" size={16} color={colors.primaryDark} />
          </TouchableOpacity>

          {/* Full Screen Map */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Map', { tripId: activeTrip.id || activeTrip.tripId })}
            style={styles.fullMapBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="expand-outline" size={16} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast Alert Banner */}
      {toastMessage ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Split Interactive Map (if enabled) */}
      {viewMode === 'split' && (
        <View style={styles.splitMapContainer}>
          <InteractiveMap
            trip={activeTrip}
            selectedDayId={selectedDayId}
            selectedPlaceId={activeTrip.map?.selectedPlaceId}
            onSelectPlace={(id) => setSelectedMapPlace(id)}
            showRoutes={true}
          />
        </View>
      )}

      {/* Horizontal Day Selector Pills */}
      <View style={styles.daySelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daySelectorContent}
        >
          {/* All Days Pill */}
          <TouchableOpacity
            style={[styles.dayPill, selectedDayId === 'all' && styles.dayPillActive]}
            onPress={() => setSelectedDayId('all')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={13}
              color={selectedDayId === 'all' ? colors.textWhite : colors.primary}
            />
            <Text
              style={[
                styles.dayPillText,
                selectedDayId === 'all' && styles.dayPillTextActive,
              ]}
            >
              All Days ({days.length})
            </Text>
          </TouchableOpacity>

          {/* Individual Day Pills */}
          {days.map((day, idx) => {
            const isSelected = selectedDayId === day.id
            const label = day.shortLabel || `Day ${idx + 1}`
            const stopsCount = (day.items || []).length
            return (
              <TouchableOpacity
                key={day.id || idx}
                style={[styles.dayPill, isSelected && styles.dayPillActive]}
                onPress={() => setSelectedDayId(day.id)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.dayPillDot,
                    { backgroundColor: day.color || getDayColor(idx) },
                  ]}
                />
                <Text
                  style={[
                    styles.dayPillText,
                    isSelected && styles.dayPillTextActive,
                  ]}
                >
                  {label} {stopsCount > 0 ? `(${stopsCount})` : ''}
                </Text>
              </TouchableOpacity>
            )
          })}

          {/* Places to Visit (Pool) Pill */}
          <TouchableOpacity
            style={[styles.dayPill, selectedDayId === 'pool' && styles.dayPillActive]}
            onPress={() => setSelectedDayId('pool')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="bookmark"
              size={13}
              color={selectedDayId === 'pool' ? colors.textWhite : '#6366f1'}
            />
            <Text
              style={[
                styles.dayPillText,
                selectedDayId === 'pool' && styles.dayPillTextActive,
              ]}
            >
              Places to Visit ({placesPool.length})
            </Text>
          </TouchableOpacity>

          {/* Add Day Button */}
          <TouchableOpacity
            style={styles.addDayPill}
            onPress={addDay}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={15} color={colors.primary} />
            <Text style={styles.addDayPillText}>Add Day</Text>
          </TouchableOpacity>

          {/* Optimize Route Pill */}
          <TouchableOpacity
            style={styles.optimizePill}
            onPress={handleOptimizeCurrentView}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={13} color="#D97706" />
            <Text style={styles.optimizePillText}>
              Optimize {selectedDayId === 'all' || selectedDayId === 'pool' ? 'All Places' : 'Day'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Itinerary Timeline Body */}
      <ScrollView
        contentContainerStyle={styles.timelineScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Trip Completion Celebratory Card */}
        {(isAllVisited || activeTrip.status === 'completed') && (
          <View style={styles.completionBanner}>
            <View style={styles.completionBannerIconWrap}>
              <Text style={{ fontSize: 24 }}>🎉</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.completionBannerTitle}>
                {activeTrip.status === 'completed' ? 'Trip Completed!' : 'All Stops Completed!'}
              </Text>
              <Text style={styles.completionBannerSub}>
                {visitedStops} of {totalStops} places visited across {days.length} itinerary days.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.completionToggleBtn}
              onPress={handleToggleTripStatus}
              activeOpacity={0.8}
            >
              <Text style={styles.completionToggleBtnText}>
                {activeTrip.status === 'completed' ? 'Reopen' : 'Mark Done'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Places to Visit Pool Section */}
        {(selectedDayId === 'all' || selectedDayId === 'pool') && placesPool.length > 0 && (
          <View style={styles.poolSection}>
            <View style={styles.poolHeader}>
              <View style={styles.poolTitleRow}>
                <View style={styles.poolBadge}>
                  <Ionicons name="bookmark" size={13} color={colors.textWhite} />
                </View>
                <Text style={styles.poolTitle}>Places to Visit ({placesPool.length})</Text>
              </View>
              <TouchableOpacity
                style={styles.addStopMiniBtn}
                onPress={() => handleOpenAddModal('pool')}
              >
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addStopMiniBtnText}>Add Place</Text>
              </TouchableOpacity>
            </View>

            {placesPool.map((item, itemIdx) => (
              <PlaceItemCard
                key={item.id || itemIdx}
                item={item}
                dayIndex={-1}
                itemIndex={itemIdx}
                accentColor="#6366f1"
                onPress={() => handleOpenDetailsModal(item, 'pool')}
                onToggleVisited={() => {}}
                onOpenTimeEditor={() => handleOpenTimeEditor(item)}
                onOpenMove={() => handleOpenMoveModal(item.id, 'pool')}
                onRemove={() => removePlaceFromPool(item.id)}
                onMapPress={() => {
                  setSelectedMapPlace(item.id)
                  navigation.navigate('Map', { focusedPlaceId: item.id })
                }}
              />
            ))}
          </View>
        )}

        {/* Days Sections */}
        {displayedDays.map((day, dayIndex) => {
          const items = Array.isArray(day.items) ? day.items : []
          const actualDayIndex = days.findIndex((d) => d.id === day.id)
          const trueDayIndex = actualDayIndex >= 0 ? actualDayIndex : dayIndex
          const dayAccent = day.color || getDayColor(trueDayIndex)
          const connectionsMap = buildDayConnectionsMap(day, activeTrip?.destination)

          const placesOnly = items.filter((i) => i.type !== 'note' && i.type !== 'checklist')
          const visitedCount = placesOnly.filter((i) => Boolean(i.visitDetails?.visited)).length
          const isDayComplete = placesOnly.length > 0 && visitedCount === placesOnly.length

          return (
            <View key={day.id || dayIndex} style={styles.dayBlock}>
              <DaySectionCard
                day={day}
                dayIndex={trueDayIndex}
                label={day.label}
                date={day.date}
                placesCount={items.length}
                distanceLabel={(day.optimization?.totalDistanceKm ?? day.optimization?.metrics?.totalDistanceKm) ? `${(day.optimization.totalDistanceKm ?? day.optimization.metrics.totalDistanceKm).toFixed(1)} km` : null}
                durationLabel={
                  day.optimization?.metrics?.estimatedTravelTimeHours
                    ? `~${Math.round(day.optimization.metrics.estimatedTravelTimeHours * 60)} min drive`
                    : day.optimization?.metrics?.totalDurationMin
                    ? `~${Math.round(day.optimization.metrics.totalDurationMin)} min drive`
                    : null
                }
                onAddStop={() => handleOpenAddModal(day.id)}
                onOptimizeDay={() => handleOptimizeDay(day.id)}
                onInsertDayAfter={() => insertDayAfter(day.id)}
                onDeleteDay={() => deleteDay(day.id)}
                canDelete={days.length > 1}
                isCompleted={isDayComplete}
                onCompleteDay={() => handleOpenCompletionModal(day, trueDayIndex)}
              />

              {items.length === 0 ? (
                <View style={styles.noStopsCard}>
                  <Ionicons name="time-outline" size={22} color={colors.textTertiary} />
                  <Text style={styles.noStopsText}>No stops scheduled for this day.</Text>
                  <Button
                    title="+ Add Place to Day"
                    size="sm"
                    variant="outline"
                    pill={true}
                    onPress={() => handleOpenAddModal(day.id)}
                    style={{ marginTop: 8 }}
                  />
                </View>
              ) : (
                <View style={styles.itemsList}>
                  {(() => {
                    let placeCounter = 0
                    return items.map((item, itemIdx) => {
                      const isPlace = item.type !== 'note' && item.type !== 'checklist'
                      const seqIdx = isPlace ? placeCounter++ : itemIdx
                      return (
                        <PlaceItemCard
                          key={item.id ? `${day.id}-${item.id}` : `day-${trueDayIndex}-item-${itemIdx}`}
                          item={item}
                          dayIndex={trueDayIndex}
                          itemIndex={seqIdx}
                          accentColor={dayAccent}
                          connection={connectionsMap.get(String(item.id)) || null}
                          canMoveUp={itemIdx > 0}
                          canMoveDown={itemIdx < items.length - 1}
                          expenseTotal={expenseMap.get(String(item.id)) || 0}
                          onPress={() => handleOpenDetailsModal(item, day.id)}
                          onToggleVisited={() => handleToggleVisited(day.id, item.id)}
                          onOpenTimeEditor={() => handleOpenTimeEditor(item)}
                          onOpenMove={() => handleOpenMoveModal(item.id, day.id)}
                          onMoveUp={() => reorderPlaceInDay(day.id, itemIdx, itemIdx - 1)}
                          onMoveDown={() => reorderPlaceInDay(day.id, itemIdx, itemIdx + 1)}
                          onRemove={() => removePlaceFromDay(day.id, item.id)}
                          onMapPress={() => {
                            setSelectedMapPlace(item.id)
                            navigation.navigate('Map', { focusedPlaceId: item.id })
                          }}
                        />
                      )
                    })
                  })()}
                </View>
              )}

              {/* Day Completion Banner & Action (End / Next) */}
              {items.length > 0 && (
                <View style={styles.dayCompletionContainer}>
                  {isDayComplete ? (
                    <View style={styles.dayCompleteBanner}>
                      <View style={styles.dayCompleteInfo}>
                        <View style={styles.dayCompleteCheckIcon}>
                          <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                        </View>
                        <View>
                          <Text style={styles.dayCompleteBannerTitle}>
                            Day {trueDayIndex + 1} All Visited!
                          </Text>
                          <Text style={styles.dayCompleteBannerSubtitle}>
                            {visitedCount} of {placesOnly.length} stops completed
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.dayCompleteBannerBtn}
                        onPress={() => handleOpenCompletionModal(day, trueDayIndex)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dayCompleteBannerBtnText}>
                          {trueDayIndex < days.length - 1 ? 'Next Day ➔' : 'End Trip 🏁'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.manualCompleteBtn}
                      onPress={() => handleOpenCompletionModal(day, trueDayIndex)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.manualCompleteLeft}>
                        <Ionicons name="trophy-outline" size={15} color={colors.primary} />
                        <Text style={styles.manualCompleteBtnText}>
                          Finish Day {trueDayIndex + 1} (End / Next)
                        </Text>
                      </View>
                      <View style={styles.manualCompleteRight}>
                        <Text style={styles.manualCompleteProgress}>
                          {visitedCount}/{placesOnly.length} stops
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Add Place Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => handleOpenAddModal(selectedDayId !== 'all' ? selectedDayId : (days[0] && days[0].id))}
        activeOpacity={0.88}
      >
        <Ionicons name="add" size={20} color={colors.textWhite} />
        <Text style={styles.fabText}>Add a Place</Text>
      </TouchableOpacity>

      {/* MODAL 1: Add Place / Stop Modal */}
      <ModalSheet
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        title="Add to Itinerary"
        subtitle={`Select target: ${targetContainerForAdd === 'pool' ? 'Places to Visit' : targetContainerForAdd}`}
      >
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {/* Target Day Selector */}
          <Text style={styles.inputLabel}>Add to which section?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.targetDayChip,
                  targetContainerForAdd === d.id && styles.targetDayChipActive,
                ]}
                onPress={() => setTargetContainerForAdd(d.id)}
              >
                <Text
                  style={[
                    styles.targetDayChipText,
                    targetContainerForAdd === d.id && styles.targetDayChipTextActive,
                  ]}
                >
                  Day {i + 1}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.targetDayChip,
                targetContainerForAdd === 'pool' && styles.targetDayChipActive,
              ]}
              onPress={() => setTargetContainerForAdd('pool')}
            >
              <Text
                style={[
                  styles.targetDayChipText,
                  targetContainerForAdd === 'pool' && styles.targetDayChipTextActive,
                ]}
              >
                Places to Visit
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Item Type Selector */}
          <View style={styles.typeSwitcherRow}>
            {['place', 'note', 'checklist'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeSwitchBtn, itemTypeToAdd === t && styles.typeSwitchBtnActive]}
                onPress={() => setItemTypeToAdd(t)}
              >
                <Text
                  style={[styles.typeSwitchText, itemTypeToAdd === t && styles.typeSwitchTextActive]}
                >
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {itemTypeToAdd === 'place' && (
            <>
              {/* Quick Search from Recommended Places & Explore API */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>Search Attractions & Places</Text>
                {liveExploreLoading && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search" size={16} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInputText}
                  value={placeSearchQuery}
                  onChangeText={handlePlaceSearchQueryChange}
                  placeholder={`Search in ${activeTrip?.destination || 'destination'}...`}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              {/* Suggestions List */}
              <View style={styles.suggestionsContainer}>
                {displayedAddSuggestions.map((p, idx) => (
                  <TouchableOpacity
                    key={p.id || p.place_id || idx}
                    style={styles.catalogItemRow}
                    onPress={() => handleSelectCatalogPlace(p)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogItemTitle}>{p.name || p.title}</Text>
                      <Text style={styles.catalogItemSub}>
                        {p.destination || p.subtitle || activeTrip?.destination} • {p.category || 'Attraction'}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Or Enter Custom Place Name</Text>
              <TextInput
                style={styles.modalInput}
                value={stopTitle}
                onChangeText={setStopTitle}
                placeholder="e.g. Monal Margalla Hills, Sunset Point"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.inputLabel}>Location / Subtitle</Text>
              <TextInput
                style={styles.modalInput}
                value={stopSubtitle}
                onChangeText={setStopSubtitle}
                placeholder="e.g. Blue Area, Islamabad"
                placeholderTextColor={colors.textTertiary}
              />

              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={stopStartTime}
                    onChangeText={setStopStartTime}
                    placeholder="09:30"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={stopEndTime}
                    onChangeText={setStopEndTime}
                    placeholder="11:00"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.chipsRow}>
                {['attraction', 'scenic', 'museum', 'food', 'shopping', 'hiking'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.suggestionChip, stopCategory === cat && styles.suggestionChipActive]}
                    onPress={() => setStopCategory(cat)}
                  >
                    <Text style={[styles.suggestionText, stopCategory === cat && styles.suggestionTextActive]}>
                      {cat.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                value={stopNote}
                onChangeText={setStopNote}
                placeholder="Custom visit notes..."
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            </>
          )}

          {itemTypeToAdd === 'note' && (
            <>
              <Text style={styles.inputLabel}>Note Content</Text>
              <TextInput
                style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Write trip notes, ticket reminder, or contact numbers..."
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            </>
          )}

          {itemTypeToAdd === 'checklist' && (
            <>
              <Text style={styles.inputLabel}>Checklist Title</Text>
              <TextInput
                style={styles.modalInput}
                value={stopTitle}
                onChangeText={setStopTitle}
                placeholder="e.g. Morning Checklist, Hiking Gear"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.inputLabel}>First Checklist Item</Text>
              <TextInput
                style={styles.modalInput}
                value={stopSubtitle}
                onChangeText={setStopSubtitle}
                placeholder="e.g. Check tickets & passports"
                placeholderTextColor={colors.textTertiary}
              />
            </>
          )}

          <Button
            title="Add to Itinerary"
            iconName="checkmark-circle"
            pill={true}
            size="lg"
            fullWidth={true}
            onPress={handleCreateManualPlaceSubmit}
            style={{ marginTop: 16, marginBottom: 20 }}
          />
        </ScrollView>
      </ModalSheet>

      {/* MODAL 2: Time Editor Modal */}
      <ModalSheet
        visible={timeModalVisible}
        onClose={() => setTimeModalVisible(false)}
        title="Schedule Visit Time"
        subtitle={timeEditingPlace?.title || 'Place'}
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Start Time (e.g. 09:30 or 14:00)</Text>
          <TextInput
            style={styles.modalInput}
            value={draftStartTime}
            onChangeText={setDraftStartTime}
            placeholder="09:30"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>End Time (e.g. 11:00 or 16:30)</Text>
          <TextInput
            style={styles.modalInput}
            value={draftEndTime}
            onChangeText={setDraftEndTime}
            placeholder="11:00"
            placeholderTextColor={colors.textTertiary}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button
              title="Clear Time"
              variant="outline"
              size="md"
              onPress={() => {
                setDraftStartTime('')
                setDraftEndTime('')
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Save Time"
              pill={true}
              size="md"
              onPress={handleSaveTime}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </ModalSheet>

      {/* MODAL 3: Move Place Modal */}
      <ModalSheet
        visible={moveModalVisible}
        onClose={() => setMoveModalVisible(false)}
        title="Move Place"
        subtitle="Select the destination day or pool"
      >
        <View style={styles.modalForm}>
          {days.map((d, idx) => (
            <TouchableOpacity
              key={d.id}
              style={styles.moveOptionRow}
              onPress={() => handlePerformMove(d.id)}
            >
              <View style={[styles.dayPillDot, { backgroundColor: d.color || getDayColor(idx) }]} />
              <Text style={styles.moveOptionText}>
                {d.label || `Day ${idx + 1}`} ({d.items?.length || 0} stops)
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.moveOptionRow, { borderBottomWidth: 0 }]}
            onPress={() => handlePerformMove('pool')}
          >
            <Ionicons name="bookmark" size={16} color="#6366f1" />
            <Text style={[styles.moveOptionText, { color: '#4f46e5' }]}>
              Move to Places to Visit (Pool)
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {/* MODAL 4: Edit Trip Dates Modal */}
      <ModalSheet
        visible={datesModalVisible}
        onClose={() => setDatesModalVisible(false)}
        title="Trip Dates & Duration"
        subtitle="Select dates on the calendar to update your itinerary schedule"
      >
        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
          <View style={styles.modalForm}>
            <CalendarPicker
              startDate={draftStartDate}
              endDate={draftEndDate}
              onDateRangeChange={({ startDate: newStart, endDate: newEnd }) => {
                setDraftStartDate(newStart)
                setDraftEndDate(newEnd)
              }}
              style={{ marginBottom: 14 }}
            />

            <Button
              title="Apply Trip Dates"
              pill={true}
              size="lg"
              fullWidth={true}
              disabled={!draftStartDate || !draftEndDate || draftEndDate < draftStartDate}
              onPress={handleSaveDates}
              style={{ marginTop: 10, marginBottom: 20 }}
            />
          </View>
        </ScrollView>
      </ModalSheet>

      {/* MODAL 5: Place Details, Schedule & Visit Journal (Parity with PlaceDetailsPanel.jsx) */}
      <ModalSheet
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        title="Visit & Journal Details"
        subtitle={editingPlace?.title || 'Place Details'}
      >
        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
          {editingPlace ? (
            <View style={{ gap: 14, paddingBottom: 20 }}>
              {/* Place Mini Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceSubtle, padding: 10, borderRadius: 12 }}>
                <Image
                  source={{ uri: editingPlace.image || editingPlace.photo || 'https://images.unsplash.com/photo-1764697758403-83229fd73fb0?auto=format&fit=crop&w=400&q=80' }}
                  style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: colors.borderLight }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.subtitle1, { fontWeight: '700', color: colors.textPrimary }]} numberOfLines={1}>
                    {editingPlace.title || editingPlace.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                    📍 {editingPlace.subtitle || editingPlace.address || 'Scheduled Place'}
                  </Text>
                </View>
                <Badge label={editingPlace.category || 'Attraction'} variant="primary" size="sm" />
              </View>

              {/* 1. Schedule Times */}
              <View style={styles.modalFormSection}>
                <Text style={styles.inputSectionHeader}>⏰ Visit Schedule</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Start Time (e.g. 10:00)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={draftPlaceStartTime}
                      onChangeText={setDraftPlaceStartTime}
                      placeholder="10:00 AM"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>End Time (e.g. 12:30)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={draftPlaceEndTime}
                      onChangeText={setDraftPlaceEndTime}
                      placeholder="12:30 PM"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
              </View>

              {/* 2. Visit & Journal (Parity with PlaceDetailsPanel.jsx) */}
              <View style={styles.modalFormSection}>
                <Text style={styles.inputSectionHeader}>📝 Visit & Journal</Text>

                {/* Mark as Visited Checkbox */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 }}
                  onPress={() => setDraftVisited(!draftVisited)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={draftVisited ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={draftVisited ? colors.success : colors.textTertiary}
                  />
                  <Text style={[typography.subtitle2, { fontWeight: '700', color: draftVisited ? colors.success : colors.textPrimary }]}>
                    Mark as Visited
                  </Text>
                </TouchableOpacity>

                {/* Visited Date & Time */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Visited Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={draftVisitedDate}
                      onChangeText={setDraftVisitedDate}
                      placeholder="2026-06-01"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Visited Time (HH:MM)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={draftVisitedTime}
                      onChangeText={setDraftVisitedTime}
                      placeholder="14:30"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>

                {/* Location Note */}
                <Text style={styles.inputLabel}>Location / Landmark Note</Text>
                <TextInput
                  style={styles.modalInput}
                  value={draftVisitLocation}
                  onChangeText={setDraftVisitLocation}
                  placeholder="Where have you been? (e.g. North Gate viewpoint)"
                  placeholderTextColor={colors.textTertiary}
                />

                {/* Journal / Visit Notes */}
                <Text style={styles.inputLabel}>Journal / Visit Experience Notes</Text>
                <TextInput
                  style={[styles.modalInput, { height: 75, textAlignVertical: 'top' }]}
                  value={draftJournalNotes}
                  onChangeText={setDraftJournalNotes}
                  placeholder="Write what happened at this place, tips for travelers, impressions..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
              </View>

              {/* 3. Expenses for this place */}
              <View style={styles.modalFormSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputSectionHeader}>💰 Place-Linked Expenses</Text>
                  <Text style={[typography.caption, { fontWeight: '700', color: colors.primaryDark }]}>
                    PKR {(expenseMap.get(String(editingPlace.id)) || 0).toLocaleString()}
                  </Text>
                </View>
                {activeTrip.expenses?.filter((e) => String(e.placeId) === String(editingPlace.id)).length > 0 ? (
                  activeTrip.expenses
                    .filter((e) => String(e.placeId) === String(editingPlace.id))
                    .map((exp, eIdx) => (
                      <View key={eIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                        <Text style={[typography.body2, { color: colors.textPrimary }]}>{exp.name || exp.category}</Text>
                        <Text style={[typography.body2, { fontWeight: '700', color: colors.primaryDark }]}>PKR {Number(exp.amount || 0).toLocaleString()}</Text>
                      </View>
                    ))
                ) : (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>No expenses linked to this stop yet.</Text>
                )}
              </View>

              {/* Submit Button */}
              <Button
                title="Save Visit & Journal"
                iconName="save-outline"
                pill={true}
                size="lg"
                fullWidth={true}
                onPress={handleSaveDetailsModal}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : null}
        </ScrollView>
      </ModalSheet>

      {/* Day / Trip Completion Celebration Modal (End & Next System) */}
      <Modal
        visible={completionModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCompletionModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.celebrationOverlay}>
          <View style={styles.celebrationCard}>
            {/* Trophy / Sparkles icon */}
            <View style={styles.celebrationIconCircle}>
              <Ionicons
                name={completionModal.isTripComplete ? 'trophy' : 'sparkles'}
                size={38}
                color="#F59E0B"
              />
            </View>

            {/* Title */}
            <Text style={styles.celebrationTitle}>
              {completionModal.isTripComplete
                ? '🎉 Trip Completed!'
                : `🎉 Day ${completionModal.dayIndex + 1} Completed!`}
            </Text>

            {/* Subtitle */}
            <Text style={styles.celebrationSubtitle}>
              {completionModal.isTripComplete
                ? 'Mubarak ho! Aapne is trip ke tamam stops kamyabi se mukammal kar liye hain!'
                : `Shabash! Aapne Day ${completionModal.dayIndex + 1} (${completionModal.dayLabel}) ke tamam stops visit kar liye hain. Agay kya karna chahte hain?`}
            </Text>

            {/* Stats Summary Bar */}
            <View style={styles.celebrationStatsRow}>
              <View style={styles.celebrationStatCol}>
                <Text style={styles.celebrationStatNumber}>
                  {completionModal.visitedCount}
                </Text>
                <Text style={styles.celebrationStatLabel}>Visited</Text>
              </View>
              <View style={styles.celebrationStatDivider} />
              <View style={styles.celebrationStatCol}>
                <Text style={styles.celebrationStatNumber}>
                  {completionModal.totalCount}
                </Text>
                <Text style={styles.celebrationStatLabel}>Total Stops</Text>
              </View>
              <View style={styles.celebrationStatDivider} />
              <View style={styles.celebrationStatCol}>
                <Text style={styles.celebrationStatNumber}>
                  {completionModal.hasNextDay ? `Day ${completionModal.dayIndex + 2}` : 'Final'}
                </Text>
                <Text style={styles.celebrationStatLabel}>Next Step</Text>
              </View>
            </View>

            {/* Main Action Buttons: END & NEXT */}
            <View style={styles.celebrationActionRow}>
              {/* 1. END BUTTON */}
              <TouchableOpacity
                style={[styles.celebrationBtn, styles.endTripBtn]}
                onPress={handleEndTripAction}
                activeOpacity={0.85}
              >
                <Ionicons name="flag-outline" size={17} color="#DC2626" />
                <Text style={styles.endTripBtnText}>End Trip</Text>
              </TouchableOpacity>

              {/* 2. NEXT BUTTON */}
              <TouchableOpacity
                style={[styles.celebrationBtn, styles.nextDayBtn]}
                onPress={handleNextDayAction}
                activeOpacity={0.85}
              >
                <Text style={styles.nextDayBtnText}>
                  {completionModal.hasNextDay ? 'Next Day ➔' : 'Review Trip'}
                </Text>
                <Ionicons
                  name={completionModal.hasNextDay ? 'arrow-forward' : 'checkmark-done'}
                  size={17}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {/* Dismiss Button */}
            <TouchableOpacity
              style={styles.celebrationDismissBtn}
              onPress={() => setCompletionModal((prev) => ({ ...prev, visible: false }))}
              activeOpacity={0.7}
            >
              <Text style={styles.celebrationDismissText}>Stay on this day</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* AI ASSISTANT MODAL */}
      <AiAssistantModal visible={aiModalVisible} initialVoiceMode={true}
        onClose={() => setAiModalVisible(false)}
        initialContext={activeTrip?.destination || activeTrip?.title || 'Pakistan Travel'}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    padding: 6,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  navTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  navSub: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  rightNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  mapToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  mapToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  optimizeQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  optimizeQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  fullMapBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  toastBanner: {
    backgroundColor: colors.primaryDark,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  splitMapContainer: {
    height: 220,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  daySelectorWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 8,
  },
  daySelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dayPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayPillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayPillTextActive: {
    color: colors.textWhite,
  },
  addDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  addDayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  optimizePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  optimizePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  timelineScroll: {
    padding: 14,
  },
  poolSection: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 10,
    marginBottom: 16,
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  poolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  poolBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4338ca',
  },
  addStopMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  addStopMiniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  dayBlock: {
    marginBottom: 14,
  },
  noStopsCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    marginTop: 4,
  },
  noStopsText: {
    ...typography.body2,
    color: colors.textTertiary,
    marginTop: 4,
  },
  itemsList: {
    gap: 2,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 9999,
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: {
    ...typography.button,
    color: colors.textWhite,
    fontWeight: '700',
  },
  modalForm: {
    gap: 8,
    paddingBottom: 20,
  },
  inputLabel: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...typography.body2,
    color: colors.textPrimary,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  suggestionsContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  catalogItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  catalogItemSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  targetDayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 6,
  },
  targetDayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  targetDayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  targetDayChipTextActive: {
    color: colors.textWhite,
  },
  typeSwitcherRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  typeSwitchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typeSwitchBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  typeSwitchTextActive: {
    color: colors.primaryDark,
  },
  timeRow: {
    flexDirection: 'row',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  suggestionChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  suggestionText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  suggestionTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  moveOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  moveOptionText: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    flex: 1,
    marginLeft: 10,
  },
  modalFormSection: {
    gap: 6,
    marginVertical: 4,
  },
  inputSectionHeader: {
    ...typography.subtitle2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  completionBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  completionBannerSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  completionToggleBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 8,
  },
  completionToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  // Day Completion In-List Action Container
  dayCompletionContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  dayCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  dayCompleteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dayCompleteCheckIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCompleteBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  dayCompleteBannerSubtitle: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  dayCompleteBannerBtn: {
    backgroundColor: '#059669',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dayCompleteBannerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  manualCompleteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  manualCompleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  manualCompleteRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manualCompleteProgress: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Game-style End & Next Celebration Modal
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  celebrationIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
  celebrationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  celebrationSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  celebrationStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    marginBottom: 20,
  },
  celebrationStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  celebrationStatNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  celebrationStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  celebrationStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
  },
  celebrationActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 10,
  },
  celebrationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  endTripBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  endTripBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  nextDayBtn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  nextDayBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  celebrationDismissBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  celebrationDismissText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
  },
})

export default ItineraryScreen
