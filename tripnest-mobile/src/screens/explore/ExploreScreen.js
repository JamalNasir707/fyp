import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  RefreshControl,
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
import { apiService } from '../../api/apiService'
import { useApp } from '../../context/AppContext'
import { getPlaceImage } from '../../constants/images'
import {
  getCurrentDeviceLocation,
  getDestinationCoordinates,
  resolvePakistaniCity,
  fetchDynamicPlacesForCity,
} from '../../utils/locationService'
import { getCurrentEnvironment, ENVIRONMENTS } from '../../config/env'
import SearchBar from '../../components/common/SearchBar'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import ModalSheet from '../../components/common/ModalSheet'
import Button from '../../components/common/Button'
import PlaceCard from '../../components/places/PlaceCard'
import { SafeImage } from '../../components/common/SafeImage'

// 8 Complete Categories matching Web travel-intelligence-react/WorkspacePage.jsx SERP_EXPLORE_CATEGORIES
export const WEB_EXPLORE_CATEGORIES = [
  { id: 'All', label: 'All', queryKey: 'tourist attractions', icon: 'compass', bg: '#F1F5F9', color: '#475569' },
  { id: 'Attractions', label: 'Attractions', queryKey: 'tourist attractions sights', icon: 'location', bg: '#EFF6FF', color: '#2563EB' },
  { id: 'Restaurants', label: 'Restaurants', queryKey: 'restaurants food dining', icon: 'restaurant', bg: '#FFF7ED', color: '#EA580C' },
  { id: 'Cafes', label: 'Cafes', queryKey: 'cafes coffee bakeries', icon: 'cafe', bg: '#FEF3C7', color: '#D97706' },
  { id: 'Hotels', label: 'Hotels', queryKey: 'hotels resorts stays', icon: 'bed', bg: '#F5F3FF', color: '#7C3AED' },
  { id: 'Nature', label: 'Nature', queryKey: 'nature parks scenic viewpoints lakes mountains', icon: 'leaf', bg: '#F0FDF4', color: '#16A34A' },
  { id: 'Historical', label: 'Historical', queryKey: 'historical heritage museum forts landmarks', icon: 'business', bg: '#FAF5FF', color: '#9333EA' },
  { id: 'Shopping', label: 'Shopping', queryKey: 'shopping bazaars markets malls', icon: 'cart', bg: '#FDF2F8', color: '#DB2777' },
]

export function ExploreScreen({ navigation, route }) {
  const { activeTrip, savedTrips, addPlaceToPool, addPlaceToDay, setActiveTrip, addToWishlist } = useApp()

  const initialDestination = route?.params?.destination || activeTrip?.destination || 'Islamabad'
  const initialQuery = route?.params?.query || ''

  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Location & City Filter state
  const [activeLocationMode, setActiveLocationMode] = useState('destination') // 'destination' | 'near_me' | 'city'
  const [selectedCity, setSelectedCity] = useState(initialDestination)
  const [userGpsCoords, setUserGpsCoords] = useState(null)
  const [locationStatusMessage, setLocationStatusMessage] = useState('')

  // Search & Category Filter state
  const [selectedCat, setSelectedCat] = useState(route?.params?.category || 'All')
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const searchDebounceTimer = useRef(null)

  // Details Modal state
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsModalVisible, setDetailsModalVisible] = useState(false)

  // Schedule Modal state
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [selectedPlaceForModal, setSelectedPlaceForModal] = useState(null)
  const [selectedTripTarget, setSelectedTripTarget] = useState(activeTrip || (savedTrips && savedTrips[0]))

  // Custom Pakistani City Modal state
  const [customCityModalVisible, setCustomCityModalVisible] = useState(false)
  const [customCityInput, setCustomCityInput] = useState('')

  const isFirstMount = useRef(true)

  // Sync route params if destination or query or category changes externally
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    const nextDest = route?.params?.destination
    const nextQuery = route?.params?.query
    const nextCat = route?.params?.category

    if (nextDest || nextQuery !== undefined || nextCat) {
      const targetCity = nextDest || selectedCity
      const targetQuery = nextQuery !== undefined ? nextQuery : searchQuery

      if (nextDest && nextDest !== selectedCity) {
        setSelectedCity(nextDest)
        setActiveLocationMode('destination')
      }
      if (nextQuery !== undefined && nextQuery !== searchQuery) {
        setSearchQuery(nextQuery)
      }
      if (nextCat && nextCat !== selectedCat) {
        setSelectedCat(nextCat)
      }

      loadPlacesForCurrentContext(targetQuery, targetCity)
    }
  }, [route?.params?.destination, route?.params?.query, route?.params?.category])

  // Sync selected trip target and keep destination synchronized when activeTrip changes
  useEffect(() => {
    if (activeTrip?.destination) {
      setSelectedTripTarget(activeTrip)
      if (activeLocationMode === 'destination') {
        setSelectedCity(activeTrip.destination)
      }
    }
  }, [activeTrip?.id, activeTrip?.tripId, activeTrip?.destination, activeLocationMode])

  // Track which places are already saved in the active trip's pool or itinerary
  const savedPlaceKeys = useMemo(() => {
    const keys = new Set()
    const targetTrip = activeTrip || (savedTrips && savedTrips[0])
    if (targetTrip) {
      ;(targetTrip.placesPool || []).forEach((p) => {
        const id = String(p.place_id || p.id || '').replace(/^serp-/, '').toLowerCase()
        const title = String(p.title || p.name || '').trim().toLowerCase()
        if (id) keys.add(id)
        if (title) keys.add(title)
      })
      ;(targetTrip.days || []).forEach((d) => {
        ;(d.items || []).forEach((p) => {
          const id = String(p.place_id || p.id || '').replace(/^serp-/, '').toLowerCase()
          const title = String(p.title || p.name || '').trim().toLowerCase()
          if (id) keys.add(id)
          if (title) keys.add(title)
        })
      })
    }
    return keys
  }, [activeTrip, savedTrips])

  const isPlaceSaved = (p) => {
    if (!p) return false
    const id = String(p.place_id || p.id || '').replace(/^serp-/, '').toLowerCase()
    const title = String(p.title || p.name || '').trim().toLowerCase()
    return (id && savedPlaceKeys.has(id)) || (title && savedPlaceKeys.has(title))
  }

  const getSavedPlaceLocation = (p) => {
    if (!p) return null
    const id = String(p.place_id || p.id || '').replace(/^serp-/, '').toLowerCase()
    const title = String(p.title || p.name || '').trim().toLowerCase()
    const targetTrip = activeTrip || (savedTrips && savedTrips[0])
    if (!targetTrip) return null

    const inPool = (targetTrip.placesPool || []).some((item) => {
      const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '').toLowerCase()
      const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
      return (id && itemId === id) || (title && itemTitle === title)
    })
    if (inPool) return 'Places Pool'

    for (let i = 0; i < (targetTrip.days || []).length; i++) {
      const day = targetTrip.days[i]
      const inDay = (day.items || []).some((item) => {
        const itemId = String(item.place_id || item.id || '').replace(/^serp-/, '').toLowerCase()
        const itemTitle = String(item.title || item.name || '').trim().toLowerCase()
        return (id && itemId === id) || (title && itemTitle === title)
      })
      if (inDay) return day.label || `Day ${i + 1}`
    }
    return null
  }

  // Initial load
  useEffect(() => {
    loadPlacesForCurrentContext()
  }, [activeLocationMode, selectedCity, selectedCat])

  // Handle Search Query with 450ms debounce matching Web
  function handleSearchQueryChange(text) {
    setSearchQuery(text)
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current)
    searchDebounceTimer.current = setTimeout(() => {
      loadPlacesForCurrentContext(text)
    }, 450)
  }

  /**
   * Loads places using backend API parameters matching the website's WorkspacePage.jsx.
   */
  async function loadPlacesForCurrentContext(overrideSearchText = searchQuery, overrideCity = selectedCity) {
    setLoading(true)
    setFetchError(null)

    try {
      let lat = 33.6844
      let lon = 73.0479
      let destinationLabel = overrideCity || selectedCity

      if (activeLocationMode === 'near_me') {
        if (userGpsCoords) {
          lat = userGpsCoords.lat
          lon = userGpsCoords.lon
          destinationLabel = 'Near You'
        } else {
          const locRes = await getCurrentDeviceLocation(false)
          if (locRes.granted && locRes.coords) {
            lat = locRes.coords.lat
            lon = locRes.coords.lon
            setUserGpsCoords(locRes.coords)
            destinationLabel = 'Near You'
            setLocationStatusMessage('Using device GPS coordinates')
          } else {
            setActiveLocationMode('destination')
            setLocationStatusMessage(locRes.error || 'Location access unavailable. Switched to destination.')
            const resolved = await resolvePakistaniCity(destinationLabel)
            lat = resolved?.lat || getDestinationCoordinates(destinationLabel).lat
            lon = resolved?.lon || getDestinationCoordinates(destinationLabel).lon
          }
        }
      } else {
        const resolved = await resolvePakistaniCity(destinationLabel)
        if (resolved) {
          lat = resolved.lat
          lon = resolved.lon
          destinationLabel = resolved.city || destinationLabel
        } else {
          const coords = getDestinationCoordinates(destinationLabel)
          lat = coords.lat
          lon = coords.lon
        }
      }

      // Query & Location Resolution
      const qClean = (overrideSearchText || '').trim()
      const explicitCity = qClean ? await resolvePakistaniCity(qClean) : null

      let queryCity = destinationLabel
      if (explicitCity && explicitCity.city) {
        queryCity = explicitCity.city
        lat = explicitCity.lat
        lon = explicitCity.lon
      }

      // Parity query construction matching travel-intelligence-react/WorkspacePage.jsx
      const activeCat = (selectedCat || 'All').trim()
      let finalQuery = 'tourist attractions'

      const activeCatItem = WEB_EXPLORE_CATEGORIES.find(
        (c) => c.id.toLowerCase() === activeCat.toLowerCase()
      )
      const catQueryText = activeCatItem ? activeCatItem.queryKey : activeCat

      if (explicitCity) {
        // User explicitly searched for a city name (e.g. "Rawalpindi" while active trip is "Multan")
        if (activeCat !== 'All') {
          finalQuery = `${catQueryText} in ${queryCity}`
        } else {
          finalQuery = `tourist attractions in ${queryCity}`
        }
      } else if (activeCat !== 'All' && qClean) {
        finalQuery = `${catQueryText} ${qClean}`
      } else if (activeCat !== 'All') {
        finalQuery = `${catQueryText} in ${queryCity}`
      } else if (qClean) {
        if (qClean.toLowerCase().includes(' in ')) {
          finalQuery = qClean
        } else {
          // If searching a specific landmark like "Faisal Mosque", query it directly
          finalQuery = `${qClean}`
        }
      } else {
        finalQuery = `tourist attractions in ${queryCity}`
      }

      let fetchedPlaces = []

      // 1. Attempt API fetch from backend (/api/explore/places)
      try {
        const res = await apiService.getExplorePlaces(lat, lon, finalQuery)
        if (res?.places && Array.isArray(res.places) && res.places.length > 0) {
          fetchedPlaces = res.places
        }
      } catch {
        // Backend unavailable
      }

      // 2. If no places returned or in offline/mock mode, query dynamic OpenStreetMap engine
      if (fetchedPlaces.length === 0) {
        fetchedPlaces = await fetchDynamicPlacesForCity(queryCity, lat, lon, selectedCat, qClean)
      }

      // 3. Strict City Filter: Keep matching places and prevent cross-city leakage
      if (fetchedPlaces.length > 0) {
        const destLow = queryCity.toLowerCase()
        const qLow = qClean.toLowerCase()
        fetchedPlaces = fetchedPlaces.filter((p) => {
          const pDest = (p.destination || '').toLowerCase()
          const pAddr = (p.address || p.subtitle || '').toLowerCase()
          const pTitle = (p.name || p.title || '').toLowerCase()
          const isOsm = String(p.id).startsWith('osm-') || String(p.id).startsWith('nom-')
          // If user searched for a specific landmark, preserve matches by title
          if (qLow && pTitle.includes(qLow)) return true
          return isOsm || pDest.includes(destLow) || pAddr.includes(destLow) || pTitle.includes(destLow)
        })
      }

      setPlaces(fetchedPlaces)
      setFetchError(null)
    } catch (err) {
      setFetchError(err.message || 'Could not load places. Try another search.')
      setPlaces([])
    } finally {
      setLoading(false)
    }
  }

  // --- Location Mode Selection ---
  async function handleSelectNearMe() {
    setLocationStatusMessage('Requesting GPS location...')
    const locRes = await getCurrentDeviceLocation(true)
    if (locRes.granted && locRes.coords) {
      setUserGpsCoords(locRes.coords)
      setActiveLocationMode('near_me')
      setLocationStatusMessage('GPS location active')
    } else {
      Alert.alert(
        'Location Access Denied or Unavailable',
        'Could not access current GPS location. You can explore places by choosing your trip destination or selecting a city from the list below.',
        [{ text: 'OK' }]
      )
      setLocationStatusMessage('Location permission denied. Destination mode active.')
      setActiveLocationMode('destination')
    }
  }

  function handleSelectDestinationMode() {
    setActiveLocationMode('destination')
    setSelectedCity(activeTrip?.destination || initialDestination || 'Islamabad')
    setLocationStatusMessage('')
  }

  function handleSelectCity(city) {
    setActiveLocationMode('city')
    setSelectedCity(city)
    setLocationStatusMessage('')
  }

  // --- Place Details Modal ---
  async function handleOpenPlaceDetails(place) {
    setSelectedPlaceDetails(place)
    setSelectedImageIndex(0)
    setDetailsModalVisible(true)
    setDetailsLoading(true)

    try {
      const details = await apiService.getPlaceDetails(place.id, place.data_id, place)
      if (details?.place) {
        setSelectedPlaceDetails((prev) => ({
          ...prev,
          ...details.place,
          images:
            Array.isArray(details.place.images) && details.place.images.length > 0
              ? details.place.images
              : prev?.images || (prev?.photo ? [prev.photo] : []),
        }))
      }
    } catch {
      // Keep basic place details
    } finally {
      setDetailsLoading(false)
    }
  }

  // External Action Handlers
  function handleOpenDirections(place) {
    if (!place) return
    const link =
      place.directionsLink ||
      (place.lat && place.lon
        ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`
        : null)
    if (link) {
      Linking.openURL(link).catch(() => {
        Alert.alert('Cannot Open Maps', 'Unable to launch map directions on this device.')
      })
    }
  }

  function handleCallPhone(phoneNumber) {
    if (!phoneNumber) return
    const clean = String(phoneNumber).replace(/[^\d+]/g, '')
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Cannot Call', `Unable to dial ${phoneNumber}.`)
    })
  }

  function handleOpenWebsite(url) {
    if (!url) return
    const formatted = url.startsWith('http') ? url : `https://${url}`
    Linking.openURL(formatted).catch(() => {
      Alert.alert('Cannot Open Website', 'The website link could not be opened.')
    })
  }

  // --- Add to Trip & Pool Handlers (with duplicate protection) ---
  function handleOpenScheduleModal(place) {
    if (!savedTrips || savedTrips.length === 0) {
      Alert.alert(
        'No Trips Available',
        'Please create a trip first before scheduling places.',
        [{ text: 'Plan a Trip', onPress: () => navigation.navigate('TripsTab') }]
      )
      return
    }
    setSelectedPlaceForModal(place)
    setSelectedTripTarget(activeTrip || savedTrips[0])
    setScheduleModalVisible(true)
  }

  function handleScheduleToDay(dayId) {
    if (!selectedPlaceForModal || !selectedTripTarget) return

    const targetTrip = selectedTripTarget
    if (activeTrip && String(activeTrip.id || activeTrip.tripId) !== String(targetTrip.id || targetTrip.tripId)) {
      setActiveTrip(targetTrip)
    }

    addPlaceToDay(dayId, selectedPlaceForModal, targetTrip.id || targetTrip.tripId)
    setScheduleModalVisible(false)
    setDetailsModalVisible(false)

    const dayName = (targetTrip.days || []).find((d) => d.id === dayId)?.shortLabel || 'Selected Day'
    Alert.alert(
      'Added to Itinerary!',
      `"${selectedPlaceForModal.name || selectedPlaceForModal.title}" scheduled into ${dayName}.`,
      [
        { text: 'Keep Exploring' },
        { text: 'View Itinerary', onPress: () => navigation.navigate('Itinerary') },
      ]
    )
  }

  function handleSaveToPoolFromModal(place) {
    const targetTrip = selectedTripTarget || activeTrip || savedTrips[0]
    if (!targetTrip) return

    if (activeTrip && String(activeTrip.id || activeTrip.tripId) !== String(targetTrip.id || targetTrip.tripId)) {
      setActiveTrip(targetTrip)
    }

    addPlaceToPool(place, targetTrip.id || targetTrip.tripId)
    addToWishlist(place)
    setScheduleModalVisible(false)
    setDetailsModalVisible(false)
    Alert.alert('Saved to Pool', `"${place.name || place.title}" added to Places to Visit in "${targetTrip.title}".`)
  }

  function handleCustomCitySubmit(cityNameOverride = null) {
    const raw = (typeof cityNameOverride === 'string' ? cityNameOverride : customCityInput).trim()
    if (!raw) {
      Alert.alert('Required', 'Please enter a Pakistani city name.')
      return
    }
    const formatted = raw.charAt(0).toUpperCase() + raw.slice(1)
    setCustomCityModalVisible(false)
    setCustomCityInput('')
    setSelectedCity(formatted)
    setActiveLocationMode('city')
    setLocationStatusMessage(`Showing places in ${formatted}, Pakistan`)
    loadPlacesForCurrentContext(searchQuery, formatted)
  }

  // Expanded Pakistan-wide city catalog covering all provinces & territories (80+ destinations)
  const popularCities = [
    // Azad Jammu & Kashmir
    'Neelum Valley',
    'Muzaffarabad',
    'Rawalakot',
    'Mirpur',
    'Kotli',
    'Leepa Valley',
    'Bagh',
    'Sharda',
    'Arang Kel',
    'Ratti Gali',
    'Taobat',
    'Bhimber',
    'Haveli',
    'Banjosa Lake',
    'Toli Pir',
    'Pir Chinasi',

    // Gilgit-Baltistan
    'Hunza Valley',
    'Skardu',
    'Gilgit',
    'Fairy Meadows',
    'Naltar Valley',
    'Attabad Lake',
    'Passu Cones',
    'Khaplu',
    'Shigar',
    'Deosai',
    'Astore',
    'Ghizer',
    'Khunjerab Pass',

    // Khyber Pakhtunkhwa
    'Swat',
    'Malam Jabba',
    'Naran',
    'Kaghan',
    'Peshawar',
    'Abbottabad',
    'Nathia Gali',
    'Chitral',
    'Kumrat',
    'Mansehra',
    'Mardan',
    'Haripur',
    'Kohat',
    'Dera Ismail Khan',
    'Bannu',

    // Federal Capital
    'Islamabad',

    // Punjab
    'Lahore',
    'Rawalpindi',
    'Murree',
    'Faisalabad',
    'Multan',
    'Bahawalpur',
    'Gujranwala',
    'Sialkot',
    'Sargodha',
    'Gujrat',
    'Jhelum',
    'Sheikhupura',
    'Sahiwal',
    'Chakwal',
    'Soon Valley',
    'Kasur',
    'Rahim Yar Khan',
    'Dera Ghazi Khan',
    'Attock',
    'Mianwali',
    'Okara',
    'Jhang',
    'Chiniot',
    'Mandi Bahauddin',

    // Sindh
    'Karachi',
    'Hyderabad',
    'Sukkur',
    'Larkana',
    'Thatta',
    'Gorakh Hill',
    'Khairpur',
    'Mirpur Khas',
    'Tharparkar',
    'Nawabshah',
    'Sehwan Sharif',
    'Badin',

    // Balochistan
    'Quetta',
    'Ziarat',
    'Gwadar',
    'Hingol',
    'Kund Malir',
    'Ormara',
    'Khuzdar',
    'Turbat',
    'Sibi',
    'Chaman',
  ]

  // Resolved hero image for the active Place Details view
  const activeDetailImages = useMemo(() => {
    if (!selectedPlaceDetails) return []
    const list = []
    if (selectedPlaceDetails.photo) list.push(selectedPlaceDetails.photo)
    if (selectedPlaceDetails.image && !list.includes(selectedPlaceDetails.image)) {
      list.push(selectedPlaceDetails.image)
    }
    if (Array.isArray(selectedPlaceDetails.images)) {
      selectedPlaceDetails.images.forEach((img) => {
        if (img && typeof img === 'string' && !list.includes(img)) {
          list.push(img)
        }
      })
    }
    if (list.length === 0) {
      list.push(
        getPlaceImage(
          selectedPlaceDetails.id,
          selectedPlaceDetails.category,
          selectedPlaceDetails.name || selectedPlaceDetails.title,
          selectedCity
        )
      )
    }
    return list
  }, [selectedPlaceDetails, selectedCity])

  const savedInfoForSelectedPlace = useMemo(() => {
    return getSavedPlaceLocation(selectedPlaceDetails)
  }, [selectedPlaceDetails, savedPlaceKeys])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Explore Places</Text>
          <Text style={styles.subtitle}>
            {activeLocationMode === 'near_me'
              ? 'Discovering attractions near your current GPS location'
              : `Browse places & attractions in ${selectedCity}`}
          </Text>
        </View>
        {activeTrip?.destination ? (
          <TouchableOpacity
            style={styles.tripBadgeBtn}
            onPress={handleSelectDestinationMode}
            activeOpacity={0.8}
          >
            <Ionicons name="airplane" size={12} color={colors.primary} />
            <Text style={styles.tripBadgeBtnText} numberOfLines={1}>
              {activeTrip.destination}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 2. SEARCH BAR WITH 450MS DEBOUNCE MATCHING WEB */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchQueryChange}
          placeholder={`Search sights, food, hotels in ${activeLocationMode === 'near_me' ? 'current location' : selectedCity}...`}
        />
      </View>

      {/* Location Status Message if any */}
      {locationStatusMessage ? (
        <View style={styles.locationStatusBanner}>
          <Ionicons
            name={activeLocationMode === 'near_me' ? 'navigate-circle' : 'information-circle-outline'}
            size={16}
            color={colors.primary}
          />
          <Text style={styles.locationStatusText}>{locationStatusMessage}</Text>
        </View>
      ) : null}

      <FlatList
        data={places}
        keyExtractor={(item, index) => String(item.id || item.place_id || item.name || `explore-${index}`)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => loadPlacesForCurrentContext()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
            {/* Location Mode Filter Chips */}
            <View style={styles.locationChipsSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
                {/* 1. Trip Destination Chip */}
                {activeTrip?.destination && (
                  <TouchableOpacity
                    style={[
                      styles.locationPill,
                      activeLocationMode === 'destination' && styles.locationPillActive,
                    ]}
                    onPress={handleSelectDestinationMode}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="airplane"
                      size={14}
                      color={activeLocationMode === 'destination' ? colors.textWhite : colors.primary}
                    />
                    <Text
                      style={[
                        styles.locationPillText,
                        activeLocationMode === 'destination' && styles.locationPillTextActive,
                      ]}
                    >
                      Trip: {activeTrip.destination}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 2. Near Me GPS Chip */}
                <TouchableOpacity
                  style={[
                    styles.locationPill,
                    activeLocationMode === 'near_me' && styles.locationPillActive,
                  ]}
                  onPress={handleSelectNearMe}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="locate"
                    size={14}
                    color={activeLocationMode === 'near_me' ? colors.textWhite : colors.primary}
                  />
                  <Text
                    style={[
                      styles.locationPillText,
                      activeLocationMode === 'near_me' && styles.locationPillTextActive,
                    ]}
                  >
                    Near Me (GPS)
                  </Text>
                </TouchableOpacity>

                {/* 3. Popular Pakistani Cities */}
                {popularCities.map((city) => {
                  const isSelected = activeLocationMode === 'city' && selectedCity === city
                  return (
                    <TouchableOpacity
                      key={city}
                      style={[styles.cityPill, isSelected && styles.cityPillActive]}
                      onPress={() => handleSelectCity(city)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="location-sharp"
                        size={12}
                        color={isSelected ? colors.textWhite : colors.textSecondary}
                      />
                      <Text style={[styles.cityPillText, isSelected && styles.cityPillTextActive]}>
                        {city}
                      </Text>
                    </TouchableOpacity>
                  )
                })}

                {/* 4. Custom Pakistani City Button */}
                <TouchableOpacity
                  style={[styles.cityPill, { borderColor: colors.primary, borderWidth: 1.5, borderStyle: 'dashed' }]}
                  onPress={() => setCustomCityModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={13} color={colors.primary} />
                  <Text style={[styles.cityPillText, { color: colors.primary, fontWeight: '700' }]}>
                    Other City
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Complete 8 Web Categories Scroll */}
            <View style={styles.categoriesSection}>
              <View style={styles.catHeaderRow}>
                <Text style={styles.catSectionTitle}>Categories</Text>
                {selectedCat !== 'All' && (
                  <TouchableOpacity onPress={() => setSelectedCat('All')}>
                    <Text style={styles.clearFilterText}>Show all</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesScrollRow}
              >
                {WEB_EXPLORE_CATEGORIES.map((cat) => {
                  const isSelected = selectedCat.toLowerCase() === cat.id.toLowerCase()
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catPillBtn,
                        isSelected && styles.catPillBtnActive,
                      ]}
                      onPress={() => setSelectedCat(isSelected ? 'All' : cat.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.catPillIcon, { backgroundColor: isSelected ? colors.primary : cat.bg }]}>
                        <Ionicons
                          name={cat.icon}
                          size={14}
                          color={isSelected ? colors.textWhite : cat.color}
                        />
                      </View>
                      <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            {/* Section Heading & Place Count */}
            <View style={styles.attractionsHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.attractionsTitle}>
                  {activeLocationMode === 'near_me'
                    ? 'Attractions Near You'
                    : `${selectedCat === 'All' ? 'Places' : selectedCat} in ${selectedCity}`}
                </Text>
                <Text style={styles.attractionsCount}>
                  {loading
                    ? 'Searching Google Maps & Catalog...'
                    : `${places.length} places • ${getCurrentEnvironment() === ENVIRONMENTS.MOCK ? 'Mock Catalog' : 'Live SerpAPI'}`}
                </Text>
              </View>
              {Boolean(searchQuery) && (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => {
                    setSearchQuery('')
                    loadPlacesForCurrentContext('')
                  }}
                >
                  <Ionicons name="close-circle" size={14} color={colors.textTertiary} />
                  <Text style={styles.clearSearchBtnText}>Clear search</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PlaceCard
            place={item}
            onPress={() => handleOpenPlaceDetails(item)}
            onSave={() => handleSaveToPoolFromModal(item)}
            onAddToTrip={() => handleOpenScheduleModal(item)}
            isSaved={isPlaceSaved(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Fetching places & sights...</Text>
            </View>
          ) : fetchError ? (
            <EmptyState
              iconName="cloud-offline-outline"
              title="Could not load places"
              description={fetchError}
              actionTitle="Retry"
              onActionPress={() => loadPlacesForCurrentContext()}
            />
          ) : (
            <EmptyState
              iconName="compass-outline"
              title="No places found"
              description={`No results found for "${searchQuery || selectedCat}" in ${
                activeLocationMode === 'near_me' ? 'your location' : selectedCity
              }. Try another keyword or category.`}
              actionTitle="Reset Search"
              onActionPress={() => {
                setSearchQuery('')
                setSelectedCat('All')
                handleSelectDestinationMode()
              }}
            />
          )
        }
      />

      {/* Modal 1: Complete Place Details & Preview Sheet (Parity with Web SerpExplore Details) */}
      <ModalSheet
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        title={selectedPlaceDetails?.name || selectedPlaceDetails?.title || 'Place Details'}
        subtitle={selectedPlaceDetails?.destination || selectedCity || 'Pakistan'}
      >
        {selectedPlaceDetails && (
          <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
            {/* Hero Image */}
            <View style={styles.detailsHeroContainer}>
              <SafeImage
                source={{
                  uri:
                    activeDetailImages[selectedImageIndex] ||
                    activeDetailImages[0] ||
                    getPlaceImage(
                      selectedPlaceDetails.id,
                      selectedPlaceDetails.category,
                      selectedPlaceDetails.name || selectedPlaceDetails.title,
                      selectedCity
                    ),
                }}
                fallbackUrls={activeDetailImages}
                style={styles.detailsHeroImage}
                resizeMode="cover"
              />
              <View style={styles.detailsHeroBadgeRow}>
                <Badge label={selectedPlaceDetails.category || 'Attraction'} variant="primary" />
                {selectedPlaceDetails.rating != null && !isNaN(Number(selectedPlaceDetails.rating)) ? (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={styles.ratingText}>
                      {Number(selectedPlaceDetails.rating).toFixed(1)}
                      {selectedPlaceDetails.reviewCount || selectedPlaceDetails.reviews || selectedPlaceDetails.reviewsCount
                        ? ` (${selectedPlaceDetails.reviewCount || selectedPlaceDetails.reviews || selectedPlaceDetails.reviewsCount})`
                        : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Multiple Photos Gallery Strip */}
            {activeDetailImages.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.galleryStrip}
                contentContainerStyle={{ gap: 8 }}
              >
                {activeDetailImages.map((imgUrl, idx) => (
                  <TouchableOpacity
                    key={`thumb-${idx}`}
                    onPress={() => setSelectedImageIndex(idx)}
                    activeOpacity={0.8}
                    style={[
                      styles.galleryThumb,
                      selectedImageIndex === idx && styles.galleryThumbActive,
                    ]}
                  >
                    <Image source={{ uri: imgUrl }} style={styles.galleryThumbImg} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.detailsBody}>
              {/* In-Trip Status Banner */}
              {savedInfoForSelectedPlace ? (
                <View style={styles.inTripBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.inTripBannerText}>
                    Already added to your trip ({savedInfoForSelectedPlace})
                  </Text>
                </View>
              ) : null}

              {/* Title & Price / Open Status */}
              <View style={styles.titleRow}>
                <Text style={styles.detailsTitle}>
                  {selectedPlaceDetails.name || selectedPlaceDetails.title}
                </Text>
              </View>

              {/* Status and Price Badges Row */}
              <View style={styles.statusPillsRow}>
                {selectedPlaceDetails.openStatus ? (
                  <View style={styles.openStatusPill}>
                    <Ionicons name="time" size={12} color="#059669" />
                    <Text style={styles.openStatusText}>{selectedPlaceDetails.openStatus}</Text>
                  </View>
                ) : null}
                {selectedPlaceDetails.priceLevel ? (
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>{selectedPlaceDetails.priceLevel}</Text>
                  </View>
                ) : null}
                {selectedPlaceDetails.source === 'serpapi' ? (
                  <View style={styles.sourcePill}>
                    <Ionicons name="logo-google" size={10} color={colors.textSecondary} />
                    <Text style={styles.sourcePillText}>Google Maps</Text>
                  </View>
                ) : null}
              </View>

              {/* Address */}
              <View style={styles.addressRow}>
                <Ionicons name="location" size={15} color={colors.primary} />
                <Text style={styles.detailsAddress}>
                  {selectedPlaceDetails.address || selectedPlaceDetails.destination || selectedCity}
                </Text>
              </View>

              {/* Quick Actions Bar (Directions, Call, Website) */}
              <View style={styles.quickActionsBar}>
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={() => handleOpenDirections(selectedPlaceDetails)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={16} color={colors.primary} />
                  <Text style={styles.quickActionBtnText}>Directions</Text>
                </TouchableOpacity>

                {selectedPlaceDetails.phone || selectedPlaceDetails.phoneNumber ? (
                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => handleCallPhone(selectedPlaceDetails.phone || selectedPlaceDetails.phoneNumber)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={16} color="#0D9488" />
                    <Text style={[styles.quickActionBtnText, { color: '#0D9488' }]}>Call</Text>
                  </TouchableOpacity>
                ) : null}

                {selectedPlaceDetails.website ? (
                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => handleOpenWebsite(selectedPlaceDetails.website)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="globe-outline" size={16} color="#2563EB" />
                    <Text style={[styles.quickActionBtnText, { color: '#2563EB' }]}>Website</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Operating Hours Table/List */}
              {selectedPlaceDetails.operatingHours && typeof selectedPlaceDetails.operatingHours === 'object' && Object.keys(selectedPlaceDetails.operatingHours).length > 0 ? (
                <View style={styles.hoursCard}>
                  <View style={styles.hoursHeaderRow}>
                    <Ionicons name="time-outline" size={15} color={colors.primary} />
                    <Text style={styles.hoursHeading}>Operating Hours</Text>
                  </View>
                  <View style={styles.hoursList}>
                    {Object.entries(selectedPlaceDetails.operatingHours).map(([day, hrs]) => (
                      <View key={day} style={styles.hourRow}>
                        <Text style={styles.hourDay}>{day}</Text>
                        <Text style={styles.hourTime}>{hrs}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : selectedPlaceDetails.hours ? (
                <View style={styles.detailsInfoRow}>
                  <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.detailsInfoText}>{selectedPlaceDetails.hours}</Text>
                </View>
              ) : null}

              {/* Service Options / Amenities Chips */}
              {Array.isArray(selectedPlaceDetails.serviceOptions) && selectedPlaceDetails.serviceOptions.length > 0 ? (
                <View style={styles.amenitiesSection}>
                  <Text style={styles.amenitiesHeading}>Amenities & Highlights</Text>
                  <View style={styles.amenitiesGrid}>
                    {selectedPlaceDetails.serviceOptions.map((opt, idx) => (
                      <View key={`opt-${idx}`} style={styles.amenityChip}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                        <Text style={styles.amenityText}>{opt}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Overview / Description */}
              <Text style={styles.overviewHeading}>About</Text>
              <Text style={styles.detailsDescription}>
                {selectedPlaceDetails.description ||
                  `A popular highlight in ${selectedCity}. Highly rated by visitors and travelers exploring the region.`}
              </Text>

              {/* Top Traveler Reviews Section */}
              {Array.isArray(selectedPlaceDetails.userReviews) && selectedPlaceDetails.userReviews.length > 0 ? (
                <View style={styles.reviewsSection}>
                  <Text style={styles.reviewsHeading}>
                    Traveler Reviews ({selectedPlaceDetails.userReviews.length})
                  </Text>
                  <View style={styles.reviewsList}>
                    {selectedPlaceDetails.userReviews.slice(0, 4).map((rev, idx) => (
                      <View key={`rev-${idx}`} style={styles.reviewCard}>
                        <View style={styles.reviewCardHeader}>
                          <View style={styles.reviewerAvatar}>
                            <Text style={styles.reviewerInitial}>
                              {(rev.user || 'T').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.reviewerName}>{rev.user || 'Traveler'}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="star" size={11} color="#F59E0B" />
                              <Text style={styles.reviewRatingText}>{rev.rating || 5}.0</Text>
                              {rev.date ? (
                                <Text style={styles.reviewDateText}>• {rev.date}</Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                        {rev.snippet ? (
                          <Text style={styles.reviewSnippet} numberOfLines={3}>
                            "{rev.snippet}"
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Action Buttons Row */}
              <View style={styles.detailsActionsRow}>
                <Button
                  title="Save to Pool"
                  variant="outline"
                  iconName="bookmark-outline"
                  pill={true}
                  onPress={() => handleSaveToPoolFromModal(selectedPlaceDetails)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Add to Itinerary"
                  variant="primary"
                  iconName="calendar-outline"
                  pill={true}
                  onPress={() => handleOpenScheduleModal(selectedPlaceDetails)}
                  style={{ flex: 1.2 }}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </ModalSheet>

      {/* Modal 2: Schedule Place to Trip / Day (Places Pool vs Day 1..N) */}
      <ModalSheet
        visible={scheduleModalVisible}
        onClose={() => setScheduleModalVisible(false)}
        title={selectedPlaceForModal ? (selectedPlaceForModal.name || selectedPlaceForModal.title) : 'Add to Trip'}
        subtitle="Schedule in your TripNest workspace"
      >
        {selectedPlaceForModal && (
          <ScrollView style={styles.scheduleModalContent} showsVerticalScrollIndicator={false}>
            {/* Target Trip Picker */}
            <Text style={styles.scheduleHeader}>Target Trip:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tripPickScroll}>
              {savedTrips.map((t, idx) => {
                const isSelected =
                  String(t.id || t.tripId) ===
                  String(selectedTripTarget?.id || selectedTripTarget?.tripId)
                const tripKey = `explore-target-${t.id || t.tripId || idx}`
                return (
                  <TouchableOpacity
                    key={tripKey}
                    style={[styles.tripPickCard, isSelected && styles.tripPickCardActive]}
                    onPress={() => setSelectedTripTarget(t)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="airplane"
                      size={14}
                      color={isSelected ? colors.textWhite : colors.primary}
                    />
                    <Text
                      style={[styles.tripPickText, isSelected && styles.tripPickTextActive]}
                      numberOfLines={1}
                    >
                      {t.title || t.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <Text style={[styles.scheduleHeader, { marginTop: 14 }]}>Where to add?</Text>

            {/* Quick Button: Unscheduled Places Pool */}
            <TouchableOpacity
              style={styles.poolOptionRow}
              onPress={() => handleSaveToPoolFromModal(selectedPlaceForModal)}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIconCircle, { backgroundColor: '#F0FDFA' }]}>
                <Ionicons name="bookmark" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.poolOptionTitle}>Places to Visit (Pool)</Text>
                <Text style={styles.poolOptionDesc}>Keep unscheduled to organize later</Text>
              </View>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </TouchableOpacity>

            <Text style={[styles.scheduleHeader, { marginTop: 14 }]}>Or Schedule to Specific Day:</Text>

            {selectedTripTarget && Array.isArray(selectedTripTarget.days) && selectedTripTarget.days.length > 0 ? (
              <View style={styles.daysList}>
                {selectedTripTarget.days.map((day, idx) => (
                  <TouchableOpacity
                    key={day.id || idx}
                    style={styles.daySelectionRow}
                    onPress={() => handleScheduleToDay(day.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.daySelectionLeft}>
                      <View style={styles.dayNumPill}>
                        <Text style={styles.dayNumText}>DAY {idx + 1}</Text>
                      </View>
                      <View>
                        <Text style={styles.daySelectLabel}>{day.label || `Day ${idx + 1}`}</Text>
                        <Text style={styles.daySelectCount}>
                          {(day.items || []).length} stops currently scheduled
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noDaysText}>
                No days configured for this trip yet. You can add it to the Places Pool above!
              </Text>
            )}
          </ScrollView>
        )}
      </ModalSheet>

      {/* Modal 3: Enter Any Pakistani City */}
      <ModalSheet
        visible={customCityModalVisible}
        onClose={() => setCustomCityModalVisible(false)}
        title="Explore Any Pakistani City"
        subtitle="Search and discover genuine attractions across Pakistan"
      >
        <View style={styles.customCityModalContent}>
          <Text style={styles.customCityLabel}>Enter City Name</Text>
          <View style={styles.customCityInputRow}>
            <Ionicons name="location-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.customCityTextInput}
              placeholder="e.g. Multan, Quetta, Gwadar, Gilgit..."
              placeholderTextColor={colors.textTertiary}
              value={customCityInput}
              onChangeText={setCustomCityInput}
              autoFocus={true}
              onSubmitEditing={() => handleCustomCitySubmit()}
              returnKeyType="search"
            />
          </View>

          <Text style={[styles.customCityLabel, { marginTop: 16 }]}>Quick Suggestions</Text>
          <View style={styles.suggestionGrid}>
            {['Bahawalpur', 'Quetta', 'Multan', 'Faisalabad', 'Hyderabad', 'Gwadar', 'Sukkur', 'Abbottabad'].map((c) => (
              <TouchableOpacity
                key={c}
                style={styles.suggestionChip}
                onPress={() => handleCustomCitySubmit(c)}
                activeOpacity={0.8}
              >
                <Ionicons name="compass-outline" size={13} color={colors.primary} />
                <Text style={styles.suggestionChipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Explore This City"
            variant="primary"
            pill={true}
            size="lg"
            onPress={() => handleCustomCitySubmit()}
            style={{ marginTop: 22 }}
          />
        </View>
      </ModalSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tripBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
    maxWidth: 140,
  },
  tripBadgeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 6,
  },
  locationStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 20,
    borderRadius: 8,
    gap: 6,
    marginBottom: 6,
  },
  locationStatusText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  listHeaderContainer: {
    paddingBottom: 8,
  },
  locationChipsSection: {
    marginVertical: 6,
  },
  horizontalChips: {
    flexDirection: 'row',
    gap: 8,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 6,
  },
  locationPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  locationPillTextActive: {
    color: colors.textWhite,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cityPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cityPillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cityPillTextActive: {
    color: colors.textWhite,
    fontWeight: '700',
  },
  categoriesSection: {
    marginVertical: 10,
  },
  catHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catSectionTitle: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  clearFilterText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  categoriesScrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  catPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  catPillBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  catPillIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  catPillTextActive: {
    color: colors.primaryDark,
  },
  attractionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  attractionsTitle: {
    ...typography.subtitle1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  attractionsCount: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  clearSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearSearchBtnText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  detailsScroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  detailsHeroContainer: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
    backgroundColor: colors.surfaceSubtle,
  },
  detailsHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  detailsHeroBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: colors.textWhite,
    fontWeight: '700',
  },
  galleryStrip: {
    marginBottom: 12,
  },
  galleryThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  galleryThumbActive: {
    borderColor: colors.primary,
  },
  galleryThumbImg: {
    width: '100%',
    height: '100%',
  },
  detailsBody: {
    gap: 8,
  },
  inTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    marginBottom: 4,
  },
  inTripBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  statusPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  openStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  openStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  pricePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pricePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailsAddress: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  quickActionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  quickActionBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  hoursCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
  },
  hoursHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  hoursHeading: {
    ...typography.subtitle2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hoursList: {
    gap: 4,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  hourDay: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hourTime: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  detailsInfoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  amenitiesSection: {
    marginVertical: 4,
  },
  amenitiesHeading: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  amenityText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  overviewHeading: {
    ...typography.subtitle2,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  detailsDescription: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  reviewsSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 10,
  },
  reviewsHeading: {
    ...typography.subtitle2,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  reviewsList: {
    gap: 8,
  },
  reviewCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInitial: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  reviewerName: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewDateText: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  reviewSnippet: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 18,
  },
  detailsActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingBottom: 20,
  },
  scheduleModalContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  scheduleHeader: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tripPickScroll: {
    marginBottom: 8,
  },
  tripPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    gap: 6,
  },
  tripPickCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tripPickText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
    maxWidth: 160,
  },
  tripPickTextActive: {
    color: colors.textWhite,
  },
  poolOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  optionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolOptionTitle: {
    ...typography.subtitle2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  poolOptionDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  daysList: {
    gap: 8,
  },
  daySelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  daySelectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayNumPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  daySelectLabel: {
    ...typography.subtitle2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  daySelectCount: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  noDaysText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  customCityModalContent: {
    paddingVertical: 8,
  },
  customCityLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  customCityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  customCityTextInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.textPrimary,
  },
  suggestionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  suggestionChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
})

export default ExploreScreen
