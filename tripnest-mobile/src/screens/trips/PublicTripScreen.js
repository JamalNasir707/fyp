import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { useApp } from '../../context/AppContext'
import { apiService } from '../../api/apiService'
import { getDestinationImage, getPlaceImage } from '../../constants/images'
import { formatTripDateRange, getDayColor, formatTime12h, ensureWorkspaceParityTrip } from '../../utils/tripUtils'
import InteractiveMap from '../../components/map/InteractiveMap'
import Badge from '../../components/common/Badge'
import Card from '../../components/common/Card'
import EmptyState from '../../components/common/EmptyState'

export function PublicTripScreen({ navigation, route }) {
  const { tripId, token, shareToken, editShareToken, isEdit: paramIsEdit } = route?.params || {}
  const effectiveToken = token || shareToken || editShareToken
  const isEdit = Boolean(
    paramIsEdit ||
    route?.name === 'PublicTripEdit' ||
    route?.name === 'PublicTripLegacyEdit' ||
    editShareToken ||
    (effectiveToken && String(effectiveToken).startsWith('sh_edit_'))
  )
  const isSharedToken = Boolean(effectiveToken)

  const {
    token: authToken,
    isAuthenticated,
    createTrip,
    loadTrips,
    setActiveTrip,
  } = useApp()

  const [trip, setTrip] = useState(null)
  const [sharedOwner, setSharedOwner] = useState(null)
  const [permission, setPermission] = useState(isEdit ? 'edit' : isSharedToken ? 'view' : 'public')
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)

  useEffect(() => {
    let active = true

    if (!effectiveToken && !tripId) {
      setError('Trip link or ID is required')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const loadTripData = async () => {
      try {
        let res = null
        if (isSharedToken) {
          // Token-based sharing flow matching Web
          if (isEdit) {
            res = await apiService.getSharedEditTrip(effectiveToken)
          } else {
            res = await apiService.getSharedTrip(effectiveToken)
          }
        } else {
          // Database public trip flow
          res = await apiService.getPublicTripById(tripId)
        }

        if (!active) return

        if (res?.success && res?.trip) {
          const raw = res.trip?.data || res.trip
          const normalized = ensureWorkspaceParityTrip(raw)
          setTrip(normalized)
          setSharedOwner(res.owner || res.trip?.owner || null)
          setPermission(res.permission || (isEdit ? 'edit' : isSharedToken ? 'view' : 'public'))
          const firstStop = normalized.days?.[0]?.items?.[0]?.id
          if (firstStop) setSelectedPlaceId(firstStop)
        } else {
          setError(res?.detail || res?.error || 'This shared trip is not accessible or link has expired.')
        }
      } catch (err) {
        if (!active) return
        setError(err.message || 'This trip is not publicly available or the link has expired.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTripData()

    return () => {
      active = false
    }
  }, [effectiveToken, tripId, isSharedToken, isEdit])

  async function handleCopyTrip() {
    if (!trip) return
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account to save and customize this trip in your library.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => navigation.navigate('Login') },
        ]
      )
      return
    }

    setCopying(true)
    try {
      if (isEdit && effectiveToken) {
        // Backend endpoint: POST /trips/shared/edit/{token}/copy
        const res = await apiService.copySharedEditTrip(authToken, effectiveToken)
        if (res?.success && res?.trip) {
          const raw = res.trip?.data || res.trip
          const clonedTrip = ensureWorkspaceParityTrip(raw)
          await loadTrips()
          setActiveTrip(clonedTrip)
          Alert.alert(
            'Trip Copied!',
            'An independent copy has been added to your Trip Library. You can now edit and customize all stops.',
            [
              {
                text: 'Open Itinerary',
                onPress: () =>
                  navigation.navigate('TripDetail', {
                    tripId: clonedTrip.id || clonedTrip.tripId,
                  }),
              },
            ]
          )
        } else {
          throw new Error(res?.detail || res?.error || 'Failed to copy shared edit trip.')
        }
      } else {
        // View-only share token or public trip: clone into user account via createTrip
        const copyPayload = {
          title: `${trip.title || trip.destination || 'My Trip'} (Copy)`,
          destination: trip.destination || trip.city || 'Pakistan',
          startDate: trip.startDate || '2026-06-01',
          endDate: trip.endDate || '2026-06-05',
          days: trip.days || [],
          placesPool: trip.placesPool || [],
          customLists: trip.customLists || [],
          budgetAmount: trip.budget?.amount || 50000,
          notes: trip.notes || '',
          isTripmate: false,
        }
        const created = await createTrip(copyPayload)
        Alert.alert(
          'Trip Saved!',
          `"${created.title}" has been saved to your Trip Library.`,
          [
            {
              text: 'Open Itinerary',
              onPress: () =>
                navigation.navigate('TripDetail', {
                  tripId: created.id || created.tripId,
                }),
            },
          ]
        )
      }
    } catch (err) {
      Alert.alert('Copy Failed', err.message || 'Could not copy this trip.')
    } finally {
      setCopying(false)
    }
  }

  async function handleShare() {
    if (!trip) return
    try {
      await Share.share({
        message: `Check out "${trip.title || trip.destination}" on TripNest!\nDestination: ${trip.destination}\nDates: ${trip.dates || formatTripDateRange(trip.startDate, trip.endDate)}`,
      })
    } catch {
      // dismissed
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading public itinerary...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Public Trip</Text>
          <View style={{ width: 38 }} />
        </View>
        <EmptyState
          iconName="lock-closed-outline"
          title="Trip Not Available"
          description={error || 'This trip may be private, archived, or deleted by the author.'}
          actionTitle="Go Back"
          onActionPress={() => navigation.goBack()}
        />
      </SafeAreaView>
    )
  }

  const destination = trip.destination || trip.city || 'Pakistan'
  const heroImage = trip.coverImage || getDestinationImage(destination)
  const days = Array.isArray(trip.days) ? trip.days : []
  const effectiveOwner = sharedOwner || trip.owner || {}

  const badgeLabel = isEdit
    ? 'Can-Edit Shared Link'
    : isSharedToken
    ? 'View-Only Shared Link'
    : 'Public Itinerary'

  const badgeIcon = isEdit ? 'create-outline' : isSharedToken ? 'eye-outline' : 'globe-outline'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {trip.title || destination}
          </Text>
          <View style={styles.publicBadgeRow}>
            <Ionicons name={badgeIcon} size={12} color={isEdit ? '#2563EB' : colors.primary} />
            <Text style={[styles.publicBadgeText, isEdit && { color: '#2563EB' }]}>{badgeLabel}</Text>
          </View>
        </View>
        <View style={styles.navRightRow}>
          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={() => setShowMap(!showMap)}
            activeOpacity={0.8}
          >
            <Ionicons name={showMap ? 'list' : 'map'} size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Cover */}
        <View style={styles.heroCard}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Badge label={isEdit ? 'Collaborative' : isSharedToken ? 'Shared' : 'Public Guide'} variant={isEdit ? 'info' : 'success'} size="sm" />
            <Text style={styles.heroTitle}>{trip.title || destination}</Text>
            <Text style={styles.heroDates}>
              {trip.dates || formatTripDateRange(trip.startDate, trip.endDate)}
            </Text>
          </View>
        </View>

        {/* Sharing Mode Info Banner */}
        {isEdit ? (
          <View style={styles.bannerEdit}>
            <Ionicons name="create-outline" size={20} color="#2563EB" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitleEdit}>Can-Edit Shared Itinerary</Text>
              <Text style={styles.bannerTextEdit}>
                You have collaborative access to this trip. Tap "Copy & Edit in My Trips" below to import a customizable copy into your personal library.
              </Text>
            </View>
          </View>
        ) : isSharedToken ? (
          <View style={styles.bannerView}>
            <Ionicons name="eye-outline" size={20} color="#059669" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitleView}>View-Only Shared Itinerary</Text>
              <Text style={styles.bannerTextView}>
                This trip is shared in read-only mode. You can explore all days, stops, and maps, or save an independent copy to your library.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Creator Info Card */}
        {effectiveOwner.username ? (
          <TouchableOpacity
            style={styles.creatorCard}
            onPress={() => navigation.navigate('UserProfile', { username: effectiveOwner.username })}
            activeOpacity={0.8}
          >
            <View style={styles.creatorAvatar}>
              {effectiveOwner.profileImage ? (
                <Image source={{ uri: effectiveOwner.profileImage }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitials}>
                  {(effectiveOwner.name || effectiveOwner.username || 'U').slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.creatorMeta}>
              <Text style={styles.creatorName}>{effectiveOwner.name || effectiveOwner.displayName || effectiveOwner.username}</Text>
              <Text style={styles.creatorHandle}>@{effectiveOwner.username}</Text>
            </View>
            <View style={styles.viewProfileBtn}>
              <Text style={styles.viewProfileText}>View Profile</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Map View toggle */}
        {showMap && (
          <View style={styles.mapContainer}>
            <InteractiveMap
              trip={trip}
              selectedDayId="all"
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={(id) => setSelectedPlaceId(id)}
              showRoutes={true}
            />
          </View>
        )}

        {/* Days & Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionHeading}>Trip Itinerary ({days.length} Days)</Text>

          {days.map((day, dayIdx) => {
            const items = (day.items || []).filter((item) => item.type !== 'note' && item.type !== 'checklist')
            const dayColor = day.color || getDayColor(dayIdx)

            return (
              <Card key={day.id || dayIdx} style={styles.dayCard} padding="md">
                <View style={styles.dayHeader}>
                  <View style={[styles.dayColorDot, { backgroundColor: dayColor }]} />
                  <Text style={styles.dayTitle}>{day.label || `Day ${dayIdx + 1}`}</Text>
                  <Text style={styles.stopCount}>{items.length} stops</Text>
                </View>

                {items.length === 0 ? (
                  <Text style={styles.emptyDayText}>No scheduled places for this day.</Text>
                ) : (
                  items.map((item, itemIdx) => {
                    const placeImg = getPlaceImage(item.id, item.category, item.title || item.name)
                    return (
                      <View key={item.id ? `${day.id}-${item.id}` : `pub-day-${dayIdx}-item-${itemIdx}`} style={styles.stopRow}>
                        <View style={styles.stopLeftCol}>
                          <View style={[styles.stopIndexBadge, { backgroundColor: dayColor }]}>
                            <Text style={styles.stopIndexText}>{itemIdx + 1}</Text>
                          </View>
                          {itemIdx < items.length - 1 && <View style={styles.stopConnectorLine} />}
                        </View>

                        <View style={styles.stopBody}>
                          <View style={styles.stopCardInner}>
                            <Image source={{ uri: placeImg }} style={styles.stopThumb} />
                            <View style={styles.stopInfo}>
                              <Text style={styles.stopTitle} numberOfLines={1}>
                                {item.title || item.name}
                              </Text>
                              {item.subtitle || item.address ? (
                                <Text style={styles.stopAddress} numberOfLines={1}>
                                  {item.subtitle || item.address}
                                </Text>
                              ) : null}
                              {item.startTime ? (
                                <View style={styles.timeTag}>
                                  <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                                  <Text style={styles.timeText}>{formatTime12h(item.startTime)}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          {item.note ? <Text style={styles.stopNote}>{item.note}</Text> : null}
                        </View>
                      </View>
                    )
                  })
                )}
              </Card>
            )
          })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Sticky Bottom Action Bar: Copy / Import to My Trips */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.copyBtn, isEdit && styles.copyBtnEdit]}
          onPress={handleCopyTrip}
          disabled={copying}
          activeOpacity={0.88}
        >
          {copying ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <>
              <Ionicons
                name={isEdit ? 'copy-outline' : 'bookmark-outline'}
                size={18}
                color={colors.textWhite}
              />
              <Text style={styles.copyBtnText}>
                {isEdit ? 'Copy & Edit in My Trips' : 'Save Copy to My Trips'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleCol: {
    flex: 1,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  publicBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  publicBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  navRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroContent: {
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textWhite,
  },
  heroDates: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  bannerEdit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
  },
  bannerTitleEdit: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 2,
  },
  bannerTextEdit: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1E40AF',
  },
  bannerView: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
  },
  bannerTitleView: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 2,
  },
  bannerTextView: {
    fontSize: 12,
    lineHeight: 18,
    color: '#065F46',
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  creatorMeta: {
    flex: 1,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  creatorHandle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewProfileText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  mapContainer: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  timelineSection: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayCard: {
    backgroundColor: colors.surface,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  stopCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyDayText: {
    fontSize: 13,
    color: colors.textTertiary,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  stopRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stopLeftCol: {
    alignItems: 'center',
    width: 28,
    marginRight: 8,
  },
  stopIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textWhite,
  },
  stopConnectorLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.borderLight,
    marginVertical: 4,
  },
  stopBody: {
    flex: 1,
  },
  stopCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    padding: 8,
    gap: 10,
  },
  stopThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  stopInfo: {
    flex: 1,
  },
  stopTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stopAddress: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  timeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stopNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  copyBtnEdit: {
    backgroundColor: '#2563EB',
  },
  copyBtnText: {
    ...typography.button,
    color: colors.textWhite,
    fontWeight: '700',
    fontSize: 15,
  },
})

export default PublicTripScreen
