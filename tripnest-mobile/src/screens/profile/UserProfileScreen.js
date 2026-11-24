import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
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
import apiService from '../../api/apiService'
import { getDestinationImage } from '../../constants/images'
import { resolveTripDestinationCity, formatTripDateRange } from '../../utils/tripUtils'
import {
  formatDisplayName,
  formatUsername,
  getInitials,
  buildProfileLink,
} from '../../utils/profileUtils'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import { SafeImage } from '../../components/common/SafeImage'

export function UserProfileScreen({ route, navigation }) {
  const { username: rawUsername } = route?.params || {}
  const username = String(rawUsername || '').trim().replace(/^@/, '')
  const { user: currentUser, token } = useApp()

  const [targetUser, setTargetUser] = useState(null)
  const [publicTrips, setPublicTrips] = useState([])
  const [followStats, setFollowStats] = useState({
    followerCount: 0,
    followingCount: 0,
    isFollowing: false,
  })

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)

  const isOwnProfile =
    Boolean(currentUser?.username) &&
    currentUser.username.toLowerCase().replace(/^@/, '') === username.toLowerCase()

  const loadUserData = useCallback(async () => {
    if (!username) {
      setError('No username specified.')
      setLoading(false)
      return
    }

    try {
      setError(null)
      // 1. Fetch public profile
      let userRes = null
      try {
        userRes = await apiService.getPublicUserByUsername(username)
      } catch (err) {
        console.warn('Could not fetch user by username:', err)
      }

      if (userRes?.user) {
        setTargetUser(userRes.user)
      } else {
        setError(`The traveler @${username} does not exist or is unavailable.`)
        setTargetUser(null)
        setLoading(false)
        return
      }

      // 2. Fetch follow status
      try {
        const followRes = await apiService.getFollowStatus(username, token)
        if (followRes) {
          setFollowStats({
            followerCount: followRes.followersCount ?? followRes.followerCount ?? 0,
            followingCount: followRes.followingCount ?? 0,
            isFollowing: Boolean(followRes.isFollowing),
          })
        }
      } catch (err) {
        console.warn('Could not fetch follow status:', err)
      }

      // 3. Fetch public trips
      try {
        const tripsRes = await apiService.getPublicTripsByUsername(username)
        if (tripsRes?.trips && Array.isArray(tripsRes.trips)) {
          setPublicTrips(tripsRes.trips)
        } else {
          setPublicTrips([])
        }
      } catch (err) {
        console.warn('Could not fetch public trips:', err)
        setPublicTrips([])
      }
    } catch (err) {
      setError(err?.message || 'Failed to load user profile.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [username, token])

  useEffect(() => {
    setLoading(true)
    loadUserData()
  }, [loadUserData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadUserData()
  }, [loadUserData])

  async function handleToggleFollow() {
    if (followLoading) return
    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please log in to follow travelers on TripNest.')
      return
    }

    setFollowLoading(true)
    try {
      if (followStats.isFollowing) {
        await apiService.unfollowUser(token, username)
        setFollowStats((prev) => ({
          ...prev,
          isFollowing: false,
          followerCount: Math.max(0, prev.followerCount - 1),
        }))
      } else {
        await apiService.followUser(token, username)
        setFollowStats((prev) => ({
          ...prev,
          isFollowing: true,
          followerCount: prev.followerCount + 1,
        }))
      }
    } catch (err) {
      Alert.alert('Action Failed', err?.message || 'Could not update follow status.')
    } finally {
      setFollowLoading(false)
    }
  }

  async function handleShare() {
    try {
      const link = buildProfileLink(targetUser || { username })
      const name = formatDisplayName(targetUser || { username })
      await Share.share({
        title: `TripNest Profile - ${name}`,
        message: `Check out ${name}'s travel itineraries on TripNest: ${link}`,
        url: link,
      })
    } catch {
      // Ignored
    }
  }

  const displayName = formatDisplayName(targetUser || { username })
  const handleFormatted = formatUsername(targetUser || { username })
  const bio = targetUser?.bio || 'Exploring destinations across Pakistan on TripNest.'
  const initials = getInitials(targetUser || { username })

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          @{username}
        </Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading traveler profile...</Text>
        </View>
      ) : error && !targetUser ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorTitle}>Profile Unavailable</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Button title="Try Again" pill onPress={loadUserData} style={{ marginTop: 14 }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Identity Section */}
          <View style={styles.identityContainer}>
            <View style={styles.identityTopRow}>
              {targetUser?.profileImage ? (
                <Image source={{ uri: targetUser.profileImage }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}

              <View style={styles.profileActionsRow}>
                {isOwnProfile ? (
                  <View style={styles.ownProfileBadge}>
                    <Text style={styles.ownProfileBadgeText}>Your Profile</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      followStats.isFollowing ? styles.followingBtn : styles.notFollowingBtn,
                    ]}
                    onPress={handleToggleFollow}
                    disabled={followLoading}
                    activeOpacity={0.8}
                  >
                    {followLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={followStats.isFollowing ? colors.textPrimary : colors.textWhite}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name={followStats.isFollowing ? 'checkmark' : 'person-add-outline'}
                          size={15}
                          color={followStats.isFollowing ? colors.textPrimary : colors.textWhite}
                        />
                        <Text
                          style={[
                            styles.followBtnText,
                            followStats.isFollowing
                              ? styles.followingBtnText
                              : styles.notFollowingBtnText,
                          ]}
                        >
                          {followStats.isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.nameSection}>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userHandle}>{handleFormatted}</Text>
              <Text style={styles.userBio}>{bio}</Text>
            </View>

            {/* Traveler Stats Card */}
            <Card style={styles.statsCard}>
              <View style={styles.statCol}>
                <Text style={styles.statNumber}>{followStats.followerCount}</Text>
                <Text style={styles.statLabel}>FOLLOWERS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statNumber}>{followStats.followingCount}</Text>
                <Text style={styles.statLabel}>FOLLOWING</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>
                  {publicTrips.length}
                </Text>
                <Text style={styles.statLabel}>PUBLIC TRIPS</Text>
              </View>
            </Card>
          </View>

          {/* Public Itineraries Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shared Itineraries</Text>
            <Text style={styles.sectionSub}>Public travel plans by @{username}</Text>
          </View>

          {/* Public Trips List */}
          <View style={styles.tripsList}>
            {publicTrips.length === 0 ? (
              <View style={styles.emptyTripsBox}>
                <Ionicons name="map-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyTripsTitle}>No public trips published yet</Text>
                <Text style={styles.emptyTripsSub}>
                  When @{username} shares travel itineraries publicly, they will appear here.
                </Text>
              </View>
            ) : (
              publicTrips.map((trip, idx) => {
                const tripId = trip.id || trip.tripId
                const destinationCity = resolveTripDestinationCity(trip)
                const title = trip.title || trip.name || `Trip to ${destinationCity}`
                const validCustomCover =
                  trip.coverImage &&
                  typeof trip.coverImage === 'string' &&
                  trip.coverImage.startsWith('http') &&
                  !trip.coverImage.includes('1764697758403')
                    ? trip.coverImage
                    : null
                const cityImage = getDestinationImage(destinationCity)
                const cover = validCustomCover || cityImage
                const days = trip.daysCount || (trip.days ? trip.days.length : null)
                const stops = trip.stopsCount || (trip.placeCount ?? 0)
                const dateText = formatTripDateRange(trip.startDate, trip.endDate) || (trip.startDate ? trip.startDate : '')
                const tripKey = `pub-trip-${tripId || idx}`

                return (
                  <TouchableOpacity
                    key={tripKey}
                    style={styles.tripCard}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('PublicTrip', { tripId })}
                  >
                    <View style={styles.tripCardImageContainer}>
                      <SafeImage
                        source={{ uri: cover }}
                        fallbackUri={cityImage}
                        style={styles.tripImage}
                        resizeMode="cover"
                      />
                      <View style={styles.tripBadgeRow}>
                        <View style={styles.publicBadgePill}>
                          <Text style={styles.publicBadgePillText}>Public</Text>
                        </View>
                        <View style={styles.destinationPillBadge}>
                          <Ionicons name="location-sharp" size={12} color="#0D9488" />
                          <Text style={styles.destinationPillText} numberOfLines={1}>
                            {destinationCity}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.tripCardBody}>
                      <Text style={styles.tripTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.tripMeta} numberOfLines={1}>
                        {dateText ? `${dateText} • ` : ''}{days ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Itinerary'}
                      </Text>
                      <Text style={styles.tripSubMeta} numberOfLines={1}>
                        📍 {destinationCity} • {stops} {stops === 1 ? 'place' : 'places'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    ...typography.subtitle1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  shareBtn: {
    padding: 6,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 12,
  },
  errorTitle: {
    ...typography.subtitle1,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
  },
  errorSub: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  identityContainer: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceSubtle,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textWhite,
  },
  profileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownProfileBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ownProfileBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  notFollowingBtn: {
    backgroundColor: colors.primary,
  },
  followingBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notFollowingBtnText: {
    color: colors.textWhite,
  },
  followingBtnText: {
    color: colors.textPrimary,
  },
  nameSection: {
    marginTop: 12,
  },
  userName: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  userHandle: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  userBio: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
  },
  statCol: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderLight,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tripsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tripCardImageContainer: {
    height: 148,
    width: '100%',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  tripImage: {
    width: '100%',
    height: '100%',
  },
  tripBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  publicBadgePill: {
    backgroundColor: 'rgba(238, 242, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  publicBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  destinationPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: '55%',
  },
  destinationPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  tripCardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  tripMeta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  tripSubMeta: {
    fontSize: 12.5,
    color: '#0E442B',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyTripsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  emptyTripsTitle: {
    ...typography.subtitle2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptyTripsSub: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
})

export default UserProfileScreen
