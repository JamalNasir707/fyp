import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
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
import apiService from '../../api/apiService'
import { getDestinationImage } from '../../constants/images'
import { resolveTripDestinationCity, formatTripDateRange } from '../../utils/tripUtils'
import { BRANDING_ASSETS } from '../../../assets/branding'
import {
  formatDisplayName,
  formatUsername,
  getInitials,
  buildProfileLink,
  createProfileDraft,
  AVAILABLE_TRAVEL_INTERESTS,
  TRAVEL_STYLE_OPTIONS,
  BUDGET_TIER_OPTIONS,
} from '../../utils/profileUtils'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import ModalSheet from '../../components/common/ModalSheet'
import { SafeImage } from '../../components/common/SafeImage'

export function ProfileScreen({ navigation }) {
  const {
    user,
    token,
    savedTrips,
    activeTrip,
    setActiveTrip,
    logout,
    updateUserProfile,
    preferences,
    updatePreference,
  } = useApp()
  const [activeMainTab, setActiveMainTab] = useState('itineraries') // 'itineraries' | 'preferences' | 'account'
  const [tripFilter, setTripFilter] = useState('all') // 'all' | 'personal' | 'shared'
  const [menuModalVisible, setMenuModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Social & Follow Stats
  const [followStats, setFollowStats] = useState({ followerCount: 0, followingCount: 0 })
  const [userSearchModalVisible, setUserSearchModalVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)

  // Edit Profile Modal
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [profileImageInput, setProfileImageInput] = useState('')
  const [homeCityInput, setHomeCityInput] = useState('Islamabad')
  const [travelStyleInput, setTravelStyleInput] = useState('Balanced')
  const [travelInterestsInput, setTravelInterestsInput] = useState([])
  const [savingProfile, setSavingProfile] = useState(false)

  const isAuthenticated = Boolean(user && token && user.role !== 'guest')
  const isAdmin = user?.role === 'admin'

  const loadFollowStats = useCallback(() => {
    if (!isAuthenticated || !user) return
    const cleanUname = (user.username || '').trim().replace(/^@/, '')
    if (cleanUname) {
      apiService
        .getFollowStatus(cleanUname, token)
        .then((res) => {
          if (res) {
            setFollowStats({
              followerCount: res.followersCount ?? res.followerCount ?? 0,
              followingCount: res.followingCount ?? 0,
            })
          }
        })
        .catch(() => {})
    }
  }, [isAuthenticated, user, token])

  useEffect(() => {
    if (user) {
      const draft = createProfileDraft(user)
      setNameInput(draft.name)
      setUsernameInput(draft.username)
      setEmailInput(draft.email || '')
      setBioInput(draft.bio)
      setProfileImageInput(draft.profileImage || '')
      setHomeCityInput(draft.homeCity || '')
      setTravelStyleInput(draft.travelStyle || 'Balanced')
      setTravelInterestsInput(draft.travelInterests || [])
      loadFollowStats()
    }
  }, [user, loadFollowStats])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      loadFollowStats()
    } finally {
      setRefreshing(false)
    }
  }, [loadFollowStats])

  function toggleInterest(interest) {
    setTravelInterestsInput((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest)
      } else {
        return [...prev, interest]
      }
    })
  }

  // Search users for traveler discovery
  useEffect(() => {
    let active = true
    if (!userSearchModalVisible) {
      setSearchQuery('')
      setSearchResults([])
      return
    }

    setIsSearchingUsers(true)
    const timeout = setTimeout(() => {
      apiService
        .searchUsers(searchQuery || '', 15)
        .then((res) => {
          if (active && res?.users) {
            setSearchResults(res.users)
          }
        })
        .catch(() => {
          if (active) setSearchResults([])
        })
        .finally(() => {
          if (active) setIsSearchingUsers(false)
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [searchQuery, userSearchModalVisible])

  const allPlacesCount = useMemo(() => {
    return (savedTrips || []).reduce((acc, t) => {
      const stops = (t.days || []).flatMap((d) => d.items || []).length
      const pool = (t.placesPool || []).length
      return acc + stops + pool
    }, 0)
  }, [savedTrips])

  const filteredTrips = useMemo(() => {
    return (savedTrips || []).filter((t) => {
      if (tripFilter === 'personal') return !t.isTripmate
      if (tripFilter === 'shared') return Boolean(t.isTripmate)
      return true
    })
  }, [savedTrips, tripFilter])

  async function handleSaveProfile() {
    const cleanName = nameInput.trim()
    const cleanUsername = usernameInput.trim().replace(/^@/, '')

    if (!cleanName) {
      Alert.alert('Required Field', 'Please enter your display name.')
      return
    }
    if (!cleanUsername) {
      Alert.alert('Required Field', 'Please enter a valid username.')
      return
    }

    setSavingProfile(true)
    try {
      await updateUserProfile({
        name: cleanName,
        displayName: cleanName,
        username: cleanUsername,
        email: emailInput.trim(),
        bio: bioInput.trim(),
        profileImage: profileImageInput.trim() || null,
        homeCity: homeCityInput.trim(),
        travelStyle: travelStyleInput,
        travelInterests: travelInterestsInput,
      })
      setEditModalVisible(false)
      Alert.alert('Profile Updated', 'Your profile changes have been saved successfully.')
    } catch (err) {
      Alert.alert('Save Failed', err.message || 'Could not save profile changes. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  function handleLogout() {
    setMenuModalVisible(false)
    Alert.alert(
      'Sign Out of TripNest',
      'Are you sure you want to sign out of your account on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout()
          },
        },
      ]
    )
  }

  async function handleShareProfile() {
    if (!isAuthenticated || !user) {
      Alert.alert('TripNest Mobile', 'Sign in to generate and share your personalized traveler link.')
      return
    }
    const link = buildProfileLink(user)
    const displayName = formatDisplayName(user)
    try {
      await Share.share({
        title: `${displayName}'s TripNest Profile`,
        message: `Check out ${displayName}'s travel profile and curated itineraries on TripNest: ${link}`,
        url: link,
      })
    } catch (err) {
      console.warn('Share profile error:', err)
    }
  }

  // =========================================================================
  // GUEST / UNAUTHENTICATED STATE
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.brandBadge}>
            {BRANDING_ASSETS?.logoMark ? (
              <Image
                source={BRANDING_ASSETS.logoMark}
                style={styles.headerLogoImg}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.brandBadgeText}>TripNest Profile</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.menuIconBtn}
              onPress={() => setMenuModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Guest Identity Hero Card */}
          <View style={styles.guestHeroCard}>
            <View style={styles.guestAvatarCircle}>
              <Ionicons name="person-circle-outline" size={64} color={colors.primary} />
            </View>

            <View style={styles.guestBadgePill}>
              <Ionicons name="compass" size={13} color={colors.primary} />
              <Text style={styles.guestBadgePillText}>Guest Explorer</Text>
            </View>

            <Text style={styles.guestTitle}>Welcome to TripNest</Text>
            <Text style={styles.guestSubtitle}>
              Sign in or create an account to customize your traveler profile, share public itineraries, sync your trips across devices, and connect with fellow explorers.
            </Text>

            <View style={styles.guestActionsCol}>
              <Button
                title="Sign In / Create Account"
                iconName="log-in-outline"
                pill
                onPress={() => logout()}
                style={{ width: '100%', marginBottom: 10 }}
              />
              <Button
                title="Plan a New Trip"
                variant="outline"
                iconName="add-outline"
                pill
                onPress={() => navigation.navigate('HomeTab')}
                style={{ width: '100%' }}
              />
            </View>
          </View>

          {/* Local Device Trips Section (if any trips created on device) */}
          {savedTrips.length > 0 && (
            <View style={styles.guestTripsSection}>
              <View style={styles.guestTripsHeader}>
                <Text style={styles.sectionHeading}>Local Device Trips</Text>
                <Text style={styles.sectionSubheading}>
                  {savedTrips.length} {savedTrips.length === 1 ? 'trip' : 'trips'} saved on this device
                </Text>
              </View>

              {savedTrips.map((trip, idx) => {
                const destinationName = (trip.destination || trip.title || trip.name || 'Pakistan').trim()
                const coverImage = trip.coverImage || getDestinationImage(destinationName)
                const tripKey = `guest-trip-${trip.id || trip.tripId || idx}`
                return (
                  <TouchableOpacity
                    key={tripKey}
                    style={styles.profileTripCard}
                    onPress={() => {
                      setActiveTrip(trip)
                      navigation.navigate('TripDetail', { tripId: trip.id || trip.tripId })
                    }}
                    activeOpacity={0.88}
                  >
                    <SafeImage source={{ uri: coverImage }} style={styles.tripCardImage} resizeMode="cover" />
                    <View style={styles.tripCardOverlay}>
                      <View style={styles.tripCardTopRow}>
                        <View style={styles.destinationPillBadge}>
                          <Ionicons name="location-sharp" size={12} color="#0D9488" />
                          <Text style={styles.destinationPillText} numberOfLines={1}>
                            {destinationName}
                          </Text>
                        </View>
                        <View style={styles.tripDaysPill}>
                          <Ionicons name="time-outline" size={12} color={colors.textWhite} />
                          <Text style={styles.tripDaysPillText}>{(trip.days || []).length} days</Text>
                        </View>
                      </View>

                      <View style={styles.tripCardBottom}>
                        <Text style={styles.tripCardTitle} numberOfLines={1}>
                          {trip.title || trip.name}
                        </Text>
                        <Text style={styles.tripCardMeta}>
                          📍 {destinationName} • {(trip.days?.flatMap((d) => d.items || []) || []).length} stops
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* Quick Options for Guest */}
          <View style={styles.guestOptionsContainer}>
            <TouchableOpacity
              style={styles.guestOptionRow}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <View style={styles.guestOptionLeft}>
                <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.guestOptionText}>Settings & Display Preferences</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guestOptionRow}
              onPress={() => setUserSearchModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.guestOptionLeft}>
                <Ionicons name="people-outline" size={20} color={colors.textPrimary} />
                <Text style={styles.guestOptionText}>Explore Community Travelers</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Menu Sheet for Guest */}
        <ModalSheet
          visible={menuModalVisible}
          onClose={() => setMenuModalVisible(false)}
          title="Account & Tools"
          subtitle="TripNest Mobile Options"
        >
          <View style={styles.menuSheetContent}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setMenuModalVisible(false)
                logout()
              }}
            >
              <Ionicons name="log-in-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuRowText, { color: colors.primary, fontWeight: '700' }]}>
                Sign In / Register
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setMenuModalVisible(false)
                navigation.navigate('Settings')
              }}
            >
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.menuRowText}>Settings & Preferences</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setMenuModalVisible(false)
                Alert.alert(
                  'About TripNest',
                  'TripNest Mobile v1.0.0 (Parity Edition)\n\nDay-wise itinerary planning, TSP route sequencing, OSRM driving routes, and offline travel catalog.'
                )
              }}
            >
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.menuRowText}>About TripNest</Text>
              <Badge label="v1.0" variant="primary" size="sm" />
            </TouchableOpacity>
          </View>
        </ModalSheet>

        {/* Discover Travelers Modal (usable by guest as well) */}
        <ModalSheet
          visible={userSearchModalVisible}
          onClose={() => setUserSearchModalVisible(false)}
          title="Discover Travelers"
          subtitle="Search public travelers on TripNest"
        >
          <View style={styles.searchModalContent}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or @handle..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {Boolean(searchQuery) && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {isSearchingUsers ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : searchResults.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ ...typography.caption, color: colors.textTertiary }}>
                  {searchQuery ? 'No matching travelers found.' : 'Search for travelers on TripNest.'}
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.username || item.id}
                    style={styles.travelerRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setUserSearchModalVisible(false)
                      navigation.navigate('UserProfile', { username: item.username })
                    }}
                  >
                    <View style={styles.travelerAvatar}>
                      {item.profileImage ? (
                        <Image source={{ uri: item.profileImage }} style={styles.travelerAvatarImg} />
                      ) : (
                        <Text style={styles.travelerAvatarText}>{getInitials(item)}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.travelerName}>{formatDisplayName(item)}</Text>
                      <Text style={styles.travelerHandle}>{formatUsername(item)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </ModalSheet>
      </SafeAreaView>
    )
  }

  // =========================================================================
  // AUTHENTICATED USER STATE
  // =========================================================================
  const displayName = formatDisplayName(user)
  const usernameFormatted = formatUsername(user)
  const initials = getInitials(user)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. TOP APP BAR */}
      <View style={styles.topHeader}>
        {navigation.canGoBack() ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.brandBadge}>
            {BRANDING_ASSETS?.logoMark ? (
              <Image
                source={BRANDING_ASSETS.logoMark}
                style={styles.headerLogoImg}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.brandBadgeText}>Traveler Profile</Text>
          </View>
        )}

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.menuIconBtn}
            onPress={() => setMenuModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* 2. PROFILE IDENTITY SECTION */}
        <View style={styles.identityContainer}>
          <View style={styles.identityTopRow}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.85}
            >
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="pencil" size={10} color={colors.textWhite} />
              </View>
            </TouchableOpacity>

            <View style={styles.profileActionsRow}>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.adminBadgeBtn}
                  onPress={() => navigation.navigate('Admin')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-checkmark" size={13} color={colors.textWhite} />
                  <Text style={styles.adminBadgeBtnText}>Admin</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.editProfilePill}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={styles.editProfilePillText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sharePill}
                onPress={handleShareProfile}
                activeOpacity={0.85}
              >
                <Ionicons name="share-social-outline" size={14} color={colors.textPrimary} />
                <Text style={styles.sharePillText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.discoverPill}
                onPress={() => setUserSearchModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.nameSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.userName}>{displayName}</Text>
              {isAdmin && <Badge label="ADMIN" variant="primary" size="sm" />}
            </View>
            <Text style={styles.userHandle}>{usernameFormatted}</Text>
            {user?.email ? (
              <Text style={styles.userEmail}>{user.email}</Text>
            ) : null}
            <Text style={styles.userBio}>
              {user?.bio || 'Exploring destinations across Pakistan with TripNest.'}
            </Text>
          </View>

          {/* Social Stats Row */}
          <View style={styles.socialStatsRow}>
            <View style={styles.socialStatItem}>
              <Text style={styles.socialStatNumber}>{followStats.followerCount}</Text>
              <Text style={styles.socialStatLabel}>Followers</Text>
            </View>
            <View style={styles.socialStatDot} />
            <View style={styles.socialStatItem}>
              <Text style={styles.socialStatNumber}>{followStats.followingCount}</Text>
              <Text style={styles.socialStatLabel}>Following</Text>
            </View>
            <View style={styles.socialStatDot} />
            <TouchableOpacity
              style={styles.findTravelersBtn}
              onPress={() => setUserSearchModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={12} color={colors.primary} />
              <Text style={styles.findTravelersText}>Discover Community</Text>
            </TouchableOpacity>
          </View>

          {/* Traveler Stats Card */}
          <Card style={styles.statsCard}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{savedTrips.length}</Text>
              <Text style={styles.statLabel}>TRIPS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{allPlacesCount}</Text>
              <Text style={styles.statLabel}>PLACES</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: colors.accentDark }]}>
                {(activeTrip?.placesPool || []).length}
              </Text>
              <Text style={styles.statLabel}>WISHLIST</Text>
            </View>
          </Card>

          {/* Traveler Style & Interests Card (Website Parity) */}
          <Card style={styles.interestsCard} padding="md">
            <View style={styles.interestsHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.interestsCardTitle}>Traveler Style & Interests</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.7}
                style={styles.interestsEditBtn}
              >
                <Ionicons name="pencil" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.interestsEditText}>Customize</Text>
              </TouchableOpacity>
            </View>

            {/* Travel Meta Badges: Home city + Style */}
            {(user?.homeCity || user?.travelStyle || user?.budgetTier) ? (
              <View style={styles.travelMetaRow}>
                {Boolean(user?.homeCity) && (
                  <View style={styles.metaBadge}>
                    <Ionicons name="location-outline" size={13} color={colors.primary} />
                    <Text style={styles.metaBadgeText}>{user.homeCity}</Text>
                  </View>
                )}
                {Boolean(user?.travelStyle) && (
                  <View style={styles.metaBadge}>
                    <Ionicons name="compass-outline" size={13} color={colors.accentDark} />
                    <Text style={styles.metaBadgeText}>{user.travelStyle}</Text>
                  </View>
                )}
                {Boolean(user?.budgetTier) && (
                  <View style={styles.metaBadge}>
                    <Ionicons name="wallet-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.metaBadgeText}>{user.budgetTier}</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Interests Cloud or Empty Prompt */}
            {Array.isArray(user?.travelInterests) && user.travelInterests.length > 0 ? (
              <View style={styles.tagsCloud}>
                {user.travelInterests.map((interest) => (
                  <View key={interest} style={styles.interestTag}>
                    <Text style={styles.interestTagText}>{interest}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyInterestsPrompt}>
                <Ionicons name="sparkles-outline" size={18} color={colors.textTertiary} />
                <Text style={styles.emptyInterestsText}>
                  No travel interests selected yet. Tap Customize to personalize your recommendations.
                </Text>
              </View>
            )}
          </Card>

          {/* 3. MAIN PROFILE TABS SWITCHER */}
          <View style={styles.profileTabsBar}>
            {[
              { id: 'itineraries', label: 'Itineraries', icon: 'airplane-outline' },
              { id: 'preferences', label: 'Preferences', icon: 'options-outline' },
              { id: 'account', label: 'Account', icon: 'person-circle-outline' },
            ].map((tab) => {
              const isActive = activeMainTab === tab.id
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.profileTabBtn, isActive && styles.profileTabBtnActive]}
                  onPress={() => setActiveMainTab(tab.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={isActive ? colors.primary : colors.textTertiary}
                  />
                  <Text style={[styles.profileTabBtnText, isActive && styles.profileTabBtnTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ========================================================= */}
        {/* TAB 1: ITINERARIES */}
        {/* ========================================================= */}
        {activeMainTab === 'itineraries' && (
          <View>
            <View style={styles.tripsSectionHeader}>
              <View>
                <Text style={styles.sectionHeading}>My Itineraries</Text>
                <Text style={styles.sectionSubheading}>
                  {savedTrips.length} {savedTrips.length === 1 ? 'trip' : 'trips'} planned
                </Text>
              </View>

              <View style={styles.tripFilterRow}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'personal', label: 'Personal' },
                  { id: 'shared', label: 'Shared' },
                ].map((f) => {
                  const isSelected = tripFilter === f.id
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setTripFilter(f.id)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <View style={styles.tabContentContainer}>
              {filteredTrips.length === 0 ? (
                <View style={styles.emptyTabWrapper}>
                  <Ionicons name="airplane-outline" size={44} color={colors.textTertiary} />
                  <Text style={styles.emptyTabTitle}>No trips found</Text>
                  <Text style={styles.emptyTabSub}>
                    {tripFilter === 'all'
                      ? 'Start planning your first itinerary with places and dates.'
                      : `No ${tripFilter} trips scheduled.`}
                  </Text>
                  <Button
                    title="Plan a trip"
                    pill
                    onPress={() => navigation.navigate('HomeTab')}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : (
                filteredTrips.map((trip, idx) => {
                  const destinationCity = resolveTripDestinationCity(trip)
                  const validCustomCover =
                    trip.coverImage &&
                    typeof trip.coverImage === 'string' &&
                    trip.coverImage.startsWith('http') &&
                    !trip.coverImage.includes('1764697758403')
                      ? trip.coverImage
                      : null
                  const cityImage = getDestinationImage(destinationCity)
                  const coverImage = validCustomCover || cityImage
                  const tripKey = `profile-trip-${trip.isTripmate ? 'shared' : 'personal'}-${trip.id || trip.tripId || idx}`
                  const title = trip.title || trip.name || `Trip to ${destinationCity}`
                  const dateRange = formatTripDateRange(trip.startDate, trip.endDate) || trip.dates || ''
                  const daysCount = (trip.days || []).length || (trip.daysCount ?? 1)
                  const stopCount = (trip.days?.flatMap((d) => d.items || []) || []).length + ((trip.placesPool || []).length)
                  return (
                    <TouchableOpacity
                      key={tripKey}
                      style={styles.profileTripCard}
                      onPress={() => {
                        setActiveTrip(trip)
                        navigation.navigate('TripDetail', { tripId: trip.id || trip.tripId })
                      }}
                      activeOpacity={0.88}
                    >
                      <View style={styles.tripCardImageContainer}>
                        <SafeImage
                          source={{ uri: coverImage }}
                          fallbackUri={cityImage}
                          style={styles.tripCardImage}
                          resizeMode="cover"
                        />
                        <View style={styles.tripCardTopRow}>
                          <View style={[styles.badgePill, trip.isTripmate && styles.badgePillTripmate]}>
                            <Text style={[styles.badgePillText, trip.isTripmate && styles.badgePillTextTripmate]}>
                              {trip.isTripmate ? '🤝 Shared Tripmate' : 'Saved'}
                            </Text>
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
                        <Text style={styles.tripCardTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.tripCardMeta} numberOfLines={1}>
                          {dateRange ? `${dateRange} • ` : ''}{daysCount} {daysCount === 1 ? 'day' : 'days'}
                        </Text>
                        <Text style={styles.tripCardSubMeta} numberOfLines={1}>
                          📍 {destinationCity} • {stopCount} {stopCount === 1 ? 'place' : 'places'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })
              )}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PREFERENCES (Integrated directly into Profile) */}
        {/* ========================================================= */}
        {activeMainTab === 'preferences' && (
          <View style={styles.preferencesTabContainer}>
            <Card style={styles.prefCard} padding="lg">
              <View style={styles.prefCardHeader}>
                <Ionicons name="options-outline" size={18} color={colors.primary} />
                <Text style={styles.prefCardTitle}>Display & Unit Standards</Text>
              </View>

              {/* Date Format */}
              <Text style={styles.prefFieldLabel}>Date Display Format</Text>
              <View style={styles.pillGroup}>
                {[
                  { key: 'month-day', label: 'Month / Day' },
                  { key: 'day-month', label: 'Day / Month' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.choicePill,
                      (preferences?.dateFormat || 'month-day') === item.key && styles.choicePillActive,
                    ]}
                    onPress={() => updatePreference('dateFormat', item.key)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        (preferences?.dateFormat || 'month-day') === item.key && styles.choicePillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Distance Unit */}
              <Text style={styles.prefFieldLabel}>Distance Units</Text>
              <View style={styles.pillGroup}>
                {[
                  { key: 'kilometers', label: 'Kilometers (km)' },
                  { key: 'miles', label: 'Miles (mi)' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.choicePill,
                      (preferences?.distanceFormat || 'kilometers') === item.key && styles.choicePillActive,
                    ]}
                    onPress={() => updatePreference('distanceFormat', item.key)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        (preferences?.distanceFormat || 'kilometers') === item.key && styles.choicePillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Time Format */}
              <Text style={styles.prefFieldLabel}>Time Clock</Text>
              <View style={styles.pillGroup}>
                {[
                  { key: '12-hour', label: '12-Hour (10:00 AM)' },
                  { key: '24-hour', label: '24-Hour (10:00)' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.choicePill,
                      (preferences?.timeFormat || '12-hour') === item.key && styles.choicePillActive,
                    ]}
                    onPress={() => updatePreference('timeFormat', item.key)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        (preferences?.timeFormat || '12-hour') === item.key && styles.choicePillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            <Card style={styles.prefCard} padding="lg">
              <View style={styles.prefCardHeader}>
                <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} />
                <Text style={styles.prefCardTitle}>Planner Intelligence</Text>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Expert Travel Tips</Text>
                  <Text style={styles.switchSub}>Surface local advisory notes & safety guidance</Text>
                </View>
                <Switch
                  value={preferences?.expertTravelTips === 'enabled'}
                  onValueChange={(val) => updatePreference('expertTravelTips', val ? 'enabled' : 'disabled')}
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Upload Media on Wi-Fi Only</Text>
                  <Text style={styles.switchSub}>Conserve cellular data while on mountain routes</Text>
                </View>
                <Switch
                  value={preferences?.photoUpload === 'wifi-only'}
                  onValueChange={(val) => updatePreference('photoUpload', val ? 'wifi-only' : 'cellular-and-wifi')}
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>
            </Card>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: ACCOUNT & SECURITY */}
        {/* ========================================================= */}
        {activeMainTab === 'account' && (
          <View style={styles.accountTabContainer}>
            <Card style={styles.prefCard} padding="lg">
              <View style={styles.prefCardHeader}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                <Text style={styles.prefCardTitle}>Account & Session</Text>
              </View>

              <TouchableOpacity
                style={styles.accountActionRow}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.accountActionLeft}>
                  <Ionicons name="person-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.accountActionText}>Edit Personal Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.accountActionRow}
                onPress={() => navigation.navigate('History')}
                activeOpacity={0.7}
              >
                <View style={styles.accountActionLeft}>
                  <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.accountActionText}>Activity History</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.accountActionRow}
                onPress={() => navigation.navigate('Settings')}
                activeOpacity={0.7}
              >
                <View style={styles.accountActionLeft}>
                  <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.accountActionText}>All Settings & Notifications</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.accountActionRow}
                onPress={() => setUserSearchModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.accountActionLeft}>
                  <Ionicons name="people-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.accountActionText}>Explore Community Travelers</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.accountActionRow}
                onPress={() => {
                  Alert.alert(
                    'About TripNest',
                    'TripNest Mobile v1.0.0 (Parity Edition)\n\nDay-wise itinerary planning, multi-stop route sequencing, collaborative tripmates budgeting, and curated destination discovery across Pakistan.'
                  )
                }}
                activeOpacity={0.7}
              >
                <View style={styles.accountActionLeft}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.accountActionText}>About TripNest</Text>
                </View>
                <Badge label="v1.0" variant="primary" size="sm" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.accountActionRow, { borderBottomWidth: 0, marginTop: 8 }]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <View style={styles.accountActionLeft}>
                  <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                  <Text style={[styles.accountActionText, { color: colors.danger, fontWeight: '700' }]}>
                    Sign Out of TripNest
                  </Text>
                </View>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 6. ACCOUNT & OPTIONS SHEET */}
      <ModalSheet
        visible={menuModalVisible}
        onClose={() => setMenuModalVisible(false)}
        title="Account & Tools"
        subtitle="Settings, history, and administration"
      >
        <View style={styles.menuSheetContent}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setMenuModalVisible(false)
                navigation.navigate('Admin')
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuRowText, { color: colors.primary, fontWeight: '700' }]}>
                Admin Management Portal
              </Text>
              <Badge label="ADMIN" variant="primary" size="sm" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              setMenuModalVisible(false)
              navigation.navigate('Settings')
            }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.menuRowText}>Settings & Preferences</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              setMenuModalVisible(false)
              navigation.navigate('History')
            }}
          >
            <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.menuRowText}>Activity History</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              setMenuModalVisible(false)
              setUserSearchModalVisible(true)
            }}
          >
            <Ionicons name="people-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.menuRowText}>Explore Travelers</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              setMenuModalVisible(false)
              setEditModalVisible(true)
            }}
          >
            <Ionicons name="person-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.menuRowText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              setMenuModalVisible(false)
              Alert.alert(
                'About TripNest',
                'TripNest Mobile v1.0.0 (Parity Edition)\n\nDay-wise itinerary planning, multi-stop TSP route optimization, collaborative tripmates budgeting, and destination discovery across Pakistan.'
              )
            }}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.menuRowText}>About TripNest</Text>
            <Badge label="v1.0" variant="primary" size="sm" />
          </TouchableOpacity>

          {/* Separated Destructive Action */}
          <TouchableOpacity
            style={styles.logoutRow}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutRowText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {/* 7. DISCOVER TRAVELERS MODAL */}
      <ModalSheet
        visible={userSearchModalVisible}
        onClose={() => setUserSearchModalVisible(false)}
        title="Find Travelers"
        subtitle="Discover public itineraries & travel enthusiasts"
      >
        <View style={styles.searchModalContent}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or @handle..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {isSearchingUsers ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : searchResults.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.textTertiary }}>
                {searchQuery ? 'No matching travelers found.' : 'Search for travelers on TripNest.'}
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.username || item.id}
                  style={styles.travelerRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setUserSearchModalVisible(false)
                    navigation.navigate('UserProfile', { username: item.username })
                  }}
                >
                  <View style={styles.travelerAvatar}>
                    {item.profileImage ? (
                      <Image source={{ uri: item.profileImage }} style={styles.travelerAvatarImg} />
                    ) : (
                      <Text style={styles.travelerAvatarText}>{getInitials(item)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.travelerName}>{formatDisplayName(item)}</Text>
                    <Text style={styles.travelerHandle}>{formatUsername(item)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </ModalSheet>

      {/* 8. EDIT PROFILE MODAL (Full Parity) */}
      <ModalSheet
        visible={editModalVisible}
        onClose={() => {
          if (!savingProfile) setEditModalVisible(false)
        }}
        title="Edit Profile"
        subtitle="Update your traveler identity & style"
      >
        <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
          <View style={styles.modalContent}>
            {/* Avatar Preview */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              {profileImageInput?.trim() ? (
                <Image source={{ uri: profileImageInput.trim() }} style={styles.avatarPreviewImg} />
              ) : (
                <View style={styles.avatarPreviewCircle}>
                  <Text style={styles.avatarPreviewText}>{getInitials({ name: nameInput || 'TN' })}</Text>
                </View>
              )}
              <Text style={{ ...typography.caption, color: colors.textTertiary, marginTop: 4 }}>
                Avatar Preview
              </Text>
            </View>

            <Text style={styles.inputLabel}>Display Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your Full Name"
              placeholderTextColor={colors.textTertiary}
              editable={!savingProfile}
            />

            <Text style={styles.inputLabel}>Username *</Text>
            <TextInput
              style={styles.modalInput}
              value={usernameInput}
              onChangeText={setUsernameInput}
              placeholder="username"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              editable={!savingProfile}
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="name@tripnest.dev"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!savingProfile}
            />

            <Text style={styles.inputLabel}>Profile Image URL (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={profileImageInput}
              onChangeText={setProfileImageInput}
              placeholder="https://example.com/avatar.jpg"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              editable={!savingProfile}
            />

            <Text style={styles.inputLabel}>Home Base / City</Text>
            <TextInput
              style={styles.modalInput}
              value={homeCityInput}
              onChangeText={setHomeCityInput}
              placeholder="e.g. Islamabad, Lahore, Karachi"
              placeholderTextColor={colors.textTertiary}
              editable={!savingProfile}
            />

            <Text style={styles.inputLabel}>Travel Style</Text>
            <View style={styles.pillGroup}>
              {TRAVEL_STYLE_OPTIONS.map((styleOpt) => {
                const isSelected = travelStyleInput === styleOpt.key
                return (
                  <TouchableOpacity
                    key={styleOpt.key}
                    style={[styles.styleChoicePill, isSelected && styles.styleChoicePillActive]}
                    onPress={() => setTravelStyleInput(styleOpt.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={styleOpt.icon}
                      size={14}
                      color={isSelected ? colors.textWhite : colors.textPrimary}
                    />
                    <Text style={[styles.styleChoicePillText, isSelected && styles.styleChoicePillTextActive]}>
                      {styleOpt.key}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="Tell fellow travelers about your journeys..."
              placeholderTextColor={colors.textTertiary}
              multiline
              editable={!savingProfile}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
              <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>Travel Interests</Text>
              <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '700' }}>
                {travelInterestsInput.length} selected
              </Text>
            </View>
            <View style={styles.modalInterestsCloud}>
              {AVAILABLE_TRAVEL_INTERESTS.map((interest) => {
                const isSelected = travelInterestsInput.includes(interest)
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.modalInterestChip, isSelected && styles.modalInterestChipActive]}
                    onPress={() => toggleInterest(interest)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={14}
                      color={isSelected ? colors.textWhite : colors.textSecondary}
                    />
                    <Text style={[styles.modalInterestChipText, isSelected && styles.modalInterestChipTextActive]}>
                      {interest}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Button
              title={savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
              pill
              onPress={handleSaveProfile}
              disabled={savingProfile}
              style={{ marginTop: 18, marginBottom: 12 }}
            />
          </View>
        </ScrollView>
      </ModalSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Top Brand Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLogoImg: {
    width: 22,
    height: 22,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadgeText: {
    ...typography.subtitle2,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Guest State Styles
  guestHeroCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  guestAvatarCircle: {
    marginBottom: 12,
  },
  guestBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 12,
  },
  guestBadgePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  guestTitle: {
    ...typography.h2,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  guestSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  guestActionsCol: {
    width: '100%',
  },
  guestTripsSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  guestTripsHeader: {
    marginBottom: 12,
  },
  guestOptionsContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  guestOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  guestOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guestOptionText: {
    ...typography.body2,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  // Identity Section
  identityContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSubtle,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textWhite,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  adminBadgeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  editProfilePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  sharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  sharePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  discoverPill: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameSection: {
    marginTop: 12,
  },
  userName: {
    ...typography.h2,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  userHandle: {
    ...typography.subtitle2,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  userEmail: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  userBio: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
  socialStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  socialStatItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  socialStatNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  socialStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  socialStatDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textTertiary,
  },
  findTravelersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  findTravelersText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },

  // Stats Card
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderLight,
  },

  // Trips Workspace
  tripsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeading: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  sectionSubheading: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  tripFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textWhite,
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  profileTripCard: {
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
  tripCardImage: {
    width: '100%',
    height: '100%',
  },
  tripCardTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  badgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  badgePillTripmate: {
    backgroundColor: 'rgba(238, 242, 255, 0.96)',
    borderColor: '#C7D2FE',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  badgePillTextTripmate: {
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
  tripCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  tripCardMeta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  tripCardSubMeta: {
    fontSize: 12.5,
    color: '#0E442B',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyTabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyTabTitle: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyTabSub: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  menuIconBtn: {
    padding: 6,
  },

  // Menu Sheet
  menuSheetContent: {
    paddingTop: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuRowText: {
    ...typography.body1,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  logoutRowText: {
    ...typography.body1,
    color: colors.danger,
    fontWeight: '700',
  },

  // Search Modal
  searchModalContent: {
    paddingTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  travelerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  travelerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  travelerAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  travelerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  travelerHandle: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Modal Edit
  modalContent: {
    paddingTop: 8,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    height: 46,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Traveler Style & Interests Card
  interestsCard: {
    marginTop: 14,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
  },
  interestsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  interestsCardTitle: {
    ...typography.subtitle2,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  interestsEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  interestsEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  travelMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tagsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  interestTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // 3-Tab Workspace Switcher
  profileTabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  profileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileTabBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  profileTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  profileTabBtnTextActive: {
    fontWeight: '800',
    color: colors.primary,
  },

  // Preferences Tab
  preferencesTabContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  prefCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
  },
  prefCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  prefCardTitle: {
    ...typography.subtitle1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  prefFieldLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  choicePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choicePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  choicePillTextActive: {
    color: colors.textWhite,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchCol: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  switchSub: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 10,
  },

  // Account Tab
  accountTabContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  accountActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  accountActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountActionText: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Avatar & Style Edit Elements
  avatarPreviewCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textWhite,
  },
  avatarPreviewImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSubtle,
  },
  styleChoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  styleChoicePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  styleChoicePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  styleChoicePillTextActive: {
    color: colors.textWhite,
    fontWeight: '700',
  },
  modalInterestsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  modalInterestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalInterestChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalInterestChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalInterestChipTextActive: {
    color: colors.textWhite,
    fontWeight: '700',
  },
})

export default ProfileScreen
