import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useApp } from '../../context/AppContext'
import { apiService } from '../../api/apiService'
import { apiClient } from '../../api/client'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import {
  DESTINATION_CATALOG,
  RECOMMENDED_PLACES_CATALOG,
  TOP_CURATED_PAKISTAN_PLACES,
  PLACE_IMAGES,
  getDestinationImage,
} from '../../constants/images'
import { getDestinationCoordinates } from '../../utils/locationService'
import { resolveTripDestinationCity } from '../../utils/tripUtils'
import { BRANDING_ASSETS } from '../../../assets/branding'
import { formatDisplayName, getInitials } from '../../utils/profileUtils'
import Card from '../../components/common/Card'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import SearchBar from '../../components/common/SearchBar'
import DestinationCard from '../../components/destinations/DestinationCard'
import PlaceCard from '../../components/places/PlaceCard'
import TripCreationWizard from '../../components/trips/TripCreationWizard'
import AiAssistantModal from '../../components/ai/AiAssistantModal'
import ModalSheet from '../../components/common/ModalSheet'
import { SafeImage } from '../../components/common/SafeImage'
import { findVerifiedLandmark, fetchLiveCuratedAttractions } from '../../services/imageService'

const CURATED_CATEGORIES = [
  { id: 'All', label: 'All Highlights', icon: 'sparkles-outline' },
  { id: 'Attraction', label: 'Top Sights', icon: 'trail-sign-outline' },
  { id: 'Scenic', label: 'Scenic Views', icon: 'camera-outline' },
  { id: 'Dining', label: 'Food & Cafes', icon: 'restaurant-outline' },
  { id: 'Historic', label: 'Heritage', icon: 'business-outline' },
]

const CURATED_CITIES = [
  { id: 'All', label: 'All Pakistan' },
  { id: 'Islamabad', label: 'Islamabad' },
  { id: 'Lahore', label: 'Lahore' },
  { id: 'Karachi', label: 'Karachi' },
  { id: 'Rawalpindi', label: 'Rawalpindi' },
  { id: 'Peshawar', label: 'Peshawar' },
  { id: 'Quetta', label: 'Quetta' },
  { id: 'Multan', label: 'Multan' },
  { id: 'Bahawalpur', label: 'Bahawalpur' },
  { id: 'Faisalabad', label: 'Faisalabad' },
  { id: 'Gujranwala', label: 'Gujranwala' },
  { id: 'Sialkot', label: 'Sialkot' },
  { id: 'Murree', label: 'Murree' },
  { id: 'Swat', label: 'Swat' },
  { id: 'Hunza', label: 'Hunza' },
  { id: 'Skardu', label: 'Skardu' },
  { id: 'Gilgit', label: 'Gilgit' },
  { id: 'Naran', label: 'Naran & Kaghan' },
  { id: 'Abbottabad', label: 'Abbottabad' },
  { id: 'Chitral', label: 'Chitral' },
  { id: 'Kumrat', label: 'Kumrat & Dir' },
  { id: 'Gwadar', label: 'Gwadar' },
  { id: 'Ziarat', label: 'Ziarat' },
  { id: 'Hingol', label: 'Hingol & Kund Malir' },
  { id: 'Sukkur', label: 'Sukkur' },
  { id: 'Hyderabad', label: 'Hyderabad' },
  { id: 'Larkana', label: 'Mohenjo-daro' },
  { id: 'Thatta', label: 'Thatta' },
  { id: 'Muzaffarabad', label: 'Muzaffarabad' },
  { id: 'Neelum', label: 'Neelum Valley' },
  { id: 'Rawalakot', label: 'Rawalakot' },
  { id: 'Mirpur', label: 'Mirpur' },
  { id: 'Leepa', label: 'Leepa Valley' },
  { id: 'Bagh', label: 'Bagh & Ganga Choti' },
  { id: 'Kotli', label: 'Kotli' },
]

function getCanonicalCuratedCategory(place) {
  const cat = String(place.category || '').toLowerCase()
  const tag = String(place.tag || '').toLowerCase()
  const desc = String(place.description || '').toLowerCase()
  const name = String(place.name || place.title || '').toLowerCase()

  if (
    cat.includes('food') || cat.includes('din') || cat.includes('cafe') || cat.includes('restaurant') ||
    tag.includes('food') || tag.includes('cafe') || tag.includes('culinary') || tag.includes('street food') ||
    cat.includes('bakery') || cat.includes('eatery') || cat.includes('bbq') ||
    tag.includes('chai') || tag.includes('dining') || tag.includes('delicacy') ||
    name.includes('cafe') || name.includes('restaurant') || name.includes('food street') ||
    name.includes('bazaar food') || name.includes('shinwari')
  ) {
    return 'Dining'
  }

  if (
    cat.includes('historic') || cat.includes('herit') || cat.includes('museum') ||
    cat.includes('ancient') || cat.includes('fort') || cat.includes('tomb') ||
    cat.includes('shrine') || cat.includes('mosque') || cat.includes('masjid') ||
    cat.includes('necropolis') || cat.includes('archaeolog') || cat.includes('ruins') ||
    cat.includes('palace') || cat.includes('residency') ||
    tag.includes('historic') || tag.includes('heritage') || tag.includes('necropolis') ||
    tag.includes('national symbol') || tag.includes('monument') || tag.includes('colonial') ||
    tag.includes('unesco') || tag.includes('buddhist') || tag.includes('royal') ||
    name.includes('fort') || name.includes('tomb') || name.includes('shrine') ||
    name.includes('museum') || name.includes('masjid') || name.includes('mosque') ||
    name.includes('mausoleum') || name.includes('palace')
  ) {
    return 'Historic'
  }

  if (
    cat.includes('scenic') || cat.includes('view') || cat.includes('nature') ||
    cat.includes('lake') || cat.includes('valley') || cat.includes('waterfall') ||
    cat.includes('pass') || cat.includes('park') || cat.includes('mountain') ||
    cat.includes('desert') || cat.includes('plains') || cat.includes('glacier') ||
    tag.includes('viewpoint') || tag.includes('lake') || tag.includes('waterfall') ||
    tag.includes('nature') || tag.includes('alpine') || tag.includes('panoramic') ||
    tag.includes('vantage') || tag.includes('biosphere') || tag.includes('meadows') ||
    name.includes('lake') || name.includes('viewpoint') || name.includes('waterfall') ||
    name.includes('pass') || name.includes('valley') || name.includes('national park')
  ) {
    return 'Scenic'
  }

  return 'Attraction'
}

function matchesCuratedCity(place, selectedCityId) {
  if (!selectedCityId || selectedCityId === 'All') return true
  const lowerCity = selectedCityId.toLowerCase().trim()
  const pDest = String(place.destination || '').toLowerCase().trim()
  const pAddr = String(place.address || '').toLowerCase().trim()
  const pName = String(place.name || place.title || '').toLowerCase().trim()

  if (pDest.includes(lowerCity) || lowerCity.includes(pDest)) return true
  if (pAddr.includes(lowerCity) || pName.includes(lowerCity)) return true

  if (lowerCity === 'neelum' || lowerCity === 'neelum valley') {
    return (
      pDest.includes('neelum') ||
      pDest.includes('sharda') ||
      pDest.includes('keran') ||
      pDest.includes('arang kel') ||
      pDest.includes('ratti gali') ||
      pDest.includes('kashmir') ||
      pAddr.includes('neelum')
    )
  }
  if (lowerCity === 'swat') {
    return (
      pDest.includes('swat') ||
      pDest.includes('mingora') ||
      pDest.includes('kalam') ||
      pDest.includes('malam') ||
      pDest.includes('fizagat') ||
      pAddr.includes('swat')
    )
  }
  if (lowerCity === 'hunza') {
    return (
      pDest.includes('hunza') ||
      pDest.includes('karimabad') ||
      pDest.includes('attabad') ||
      pDest.includes('passu') ||
      pDest.includes('gulmit') ||
      pDest.includes('khunjerab') ||
      pAddr.includes('hunza')
    )
  }
  if (lowerCity === 'skardu') {
    return (
      pDest.includes('skardu') ||
      pDest.includes('shigar') ||
      pDest.includes('khaplu') ||
      pDest.includes('deosai') ||
      pDest.includes('shangrila') ||
      pAddr.includes('skardu') ||
      pAddr.includes('baltistan')
    )
  }
  if (lowerCity === 'naran') {
    return (
      pDest.includes('naran') ||
      pDest.includes('kaghan') ||
      pDest.includes('saif') ||
      pAddr.includes('kaghan')
    )
  }
  if (lowerCity === 'larkana' || lowerCity === 'mohenjo-daro' || lowerCity === 'mohenjo') {
    return (
      pDest.includes('larkana') ||
      pDest.includes('mohenjo') ||
      pAddr.includes('larkana') ||
      pAddr.includes('mohenjo')
    )
  }
  if (lowerCity === 'hingol') {
    return (
      pDest.includes('hingol') ||
      pDest.includes('kund malir') ||
      pDest.includes('ormara') ||
      pAddr.includes('makran')
    )
  }
  if (lowerCity === 'kumrat') {
    return (
      pDest.includes('kumrat') ||
      pDest.includes('dir') ||
      pAddr.includes('kumrat') ||
      pAddr.includes('dir')
    )
  }
  if (lowerCity === 'rawalakot') {
    return (
      pDest.includes('rawalakot') ||
      pDest.includes('banjosa') ||
      pDest.includes('poonch') ||
      pDest.includes('tolipir')
    )
  }
  if (lowerCity === 'leepa') {
    return (
      pDest.includes('leepa') ||
      pAddr.includes('leepa')
    )
  }
  return false
}

export function HomeScreen({ navigation }) {
  const {
    user,
    savedTrips,
    loadTrips,
    activeTrip,
    setActiveTrip,
    createTrip,
    addPlaceToPool,
    loading,
    userInvitations,
    loadUserInvitations,
    respondToInvitation,
  } = useApp()

  const [weather, setWeather] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [wizardVisible, setWizardVisible] = useState(false)
  const [aiModalVisible, setAiModalVisible] = useState(false)
  const [respondingInviteId, setRespondingInviteId] = useState(null)

  const [helpModalVisible, setHelpModalVisible] = useState(false)

  async function handleStartTemplateTrip(templateKey) {
    try {
      let payload = null
      if (templateKey === 'lahore') {
        payload = {
          title: 'Lahore Heritage Expedition',
          destination: 'Lahore',
          startDate: '2026-11-20',
          endDate: '2026-11-22',
          budget: { amount: 35000, currency: 'PKR' },
          status: 'active',
          days: [
            {
              id: 'day-1',
              label: 'Day 1 - Walled City & Fort',
              items: [
                { id: 'lhr-1', title: 'Badshahi Mosque', category: 'historical', lat: 31.5889, lon: 74.31, startTime: '09:30 AM', visitDetails: { visited: false } },
                { id: 'lhr-2', title: 'Lahore Fort (Shahi Qila)', category: 'historical', lat: 31.5881, lon: 74.3152, startTime: '11:45 AM', visitDetails: { visited: false } },
                { id: 'lhr-3', title: 'Fort Road Food Street', category: 'restaurant', lat: 31.5872, lon: 74.312, startTime: '02:00 PM', visitDetails: { visited: false } },
              ],
            },
            {
              id: 'day-2',
              label: 'Day 2 - Mughal Gardens & History',
              items: [
                { id: 'lhr-4', title: 'Shalimar Gardens', category: 'historical', lat: 31.585, lon: 74.3929, startTime: '10:00 AM', visitDetails: { visited: false } },
                { id: 'lhr-5', title: 'Lahore Museum', category: 'historical', lat: 31.5684, lon: 74.3079, startTime: '02:00 PM', visitDetails: { visited: false } },
              ],
            },
            {
              id: 'day-3',
              label: 'Day 3 - Minar-e-Pakistan & Bazaar',
              items: [
                { id: 'lhr-6', title: 'Minar-e-Pakistan', category: 'historical', lat: 31.5925, lon: 74.3095, startTime: '11:00 AM', visitDetails: { visited: false } },
                { id: 'lhr-7', title: 'Anarkali Bazaar', category: 'urban', lat: 31.569, lon: 74.314, startTime: '03:00 PM', visitDetails: { visited: false } },
              ],
            },
          ],
        }
      } else if (templateKey === 'hunza') {
        payload = {
          title: 'Hunza Valley Discovery',
          destination: 'Hunza',
          startDate: '2026-11-25',
          endDate: '2026-11-27',
          budget: { amount: 65000, currency: 'PKR' },
          status: 'active',
          days: [
            {
              id: 'day-1',
              label: 'Day 1 - Karimabad & Ancient Forts',
              items: [
                { id: 'hnz-1', title: 'Baltit Fort', category: 'historical', lat: 36.3256, lon: 74.6711, startTime: '10:00 AM', visitDetails: { visited: false } },
                { id: 'hnz-2', title: 'Altit Fort', category: 'historical', lat: 36.315, lon: 74.69, startTime: '02:30 PM', visitDetails: { visited: false } },
              ],
            },
            {
              id: 'day-2',
              label: 'Day 2 - Turquoise Attabad Lake & Cones',
              items: [
                { id: 'hnz-3', title: 'Attabad Lake Boating', category: 'scenic', lat: 36.338, lon: 74.867, startTime: '11:00 AM', visitDetails: { visited: false } },
                { id: 'hnz-4', title: 'Passu Cones Viewpoint', category: 'scenic', lat: 36.467, lon: 74.883, startTime: '03:00 PM', visitDetails: { visited: false } },
              ],
            },
          ],
        }
      } else {
        payload = {
          title: 'Islamabad Capital Highlights',
          destination: 'Islamabad',
          startDate: '2026-11-20',
          endDate: '2026-11-22',
          budget: { amount: 25000, currency: 'PKR' },
          status: 'active',
          days: [
            {
              id: 'day-1',
              label: 'Day 1 - Iconic Landmarks & Margalla',
              items: [
                { id: 'isb-1', title: 'Faisal Mosque', category: 'historical', lat: 33.7297, lon: 73.0372, startTime: '10:00 AM', visitDetails: { visited: false } },
                { id: 'isb-2', title: 'Daman-e-Koh Margalla', category: 'scenic', lat: 33.74, lon: 73.05, startTime: '02:00 PM', visitDetails: { visited: false } },
                { id: 'isb-3', title: 'Monal Margalla Hills', category: 'restaurant', lat: 33.76, lon: 73.07, startTime: '06:00 PM', visitDetails: { visited: false } },
              ],
            },
            {
              id: 'day-2',
              label: 'Day 2 - National Heritage & Culture',
              items: [
                { id: 'isb-4', title: 'Pakistan Monument', category: 'historical', lat: 33.693, lon: 73.068, startTime: '11:00 AM', visitDetails: { visited: false } },
                { id: 'isb-5', title: 'Lok Virsa Heritage Museum', category: 'historical', lat: 33.69, lon: 73.07, startTime: '02:30 PM', visitDetails: { visited: false } },
              ],
            },
          ],
        }
      }

      const created = await createTrip(payload)
      if (created?.id || created?.tripId) {
        navigation.navigate('TripDetail', { tripId: created.id || created.tripId })
      }
    } catch (err) {
      Alert.alert('Trip Creation', err?.message || 'Could not start template trip')
    }
  }


  // Determine prominent upcoming trip and destination
  const upcomingTrip = activeTrip || (savedTrips && savedTrips.length > 0 ? savedTrips[0] : null)
  const targetDestination = useMemo(() => {
    return resolveTripDestinationCity(upcomingTrip)
  }, [upcomingTrip])

  useEffect(() => {
    loadWeather(targetDestination)
    if (loadUserInvitations) {
      loadUserInvitations()
    }
  }, [targetDestination])

  async function loadWeather(destName = 'Islamabad') {
    try {
      const coords = getDestinationCoordinates(destName)
      const data = await apiService.getWeather(coords.lat, coords.lon)
      setWeather(data)
    } catch {
      // offline fallback
    }
  }

  const heroImage = upcomingTrip
    ? getDestinationImage(targetDestination)
    : getDestinationImage('Islamabad')

  function handleOpenTrip(trip) {
    setActiveTrip(trip)
    navigation.navigate('TripDetail', { tripId: trip.id || trip.tripId })
  }

  async function handleWizardTripCreated(payload) {
    const created = await createTrip(payload)
    setWizardVisible(false)
    navigation.navigate('TripDetail', { tripId: created.id || created.tripId })
  }

  const [liveLocationSuggestions, setLiveLocationSuggestions] = useState([])
  const homeSearchDebounceTimer = useRef(null)

  // Live nationwide location search with 250ms debounce
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q || q.length < 2) {
      setLiveLocationSuggestions([])
      return
    }
    if (homeSearchDebounceTimer.current) clearTimeout(homeSearchDebounceTimer.current)
    homeSearchDebounceTimer.current = setTimeout(async () => {
      try {
        const res = await apiClient.searchLocations(q, { limit: 5 })
        if (res?.locations?.length > 0) {
          setLiveLocationSuggestions(res.locations)
        }
      } catch {
        // Fallback to static catalog
      }
    }, 250)
    return () => {
      if (homeSearchDebounceTimer.current) clearTimeout(homeSearchDebounceTimer.current)
    }
  }, [searchQuery])

  // Live destination & attraction search suggestions (Issue 3)
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return { destinations: [], places: [], total: 0 }

    const seenNames = new Set()
    const matchedDestinations = []

    // 1. Check local catalog first
    DESTINATION_CATALOG.forEach((d) => {
      const title = (d.title || '').toLowerCase()
      const region = (d.region || '').toLowerCase()
      if (title.includes(q) || region.includes(q)) {
        if (!seenNames.has(title)) {
          seenNames.add(title)
          matchedDestinations.push(d)
        }
      }
    })

    // 2. Add live database suggestions from all across Pakistan
    liveLocationSuggestions.forEach((loc) => {
      const name = (loc.name || '').trim()
      const nameLow = name.toLowerCase()
      if (!seenNames.has(nameLow)) {
        seenNames.add(nameLow)
        matchedDestinations.push({
          id: loc.id || name,
          title: name,
          region: `${loc.province || 'Pakistan'} • ${loc.category || 'Destination'}`,
          province: loc.province,
          lat: loc.lat,
          lon: loc.lon,
        })
      }
    })

    const matchedPlaces = RECOMMENDED_PLACES_CATALOG.filter((p) => {
      const name = (p.name || '').toLowerCase()
      const dest = (p.destination || '').toLowerCase()
      const cat = (p.category || '').toLowerCase()
      return name.includes(q) || dest.includes(q) || cat.includes(q)
    }).slice(0, 5)

    const finalDestinations = matchedDestinations.slice(0, 4)

    return {
      destinations: finalDestinations,
      places: matchedPlaces,
      total: finalDestinations.length + matchedPlaces.length,
    }
  }, [searchQuery, liveLocationSuggestions])

  // Build unified curated catalog combining top regional landmarks and recommended places
  const combinedCuratedPlaces = useMemo(() => {
    const seen = new Set()
    const list = []

    const processItem = (place) => {
      if (!place) return
      const pId = String(place.id || place.place_id || '').toLowerCase().trim()
      const pTitle = String(place.name || place.title || '').trim().toLowerCase()
      // Title normalization to prevent duplicate landmark variations (e.g., "Pakistan Monument" vs "Pakistan Monument Museum")
      const normalizedTitle = pTitle
        .replace(/^(the|a)\s+/i, '')
        .replace(/\b(museum|viewpoint|park|residency|bazaar|garden|gardens)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (seen.has(pId) || (pTitle && seen.has(pTitle)) || (normalizedTitle.length > 5 && seen.has(normalizedTitle))) {
        return
      }
      if (pId) seen.add(pId)
      if (pTitle) seen.add(pTitle)
      if (normalizedTitle.length > 5) seen.add(normalizedTitle)

      const dest = place.destination || ''
      const verified = findVerifiedLandmark(place.id || place.place_id, place.name || place.title, dest)
      const primaryPhoto = (verified && verified.imageUrl) || (place.id && PLACE_IMAGES[place.id]) || place.image || place.photo

      const fallbackUrls = [
        primaryPhoto,
        ...(place.fallbackUrls || []),
        ...((verified && verified.fallbackUrls) || []),
        ...(place.id && PLACE_IMAGES[place.id] ? [PLACE_IMAGES[place.id]] : []),
      ].filter((u, i, self) => u && typeof u === 'string' && u.startsWith('http') && !u.includes('grass-cs') && self.indexOf(u) === i)

      list.push({
        ...place,
        id: place.id || place.place_id || `curated-${list.length}`,
        name: place.name || place.title || 'Attraction',
        title: place.title || place.name || 'Attraction',
        destination: dest,
        image: primaryPhoto,
        photo: primaryPhoto,
        fallbackUrls,
        canonicalCategory: getCanonicalCuratedCategory(place),
        imageVerified: true,
        imageSource: (verified && verified.imageSource) || place.imageSource || 'wikimedia_commons',
        attribution: (verified && verified.attribution) || place.attribution || 'Wikimedia Commons CC / Authentic Tourism Data',
      })
    }

    ;(TOP_CURATED_PAKISTAN_PLACES || []).forEach(processItem)
    ;(RECOMMENDED_PLACES_CATALOG || []).forEach(processItem)

    return list
  }, [])

  const [curatedPlaces, setCuratedPlaces] = useState(combinedCuratedPlaces)
  const [selectedCuratedCategory, setSelectedCuratedCategory] = useState('All')
  const [selectedCuratedCity, setSelectedCuratedCity] = useState('All')

  useEffect(() => {
    setCuratedPlaces(combinedCuratedPlaces)
  }, [combinedCuratedPlaces])

  // Dynamic filtered curated attractions matching active category and city filter
  const displayedCuratedPlaces = useMemo(() => {
    return curatedPlaces.filter((place) => {
      // 1. Category filter
      if (selectedCuratedCategory !== 'All' && place.canonicalCategory !== selectedCuratedCategory) {
        return false
      }
      // 2. City filter
      if (!matchesCuratedCity(place, selectedCuratedCity)) {
        return false
      }
      return true
    })
  }, [curatedPlaces, selectedCuratedCategory, selectedCuratedCity])

  // Synchronize Home curated attractions with live Explore API photographs and metrics
  useEffect(() => {
    let isMounted = true
    async function loadLiveCurated() {
      try {
        const live = await fetchLiveCuratedAttractions(combinedCuratedPlaces.slice(0, 30), apiService)
        if (isMounted && Array.isArray(live) && live.length > 0) {
          const liveMap = new Map(live.map((p) => [String(p.id).toLowerCase(), p]))
          setCuratedPlaces((prev) =>
            prev.map((item) => liveMap.get(String(item.id).toLowerCase()) || item)
          )
        }
      } catch {
        // Keeps verified fallback
      }
    }
    loadLiveCurated()
    return () => {
      isMounted = false
    }
  }, [combinedCuratedPlaces])

  function handleSelectDestinationSuggestion(dest) {
    setSearchQuery('')
    navigation.navigate('ExploreTab', { destination: dest.title })
  }

  function handleSelectPlaceSuggestion(place) {
    setSearchQuery('')
    navigation.navigate('ExploreTab', {
      destination: place.destination,
      query: place.name,
    })
  }

  function handleSearchSubmit() {
    const q = searchQuery.trim()
    if (!q) return
    const matchedDest = DESTINATION_CATALOG.find(
      (d) => d.title.toLowerCase() === q.toLowerCase()
    )
    if (matchedDest) {
      setSearchQuery('')
      navigation.navigate('ExploreTab', { destination: matchedDest.title })
    } else {
      setSearchQuery('')
      navigation.navigate('ExploreTab', { query: q })
    }
  }

  // Greeting based on hour
  const currentHour = new Date().getHours()
  const greetingText =
    currentHour < 12
      ? 'Good morning,'
      : currentHour < 18
      ? 'Good afternoon,'
      : 'Good evening,'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. TOP BRAND APP BAR */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <Image
            source={BRANDING_ASSETS.logoMark}
            style={styles.brandLogoImg}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>TripNest</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.aiHeaderBtn}
            onPress={() => setAiModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={14} color="#0E442B" />
            <Text style={styles.aiHeaderBtnText}>AI</Text>
            <Ionicons name="mic" size={12} color="#059669" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.helpGuideHeaderBtn}
            onPress={() => setHelpModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="help-circle-outline" size={17} color="#0E442B" />
            <Text style={styles.helpGuideHeaderBtnText}>Guide</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => navigation.navigate('ProfileTab')}
            activeOpacity={0.8}
          >
            {user?.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={async () => {
              loadTrips()
              if (loadUserInvitations) loadUserInvitations()
              try {
                const live = await fetchLiveCuratedAttractions(combinedCuratedPlaces.slice(0, 30), apiService)
                if (Array.isArray(live) && live.length > 0) {
                  const liveMap = new Map(live.map((p) => [String(p.id).toLowerCase(), p]))
                  setCuratedPlaces((prev) =>
                    prev.map((item) => liveMap.get(String(item.id).toLowerCase()) || item)
                  )
                }
              } catch {}
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* User Greeting & Search */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingSubtitle}>{greetingText}</Text>
          <Text style={styles.greetingName}>
            {user ? formatDisplayName(user) : 'Traveler'} 👋
          </Text>
        </View>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Where would you like to travel next?"
          style={styles.searchBar}
          returnKeyType="search"
          onSubmitEditing={handleSearchSubmit}
        />

        {/* Live Search Suggestions Dropdown (Issue 3) */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchDropdownCard}>
            <View style={styles.searchDropdownHeader}>
              <Text style={styles.searchDropdownTitle}>
                Suggestions for "{searchQuery.trim()}"
              </Text>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.searchDropdownClear}>Dismiss</Text>
              </TouchableOpacity>
            </View>

            {/* Destinations */}
            {searchSuggestions.destinations.length > 0 && (
              <View style={styles.searchGroup}>
                <Text style={styles.searchGroupHeader}>Destinations</Text>
                {searchSuggestions.destinations.map((d) => (
                  <TouchableOpacity
                    key={`dest-${d.id}`}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectDestinationSuggestion(d)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionIconDest}>
                      <Ionicons name="location-sharp" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionTitle}>{d.title}</Text>
                      <Text style={styles.suggestionSubtitle}>{d.region}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Places / Attractions */}
            {searchSuggestions.places.length > 0 && (
              <View style={styles.searchGroup}>
                <Text style={styles.searchGroupHeader}>Attractions & Places</Text>
                {searchSuggestions.places.map((p) => (
                  <TouchableOpacity
                    key={`place-${p.id}`}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectPlaceSuggestion(p)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionIconPlace}>
                      <Ionicons name="compass-outline" size={16} color={colors.accent} />
                    </View>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionTitle}>{p.name}</Text>
                      <Text style={styles.suggestionSubtitle}>
                        {p.destination} • {p.category}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* No matches */}
            {searchSuggestions.total === 0 && (
              <View style={styles.searchNoMatchesBox}>
                <Ionicons name="search-outline" size={24} color={colors.textTertiary} />
                <Text style={styles.searchNoMatchesText}>
                  No destinations or attractions found matching "{searchQuery.trim()}".
                </Text>
                <TouchableOpacity
                  style={styles.searchExploreBtn}
                  onPress={handleSearchSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.searchExploreBtnText}>Search in Explore</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* PENDING TRIP INVITATIONS */}
        {Array.isArray(userInvitations) && userInvitations.length > 0 && (
          <View style={styles.invitationsSection}>
            <View style={styles.invitationsHeaderRow}>
              <Ionicons name="mail-unread" size={18} color={colors.accent} />
              <Text style={styles.invitationsSectionTitle}>
                Trip Invitations ({userInvitations.length})
              </Text>
            </View>
            {userInvitations.map((inv) => (
              <Card key={inv.id} style={styles.invitationCard}>
                <View style={styles.invitationCardContent}>
                  <View style={styles.invitationAvatar}>
                    <Ionicons name="people" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.invitationTripTitle}>
                      {inv.tripTitle || 'Shared Trip Invitation'}
                    </Text>
                    <Text style={styles.invitationInviter}>
                      Invited by {inv.inviterName || inv.inviterEmail || 'A companion'}
                    </Text>
                  </View>
                </View>
                <View style={styles.invitationActionsRow}>
                  <Button
                    title={respondingInviteId === inv.id ? '...' : 'Accept'}
                    size="sm"
                    pill={true}
                    disabled={respondingInviteId === inv.id}
                    onPress={async () => {
                      setRespondingInviteId(inv.id)
                      try {
                        const res = await respondToInvitation(inv.id, 'accept')
                        if (res?.success) {
                          Alert.alert('Accepted', `You joined "${inv.tripTitle || 'Trip'}"!`)
                        }
                      } finally {
                        setRespondingInviteId(null)
                      }
                    }}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="Decline"
                    variant="outline"
                    size="sm"
                    pill={true}
                    disabled={respondingInviteId === inv.id}
                    onPress={async () => {
                      setRespondingInviteId(inv.id)
                      try {
                        await respondToInvitation(inv.id, 'decline')
                      } finally {
                        setRespondingInviteId(null)
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}



        {/* ==================================================== */}
        {/* WELCOME SECTION (ALWAYS VISIBLE FOR LOGGED IN USERS) */}
        {/* ==================================================== */}
        <View style={styles.welcomeHeroContainer}>
          <View style={styles.onboardingCard}>
            <View style={styles.onboardingHeaderRow}>
              <View style={styles.onboardingIconBox}>
                <Ionicons name="sparkles" size={20} color="#0E442B" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.onboardingTitle}>
                  Welcome, {user ? formatDisplayName(user) : 'Traveler'}! 🌟
                </Text>
                <Text style={styles.onboardingSubtitle}>Your AI Travel Companion for Pakistan</Text>
              </View>
              <TouchableOpacity
                style={styles.onboardingHelpBtn}
                onPress={() => setHelpModalVisible(true)}
              >
                <Ionicons name="information-circle-outline" size={18} color="#059669" />
              </TouchableOpacity>
            </View>

            {/* 3 Simple Steps */}
            <View style={styles.stepsRow}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepItemTitle}>Pick City</Text>
                <Text style={styles.stepItemSub}>530+ places</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color="#94A3B8" style={{ marginTop: 8 }} />
              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepItemTitle}>AI Route</Text>
                <Text style={styles.stepItemSub}>TSP 2-Opt</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color="#94A3B8" style={{ marginTop: 8 }} />
              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepItemTitle}>Track & Enjoy</Text>
                <Text style={styles.stepItemSub}>Smart budget</Text>
              </View>
            </View>

            {/* Quick Actions Row */}
            <View style={styles.onboardingActionsRow}>
              <TouchableOpacity
                style={styles.planFirstTripBtn}
                onPress={() => setWizardVisible(true)}
                activeOpacity={0.88}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.planFirstTripBtnText}>+ Plan Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.howItWorksBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1 }]}
                onPress={() => setAiModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={16} color="#0E442B" />
                <Text style={[styles.howItWorksBtnText, { color: '#0E442B', fontWeight: '800' }]}>Ask AI 🎙️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.howItWorksBtn}
                onPress={() => setHelpModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={16} color="#64748B" />
                <Text style={styles.howItWorksBtnText}>Guide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 3. ACTIVE ITINERARY OR READY-MADE TEMPLATES */}
        {upcomingTrip ? (
          <View style={styles.heroSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Active Itinerary</Text>
                <Text style={styles.sectionSubtitle}>Your next upcoming adventure</Text>
              </View>
              <TouchableOpacity onPress={() => handleOpenTrip(upcomingTrip)}>
                <Text style={styles.seeAllText}>Open Trip →</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => handleOpenTrip(upcomingTrip)}
              activeOpacity={0.92}
            >
              <SafeImage
                source={{ uri: heroImage }}
                fallbackUri={getDestinationImage(targetDestination)}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <View style={styles.heroOverlay} />

              {/* Top Row on Hero */}
              <View style={styles.heroTopRow}>
                <Badge
                  label={upcomingTrip.isTripmate ? 'Shared Expedition' : 'Personal Trip'}
                  variant="primary"
                  iconName="sparkles"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <View style={styles.heroDatesPill}>
                  <Ionicons name="time-outline" size={13} color={colors.textWhite} />
                  <Text style={styles.heroDatesText}>
                    {(upcomingTrip.days || []).length} Days
                  </Text>
                </View>
              </View>

              {/* Bottom Content on Hero */}
              <View style={styles.heroBottomContent}>
                <View style={styles.heroDestinationBadge}>
                  <Ionicons name="location-sharp" size={13} color={colors.accent} />
                  <Text style={styles.heroDestinationText}>
                    {targetDestination}
                  </Text>
                </View>

                <Text style={styles.heroTitle} numberOfLines={1}>
                  {upcomingTrip.title || upcomingTrip.name}
                </Text>

                {/* Hero Stats Pill Row */}
                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStatItem}>
                    <Ionicons name="calendar-outline" size={13} color="rgba(255, 255, 255, 0.9)" />
                    <Text style={styles.heroStatText}>
                      {upcomingTrip.dates || 'Upcoming'}
                    </Text>
                  </View>
                  <Text style={styles.heroDot}>•</Text>
                  <View style={styles.heroStatItem}>
                    <Ionicons name="map-outline" size={13} color="rgba(255, 255, 255, 0.9)" />
                    <Text style={styles.heroStatText}>
                      {(upcomingTrip.days?.flatMap((d) => d.items || []) || []).length} Stops
                    </Text>
                  </View>
                  {weather && (
                    <>
                      <Text style={styles.heroDot}>•</Text>
                      <View style={styles.heroStatItem}>
                        <Ionicons name="partly-sunny-outline" size={13} color="rgba(255, 255, 255, 0.9)" />
                        <Text style={styles.heroStatText}>
                          {weather.temp_c ?? weather.temperature ?? 24}°C {weather.condition || weather.description ? `• ${weather.condition || weather.description}` : ''}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Action CTA inside Hero */}
                <View style={styles.heroActionBtn}>
                  <Text style={styles.heroActionText}>Continue Planning</Text>
                  <Ionicons name="arrow-forward" size={15} color={colors.primaryDark} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.templateSection}>
            <View style={styles.templateHeaderRow}>
              <Text style={styles.templateSectionTitle}>⚡ 1-Tap Ready Itineraries</Text>
              <Text style={styles.templateSectionSub}>Instant pre-planned trips in Pakistan</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
              {/* Lahore Template */}
              <TouchableOpacity
                style={styles.templateCard}
                onPress={() => handleStartTemplateTrip('lahore')}
                activeOpacity={0.88}
              >
                <View style={[styles.templateIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="business" size={20} color="#D97706" />
                </View>
                <Text style={styles.templateCardTitle}>Lahore Heritage</Text>
                <Text style={styles.templateCardMeta}>3 Days • 7 Key Attractions</Text>
                <Text style={styles.templateCardHighlights}>Badshahi Mosque, Shahi Qila, Food Street</Text>
                <View style={styles.templateStartBtn}>
                  <Text style={styles.templateStartBtnText}>Start This Trip</Text>
                  <Ionicons name="arrow-forward" size={12} color="#0E442B" />
                </View>
              </TouchableOpacity>

              {/* Islamabad Template */}
              <TouchableOpacity
                style={styles.templateCard}
                onPress={() => handleStartTemplateTrip('islamabad')}
                activeOpacity={0.88}
              >
                <View style={[styles.templateIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="leaf" size={20} color="#059669" />
                </View>
                <Text style={styles.templateCardTitle}>Islamabad Capital</Text>
                <Text style={styles.templateCardMeta}>2 Days • Margalla & Heritage</Text>
                <Text style={styles.templateCardHighlights}>Faisal Mosque, Daman-e-Koh, Monal</Text>
                <View style={styles.templateStartBtn}>
                  <Text style={styles.templateStartBtnText}>Start This Trip</Text>
                  <Ionicons name="arrow-forward" size={12} color="#0E442B" />
                </View>
              </TouchableOpacity>

              {/* Hunza Template */}
              <TouchableOpacity
                style={styles.templateCard}
                onPress={() => handleStartTemplateTrip('hunza')}
                activeOpacity={0.88}
              >
                <View style={[styles.templateIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="snow" size={20} color="#2563EB" />
                </View>
                <Text style={styles.templateCardTitle}>Hunza Adventure</Text>
                <Text style={styles.templateCardMeta}>2 Days • Lakes & Forts</Text>
                <Text style={styles.templateCardHighlights}>Baltit Fort, Attabad Lake, Passu</Text>
                <View style={styles.templateStartBtn}>
                  <Text style={styles.templateStartBtnText}>Start This Trip</Text>
                  <Ionicons name="arrow-forward" size={12} color="#0E442B" />
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* 4. QUICK PLANNING TOOLS ROW */}
        <View style={styles.quickToolsSection}>
          <Text style={styles.quickToolsHeader}>PLANNING ACTIONS</Text>
          <View style={styles.quickToolsGrid}>
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => setWizardVisible(true)}
              activeOpacity={0.85}
            >
              <View style={[styles.toolIconBox, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </View>
              <View style={styles.toolTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.toolTitle}>Plan a trip</Text>
                  <Badge label="REC" variant="accent" size="sm" />
                </View>
                <Text style={styles.toolDesc}>Choose places and build day-by-day plans</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => navigation.navigate('ExploreTab')}
              activeOpacity={0.85}
            >
              <View style={[styles.toolIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="compass" size={24} color="#2563EB" />
              </View>
              <View style={styles.toolTextCol}>
                <Text style={styles.toolTitle}>Explore destinations</Text>
                <Text style={styles.toolDesc}>Top attractions, viewpoints & food</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. EXPLORE DESTINATIONS CAROUSEL */}
        <View style={styles.carouselSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Featured Destinations</Text>
              <Text style={styles.sectionSubtitle}>Top scenic getaways across Pakistan</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ExploreTab')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollList}
          >
            {DESTINATION_CATALOG.map((dest, idx) => (
              <DestinationCard
                key={'dest-' + (dest.id || 'item') + '-' + idx}
                destination={dest}
                onPress={() => {
                  navigation.navigate('ExploreTab', { destination: dest.title })
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* 6. CURATED ATTRACTIONS (CATEGORIES & CITY FILTERING) */}
        <View style={styles.recommendedSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <View style={styles.sectionTitleBadgeRow}>
                <Text style={styles.sectionTitle}>Curated Attractions</Text>
                <View style={styles.curatedCountBadge}>
                  <Text style={styles.curatedCountBadgeText}>
                    {displayedCuratedPlaces.length}
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                Verified highlights across Pakistan for your wishlist
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('ExploreTab', {
                  destination: selectedCuratedCity !== 'All' ? selectedCuratedCity : undefined,
                  category: selectedCuratedCategory !== 'All' ? selectedCuratedCategory : undefined,
                })
              }
            >
              <Text style={styles.seeAllText}>Browse all</Text>
            </TouchableOpacity>
          </View>

          {/* 4 Core Category Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsScroll}
          >
            {CURATED_CATEGORIES.map((cat) => {
              const isSelected = selectedCuratedCategory === cat.id
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.curatedCategoryTab,
                    isSelected && styles.curatedCategoryTabActive,
                  ]}
                  onPress={() => setSelectedCuratedCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={isSelected ? colors.textWhite : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.curatedCategoryTabText,
                      isSelected && styles.curatedCategoryTabTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* City / Destination Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityChipsScroll}
          >
            {CURATED_CITIES.map((city) => {
              const isSelected = selectedCuratedCity === city.id
              return (
                <TouchableOpacity
                  key={city.id}
                  style={[
                    styles.cityFilterChip,
                    isSelected && styles.cityFilterChipActive,
                  ]}
                  onPress={() => setSelectedCuratedCity(city.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cityFilterChipText,
                      isSelected && styles.cityFilterChipTextActive,
                    ]}
                  >
                    {city.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {displayedCuratedPlaces.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollList}
            >
              {displayedCuratedPlaces.map((place) => (
                <View key={place.id} style={styles.recCardWrapper}>
                  <PlaceCard
                    place={place}
                    compact={false}
                    onPress={() =>
                      navigation.navigate('ExploreTab', {
                        destination: place.destination,
                        query: place.name || place.title,
                      })
                    }
                    onSave={() => {
                      addPlaceToPool(place)
                      Alert.alert('Saved to Pool', `"${place.name}" added to your saved places pool!`)
                    }}
                    onAddToTrip={() => {
                      addPlaceToPool(place)
                      Alert.alert('Saved to Trip', `"${place.name}" added to your active trip pool!`)
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.curatedEmptyState}>
              <Ionicons name="compass-outline" size={36} color={colors.textTertiary} />
              <Text style={styles.curatedEmptyTitle}>No matching attractions</Text>
              <Text style={styles.curatedEmptySubtitle}>
                No verified places found for "{selectedCuratedCity}" in "{CURATED_CATEGORIES.find((c) => c.id === selectedCuratedCategory)?.label || selectedCuratedCategory}".
              </Text>
              <TouchableOpacity
                style={styles.curatedResetBtn}
                onPress={() => {
                  setSelectedCuratedCategory('All')
                  setSelectedCuratedCity('All')
                }}
              >
                <Text style={styles.curatedResetBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* GUIDED TRIP CREATION WIZARD MODAL */}
      
      {/* BEGINNER'S GUIDE & HELP MODAL SHEET */}
      <ModalSheet
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
        title="Welcome to TripNest Guide"
        subtitle="How to plan, optimize, and travel Pakistan with ease"
      >
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {/* Guide Item 1 */}
          <View style={styles.guideStepRow}>
            <View style={[styles.guideStepIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="compass" size={22} color="#059669" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.guideStepTitle}>1. Discover 530+ Curated Sights</Text>
              <Text style={styles.guideStepDesc}>
                Explore verified destinations in Pakistan — from heritage forts and mosques to scenic alpine lakes and local bazaars.
              </Text>
            </View>
          </View>

          {/* Guide Item 2 */}
          <View style={styles.guideStepRow}>
            <View style={[styles.guideStepIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="flash" size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.guideStepTitle}>2. AI Route Optimization (TSP 2-Opt)</Text>
              <Text style={styles.guideStepDesc}>
                Tap "Optimize" on any day! The algorithm automatically reorders your stops to minimize driving distance, saving fuel and time.
              </Text>
            </View>
          </View>

          {/* Guide Item 3 */}
          <View style={styles.guideStepRow}>
            <View style={[styles.guideStepIconBox, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="wallet" size={22} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.guideStepTitle}>3. Smart Budget & Tripmates</Text>
              <Text style={styles.guideStepDesc}>
                Set trip budget targets, track categories (Food, Hotel, Transport), and invite friends to split expenses with automated settlements.
              </Text>
            </View>
          </View>

          {/* Guide Item 4 */}
          <View style={styles.guideStepRow}>
            <View style={[styles.guideStepIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="flag" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.guideStepTitle}>4. Complete Trip & Plan Next</Text>
              <Text style={styles.guideStepDesc}>
                Mark stops visited as you travel. When done, tap "End Trip" to save your journey, or "+ Next Trip" to plan your next adventure!
              </Text>
            </View>
          </View>

          <Button
            title="Got it, Let's Travel!"
            variant="primary"
            pill={true}
            size="lg"
            fullWidth={true}
            onPress={() => setHelpModalVisible(false)}
            style={{ marginTop: 16, marginBottom: 12 }}
          />
        </ScrollView>
      </ModalSheet>

      <TripCreationWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onTripCreated={handleWizardTripCreated}
      />
          {/* FLOATING AI ASSISTANT ACTION BUTTON */}
      <TouchableOpacity
        style={styles.floatingAiFab}
        onPress={() => setAiModalVisible(true)}
        activeOpacity={0.88}
        accessibilityLabel="Ask TripNest AI Travel Guide"
      >
        <View style={styles.floatingAiFabIconBox}>
          <Ionicons name="sparkles" size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.floatingAiFabText}>AI Guide</Text>
        <View style={styles.floatingAiFabMicBox}>
          <Ionicons name="mic" size={12} color="#0E442B" />
        </View>
      </TouchableOpacity>

      {/* AI ASSISTANT MODAL */}
      <AiAssistantModal visible={aiModalVisible} initialVoiceMode={true}
        onClose={() => setAiModalVisible(false)}
        initialContext={upcomingTrip?.destination || 'Pakistan Travel'}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  aiHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
  },
  aiHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0E442B',
  },
  floatingAiFab: {
    position: 'absolute',
    bottom: 84,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E442B',
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 28,
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    gap: 6,
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  floatingAiFabIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingAiFabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  floatingAiFabMicBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },


  helpGuideHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
  },
  helpGuideHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E442B',
  },
  welcomeHeroContainer: {
    width: '100%',
  },
  onboardingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 14,
  },
  onboardingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onboardingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  onboardingSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  onboardingHelpBtn: {
    padding: 6,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 14,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0E442B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  stepItemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepItemSub: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  onboardingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planFirstTripBtn: {
    flex: 1.3,
    backgroundColor: '#0E442B',
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  planFirstTripBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  howItWorksBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  howItWorksBtnText: {
    color: '#0E442B',
    fontSize: 13,
    fontWeight: '700',
  },
  templateSection: {
    marginTop: 4,
    marginBottom: 6,
  },
  templateHeaderRow: {
    marginBottom: 8,
  },
  templateSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  templateSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  templateScroll: {
    paddingRight: 10,
    gap: 10,
  },
  templateCard: {
    width: 175,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  templateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  templateCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  templateCardMeta: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  },
  templateCardHighlights: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 14,
    height: 28,
  },
  templateStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: '#ECFDF5',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  templateStartBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0E442B',
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  guideStepIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  guideStepDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },

  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.textWhite,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  greetingSection: {
    marginBottom: 8,
  },
  greetingSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
  },
  greetingName: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
    marginTop: 2,
  },
  searchBar: {
    marginVertical: 10,
  },
  searchDropdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  searchDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: 8,
  },
  searchDropdownTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    flex: 1,
  },
  searchDropdownClear: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 8,
  },
  searchGroup: {
    marginBottom: 8,
  },
  searchGroupHeader: {
    ...typography.caption,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textTertiary,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    marginBottom: 6,
  },
  suggestionIconDest: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionIconPlace: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionTitle: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  suggestionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  searchNoMatchesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchNoMatchesText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
  },
  searchExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    marginTop: 4,
  },
  searchExploreBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  // Hero section
  heroSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  heroCard: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: 16,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.44)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  heroDatesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroDatesText: {
    fontSize: 11,
    color: colors.textWhite,
    fontWeight: '700',
  },
  heroBottomContent: {
    zIndex: 2,
  },
  heroDestinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  heroDestinationText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.textWhite,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroStatText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  heroDot: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  heroActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  emptyHeroCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
  },
  emptyHeroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyHeroTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  emptyHeroSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  // Quick tools
  quickToolsSection: {
    marginBottom: 20,
  },
  quickToolsHeader: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  quickToolsGrid: {
    gap: 10,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  toolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  toolTextCol: {
    flex: 1,
  },
  toolTitle: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  toolDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Carousels
  carouselSection: {
    marginBottom: 20,
  },
  recommendedSection: {
    marginBottom: 16,
  },
  sectionTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  curatedCountBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  curatedCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  categoryTabsScroll: {
    flexDirection: 'row',
    paddingVertical: 8,
    gap: 8,
  },
  curatedCategoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  curatedCategoryTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  curatedCategoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  curatedCategoryTabTextActive: {
    color: colors.textWhite,
    fontWeight: '700',
  },
  cityChipsScroll: {
    flexDirection: 'row',
    paddingBottom: 10,
    gap: 6,
  },
  cityFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant || '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cityFilterChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  cityFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cityFilterChipTextActive: {
    color: colors.textWhite,
    fontWeight: '700',
  },
  curatedEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginVertical: 12,
  },
  curatedEmptyTitle: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 8,
  },
  curatedEmptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    maxWidth: 280,
  },
  curatedResetBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  curatedResetBtnText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalScrollList: {
    paddingVertical: 4,
  },
  recCardWrapper: {
    width: 260,
    marginRight: 14,
  },
  invitationsSection: {
    marginBottom: 16,
  },
  invitationsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  invitationsSectionTitle: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  invitationCard: {
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  invitationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  invitationAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationTripTitle: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  invitationInviter: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  invitationActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})

export default HomeScreen
