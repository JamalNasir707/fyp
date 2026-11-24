import React, { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { getPlaceImage } from '../../constants/images'
import { formatTime12h, getPlaceLatLon } from '../../utils/tripUtils'
import Badge from '../common/Badge'
import apiService from '../../api/apiService'

/**
 * PlaceDetailBottomSheet
 * 
 * Mobile parity implementation of TripNest web PlannerMapPanel.jsx & PlaceDetailsPanel.jsx:
 * - 4 distinct navigation tabs: About, Photos, Reviews, Weather
 * - Live/mock weather card (Temp, Feels Like, Humidity, Wind, Clouds, Pressure)
 * - Split-pill "+ Add to Trip" / "✓ Added" dropdown with Day & Places Pool assignment
 * - Operating hours with today highlighted
 * - Visit duration & live crowd busyness insights
 * - Photo gallery with fullscreen lightbox modal
 * - Traveler reviews list
 */
export function PlaceDetailBottomSheet({
  visible,
  place,
  trip,
  onClose,
  onAddToTrip,
  onRemoveFromTrip,
  onToggleVisited,
}) {
  const [activeTab, setActiveTab] = useState('about') // 'about' | 'photos' | 'reviews' | 'weather'
  const [addToTripDropdownOpen, setAddToTripDropdownOpen] = useState(false)
  const [zoomedPhotoIndex, setZoomedPhotoIndex] = useState(null)
  const [copiedNotification, setCopiedNotification] = useState(false)

  // Live weather & photos integration
  const [liveWeather, setLiveWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [livePhotos, setLivePhotos] = useState([])

  if (!place || !visible) return null

  const days = Array.isArray(trip?.days) ? trip.days : []
  const coords = getPlaceLatLon(place) || { lat: 33.6844, lon: 73.0479 }
  const mainImage = getPlaceImage(place.id, place.category, place.title || place.name)

  useEffect(() => {
    if (!visible || !place) return
    let active = true

    // Fetch live weather from API
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)) {
      setWeatherLoading(true)
      apiService
        .getWeather(coords.lat, coords.lon)
        .then((res) => {
          if (active && res) {
            setLiveWeather(res)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setWeatherLoading(false)
        })
    }

    // Fetch place photos from API
    const dataId = place.data_id || place.dataId || place.place_id || place.id
    if (dataId) {
      apiService
        .getPlacePhotos(dataId)
        .then((res) => {
          if (active && res?.photos && Array.isArray(res.photos) && res.photos.length > 0) {
            setLivePhotos(res.photos)
          }
        })
        .catch(() => {})
    }

    return () => {
      active = false
    }
  }, [visible, place.id, coords.lat, coords.lon])

  // Find if and where this place is assigned in the active trip
  let assignedContainer = null // { type: 'day', day, dayIndex } | { type: 'pool' } | null
  if (trip) {
    if ((trip.placesPool || []).some((p) => String(p.id) === String(place.id))) {
      assignedContainer = { type: 'pool' }
    } else {
      days.forEach((day, idx) => {
        if ((day.items || []).some((item) => String(item.id) === String(place.id))) {
          assignedContainer = { type: 'day', day, dayIndex: idx }
        }
      })
    }
  }

  // Operating Hours data
  const operatingHours =
    place.operatingHours && typeof place.operatingHours === 'object' && Object.keys(place.operatingHours).length > 0
      ? place.operatingHours
      : null
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  // Photo gallery list
  const combinedPhotos = [
    ...(livePhotos.length > 0 ? livePhotos : []),
    ...(Array.isArray(place.photos) ? place.photos : []),
  ]
  const photosList = combinedPhotos.length > 0 ? combinedPhotos : [mainImage]

  // Reviews list
  const userReviews = Array.isArray(place.userReviews) && place.userReviews.length > 0
    ? place.userReviews
    : []

  // Weather metrics (live weather or place weather, without fake fallback)
  const weatherData = liveWeather || place.weather || null

  // Share handler
  async function handleShare() {
    try {
      await Share.share({
        message: `${place.title || place.name} - ${place.subtitle || place.address || ''}\nCoordinates: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}\nPlanned via TripNest`,
      })
    } catch {
      // dismissed
    }
  }

  // Directions handler
  function handleOpenDirections() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`
    Linking.openURL(url).catch(() => {})
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.handleBar} />

          {/* Top Bar with Title & Close */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerInfoCol}>
              <Text style={styles.placeTitle} numberOfLines={1}>
                {place.title || place.name || 'Place Details'}
              </Text>
              <Text style={styles.placeSubtitle} numberOfLines={1}>
                📍 {place.subtitle || place.address || `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Badges & Split-Pill Action Row */}
          <View style={styles.actionPillRow}>
            {/* Split Pill Button (Add to Trip) */}
            <View style={styles.splitPillGroup}>
              <TouchableOpacity
                style={[styles.splitPillMain, assignedContainer && styles.splitPillMainAssigned]}
                onPress={() => setAddToTripDropdownOpen(!addToTripDropdownOpen)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={assignedContainer ? 'checkmark-circle' : 'add-circle'}
                  size={15}
                  color={assignedContainer ? colors.primaryDark : colors.textWhite}
                />
                <Text
                  style={[
                    styles.splitPillText,
                    assignedContainer && styles.splitPillTextAssigned,
                  ]}
                >
                  {assignedContainer
                    ? assignedContainer.type === 'pool'
                      ? 'In Places to Visit'
                      : `In Day ${assignedContainer.dayIndex + 1}`
                    : '+ Add to Trip'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.splitPillArrow, assignedContainer && styles.splitPillArrowAssigned]}
                onPress={() => setAddToTripDropdownOpen(!addToTripDropdownOpen)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={addToTripDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={assignedContainer ? colors.primaryDark : colors.textWhite}
                />
              </TouchableOpacity>
            </View>

            {/* Mark Visited Toggle (if assigned to a day) */}
            {assignedContainer && assignedContainer.type === 'day' && onToggleVisited ? (
              <TouchableOpacity
                style={[styles.visitedToggleBtn, place.visitDetails?.visited && styles.visitedToggleActive]}
                onPress={onToggleVisited}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={place.visitDetails?.visited ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={place.visitDetails?.visited ? colors.success : colors.textSecondary}
                />
                <Text style={[styles.visitedToggleText, place.visitDetails?.visited && { color: colors.success }]}>
                  {place.visitDetails?.visited ? 'Visited' : 'Mark Visited'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Category / Rating Badges */}
            <View style={styles.rightBadges}>
              <Badge label={place.category || 'Attraction'} variant="primary" size="sm" />
              {place.rating ? (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingBadgeText}>⭐ {place.rating}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Dropdown Menu for Add to Trip */}
          {addToTripDropdownOpen ? (
            <View style={styles.addToTripDropdown}>
              <Text style={styles.dropdownSectionTitle}>Select Target Day:</Text>
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                {/* 1. Places to Visit Pool */}
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    assignedContainer?.type === 'pool' && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setAddToTripDropdownOpen(false)
                    if (onAddToTrip) onAddToTrip('pool')
                  }}
                >
                  <Ionicons name="bookmark-outline" size={15} color="#6366f1" />
                  <Text style={styles.dropdownItemText}>Places to Visit (Pool)</Text>
                  {assignedContainer?.type === 'pool' ? (
                    <Ionicons name="checkmark" size={15} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>

                {/* 2. Days List */}
                {days.map((d, idx) => {
                  const isAssigned = assignedContainer?.type === 'day' && assignedContainer.day?.id === d.id
                  return (
                    <TouchableOpacity
                      key={d.id || idx}
                      style={[styles.dropdownItem, isAssigned && styles.dropdownItemActive]}
                      onPress={() => {
                        setAddToTripDropdownOpen(false)
                        if (onAddToTrip) onAddToTrip(d.id)
                      }}
                    >
                      <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                      <Text style={styles.dropdownItemText}>
                        Day {idx + 1} ({d.shortLabel || d.label || `Day ${idx + 1}`})
                      </Text>
                      {isAssigned ? (
                        <Ionicons name="checkmark" size={15} color={colors.primary} />
                      ) : null}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {/* 3. Remove Option */}
              {assignedContainer && onRemoveFromTrip ? (
                <TouchableOpacity
                  style={[styles.dropdownItem, styles.dropdownItemDelete]}
                  onPress={() => {
                    setAddToTripDropdownOpen(false)
                    onRemoveFromTrip()
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                  <Text style={[styles.dropdownItemText, { color: colors.error }]}>
                    Remove from itinerary
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Navigation Tabs (About | Photos | Reviews | Weather) */}
          <View style={styles.tabsHeader}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'about' && styles.tabBtnActive]}
              onPress={() => setActiveTab('about')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'about' && styles.tabBtnTextActive]}>
                About
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'photos' && styles.tabBtnActive]}
              onPress={() => setActiveTab('photos')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'photos' && styles.tabBtnTextActive]}>
                Photos ({photosList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'reviews' && styles.tabBtnActive]}
              onPress={() => setActiveTab('reviews')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'reviews' && styles.tabBtnTextActive]}>
                Reviews ({userReviews.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'weather' && styles.tabBtnActive]}
              onPress={() => setActiveTab('weather')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'weather' && styles.tabBtnTextActive]}>
                Weather
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Tab Content Body */}
          <ScrollView style={styles.tabContentScroll} showsVerticalScrollIndicator={false}>
            {/* TAB 1: ABOUT */}
            {activeTab === 'about' && (
              <View style={styles.tabSection}>
                {/* Hero / Thumbnail */}
                <Image source={{ uri: mainImage }} style={styles.aboutHeroImage} />

                {/* Description */}
                <View style={styles.infoCard}>
                  <Text style={styles.sectionHeader}>Overview</Text>
                  <Text style={styles.descriptionText}>
                    {place.description ||
                      place.note ||
                      `Discover ${place.title || place.name || 'this spot'}${place.address ? ` located at ${place.address}` : ''}. Known for its cultural significance and scenic surroundings.`}
                  </Text>
                </View>

                {/* Action Buttons: Directions, Share, Call, Website */}
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, styles.quickActionPrimary]}
                    onPress={handleOpenDirections}
                  >
                    <Ionicons name="navigate" size={15} color={colors.textWhite} />
                    <Text style={styles.quickActionTextPrimary}>Directions</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.quickActionBtn} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={15} color={colors.primaryDark} />
                    <Text style={styles.quickActionText}>Share</Text>
                  </TouchableOpacity>

                  {place.website ? (
                    <TouchableOpacity
                      style={styles.quickActionBtn}
                      onPress={() => Linking.openURL(place.website).catch(() => {})}
                    >
                      <Ionicons name="globe-outline" size={15} color={colors.primaryDark} />
                      <Text style={styles.quickActionText}>Website</Text>
                    </TouchableOpacity>
                  ) : null}

                  {place.phoneNumber || place.phone ? (
                    <TouchableOpacity
                      style={styles.quickActionBtn}
                      onPress={() => Linking.openURL(`tel:${place.phoneNumber || place.phone}`).catch(() => {})}
                    >
                      <Ionicons name="call-outline" size={15} color={colors.primaryDark} />
                      <Text style={styles.quickActionText}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Contact & Location Details */}
                <View style={styles.infoCard}>
                  <Text style={styles.sectionHeader}>📍 Location & Details</Text>
                  {place.address ? (
                    <View style={styles.metaDetailRow}>
                      <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.metaDetailText}>{place.address}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metaDetailRow}>
                    <Ionicons name="compass-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.metaDetailText}>
                      Coordinates: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
                    </Text>
                  </View>
                </View>

                {/* Operating Hours */}
                {operatingHours ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionHeader}>⏰ Operating Hours</Text>
                    <View style={styles.hoursGrid}>
                      {Object.entries(operatingHours).map(([day, hours]) => {
                        const isToday = day.toLowerCase() === todayName.toLowerCase()
                        return (
                          <View
                            key={day}
                            style={[styles.hoursRow, isToday && styles.hoursRowToday]}
                          >
                            <Text style={[styles.hoursDayText, isToday && styles.hoursDayTextToday]}>
                              {day} {isToday ? '(Today)' : ''}
                            </Text>
                            <Text style={[styles.hoursValText, isToday && styles.hoursValTextToday]}>
                              {hours}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                ) : place.hours ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionHeader}>⏰ Operating Hours</Text>
                    <Text style={styles.metaDetailText}>{place.hours}</Text>
                  </View>
                ) : null}

                {/* Visit Insights (Typical Duration & Busyness) */}
                {(place.timeNeeded || place.popularTimes) ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionHeader}>⏱ Visit Insights</Text>
                    {Boolean(place.timeNeeded || place.popularTimes?.time_spent) && (
                      <View style={styles.insightBox}>
                        <Ionicons name="time-outline" size={18} color="#d97706" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.insightTitle}>Typical Duration</Text>
                          <Text style={styles.insightSub}>
                            {place.timeNeeded || place.popularTimes?.time_spent}
                          </Text>
                        </View>
                      </View>
                    )}

                    {Boolean(place.popularTimes?.info) && (
                      <View style={[styles.insightBox, { marginTop: 8 }]}>
                        <Ionicons name="people-outline" size={18} color="#059669" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.insightTitle}>Crowd Status</Text>
                          <Text style={styles.insightSub}>
                            {place.popularTimes?.info}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Accessibility & Amenities (only if specified) */}
                {Array.isArray(place.serviceOptions) && place.serviceOptions.length > 0 ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionHeader}>✓ Amenities & Features</Text>
                    <View style={styles.tagCloud}>
                      {place.serviceOptions.map((feat, idx) => (
                        <View key={idx} style={styles.featureChip}>
                          <Text style={styles.featureChipText}>✓ {feat}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            )}

            {/* TAB 2: PHOTOS */}
            {activeTab === 'photos' && (
              <View style={styles.tabSection}>
                <Text style={styles.sectionHeader}>Photo Gallery</Text>
                <View style={styles.photoGrid}>
                  {photosList.map((uri, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.photoGridItem}
                      onPress={() => setZoomedPhotoIndex(idx)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri }} style={styles.gridImg} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* TAB 3: REVIEWS */}
            {activeTab === 'reviews' && (
              <View style={styles.tabSection}>
                {place.rating != null && !isNaN(Number(place.rating)) ? (
                  <View style={styles.reviewsSummaryCard}>
                    <Text style={styles.ratingNumber}>{Number(place.rating).toFixed(1)}</Text>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.ratingStars}>⭐</Text>
                      <Text style={styles.ratingCount}>
                        {place.reviews || place.reviewCount
                          ? `Based on ${Number(place.reviews || place.reviewCount).toLocaleString()} traveler reviews`
                          : 'Overall rating'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.reviewsSummaryCard}>
                    <Ionicons name="star-outline" size={28} color={colors.textTertiary} />
                    <Text style={[styles.ratingCount, { marginTop: 6 }]}>No rating published yet</Text>
                  </View>
                )}

                {userReviews.length > 0 ? (
                  userReviews.map((rev, idx) => (
                    <View key={idx} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewerInfo}>
                          <View style={styles.reviewerAvatar}>
                            <Text style={styles.avatarLetter}>
                              {(rev.user || 'T').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.reviewerName}>{rev.user}</Text>
                        </View>
                        <Text style={styles.reviewDate}>{rev.date}</Text>
                      </View>
                      {rev.rating != null && <Text style={styles.reviewRating}>⭐ {rev.rating} / 5</Text>}
                      <Text style={styles.reviewText}>{rev.text}</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Ionicons name="chatbubbles-outline" size={36} color={colors.textTertiary} />
                    <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                      No traveler reviews published yet for this location.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 4: WEATHER */}
            {activeTab === 'weather' && (
              <View style={styles.tabSection}>
                {weatherLoading ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 8 }}>
                      Loading local weather...
                    </Text>
                  </View>
                ) : weatherData ? (
                  <View style={styles.weatherCard}>
                    <View style={styles.weatherHeader}>
                      <View>
                        <Text style={styles.weatherTemp}>{weatherData.temperature}°C</Text>
                        <Text style={styles.weatherCondition}>{weatherData.description}</Text>
                        {weatherData.feels_like != null && (
                          <Text style={styles.weatherFeels}>
                            Feels like {weatherData.feels_like}°C
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={weatherData.temperature > 20 ? 'sunny' : 'partly-sunny'}
                        size={54}
                        color="#f59e0b"
                      />
                    </View>

                    <View style={styles.weatherMetricsGrid}>
                      {weatherData.humidity != null && (
                        <View style={styles.weatherMetricItem}>
                          <Text style={styles.weatherMetricLabel}>💧 Humidity</Text>
                          <Text style={styles.weatherMetricVal}>{weatherData.humidity}%</Text>
                        </View>
                      )}

                      {weatherData.wind_speed != null && (
                        <View style={styles.weatherMetricItem}>
                          <Text style={styles.weatherMetricLabel}>🌬️ Wind Speed</Text>
                          <Text style={styles.weatherMetricVal}>{weatherData.wind_speed} m/s</Text>
                        </View>
                      )}

                      {weatherData.cloud_cover != null && (
                        <View style={styles.weatherMetricItem}>
                          <Text style={styles.weatherMetricLabel}>☁️ Cloud Cover</Text>
                          <Text style={styles.weatherMetricVal}>{weatherData.cloud_cover}%</Text>
                        </View>
                      )}

                      {weatherData.pressure != null && (
                        <View style={styles.weatherMetricItem}>
                          <Text style={styles.weatherMetricLabel}>🌡️ Air Pressure</Text>
                          <Text style={styles.weatherMetricVal}>{weatherData.pressure} hPa</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.weatherUpdatedNotice}>⏱ Local Weather Forecast</Text>
                  </View>
                ) : (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Ionicons name="cloud-offline-outline" size={36} color={colors.textTertiary} />
                    <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                      Weather forecast currently unavailable for these coordinates.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>

      {/* Lightbox Photo Zoom Modal */}
      {zoomedPhotoIndex !== null && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View style={styles.lightboxOverlay}>
            <TouchableOpacity
              style={styles.lightboxCloseBtn}
              onPress={() => setZoomedPhotoIndex(null)}
            >
              <Ionicons name="close" size={26} color={colors.textWhite} />
            </TouchableOpacity>

            <Image
              source={{ uri: photosList[zoomedPhotoIndex] }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />

            <View style={styles.lightboxCounter}>
              <Text style={styles.lightboxCounterText}>
                Photo {zoomedPhotoIndex + 1} of {photosList.length}
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '85%',
    paddingBottom: 20,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  placeTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  placeSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  actionPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  splitPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  splitPillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 5,
  },
  splitPillMainAssigned: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  splitPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  splitPillTextAssigned: {
    color: colors.textPrimary,
  },
  splitPillArrow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
  },
  splitPillArrowAssigned: {
    backgroundColor: '#f1f5f9',
    borderLeftColor: '#cbd5e1',
    borderWidth: 1,
  },
  visitedToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  visitedToggleActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  visitedToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingBadge: {
    backgroundColor: '#fffbeb',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  addToTripDropdown: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 8,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  dropdownSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 8,
  },
  dropdownItemActive: {
    backgroundColor: colors.primaryLight,
  },
  dropdownItemDelete: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 4,
    paddingTop: 8,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 10,
    marginRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabBtnText: {
    ...typography.subtitle2,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  tabContentScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tabSection: {
    gap: 12,
  },
  aboutHeroImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionHeader: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 6,
  },
  descriptionText: {
    ...typography.body2,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  quickActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  quickActionTextPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  metaDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaDetailText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  hoursGrid: {
    gap: 4,
    marginTop: 4,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  hoursRowToday: {
    backgroundColor: '#fff7ed',
    borderRadius: 6,
  },
  hoursDayText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  hoursDayTextToday: {
    color: '#ea580c',
    fontWeight: '700',
  },
  hoursValText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  hoursValTextToday: {
    color: '#ea580c',
    fontWeight: '700',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  insightTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  insightSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  featureChip: {
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  featureChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoGridItem: {
    width: '48%',
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gridImg: {
    width: '100%',
    height: '100%',
  },
  reviewsSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ratingNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  ratingStars: {
    fontSize: 16,
  },
  ratingCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  reviewRating: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  reviewText: {
    ...typography.body2,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  weatherCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  weatherTemp: {
    fontSize: 34,
    fontWeight: '800',
    color: '#166534',
  },
  weatherCondition: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
    marginTop: 2,
  },
  weatherFeels: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 1,
  },
  weatherMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
    paddingTop: 12,
  },
  weatherMetricItem: {
    width: '47%',
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 8,
  },
  weatherMetricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  weatherMetricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  weatherUpdatedNotice: {
    fontSize: 11,
    color: '#16a34a',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: '92%',
    height: '70%',
  },
  lightboxCounter: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  lightboxCounterText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '600',
  },
})
