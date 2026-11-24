import React, { useEffect, useMemo, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Share,
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
import { getDestinationImage } from '../../constants/images'
import { geocodePlaceQuery } from '../../utils/locationService'
import { findVerifiedLandmark, getAuthenticPlaceImageSync } from '../../services/imageService'
import { buildDayConnectionsMap } from '../../utils/tripUtils'
import Card from '../../components/common/Card'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import ActionRow from '../../components/common/ActionRow'
import ModalSheet from '../../components/common/ModalSheet'
import { apiService } from '../../api/apiService'
import SharedBudgetModal from '../../components/trips/SharedBudgetModal'
import TripCreationWizard from '../../components/trips/TripCreationWizard'
import AiAssistantModal from '../../components/ai/AiAssistantModal'

const EXPENSE_CATEGORIES = ['Transport', 'Food', 'Tickets', 'Hotel', 'Shopping', 'Misc']

const CATEGORY_ICONS = {
  Transport: 'car-outline',
  Food: 'restaurant-outline',
  Tickets: 'ticket-outline',
  Hotel: 'bed-outline',
  Shopping: 'cart-outline',
  Misc: 'receipt-outline',
}

const CATEGORY_COLORS = {
  Transport: '#3B82F6',
  Food: '#EF4444',
  Tickets: '#F59E0B',
  Hotel: '#8B5CF6',
  Shopping: '#EC4899',
  Misc: '#10B981',
}

export function TripDetailScreen({ navigation, route }) {
  const {
    activeTrip,
    createTrip,
    setActiveTrip,
    savedTrips,
    token,
    addExpense,
    removeExpense,
    updateExpense,
    updateTripBudget,
    togglePlaceVisited,
    addPlaceToDay,
    removePlaceFromDay,
    movePlace,
    updatePlaceDetails,
    updateTrip,
    optimizeDayRoute,
    optimizeTripItinerary,
    tripMembers,
    loadTripMembers,
    inviteTripMember,
    removeTripMember,
  } = useApp()

  // Three clean TripNest workspace sections matching Web
  const [workspaceTab, setWorkspaceTab] = useState('overview') // 'overview' | 'itinerary' | 'budget'

  // Sheet states for secondary tools
  const [activeSheet, setActiveSheet] = useState(null)
  const [aiModalVisible, setAiModalVisible] = useState(false) // 'tripmates' | 'sharing' | null

  // Tripmates invitation state
  const [inviteIdentifierInput, setInviteIdentifierInput] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  // Sharing state
  const [sharePermission, setSharePermission] = useState('view')
  const [shareTokenData, setShareTokenData] = useState(null)
  const [shareTokenLoading, setShareTokenLoading] = useState(false)

  // Route optimization state
  const [optimizingDayId, setOptimizingDayId] = useState(null)

  // Target Budget Modal state
  const [budgetModalVisible, setBudgetModalVisible] = useState(false)
  const [targetBudgetInput, setTargetBudgetInput] = useState('')

  // Expense Modal state (Add / Edit)
  const [expenseModalVisible, setExpenseModalVisible] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [expenseName, setExpenseName] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCat, setExpenseCat] = useState('Transport')
  const [expenseDate, setExpenseDate] = useState('')
  const [expenseNote, setExpenseNote] = useState('')

  // Add stop modal (for Itinerary section)
  const [addStopModalVisible, setAddStopModalVisible] = useState(false)
  const [targetDayIdForStop, setTargetDayIdForStop] = useState(null)
  const [stopTitle, setStopTitle] = useState('')
  const [stopSubtitle, setStopSubtitle] = useState('')
  const [stopTime, setStopTime] = useState('10:00')
  const [stopNote, setStopNote] = useState('')

  // Notes editor modal
  const [notesModalVisible, setNotesModalVisible] = useState(false)
  const [notesText, setNotesText] = useState('')

  // Dedicated Shared Budget modal state
  const [sharedBudgetVisible, setSharedBudgetVisible] = useState(false)

  // Stop Action, Edit & Move modal states
  const [selectedStopForAction, setSelectedStopForAction] = useState(null)
  const [selectedStopDayId, setSelectedStopDayId] = useState(null)
  const [stopActionModalVisible, setStopActionModalVisible] = useState(false)
  const [editStopModalVisible, setEditStopModalVisible] = useState(false)
  const [editStopTitle, setEditStopTitle] = useState('')
  const [editStopSubtitle, setEditStopSubtitle] = useState('')
  const [editStopTime, setEditStopTime] = useState('')
  const [editStopNote, setEditStopNote] = useState('')
  const [moveStopModalVisible, setMoveStopModalVisible] = useState(false)

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

  const trip = activeTrip

  useEffect(() => {
    if (!isFocused) return
    const targetTripId = activeTrip?.tripId || activeTrip?.id
    if (targetTripId && loadTripMembers) {
      loadTripMembers(targetTripId)
    }
  }, [isFocused, activeTrip?.tripId, activeTrip?.id])

  async function handleOptimizeDay(dayId) {
    if (optimizingDayId) return
    setOptimizingDayId(dayId)
    try {
      const res = await optimizeDayRoute(dayId)
      if (res && res.metrics) {
        const dist = Number(res.metrics.totalDistanceKm || 0).toFixed(1)
        const mins = Math.max(1, Math.round(Number(res.metrics.estimatedTravelTimeHours || 0) * 60))
        const saved = Number(res.metrics.distanceSavedKm || 0)
        const savedText = saved > 0.05 ? ` • Saved ${saved.toFixed(1)} km` : ''
        Alert.alert(
          'Route Optimized',
          `Day itinerary reordered for minimal travel time!\n\nDistance: ${dist} km (~${mins} min drive)${savedText}`
        )
      } else {
        Alert.alert('Route Optimized', 'Day stops successfully reordered via TSP optimization.')
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

  const [optimizingAllDays, setOptimizingAllDays] = useState(false)

  async function handleOptimizeAllDays() {
    if (optimizingAllDays || optimizingDayId) return
    setOptimizingAllDays(true)
    try {
      await optimizeTripItinerary()
      Alert.alert(
        'All Routes Optimized',
        'Every day in your itinerary has been organized for minimal travel time using TSP 2-Opt optimization!'
      )
    } catch (err) {
      Alert.alert(
        'Route Optimization',
        err.message || 'Failed to optimize itinerary routes. Verify places exist in your schedule.'
      )
    } finally {
      setOptimizingAllDays(false)
    }
  }

  const destination = trip?.destination || trip?.name || 'Pakistan'
  const heroImage = getDestinationImage(destination)
  const days = Array.isArray(trip?.days) ? trip.days : []
  const daysCount = days.length
  const allStops = days.flatMap((d) => (Array.isArray(d.items) ? d.items : []))
  const totalStops = allStops.length
  const visitedStops = allStops.filter((s) => s.visitDetails?.visited || s.visited).length
  const poolCount = Array.isArray(trip?.placesPool) ? trip.placesPool.length : 0
  const isAllStopsVisited = totalStops > 0 && visitedStops === totalStops
  const isTripCompleted = trip?.status === 'completed' || isAllStopsVisited

  // Budget calculations matching Web WorkspacePage.jsx
  const budgetAmount = Number(trip?.budget?.amount || trip?.budget || 0)
  const currency = trip?.budget?.currency || 'PKR'
  const rawExpenses = Array.isArray(trip?.expenses) ? trip.expenses : []
  const expensesList = useMemo(() => {
    const entries = [...rawExpenses]
    entries.sort((a, b) => {
      const timeA = new Date(a.date || '').getTime() || 0
      const timeB = new Date(b.date || '').getTime() || 0
      return timeB - timeA
    })
    return entries
  }, [rawExpenses])

  const totalSpent = useMemo(
    () => expensesList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    [expensesList]
  )
  const remainingBudget = Math.max(0, budgetAmount - totalSpent)
  const spentPercent = budgetAmount > 0 ? Math.min(100, Math.round((totalSpent / budgetAmount) * 100)) : 0

  // Category-wise totals and percentages
  const categoryBreakdown = useMemo(() => {
    const map = {}
    EXPENSE_CATEGORIES.forEach((cat) => {
      map[cat] = 0
    })
    expensesList.forEach((exp) => {
      const cat = EXPENSE_CATEGORIES.includes(exp.category) ? exp.category : 'Misc'
      map[cat] = (map[cat] || 0) + (Number(exp.amount) || 0)
    })
    return EXPENSE_CATEGORIES.map((cat) => {
      const amt = map[cat] || 0
      const pct = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0
      return { category: cat, amount: amt, percent: pct }
    })
  }, [expensesList, totalSpent])

  function handleShareTrip() {
    setActiveSheet('sharing')
  }

  // Budget Handlers
  function handleOpenSetBudget() {
    setTargetBudgetInput(budgetAmount > 0 ? String(budgetAmount) : '')
    setBudgetModalVisible(true)
  }

  function handleSaveBudgetSubmit() {
    const val = Number(targetBudgetInput.trim())
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid non-negative number for the budget.')
      return
    }
    updateTripBudget(val, currency)
    setBudgetModalVisible(false)
  }

  function handleOpenAddExpense() {
    setEditingExpenseId(null)
    setExpenseName('')
    setExpenseAmount('')
    setExpenseCat('Transport')
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setExpenseNote('')
    setExpenseModalVisible(true)
  }

  function handleOpenEditExpense(exp) {
    setEditingExpenseId(exp.id)
    setExpenseName(exp.name || '')
    setExpenseAmount(String(exp.amount || ''))
    setExpenseCat(exp.category || 'Transport')
    setExpenseDate(exp.date || '')
    setExpenseNote(exp.note || '')
    setExpenseModalVisible(true)
  }

  function handleSaveExpenseSubmit() {
    if (!expenseAmount.trim()) {
      Alert.alert('Required', 'Please enter an expense amount.')
      return
    }
    const parsedAmount = Number(expenseAmount.trim())
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number for amount.')
      return
    }

    const finalName = expenseName.trim() || expenseCat || 'Expense'

    if (editingExpenseId) {
      updateExpense(editingExpenseId, {
        name: finalName,
        amount: parsedAmount,
        category: expenseCat,
        date: expenseDate.trim() || new Date().toISOString().slice(0, 10),
        note: expenseNote.trim(),
      })
    } else {
      addExpense({
        name: finalName,
        amount: parsedAmount,
        category: expenseCat,
        date: expenseDate.trim() || new Date().toISOString().slice(0, 10),
        note: expenseNote.trim(),
      })
    }
    setExpenseModalVisible(false)
    setEditingExpenseId(null)
    setExpenseName('')
    setExpenseAmount('')
  }

  function handleDeleteExpense(exp) {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to remove "${exp.name || exp.category}" (${currency} ${Number(exp.amount).toLocaleString()})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeExpense(exp.id),
        },
      ]
    )
  }

  // Itinerary Handlers
  function handleOpenAddStop(dayId) {
    setTargetDayIdForStop(dayId || (days[0] && days[0].id))
    setAddStopModalVisible(true)
  }

  async function handleAddStopSubmit() {
    if (!stopTitle.trim()) {
      Alert.alert('Required', 'Please enter a name for this stop')
      return
    }

    const title = stopTitle.trim()
    const subtitle = stopSubtitle.trim()
    const currentTrip = activeTrip || route?.params?.trip
    const dest = currentTrip?.destination || currentTrip?.name || ''
    const resolvedCoords = await geocodePlaceQuery(title, dest)

    // Resolve authentic image metadata
    const verified = findVerifiedLandmark('', title, dest)
    const imgObj = verified || getAuthenticPlaceImageSync('', 'attraction', title, dest)

    addPlaceToDay(targetDayIdForStop, {
      title,
      subtitle: subtitle || dest || 'Custom Stop',
      startTime: stopTime.trim(),
      note: stopNote.trim(),
      category: 'attraction',
      image: imgObj.imageUrl,
      photo: imgObj.imageUrl,
      imageSource: imgObj.imageSource,
      imageAttribution: imgObj.imageAttribution,
      imageVerified: Boolean(imgObj.imageVerified),
      lat: resolvedCoords ? resolvedCoords.lat : (verified?.lat || null),
      lon: resolvedCoords ? resolvedCoords.lon : (verified?.lon || null),
      unresolvedCoordinates: !resolvedCoords && !verified?.lat,
    })
    setAddStopModalVisible(false)
    setStopTitle('')
    setStopSubtitle('')
    setStopNote('')
  }

  function handleOpenNotesModal() {
    setNotesText(trip.notes || '')
    setNotesModalVisible(true)
  }

  function handleSaveNotesSubmit() {
    updateTrip({ ...trip, notes: notesText.trim() })
    setNotesModalVisible(false)
    Alert.alert('Notes Saved', 'Organizer advice has been updated.')
  }

  function handleOpenStopAction(dayId, item) {
    setSelectedStopDayId(dayId)
    setSelectedStopForAction(item)
    setStopActionModalVisible(true)
  }

  function handleToggleSelectedStopVisited() {
    if (!selectedStopDayId || !selectedStopForAction) return
    togglePlaceVisited(selectedStopDayId, selectedStopForAction.id)
    setStopActionModalVisible(false)
  }

  function handleOpenEditStop() {
    if (!selectedStopForAction) return
    setEditStopTitle(selectedStopForAction.title || selectedStopForAction.name || '')
    setEditStopSubtitle(selectedStopForAction.subtitle || selectedStopForAction.address || '')
    setEditStopTime(selectedStopForAction.startTime || '')
    setEditStopNote(selectedStopForAction.note || selectedStopForAction.visitDetails?.notes || '')
    setStopActionModalVisible(false)
    setEditStopModalVisible(true)
  }

  function handleSaveEditStopSubmit() {
    if (!selectedStopForAction) return
    if (!editStopTitle.trim()) {
      Alert.alert('Required', 'Please enter a title for this stop')
      return
    }
    updatePlaceDetails(selectedStopForAction.id, {
      title: editStopTitle.trim(),
      subtitle: editStopSubtitle.trim(),
      startTime: editStopTime.trim(),
      note: editStopNote.trim(),
      visitDetails: {
        ...(selectedStopForAction.visitDetails || {}),
        notes: editStopNote.trim(),
      },
    })
    setEditStopModalVisible(false)
    Alert.alert('Stop Updated', `"${editStopTitle.trim()}" has been updated.`)
  }

  function handleOpenMoveStop() {
    setStopActionModalVisible(false)
    setMoveStopModalVisible(true)
  }

  function handleMoveStopToDay(targetDayId) {
    if (!selectedStopDayId || !selectedStopForAction) return
    movePlace(selectedStopDayId, selectedStopForAction.id, targetDayId)
    setMoveStopModalVisible(false)
    const targetLabel = (days || []).find((d) => d.id === targetDayId)?.shortLabel || 'the selected day'
    Alert.alert('Stop Moved', `Moved to ${targetLabel}.`)
  }

  
  const [wizardVisible, setWizardVisible] = useState(false)

  

  async function handleWizardTripCreated(payload) {
    try {
      const created = await createTrip(payload)
      setWizardVisible(false)
      if (created) {
        if (typeof setActiveTrip === 'function') {
          setActiveTrip(created)
        }
        const newId = created.id || created.tripId
        if (typeof navigation.push === 'function') {
          navigation.push('TripDetail', { tripId: newId, trip: created })
        } else {
          navigation.navigate('TripDetail', { tripId: newId, trip: created, refreshKey: Date.now() })
        }
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not create next trip')
    }
  }

  function handleEndTripConfirm() {
    Alert.alert(
      'End This Trip?',
      'Are you sure you want to finish this trip? It will be marked as Completed and saved in your travel history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: () => {
            updateTrip({ ...trip, status: 'completed' })
            Alert.alert(
              'Trip Completed! 🎉',
              'Congratulations on finishing your journey! What would you like to do next?',
              [
                { text: '🗺️ Plan Next Trip', onPress: () => setWizardVisible(true) },
                { text: 'View All Trips', onPress: () => navigation.navigate('MainTabs', { screen: 'TripsTab' }) },
                { text: 'Stay Here', style: 'cancel' },
              ]
            )
          },
        },
      ]
    )
  }

  function handleToggleTripStatus() {
    const nextStatus = trip.status === 'completed' ? 'active' : 'completed'
    updateTrip({ ...trip, status: nextStatus })
    Alert.alert(
      nextStatus === 'completed' ? 'Trip Completed! 🎉' : 'Trip Reopened',
      nextStatus === 'completed'
        ? 'Congratulations on completing your itinerary! This trip is now marked as Completed.'
        : 'This trip is active and ready for planning.'
    )
  }

  React.useEffect(() => {
    const targetTripId = trip?.id || trip?.tripId
    if (activeSheet === 'tripmates' && targetTripId) {
      loadTripMembers(targetTripId)
    } else if (activeSheet === 'sharing' && targetTripId) {
      handleFetchShareToken('view')
    }
  }, [activeSheet, trip?.id, trip?.tripId])

  async function handleFetchShareToken(perm = 'view') {
    setSharePermission(perm)
    setShareTokenLoading(true)
    try {
      const targetTripId = trip?.id || trip?.tripId
      const res = await apiService.getTripShareToken(token, targetTripId, perm)
      if (res?.success) {
        setShareTokenData(res)
      }
    } catch (err) {
      console.warn('Failed to load share token:', err.message)
    } finally {
      setShareTokenLoading(false)
    }
  }

  async function handleCopyShareLink() {
    const rawToken = sharePermission === 'edit'
      ? (shareTokenData?.editShareToken || shareTokenData?.shareToken)
      : shareTokenData?.shareToken

    if (!rawToken) {
      Alert.alert('Share Trip', 'Share token not generated yet. Please select permissions above.')
      return
    }
    const isEditMode = sharePermission === 'edit'
    const shareUrl = isEditMode
      ? `https://tripnest.app/share/edit/${rawToken}`
      : `https://tripnest.app/share/${rawToken}`

    try {
      await Share.share({
        title: `TripNest: ${trip.title || trip.destination || 'Trip'}`,
        message: isEditMode
          ? `Join and edit our trip itinerary for ${trip.title || trip.destination || 'TripNest'}!\n${shareUrl}`
          : `Check out our trip itinerary for ${trip.title || trip.destination || 'TripNest'}!\n${shareUrl}`,
        url: shareUrl,
      })
    } catch {
      // Dismissed
    }
  }

  async function handleInviteTripmateSubmit() {
    if (!inviteIdentifierInput.trim()) return
    setInviteBusy(true)
    try {
      const res = await inviteTripMember(trip.id, inviteIdentifierInput.trim())
      if (res?.success) {
        setInviteIdentifierInput('')
        Alert.alert('Tripmate Added', `${res.invitation?.invitedUserName || inviteIdentifierInput} has been added to this trip's member list.`)
      } else {
        Alert.alert('Invite Failed', res?.error || 'Could not add collaborator.')
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not add collaborator.')
    } finally {
      setInviteBusy(false)
    }
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFoundContainer}>
          <Ionicons name="airplane-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.notFoundTitle}>No Active Trip Selected</Text>
          <Text style={styles.notFoundSubtitle}>
            Choose a trip from your itineraries library.
          </Text>
          <Button
            title="Back to Trips"
            pill={true}
            onPress={() => navigation.navigate('MainTabs', { screen: 'TripsTab' })}
            style={{ marginTop: 14 }}
          />
        </View>
      
    </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack()
            } else {
              navigation.navigate('MainTabs', { screen: 'TripsTab' })
            }
          }}
          style={styles.navButton}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {trip.title || trip.name || destination}
        </Text>
        <View style={styles.navRightGroup}>
          <TouchableOpacity
            onPress={() => navigation.navigate('PrintTrip', { trip })}
            style={styles.navButton}
            activeOpacity={0.7}
            accessibilityLabel="Print or Export Trip"
          >
            <Ionicons name="print-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShareTrip}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleOpenNotesModal}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ==================================================== */}
        {/* 1. DESTINATION HERO COVER */}
        {/* ==================================================== */}
        <View style={styles.heroCard}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />

          {/* Badges on Top */}
          <View style={styles.heroTopBadges}>
            {trip.isTripmate ? (
              <Badge
                label={`Tripmate • ${trip.tripmateRole || 'Member'}`}
                variant="tripmate"
                size="sm"
              />
            ) : (
              <Badge label="Personal Trip" variant="primary" size="sm" />
            )}
            <View style={styles.durationPill}>
              <Ionicons name="time-outline" size={12} color={colors.textWhite} />
              <Text style={styles.durationText}>{daysCount} Days</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.statusPill,
                trip.status === 'completed' ? styles.statusPillCompleted : styles.statusPillActive,
              ]}
              onPress={handleToggleTripStatus}
              activeOpacity={0.8}
            >
              <Ionicons
                name={trip.status === 'completed' ? 'checkmark-circle' : 'flag'}
                size={12}
                color={colors.textWhite}
              />
              <Text style={styles.statusPillText}>
                {trip.status === 'completed' ? 'Completed' : 'Active'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Destination & Meta Info */}
          <View style={styles.heroBottom}>
            <View style={styles.locationPill}>
              <Ionicons name="location-sharp" size={13} color={colors.accent} />
              <Text style={styles.locationPillText}>{destination}</Text>
            </View>

            <Text style={styles.heroTitle}>{trip.title || trip.name || 'Untitled Trip'}</Text>

            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.heroDates}>
                {trip.dates || (trip.startDate && `${trip.startDate} - ${trip.endDate}`) || 'Dates not set'}
              </Text>
            </View>

            {trip.isTripmate && trip.ownerName && (
              <View style={styles.organizerRow}>
                <Ionicons name="people" size={13} color="#92400E" />
                <Text style={styles.organizerText}>Organized by {trip.ownerName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ==================================================== */}
        {/* 2. THREE TRIPNEST WORKSPACE SECTIONS MATCHING WEB */}
        {/* ==================================================== */}
        <View style={styles.workspaceTabBar}>
          {[
            { id: 'overview', label: 'Overview', icon: 'grid-outline' },
            { id: 'itinerary', label: 'Itinerary', icon: 'calendar-outline' },
            { id: 'budget', label: 'Budget', icon: 'wallet-outline' },
          ].map((tab) => {
            const isActive = workspaceTab === tab.id
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.workspaceTabItem, isActive && styles.workspaceTabItemActive]}
                onPress={() => setWorkspaceTab(tab.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={[styles.workspaceTabText, isActive && styles.workspaceTabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ==================================================== */}
        {/* SECTION 1: OVERVIEW */}
        {/* ==================================================== */}
        {workspaceTab === 'overview' && (
          <View>
            {/* TRIP LIFECYCLE: END TRIP & PLAN NEXT TRIP */}
            <View style={styles.lifecycleCard}>
              <View style={styles.lifecycleCardLeft}>
                <View style={styles.lifecycleStatusBadge}>
                  <View style={[styles.lifecycleDot, trip.status === 'completed' ? styles.lifecycleDotCompleted : styles.lifecycleDotActive]} />
                  <Text style={styles.lifecycleStatusTitle}>
                    {trip.status === 'completed' ? 'Trip Completed 🏆' : 'Active Trip in Progress'}
                  </Text>
                </View>
                <Text style={styles.lifecycleStatusSub}>
                  {visitedStops} of {totalStops} stops visited • {daysCount} Days
                </Text>
              </View>

              <View style={styles.lifecycleCardActions}>
                {trip.status === 'completed' ? (
                  <TouchableOpacity
                    style={styles.lifecycleReopenBtn}
                    onPress={handleToggleTripStatus}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={13} color="#475569" />
                    <Text style={styles.lifecycleReopenBtnText}>Reopen</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.lifecycleEndBtn}
                    onPress={handleEndTripConfirm}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-done-circle" size={15} color="#DC2626" />
                    <Text style={styles.lifecycleEndBtnText}>End Trip</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.lifecycleNextBtn}
                  onPress={() => setWizardVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="airplane" size={14} color="#FFFFFF" />
                  <Text style={styles.lifecycleNextBtnText}>+ Next Trip</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TRIP COMPLETION / CELEBRATION CARD */}
            {(isAllStopsVisited || trip.status === 'completed') && (
              <View style={styles.completionBanner}>
                <View style={styles.completionBannerIconWrap}>
                  <Text style={{ fontSize: 24 }}>🎉</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.completionBannerTitle}>
                    {trip.status === 'completed' ? 'Trip Completed!' : 'All Stops Visited!'}
                  </Text>
                  <Text style={styles.completionBannerSub}>
                    {visitedStops} of {totalStops} stops visited across {daysCount} days.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.completionToggleBtn}
                  onPress={handleToggleTripStatus}
                  activeOpacity={0.8}
                >
                  <Text style={styles.completionToggleBtnText}>
                    {trip.status === 'completed' ? 'Reopen' : 'Mark Done'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PROMINENT PRIMARY CTA: OPEN ITINERARY */}
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => navigation.navigate('Itinerary')}
              activeOpacity={0.88}
            >
              <View style={styles.primaryCtaLeft}>
                <View style={styles.primaryCtaIconCircle}>
                  <Ionicons name="map" size={24} color={colors.textWhite} />
                </View>
                <View>
                  <Text style={styles.primaryCtaTitle}>Open Daily Itinerary</Text>
                  <Text style={styles.primaryCtaSubtitle}>
                    {daysCount} Days • {totalStops} Planned Stops ({visitedStops} visited)
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textWhite} />
            </TouchableOpacity>

            {/* SUMMARY STATS BAR */}
            <Card style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{daysCount}</Text>
                <Text style={styles.summaryLabel}>Days</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalStops}</Text>
                <Text style={styles.summaryLabel}>Stops</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.success }]}>{visitedStops}</Text>
                <Text style={styles.summaryLabel}>Visited</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.accentDark }]}>{poolCount}</Text>
                <Text style={styles.summaryLabel}>Pool</Text>
              </View>
            </Card>

            {/* QUICK TRAVEL TOOLS ROW */}
            <View style={styles.quickToolsRow}>
              <Text style={styles.groupHeader}>QUICK SHORTCUTS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolsIconsList}>
                <TouchableOpacity
                  style={styles.toolIconItem}
                  onPress={() => setAiModalVisible(true)}
                >
                  <View style={[styles.toolIconSquare, { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' }]}>
                    <Ionicons name="sparkles" size={20} color="#0E442B" />
                  </View>
                  <Text style={[styles.toolIconLabel, { fontWeight: '700', color: '#0E442B' }]}>AI Guide 🎙️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolIconItem}
                  onPress={() => setWorkspaceTab('itinerary')}
                >
                  <View style={[styles.toolIconSquare, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="calendar" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.toolIconLabel}>Schedule</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolIconItem}
                  onPress={() => navigation.navigate('Map', { tripId: trip.id || trip.tripId })}
                >
                  <View style={[styles.toolIconSquare, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="navigate" size={20} color="#2563EB" />
                  </View>
                  <Text style={styles.toolIconLabel}>Route Map</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolIconItem}
                  onPress={() => setWorkspaceTab('budget')}
                >
                  <View style={[styles.toolIconSquare, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="wallet" size={20} color="#059669" />
                  </View>
                  <Text style={styles.toolIconLabel}>Budget</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolIconItem}
                  onPress={() => setSharedBudgetVisible(true)}
                >
                  <View style={[styles.toolIconSquare, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="people" size={20} color="#7C3AED" />
                  </View>
                  <Text style={styles.toolIconLabel}>Shared Budget</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolIconItem}
                  onPress={handleOpenNotesModal}
                >
                  <View style={[styles.toolIconSquare, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="document-text" size={20} color="#4F46E5" />
                  </View>
                  <Text style={styles.toolIconLabel}>Notes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolIconItem}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'ExploreTab', params: { destination, category: 'All' } })}
                >
                  <View style={[styles.toolIconSquare, { backgroundColor: '#F0FDFA' }]}>
                    <Ionicons name="compass" size={20} color="#0D9488" />
                  </View>
                  <Text style={styles.toolIconLabel}>Browse All</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* 1. PLANNING TOOLS */}
            <Text style={styles.groupHeader}>PLANNING</Text>
            <Card style={styles.groupCard}>
              <ActionRow
                icon="calendar-outline"
                iconColor={colors.primary}
                iconBg={colors.primaryLight}
                title="Daily Schedule & Stops"
                subtitle={`${daysCount} day timeline with planned activities`}
                onPress={() => setWorkspaceTab('itinerary')}
              />
              <View style={styles.rowDivider} />
              <ActionRow
                icon="navigate-outline"
                iconColor="#2563EB"
                iconBg="#EFF6FF"
                title="Map View & Scenic Route"
                subtitle="Geographic stops, driving paths, and landmarks"
                onPress={() => navigation.navigate('Map', { tripId: trip.id || trip.tripId })}
              />
              <View style={styles.rowDivider} />
              <ActionRow
                icon="bookmark-outline"
                iconColor="#D97706"
                iconBg="#FEF3C7"
                title="Places Pool (Unscheduled)"
                subtitle={`${poolCount} saved attractions waiting for assignment`}
                valueText={`${poolCount} places`}
                onPress={() => navigation.navigate('MainTabs', { screen: 'SavedTab' })}
              />
              <View style={styles.rowDivider} />
              <ActionRow
                icon="compass-outline"
                iconColor="#0D9488"
                iconBg="#F0FDFA"
                title="Browse All Places (Explore)"
                subtitle={`Discover attractions, dining & stays in ${destination}`}
                onPress={() => navigation.navigate('MainTabs', { screen: 'ExploreTab', params: { destination, category: 'All' } })}
              />
            </Card>

            {/* 2. FINANCES */}
            <Text style={styles.groupHeader}>FINANCES</Text>
            <Card style={styles.groupCard}>
              <ActionRow
                icon="wallet-outline"
                iconColor="#059669"
                iconBg="#ECFDF5"
                title="Personal Budget & Expenses"
                subtitle={`${currency} ${totalSpent.toLocaleString()} spent • ${remainingBudget.toLocaleString()} left`}
                valueText={`${spentPercent}%`}
                onPress={() => setWorkspaceTab('budget')}
              />
              <View style={styles.rowDivider} />
              <ActionRow
                icon="people-outline"
                iconColor="#7C3AED"
                iconBg="#F5F3FF"
                title="Dedicated Shared Budget & Balances"
                subtitle="Multi-traveler bill splitting, net balances & settlements"
                onPress={() => setSharedBudgetVisible(true)}
              />
            </Card>

            {/* 3. COLLABORATION */}
            <Text style={styles.groupHeader}>COLLABORATION</Text>
            <Card style={styles.groupCard}>
              <ActionRow
                icon="people-outline"
                iconColor="#6366F1"
                iconBg="#EEF2FF"
                title="Tripmates"
                subtitle={trip.isTripmate ? `Member • Organized by ${trip.ownerName || 'Organizer'}` : 'Solo trip • Invite travelers'}
                onPress={() => setActiveSheet('tripmates')}
              />
              <View style={styles.rowDivider} />
              <ActionRow
                icon="share-social-outline"
                iconColor="#0891B2"
                iconBg="#ECFEFF"
                title="Share & Export"
                subtitle="View-only link and collaboration token"
                onPress={() => setActiveSheet('sharing')}
              />
            </Card>
          </View>
        )}

        {/* ==================================================== */}
        {/* SECTION 2: ITINERARY */}
        {/* ==================================================== */}
        {workspaceTab === 'itinerary' && (
          <View style={styles.itineraryTabContent}>

            {/* TRIP LIFECYCLE: END TRIP & PLAN NEXT TRIP */}
            <View style={styles.lifecycleCard}>
              <View style={styles.lifecycleCardLeft}>
                <View style={styles.lifecycleStatusBadge}>
                  <View style={[styles.lifecycleDot, trip.status === 'completed' ? styles.lifecycleDotCompleted : styles.lifecycleDotActive]} />
                  <Text style={styles.lifecycleStatusTitle}>
                    {trip.status === 'completed' ? 'Trip Completed 🏆' : 'Active Trip in Progress'}
                  </Text>
                </View>
                <Text style={styles.lifecycleStatusSub}>
                  {visitedStops} of {totalStops} stops visited • {daysCount} Days
                </Text>
              </View>

              <View style={styles.lifecycleCardActions}>
                {trip.status === 'completed' ? (
                  <TouchableOpacity
                    style={styles.lifecycleReopenBtn}
                    onPress={handleToggleTripStatus}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={13} color="#475569" />
                    <Text style={styles.lifecycleReopenBtnText}>Reopen</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.lifecycleEndBtn}
                    onPress={handleEndTripConfirm}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-done-circle" size={15} color="#DC2626" />
                    <Text style={styles.lifecycleEndBtnText}>End Trip</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.lifecycleNextBtn}
                  onPress={() => setWizardVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="airplane" size={14} color="#FFFFFF" />
                  <Text style={styles.lifecycleNextBtnText}>+ Next Trip</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.itineraryActionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itineraryHeading}>Daily Itinerary ({daysCount} Days)</Text>
                <Text style={styles.itinerarySubheading}>
                  {totalStops} planned stops • {visitedStops} completed
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {totalStops >= 2 && (
                  <TouchableOpacity
                    style={styles.optimizeAllBtn}
                    onPress={handleOptimizeAllDays}
                    disabled={optimizingAllDays}
                    activeOpacity={0.8}
                  >
                    {optimizingAllDays ? (
                      <ActivityIndicator size="small" color="#b45309" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={13} color="#d97706" />
                        <Text style={styles.optimizeAllBtnText}>Optimize All</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.fullItineraryLink}
                  onPress={() => navigation.navigate('Itinerary')}
                >
                  <Text style={styles.fullItineraryText}>Full Timeline →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TRIP COMPLETION / CELEBRATION CARD */}
            {(isAllStopsVisited || trip.status === 'completed') && (
              <View style={styles.completionBanner}>
                <View style={styles.completionBannerIconWrap}>
                  <Text style={{ fontSize: 24 }}>🎉</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.completionBannerTitle}>
                    {trip.status === 'completed' ? 'Trip Completed!' : 'All Stops Visited!'}
                  </Text>
                  <Text style={styles.completionBannerSub}>
                    {visitedStops} of {totalStops} stops visited across {daysCount} days.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.completionToggleBtn}
                  onPress={handleToggleTripStatus}
                  activeOpacity={0.8}
                >
                  <Text style={styles.completionToggleBtnText}>
                    {trip.status === 'completed' ? 'Reopen' : 'Mark Done'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {days.map((day, dIdx) => {
              const connectionsMap = buildDayConnectionsMap(day, trip?.destination || destination)
              return (
              <Card key={day.id || dIdx} style={styles.dayPreviewCard}>
                <View style={styles.dayPreviewHeader}>
                  <View style={styles.dayPreviewBadge}>
                    <Text style={styles.dayPreviewBadgeText}>DAY {dIdx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayPreviewTitle}>{day.label}</Text>
                    <Text style={styles.dayPreviewCount}>
                      {(day.items || []).length} stops planned
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {(day.items || []).filter((it) => it?.type !== 'note' && it?.type !== 'checklist').length >= 2 && (
                      <TouchableOpacity
                        style={styles.optimizeSmallBtn}
                        onPress={() => handleOptimizeDay(day.id)}
                        activeOpacity={0.8}
                        disabled={optimizingDayId === day.id}
                      >
                        {optimizingDayId === day.id ? (
                          <ActivityIndicator size="small" color="#b45309" />
                        ) : (
                          <>
                            <Ionicons name="flash" size={12} color="#f59e0b" />
                            <Text style={styles.optimizeSmallBtnText}>Optimize</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.addStopSmallBtn}
                      onPress={() => handleOpenAddStop(day.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={14} color={colors.primary} />
                      <Text style={styles.addStopSmallBtnText}>Add Stop</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {day.optimization && (day.optimization.metrics || day.optimization.totalDistanceKm) ? (
                  <View style={styles.dayOptBanner}>
                    <Ionicons name="flash" size={12} color="#d97706" />
                    <Text style={styles.dayOptBannerText}>
                      Optimized (TSP 2-Opt): {(day.optimization.metrics?.totalDistanceKm ?? day.optimization.totalDistanceKm ?? 0).toFixed(1)} km
                      {day.optimization.metrics?.distanceSavedKm > 0
                        ? ` • Saved ${day.optimization.metrics.distanceSavedKm.toFixed(1)} km`
                        : ''}
                    </Text>
                  </View>
                ) : null}

                {(day.items || []).length === 0 ? (
                  <View style={styles.dayEmptyBox}>
                    <Text style={styles.dayEmptyText}>No stops scheduled for this day yet.</Text>
                    <Button
                      title="+ Add Stop"
                      size="sm"
                      variant="outline"
                      pill={true}
                      onPress={() => handleOpenAddStop(day.id)}
                      style={{ marginTop: 6 }}
                    />
                  </View>
                ) : (
                  (() => {
                    let placeCounter = 0
                    return day.items.map((item, itemIdx) => {
                      const isPlace = item.type !== 'note' && item.type !== 'checklist'
                      const seqNum = isPlace ? ++placeCounter : itemIdx + 1
                      return (
                        <React.Fragment key={item.id ? `${day.id}-${item.id}` : `day-${dIdx}-item-${itemIdx}`}>
                          {connectionsMap.has(String(item.id)) && (
                            <View style={styles.inlineConnectionRow}>
                              <View style={styles.inlineConnectionLine} />
                              <View style={styles.inlineConnectionBadge}>
                                <Ionicons name="car-outline" size={11} color={colors.primary} />
                                <Text style={styles.inlineConnectionText}>
                                  {connectionsMap.get(String(item.id)).from} ━━━━> {item.title}: {connectionsMap.get(String(item.id)).distanceLabel}, ~{connectionsMap.get(String(item.id)).durationLabel}
                                </Text>
                              </View>
                              <View style={styles.inlineConnectionLine} />
                            </View>
                          )}
                          <View style={styles.miniStopRow}>
                            <TouchableOpacity
                              style={[
                                styles.miniCheckCircle,
                                item.visitDetails?.visited && styles.miniCheckCircleVisited,
                              ]}
                              onPress={() => togglePlaceVisited(day.id, item.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {item.visitDetails?.visited ? (
                                <Ionicons name="checkmark" size={12} color={colors.textWhite} />
                              ) : (
                                <Text style={styles.miniStopNum}>{seqNum}</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, marginLeft: 10 }}
                              onPress={() => handleOpenStopAction(day.id, item)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.miniStopTitle,
                                  item.visitDetails?.visited && styles.miniStopTitleVisited,
                                ]}
                                numberOfLines={1}
                              >
                                {item.title}
                              </Text>
                              <View style={styles.stopMetaRow}>
                                {item.startTime ? (
                                  <Text style={styles.miniStopTime}>⏰ {item.startTime}</Text>
                                ) : null}
                            {item.subtitle ? (
                              <Text style={styles.miniStopSubtitle} numberOfLines={1}>
                                📍 {item.subtitle}
                              </Text>
                            ) : null}
                            {item.note ? (
                              <Text style={styles.miniStopNoteText} numberOfLines={1}>
                                📝 {item.note}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleOpenStopAction(day.id, item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 4, marginRight: 2 }}
                        >
                          <Ionicons name="ellipsis-vertical" size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removePlaceFromDay(day.id, item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </React.Fragment>
                      )
                    })
                  })()
                )}
              </Card>
              )
            })}

            <Button
              title="Open Interactive Timeline & Map"
              iconName="map"
              pill={true}
              size="lg"
              fullWidth={true}
              onPress={() => navigation.navigate('Itinerary')}
              style={{ marginTop: 10 }}
            />
          </View>
        )}

        {/* ==================================================== */}
        {/* SECTION 3: BUDGET & EXPENSES (WEB SOURCE-OF-TRUTH) */}
        {/* ==================================================== */}
        {workspaceTab === 'budget' && (
          <View style={styles.budgetTabContainer}>
            {/* Deep Navy Budget Hero Card */}
            <View style={styles.budgetHeroCard}>
              <View style={styles.budgetCardTop}>
                <Text style={styles.budgetCurrencyLabel}>Total Spent</Text>
                <Text style={styles.budgetLargeAmount}>
                  {currency} {totalSpent.toLocaleString()}
                </Text>
                <Text style={styles.budgetTargetSub}>
                  of {budgetAmount > 0 ? `${currency} ${budgetAmount.toLocaleString()}` : 'No target set'}
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.budgetProgressTrack}>
                <View
                  style={[
                    styles.budgetProgressFill,
                    { width: `${spentPercent}%` },
                  ]}
                />
              </View>

              <View style={styles.budgetRemainingRow}>
                <Text style={styles.budgetRemainingText}>
                  {budgetAmount > 0
                    ? `${currency} ${remainingBudget.toLocaleString()} remaining (${100 - spentPercent}%)`
                    : `${currency} ${totalSpent.toLocaleString()} recorded`}
                </Text>
              </View>

              {/* Quick Action Pills */}
              <View style={styles.budgetActionPillsRow}>
                <TouchableOpacity
                  style={styles.budgetPillBtn}
                  onPress={handleOpenSetBudget}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.textWhite} />
                  <Text style={styles.budgetPillBtnText}>Set Target Budget</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.budgetPillBtn}
                  onPress={() => setSharedBudgetVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="people-outline" size={14} color={colors.textWhite} />
                  <Text style={styles.budgetPillBtnText}>Group balances & settle</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Dedicated Shared Budget Access Banner */}
            <TouchableOpacity
              style={styles.sharedBudgetBanner}
              onPress={() => setSharedBudgetVisible(true)}
              activeOpacity={0.88}
            >
              <View style={styles.sharedBudgetBannerLeft}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people" size={22} color="#7C3AED" />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.sharedBudgetBannerTitle}>Dedicated Shared Budget</Text>
                  <Text style={styles.sharedBudgetBannerSub}>
                    Multi-traveler bill splitting, who owes whom, and settlement tracking
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
            </TouchableOpacity>

            {/* Category Breakdown Card */}
            <Card style={styles.breakdownCard}>
              <Text style={styles.breakdownHeading}>Category Breakdown</Text>
              <View style={styles.breakdownList}>
                {categoryBreakdown.map((item) => (
                  <View key={item.category} style={styles.breakdownRow}>
                    <View style={styles.breakdownCategoryInfo}>
                      <View style={[styles.breakdownIconWrap, { backgroundColor: `${CATEGORY_COLORS[item.category]}18` }]}>
                        <Ionicons
                          name={CATEGORY_ICONS[item.category] || 'receipt-outline'}
                          size={15}
                          color={CATEGORY_COLORS[item.category] || colors.primary}
                        />
                      </View>
                      <Text style={styles.breakdownCategoryName}>{item.category}</Text>
                    </View>
                    <View style={styles.breakdownRight}>
                      <View style={styles.breakdownBarWrap}>
                        <View
                          style={[
                            styles.breakdownBarFill,
                            {
                              width: `${item.percent}%`,
                              backgroundColor: CATEGORY_COLORS[item.category] || colors.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.breakdownAmountText}>
                        {currency} {item.amount.toLocaleString()} ({item.percent}%)
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            {/* Expenses List Section */}
            <View style={styles.expensesListSection}>
              <View style={styles.expensesHeaderRow}>
                <Text style={styles.expensesSectionTitle}>Expenses ({expensesList.length})</Text>
                <TouchableOpacity
                  style={styles.addExpenseHeaderBtn}
                  onPress={handleOpenAddExpense}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={16} color={colors.primary} />
                  <Text style={styles.addExpenseHeaderBtnText}>Add Expense</Text>
                </TouchableOpacity>
              </View>

              {expensesList.length === 0 ? (
                <View style={styles.emptyExpensesBox}>
                  <Ionicons name="receipt-outline" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyExpensesText}>
                    You haven't added any expenses yet. Track your spending by adding an expense below.
                  </Text>
                  <Button
                    title="+ Add Expense"
                    size="sm"
                    variant="primary"
                    pill={true}
                    onPress={handleOpenAddExpense}
                    style={{ marginTop: 12 }}
                  />
                </View>
              ) : (
                expensesList.map((exp) => (
                  <Card key={exp.id} style={styles.expenseCard}>
                    <View style={styles.expenseLeft}>
                      <View style={[styles.expenseIconCircle, { backgroundColor: `${CATEGORY_COLORS[exp.category] || colors.primary}18` }]}>
                        <Ionicons
                          name={CATEGORY_ICONS[exp.category] || 'receipt-outline'}
                          size={18}
                          color={CATEGORY_COLORS[exp.category] || colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.expenseTitle}>{exp.name || exp.category}</Text>
                        <Text style={styles.expenseDate}>
                          {exp.category} {exp.date ? `• ${exp.date}` : ''}
                        </Text>
                        {exp.note ? (
                          <Text style={styles.expenseNoteText} numberOfLines={1}>
                            {exp.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.expenseAmountText}>
                        {currency} {Number(exp.amount).toLocaleString()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                          onPress={() => handleOpenEditExpense(exp)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteExpense(exp)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error || '#ef4444'} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                ))
              )}

              {/* Large Primary Add Expense Button */}
              <Button
                title="+ Add expense"
                pill={true}
                size="lg"
                fullWidth={true}
                onPress={handleOpenAddExpense}
                style={{ marginTop: 14 }}
              />
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ==================================================== */}
      {/* SECONDARY TOOL SHEETS */}
      {/* ==================================================== */}

      {/* TOOL SHEET: TRIPMATES */}
      <ModalSheet
        visible={activeSheet === 'tripmates'}
        onClose={() => setActiveSheet(null)}
        title="Tripmates Collaboration"
        subtitle="Invite companions to collaborate on this itinerary"
      >
        <View style={styles.sheetContent}>
          {/* Owner row */}
          {tripMembers?.owner ? (
            <View style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {(tripMembers.owner.displayName || tripMembers.owner.username || 'O')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.memberName}>{tripMembers.owner.displayName || tripMembers.owner.username}</Text>
                <Text style={styles.memberRole}>Trip Organizer • Owner</Text>
              </View>
              <Badge label="Owner" variant="tripmate" size="sm" />
            </View>
          ) : null}

          {/* Members list */}
          {Array.isArray(tripMembers?.members) && tripMembers.members.length > 0 ? (
            tripMembers.members.map((m) => (
              <View key={m.userId || m.username} style={styles.memberCard}>
                <View style={[styles.memberAvatar, { backgroundColor: colors.accentDark }]}>
                  <Text style={styles.memberAvatarText}>
                    {(m.displayName || m.username || 'T')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberName}>{m.displayName || m.username}</Text>
                  <Text style={styles.memberRole}>{m.email || 'Tripmate Member'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Badge label="Tripmate" variant="primary" size="sm" />
                  <TouchableOpacity
                    onPress={() => removeTripMember(trip.id, m.userId)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : null}

          {/* Pending invites */}
          {Array.isArray(tripMembers?.pendingInvites) && tripMembers.pendingInvites.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.inputLabel, { marginTop: 4 }]}>PENDING INVITATIONS</Text>
              {tripMembers.pendingInvites.map((inv) => (
                <View key={inv.id} style={styles.memberCard}>
                  <View style={[styles.memberAvatar, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                    <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.memberName}>{inv.invitedUserName || inv.invitedUserEmail || 'Invited User'}</Text>
                    <Text style={styles.memberRole}>Waiting for acceptance</Text>
                  </View>
                  <Badge label="Pending" variant="accent" size="sm" />
                </View>
              ))}
            </View>
          ) : null}

          {/* Invite form */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.inputLabel}>Invite by Username or Email</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={inviteIdentifierInput}
                onChangeText={setInviteIdentifierInput}
                placeholder="e.g. wanderer99 or companion@gmail.com"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
              />
              <Button
                title={inviteBusy ? "..." : "Invite"}
                variant="primary"
                pill={true}
                size="md"
                onPress={handleInviteTripmateSubmit}
                disabled={inviteBusy || !inviteIdentifierInput.trim()}
              />
            </View>
          </View>
        </View>
      </ModalSheet>

      {/* TOOL SHEET: SHARING */}
      <ModalSheet
        visible={activeSheet === 'sharing'}
        onClose={() => setActiveSheet(null)}
        title="Share Trip"
        subtitle="Create shareable links for companions or viewers"
      >
        <View style={styles.sheetContent}>
          {/* Permission selection */}
          <Text style={styles.inputLabel}>Sharing Mode</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.suggestionChip, sharePermission === 'view' && styles.suggestionChipActive]}
              onPress={() => handleFetchShareToken('view')}
            >
              <Text style={[styles.suggestionText, sharePermission === 'view' && styles.suggestionTextActive]}>
                View-Only Link
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.suggestionChip, sharePermission === 'edit' && styles.suggestionChipActive]}
              onPress={() => handleFetchShareToken('edit')}
            >
              <Text style={[styles.suggestionText, sharePermission === 'edit' && styles.suggestionTextActive]}>
                Can-Edit Copy Link
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shareCard}>
            <Text style={styles.shareTitle}>
              {sharePermission === 'view' ? 'View-Only Sharing' : 'Editable Copy Sharing'}
            </Text>
            <Text style={styles.shareDesc}>
              {sharePermission === 'view'
                ? 'Anyone with this link can view the complete itinerary, routes, and day schedule in read-only mode.'
                : 'Anyone with this link can create an independent, fully editable copy of this trip in their own library.'}
            </Text>

            {shareTokenLoading ? (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.resDates, { marginTop: 6 }]}>Generating secure share link...</Text>
              </View>
            ) : shareTokenData?.shareToken ? (
              <>
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenText} numberOfLines={2} selectable={true}>
                    {sharePermission === 'edit'
                      ? `https://tripnest.app/share/edit/${shareTokenData.editShareToken || shareTokenData.shareToken}`
                      : `https://tripnest.app/share/${shareTokenData.shareToken}`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Share Link"
                      iconName="share-outline"
                      variant="primary"
                      size="sm"
                      pill={true}
                      fullWidth={true}
                      onPress={handleCopyShareLink}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Preview Link"
                      iconName="eye-outline"
                      variant="outline"
                      size="sm"
                      pill={true}
                      fullWidth={true}
                      onPress={() => {
                        const rawTok = sharePermission === 'edit'
                          ? (shareTokenData.editShareToken || shareTokenData.shareToken)
                          : shareTokenData.shareToken
                        setActiveSheet(null)
                        navigation.navigate('PublicTrip', {
                          token: rawTok,
                          isEdit: sharePermission === 'edit',
                        })
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <Button
                title="Generate Link"
                variant="outline"
                size="sm"
                pill={true}
                onPress={() => handleFetchShareToken(sharePermission)}
              />
            )}
          </View>
        </View>
      </ModalSheet>

      {/* Modal: Set Target Budget */}
      <ModalSheet
        visible={budgetModalVisible}
        onClose={() => setBudgetModalVisible(false)}
        title="Trip Budget"
        subtitle="Set the overall target spending for this trip"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Total Budget ({currency})</Text>
          <TextInput
            style={styles.modalInput}
            value={targetBudgetInput}
            onChangeText={setTargetBudgetInput}
            keyboardType="numeric"
            placeholder="e.g. 50000"
            placeholderTextColor={colors.textTertiary}
            autoFocus={true}
            returnKeyType="done"
            onSubmitEditing={handleSaveBudgetSubmit}
            selectTextOnFocus={true}
          />
          <Button
            title="Save Budget"
            iconName="checkmark"
            pill={true}
            size="lg"
            fullWidth={true}
            onPress={handleSaveBudgetSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal: Add / Edit Expense Form */}
      <ModalSheet
        visible={expenseModalVisible}
        onClose={() => {
          setExpenseModalVisible(false)
          setEditingExpenseId(null)
        }}
        title={editingExpenseId ? "Edit Expense" : "Add Expense"}
        subtitle={`Record spending for ${destination}`}
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Expense Title</Text>
          <TextInput
            style={styles.modalInput}
            value={expenseName}
            onChangeText={setExpenseName}
            placeholder="e.g. Fuel, Lunch, Entry Tickets, Hotel Room"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
            autoFocus={true}
          />

          <Text style={styles.inputLabel}>Amount ({currency})</Text>
          <TextInput
            style={styles.modalInput}
            value={expenseAmount}
            onChangeText={setExpenseAmount}
            keyboardType="numeric"
            placeholder="3500"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
          />

          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.chipsRow}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.suggestionChip, expenseCat === cat && styles.suggestionChipActive]}
                onPress={() => setExpenseCat(cat)}
              >
                <Text style={[styles.suggestionText, expenseCat === cat && styles.suggestionTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.modalInput}
            value={expenseDate}
            onChangeText={setExpenseDate}
            placeholder="2026-06-15"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Note (Optional)</Text>
          <TextInput
            style={styles.modalInput}
            value={expenseNote}
            onChangeText={setExpenseNote}
            placeholder="e.g. Paid cash at mountain pass"
            placeholderTextColor={colors.textTertiary}
          />

          <Button
            title={editingExpenseId ? "Update Expense" : "Save Expense"}
            iconName="checkmark"
            pill={true}
            size="lg"
            fullWidth={true}
            onPress={handleSaveExpenseSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal: Add Stop to Day (Itinerary Section) */}
      <ModalSheet
        visible={addStopModalVisible}
        onClose={() => setAddStopModalVisible(false)}
        title="Add Stop to Itinerary"
        subtitle="Schedule a visit or activity"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Stop Title</Text>
          <TextInput
            style={styles.modalInput}
            value={stopTitle}
            onChangeText={setStopTitle}
            placeholder="e.g. Sunset Point, Tea Stall, Historical Site"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Location / Subtitle</Text>
          <TextInput
            style={styles.modalInput}
            value={stopSubtitle}
            onChangeText={setStopSubtitle}
            placeholder="e.g. Central Valley, Viewpoint Road"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Time</Text>
          <TextInput
            style={styles.modalInput}
            value={stopTime}
            onChangeText={setStopTime}
            placeholder="e.g. 10:00 AM"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={styles.modalInput}
            value={stopNote}
            onChangeText={setStopNote}
            placeholder="e.g. Wear comfortable shoes, Bring camera"
            placeholderTextColor={colors.textTertiary}
          />

          <Button
            title="Add Stop"
            iconName="add"
            pill={true}
            size="lg"
            fullWidth={true}
            onPress={handleAddStopSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal: Edit Organizer Notes */}
      <ModalSheet
        visible={notesModalVisible}
        onClose={() => setNotesModalVisible(false)}
        title="Trip Notes & Guidance"
        subtitle="Edit route tips, packing suggestions, and advice"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Notes & Instructions</Text>
          <TextInput
            style={[styles.modalInput, { height: 110, textAlignVertical: 'top', paddingTop: 10 }]}
            value={notesText}
            onChangeText={setNotesText}
            multiline={true}
            placeholder="Add key route tips, mountain road conditions, contact numbers, or packing reminders..."
            placeholderTextColor={colors.textTertiary}
          />

          <Button
            title="Save Notes"
            iconName="checkmark"
            pill={true}
            size="lg"
            fullWidth={true}
            onPress={handleSaveNotesSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal: Stop Options & Actions Sheet */}
      <ModalSheet
        visible={stopActionModalVisible}
        onClose={() => setStopActionModalVisible(false)}
        title={selectedStopForAction?.title || "Stop Options"}
        subtitle={selectedStopForAction?.subtitle || "Manage stop in this itinerary"}
      >
        <View style={styles.sheetContent}>
          <TouchableOpacity
            style={styles.actionOptionRow}
            onPress={handleToggleSelectedStopVisited}
            activeOpacity={0.7}
          >
            <View style={[styles.actionOptionIcon, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons
                name={selectedStopForAction?.visitDetails?.visited ? "close-circle" : "checkmark-circle"}
                size={20}
                color="#059669"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionOptionTitle}>
                {selectedStopForAction?.visitDetails?.visited ? "Mark as Not Visited" : "Mark as Visited"}
              </Text>
              <Text style={styles.actionOptionSubtitle}>
                {selectedStopForAction?.visitDetails?.visited ? "Uncheck this stop" : "Record arrival & completion"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionOptionRow}
            onPress={handleOpenEditStop}
            activeOpacity={0.7}
          >
            <View style={[styles.actionOptionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionOptionTitle}>Edit Time & Notes</Text>
              <Text style={styles.actionOptionSubtitle}>Update stop schedule, advice or notes</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionOptionRow}
            onPress={handleOpenMoveStop}
            activeOpacity={0.7}
          >
            <View style={[styles.actionOptionIcon, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="swap-horizontal" size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionOptionTitle}>Move to Another Day</Text>
              <Text style={styles.actionOptionSubtitle}>Reschedule to a different day</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionOptionRow, { borderBottomWidth: 0 }]}
            onPress={() => {
              if (selectedStopDayId && selectedStopForAction) {
                removePlaceFromDay(selectedStopDayId, selectedStopForAction.id)
                setStopActionModalVisible(false)
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionOptionIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.actionOptionTitle, { color: '#DC2626' }]}>Remove from Itinerary</Text>
              <Text style={styles.actionOptionSubtitle}>Delete stop from this day</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {/* Modal: Edit Stop Details */}
      <ModalSheet
        visible={editStopModalVisible}
        onClose={() => setEditStopModalVisible(false)}
        title="Edit Stop"
        subtitle="Modify place name, time or notes"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Place / Stop Title *</Text>
          <TextInput
            style={styles.modalInput}
            value={editStopTitle}
            onChangeText={setEditStopTitle}
            placeholder="e.g. Sunset Point, Tea Stall"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Location / Subtitle</Text>
          <TextInput
            style={styles.modalInput}
            value={editStopSubtitle}
            onChangeText={setEditStopSubtitle}
            placeholder="e.g. Central Valley, Viewpoint Road"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Scheduled Time</Text>
          <TextInput
            style={styles.modalInput}
            value={editStopTime}
            onChangeText={setEditStopTime}
            placeholder="e.g. 10:00 AM"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Notes & Instructions</Text>
          <TextInput
            style={[styles.modalInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
            value={editStopNote}
            onChangeText={setEditStopNote}
            multiline={true}
            placeholder="Add visit instructions, parking tips, or reminders..."
            placeholderTextColor={colors.textTertiary}
          />

          <Button
            title="Save Changes"
            iconName="checkmark"
            pill={true}
            size="lg"
            fullWidth={true}
            onPress={handleSaveEditStopSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal: Move Stop to Day */}
      <ModalSheet
        visible={moveStopModalVisible}
        onClose={() => setMoveStopModalVisible(false)}
        title="Move Stop"
        subtitle={`Reschedule "${selectedStopForAction?.title || 'stop'}" to another day`}
      >
        <View style={styles.sheetContent}>
          {days.map((d, dIdx) => {
            const isCurrent = d.id === selectedStopDayId
            return (
              <TouchableOpacity
                key={d.id || dIdx}
                style={[styles.moveDayOptionRow, isCurrent && styles.moveDayOptionRowCurrent]}
                onPress={() => !isCurrent && handleMoveStopToDay(d.id)}
                disabled={isCurrent}
                activeOpacity={0.7}
              >
                <View style={[styles.moveDayBadge, isCurrent && { backgroundColor: colors.borderLight }]}>
                  <Text style={[styles.moveDayBadgeText, isCurrent && { color: colors.textTertiary }]}>
                    DAY {dIdx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.moveDayTitle, isCurrent && { color: colors.textTertiary }]}>
                    {d.label || `Day ${dIdx + 1}`}
                  </Text>
                  <Text style={styles.moveDayCount}>
                    {(d.items || []).length} stops scheduled {isCurrent ? '(Current)' : ''}
                  </Text>
                </View>
                {!isCurrent ? (
                  <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>Current</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </ModalSheet>

      {/* Dedicated Shared Budget Modal */}
      <SharedBudgetModal
        visible={sharedBudgetVisible}
        onClose={() => setSharedBudgetVisible(false)}
        trip={trip}
        tripId={trip?.tripId || trip?.id}
        tripTitle={trip?.title || trip?.name || destination}
      />
      {/* AI ASSISTANT MODAL */}
      <AiAssistantModal visible={aiModalVisible} initialVoiceMode={true}
        onClose={() => setAiModalVisible(false)}
        initialContext={trip?.title || trip?.destination || destination || 'Pakistan Travel'}
      />

      {/* GUIDED TRIP CREATION WIZARD FOR NEXT TRIP */}
      <TripCreationWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onTripCreated={handleWizardTripCreated}
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
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
    fontWeight: '700',
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  notFoundTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 12,
  },
  notFoundSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  // Hero
  heroCard: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 14,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  heroTopBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textWhite,
  },
  heroBottom: {
    zIndex: 2,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 6,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.textWhite,
    fontWeight: '800',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroDates: {
    ...typography.caption,
    color: colors.textWhite,
    fontWeight: '600',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  organizerText: {
    ...typography.caption,
    color: '#92400E',
    fontWeight: '700',
  },
  // Workspace Tab Bar (3 Tabs)
  workspaceTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  workspaceTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 11,
    gap: 3,
  },
  workspaceTabItemActive: {
    backgroundColor: colors.card,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  workspaceTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  workspaceTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
    fontSize: 11,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  // Primary CTA: Open Itinerary
  primaryCta: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryCtaIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaTitle: {
    ...typography.subtitle1,
    color: colors.textWhite,
    fontWeight: '700',
  },
  primaryCtaSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  // Quick Shortcuts Row
  quickToolsRow: {
    marginBottom: 16,
  },
  groupHeader: {
    ...typography.overline,
    color: colors.textTertiary,
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: '700',
  },
  toolsIconsList: {
    flexDirection: 'row',
    gap: 12,
  },
  toolIconItem: {
    alignItems: 'center',
    gap: 6,
  },
  toolIconSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  groupCard: {
    padding: 0,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 56,
  },
  // Itinerary Tab Content
  itineraryTabContent: {
    gap: 12,
  },
  itineraryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itineraryHeading: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  itinerarySubheading: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  fullItineraryLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  fullItineraryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  dayPreviewCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  dayPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  dayPreviewBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayPreviewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textWhite,
  },
  dayPreviewTitle: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  dayPreviewCount: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  addStopSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addStopSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  optimizeSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  optimizeSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  dayOptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  dayOptBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  dayEmptyBox: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 6,
  },
  dayEmptyText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  miniStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  miniCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCheckCircleVisited: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  miniStopNum: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  miniStopTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  miniStopTitleVisited: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  stopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  miniStopTime: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  miniStopSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
    flex: 1,
  },
  // Budget Hero Card
  budgetTabContainer: {
    gap: 12,
  },
  budgetHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  budgetCardTop: {
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetCurrencyLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  budgetLargeAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textWhite,
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  budgetTargetSub: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  budgetProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  budgetProgressFill: {
    height: '100%',
    backgroundColor: colors.primaryMuted,
    borderRadius: 3,
  },
  budgetRemainingRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetRemainingText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  budgetActionPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  budgetPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  budgetPillBtnText: {
    ...typography.caption,
    color: colors.textWhite,
    fontWeight: '600',
  },
  sharedBudgetBanner: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sharedBudgetBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sharedBudgetBannerTitle: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sharedBudgetBannerSub: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  // Breakdown Card
  breakdownCard: {
    padding: 16,
    borderRadius: 16,
  },
  breakdownHeading: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 12,
  },
  breakdownList: {
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownCategoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 100,
  },
  breakdownIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownCategoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  breakdownRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  breakdownBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownAmountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 100,
    textAlign: 'right',
  },
  // Expenses List
  expensesListSection: {
    marginTop: 6,
  },
  expensesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  expensesSectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  addExpenseHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addExpenseHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyExpensesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyExpensesText: {
    ...typography.body2,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  expenseIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseTitle: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  expenseDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  expenseNoteText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 2,
  },
  expenseAmountText: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  // Sheets & Modals
  sheetContent: {
    paddingBottom: 20,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: colors.textWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalForm: {
    paddingBottom: 24,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  suggestionChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  suggestionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  suggestionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  shareCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  shareTitle: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  shareDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  tokenBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  tokenText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: 'monospace',
  },
  resDates: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  // Status and Completion styles

  lifecycleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lifecycleCardLeft: {
    flex: 1,
    marginRight: 8,
  },
  lifecycleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  lifecycleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lifecycleDotActive: {
    backgroundColor: '#10B981',
  },
  lifecycleDotCompleted: {
    backgroundColor: '#F59E0B',
  },
  lifecycleStatusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  lifecycleStatusSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  lifecycleCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lifecycleEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  lifecycleEndBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  lifecycleReopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  lifecycleReopenBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  lifecycleNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0E442B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  lifecycleNextBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
  },
  statusPillCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textWhite,
  },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
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
  miniStopNoteText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 1,
  },
  // Stop action & move options
  actionOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  actionOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionOptionSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  moveDayOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  moveDayOptionRowCurrent: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  moveDayBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  moveDayBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  moveDayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  moveDayCount: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  optimizeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  optimizeAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  inlineConnectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  inlineConnectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  inlineConnectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginHorizontal: 6,
  },
  inlineConnectionText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
})

export default TripDetailScreen
