import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../../api/client'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import {
  DESTINATION_CATALOG,
  getDestinationImage,
  getPlacesForDestination,
} from '../../constants/images'
import {
  addDaysToIso,
  isoToDateString,
  formatDayLabel,
  formatMonthDayDisplay,
  countDaysBetweenIso,
  toNormalizedIsoDate,
  formatTripDateRange,
  buildDaysFromDateRange,
  buildNewTripPayload,
  getPlaceLatLon,
  optimizePlaceSequence,
} from '../../utils/tripUtils'
import {
  guessProvinceFromTripName,
  PROVINCE_COORDS,
  getDestinationCoordinates,
} from '../../utils/locationService'
import Badge from '../common/Badge'
import { CalendarPicker } from '../common/CalendarPicker'
import { SafeImage } from '../common/SafeImage'

// Major Pakistan Destinations
const DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1)

export const QUICK_DESTINATIONS = [
  { id: 'Islamabad', name: 'Islamabad', province: 'Federal Capital' },
  { id: 'Neelum Valley', name: 'Neelum Valley', province: 'Azad Kashmir' },
  { id: 'Lahore', name: 'Lahore', province: 'Punjab' },
  { id: 'Muzaffarabad', name: 'Muzaffarabad', province: 'Azad Kashmir' },
  { id: 'Karachi', name: 'Karachi', province: 'Sindh' },
  { id: 'Hunza Valley', name: 'Hunza Valley', province: 'Gilgit-Baltistan' },
  { id: 'Rawalakot', name: 'Rawalakot', province: 'Azad Kashmir' },
  { id: 'Skardu', name: 'Skardu', province: 'Gilgit-Baltistan' },
  { id: 'Swat', name: 'Swat Valley', province: 'Khyber Pakhtunkhwa' },
  { id: 'Murree', name: 'Murree Hills', province: 'Punjab' },
  { id: 'Mirpur', name: 'Mirpur', province: 'Azad Kashmir' },
  { id: 'Gilgit', name: 'Gilgit', province: 'Gilgit-Baltistan' },
  { id: 'Naran', name: 'Naran & Kaghan', province: 'Khyber Pakhtunkhwa' },
  { id: 'Peshawar', name: 'Peshawar', province: 'Khyber Pakhtunkhwa' },
  { id: 'Leepa Valley', name: 'Leepa Valley', province: 'Azad Kashmir' },
  { id: 'Gwadar', name: 'Gwadar', province: 'Balochistan' },
  { id: 'Quetta', name: 'Quetta', province: 'Balochistan' },
  { id: 'Bagh', name: 'Bagh', province: 'Azad Kashmir' },
  { id: 'Faisalabad', name: 'Faisalabad', province: 'Punjab' },
  { id: 'Multan', name: 'Multan', province: 'Punjab' },
  { id: 'Abbottabad', name: 'Abbottabad', province: 'Khyber Pakhtunkhwa' },
  { id: 'Chitral', name: 'Chitral', province: 'Khyber Pakhtunkhwa' },
  { id: 'Ziarat', name: 'Ziarat', province: 'Balochistan' },
  { id: 'Bahawalpur', name: 'Bahawalpur', province: 'Punjab' },
]

export const ALL_PAKISTAN_CITIES = [
  // --- AZAD JAMMU & KASHMIR (AJK) ---
  { id: 'Neelum Valley', name: 'Neelum Valley', province: 'Azad Kashmir' },
  { id: 'Muzaffarabad', name: 'Muzaffarabad', province: 'Azad Kashmir' },
  { id: 'Rawalakot', name: 'Rawalakot & Banjosa', province: 'Azad Kashmir' },
  { id: 'Mirpur', name: 'Mirpur', province: 'Azad Kashmir' },
  { id: 'Kotli', name: 'Kotli', province: 'Azad Kashmir' },
  { id: 'Leepa Valley', name: 'Leepa Valley', province: 'Azad Kashmir' },
  { id: 'Bagh', name: 'Bagh & Ganga Choti', province: 'Azad Kashmir' },
  { id: 'Sharda', name: 'Sharda & Arang Kel', province: 'Azad Kashmir' },
  { id: 'Ratti Gali', name: 'Ratti Gali Lake', province: 'Azad Kashmir' },
  { id: 'Taobat', name: 'Taobat', province: 'Azad Kashmir' },
  { id: 'Bhimber', name: 'Bhimber', province: 'Azad Kashmir' },
  { id: 'Haveli', name: 'Haveli / Kahuta', province: 'Azad Kashmir' },
  { id: 'Banjosa Lake', name: 'Banjosa Lake', province: 'Azad Kashmir' },
  { id: 'Toli Pir', name: 'Toli Pir Peak', province: 'Azad Kashmir' },
  { id: 'Pir Chinasi', name: 'Pir Chinasi', province: 'Azad Kashmir' },

  // --- GILGIT-BALTISTAN (GB) ---
  { id: 'Hunza Valley', name: 'Hunza Valley', province: 'Gilgit-Baltistan' },
  { id: 'Skardu', name: 'Skardu', province: 'Gilgit-Baltistan' },
  { id: 'Gilgit', name: 'Gilgit', province: 'Gilgit-Baltistan' },
  { id: 'Fairy Meadows', name: 'Fairy Meadows & Nanga Parbat', province: 'Gilgit-Baltistan' },
  { id: 'Naltar Valley', name: 'Naltar Valley', province: 'Gilgit-Baltistan' },
  { id: 'Attabad Lake', name: 'Attabad Lake', province: 'Gilgit-Baltistan' },
  { id: 'Passu Cones', name: 'Passu Cones & Gojal', province: 'Gilgit-Baltistan' },
  { id: 'Khaplu', name: 'Khaplu', province: 'Gilgit-Baltistan' },
  { id: 'Shigar', name: 'Shigar Valley', province: 'Gilgit-Baltistan' },
  { id: 'Deosai', name: 'Deosai National Park', province: 'Gilgit-Baltistan' },
  { id: 'Astore', name: 'Astore Valley & Rama', province: 'Gilgit-Baltistan' },
  { id: 'Ghizer', name: 'Ghizer & Phander Valley', province: 'Gilgit-Baltistan' },
  { id: 'Khunjerab Pass', name: 'Khunjerab Pass', province: 'Gilgit-Baltistan' },

  // --- KHYBER PAKHTUNKHWA (KPK) ---
  { id: 'Swat', name: 'Swat Valley', province: 'Khyber Pakhtunkhwa' },
  { id: 'Malam Jabba', name: 'Malam Jabba Ski Resort', province: 'Khyber Pakhtunkhwa' },
  { id: 'Naran', name: 'Naran & Kaghan', province: 'Khyber Pakhtunkhwa' },
  { id: 'Peshawar', name: 'Peshawar', province: 'Khyber Pakhtunkhwa' },
  { id: 'Abbottabad', name: 'Abbottabad', province: 'Khyber Pakhtunkhwa' },
  { id: 'Nathia Gali', name: 'Nathia Gali & Galyat', province: 'Khyber Pakhtunkhwa' },
  { id: 'Chitral', name: 'Chitral & Kalash Valley', province: 'Khyber Pakhtunkhwa' },
  { id: 'Kumrat', name: 'Kumrat Valley & Dir', province: 'Khyber Pakhtunkhwa' },
  { id: 'Mansehra', name: 'Mansehra', province: 'Khyber Pakhtunkhwa' },
  { id: 'Mardan', name: 'Mardan', province: 'Khyber Pakhtunkhwa' },
  { id: 'Haripur', name: 'Haripur & Khanpur Lake', province: 'Khyber Pakhtunkhwa' },
  { id: 'Kohat', name: 'Kohat', province: 'Khyber Pakhtunkhwa' },
  { id: 'Dera Ismail Khan', name: 'Dera Ismail Khan', province: 'Khyber Pakhtunkhwa' },
  { id: 'Bannu', name: 'Bannu', province: 'Khyber Pakhtunkhwa' },

  // --- FEDERAL CAPITAL ---
  { id: 'Islamabad', name: 'Islamabad', province: 'Federal Capital' },

  // --- PUNJAB ---
  { id: 'Lahore', name: 'Lahore', province: 'Punjab' },
  { id: 'Rawalpindi', name: 'Rawalpindi', province: 'Punjab' },
  { id: 'Murree', name: 'Murree Hills & Patriata', province: 'Punjab' },
  { id: 'Faisalabad', name: 'Faisalabad', province: 'Punjab' },
  { id: 'Multan', name: 'Multan', province: 'Punjab' },
  { id: 'Bahawalpur', name: 'Bahawalpur & Cholistan', province: 'Punjab' },
  { id: 'Gujranwala', name: 'Gujranwala', province: 'Punjab' },
  { id: 'Sialkot', name: 'Sialkot', province: 'Punjab' },
  { id: 'Sargodha', name: 'Sargodha', province: 'Punjab' },
  { id: 'Gujrat', name: 'Gujrat', province: 'Punjab' },
  { id: 'Jhelum', name: 'Jhelum & Rohtas Fort', province: 'Punjab' },
  { id: 'Sheikhupura', name: 'Sheikhupura & Hiran Minar', province: 'Punjab' },
  { id: 'Sahiwal', name: 'Sahiwal', province: 'Punjab' },
  { id: 'Chakwal', name: 'Chakwal & Katas Raj', province: 'Punjab' },
  { id: 'Soon Valley', name: 'Soon Valley', province: 'Punjab' },
  { id: 'Kasur', name: 'Kasur', province: 'Punjab' },
  { id: 'Rahim Yar Khan', name: 'Rahim Yar Khan', province: 'Punjab' },
  { id: 'Dera Ghazi Khan', name: 'Dera Ghazi Khan', province: 'Punjab' },
  { id: 'Attock', name: 'Attock', province: 'Punjab' },
  { id: 'Mianwali', name: 'Mianwali', province: 'Punjab' },
  { id: 'Okara', name: 'Okara', province: 'Punjab' },
  { id: 'Jhang', name: 'Jhang', province: 'Punjab' },
  { id: 'Chiniot', name: 'Chiniot', province: 'Punjab' },
  { id: 'Mandi Bahauddin', name: 'Mandi Bahauddin', province: 'Punjab' },

  // --- SINDH ---
  { id: 'Karachi', name: 'Karachi', province: 'Sindh' },
  { id: 'Hyderabad', name: 'Hyderabad', province: 'Sindh' },
  { id: 'Sukkur', name: 'Sukkur & Rohri', province: 'Sindh' },
  { id: 'Larkana', name: 'Larkana & Mohenjo-Daro', province: 'Sindh' },
  { id: 'Thatta', name: 'Thatta & Keenjhar Lake', province: 'Sindh' },
  { id: 'Gorakh Hill', name: 'Gorakh Hill Station', province: 'Sindh' },
  { id: 'Khairpur', name: 'Khairpur & Kot Diji', province: 'Sindh' },
  { id: 'Mirpur Khas', name: 'Mirpur Khas', province: 'Sindh' },
  { id: 'Tharparkar', name: 'Tharparkar & Mithi', province: 'Sindh' },
  { id: 'Nawabshah', name: 'Nawabshah', province: 'Sindh' },
  { id: 'Sehwan Sharif', name: 'Sehwan Sharif', province: 'Sindh' },
  { id: 'Badin', name: 'Badin', province: 'Sindh' },

  // --- BALOCHISTAN ---
  { id: 'Quetta', name: 'Quetta & Hanna Lake', province: 'Balochistan' },
  { id: 'Ziarat', name: 'Ziarat & Juniper Forest', province: 'Balochistan' },
  { id: 'Gwadar', name: 'Gwadar', province: 'Balochistan' },
  { id: 'Hingol', name: 'Hingol & Kund Malir', province: 'Balochistan' },
  { id: 'Ormara', name: 'Ormara Beach', province: 'Balochistan' },
  { id: 'Khuzdar', name: 'Khuzdar & Moola Chotok', province: 'Balochistan' },
  { id: 'Turbat', name: 'Turbat', province: 'Balochistan' },
  { id: 'Sibi', name: 'Sibi & Bolan Pass', province: 'Balochistan' },
  { id: 'Lasbela', name: 'Lasbela & Hub', province: 'Balochistan' },
  { id: 'Zhob', name: 'Zhob', province: 'Balochistan' },
  { id: 'Chaman', name: 'Chaman', province: 'Balochistan' },
  { id: 'Pasni', name: 'Pasni & Astola Island', province: 'Balochistan' },
]

const POPULAR_CITIES = QUICK_DESTINATIONS

function getTodayIso() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function TripCreationWizard({ visible, onClose, onTripCreated }) {
  const insets = useSafeAreaInsets()
  const todayIso = useMemo(() => getTodayIso(), [])

  // 1. Destination City
  const [selectedCity, setSelectedCity] = useState(QUICK_DESTINATIONS[0]) // Islamabad
  const [isCityModalOpen, setIsCityModalOpen] = useState(false)
  const [citySearchQuery, setCitySearchQuery] = useState('')
  const [selectedProvinceFilter, setSelectedProvinceFilter] = useState('All')
  const [liveSearchResults, setLiveSearchResults] = useState([])
  const liveSearchTimer = useRef(null)

  // Live nationwide location search with 250ms debounce
  useEffect(() => {
    const q = citySearchQuery.trim()
    if (!q || q.length < 2) {
      setLiveSearchResults([])
      return
    }
    if (liveSearchTimer.current) clearTimeout(liveSearchTimer.current)
    liveSearchTimer.current = setTimeout(async () => {
      try {
        const res = await apiClient.searchLocations(q, {
          province: selectedProvinceFilter === 'All' ? '' : selectedProvinceFilter,
          limit: 12,
        })
        if (res?.locations?.length > 0) {
          setLiveSearchResults(res.locations)
        }
      } catch {
        // Fallback to local catalog
      }
    }, 250)
    return () => {
      if (liveSearchTimer.current) clearTimeout(liveSearchTimer.current)
    }
  }, [citySearchQuery, selectedProvinceFilter])

  // 2. Travel Dates
  const [startDate, setStartDate] = useState(addDaysToIso(todayIso, 7))
  const [endDate, setEndDate] = useState(addDaysToIso(todayIso, 11))

  // 3. Draft Dates for CalendarPicker Modal
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const daysScrollRef = React.useRef(null)
  const [draftStartDate, setDraftStartDate] = useState(startDate)
  const [draftEndDate, setDraftEndDate] = useState(endDate)

  // Auto-scroll days pills to active selected day
  useEffect(() => {
    if (isDateModalOpen && daysScrollRef.current && draftDaysCount >= 1) {
      const targetX = Math.max(0, (draftDaysCount - 2) * 76)
      daysScrollRef.current.scrollTo({ x: targetX, animated: true })
    }
  }, [draftDaysCount, isDateModalOpen])

  const draftDaysCount = useMemo(() => {
    if (!draftStartDate || !draftEndDate) return 1
    return Math.max(1, Math.min(30, countDaysBetweenIso(draftStartDate, draftEndDate)))
  }, [draftStartDate, draftEndDate])

  function handleSetDays(daysNum) {
    const validDays = Math.max(1, Math.min(30, daysNum))
    let baseStart = draftStartDate || todayIso
    if (baseStart < todayIso) {
      baseStart = todayIso
    }
    setDraftStartDate(baseStart)
    setDraftEndDate(addDaysToIso(baseStart, validDays - 1))
  }

  function handleSelectFuturePreset(presetType) {
    let s = todayIso
    let days = 4
    if (presetType === 'today') {
      s = todayIso
      days = 3
    } else if (presetType === 'tomorrow') {
      s = addDaysToIso(todayIso, 1)
      days = 4
    } else if (presetType === 'weekend') {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const daysUntilFri = (5 - dayOfWeek + 7) % 7 || 7
      s = addDaysToIso(todayIso, daysUntilFri)
      days = 3
    } else if (presetType === 'next_week') {
      s = addDaysToIso(todayIso, 7)
      days = 5
    } else if (presetType === 'next_month') {
      s = addDaysToIso(todayIso, 30)
      days = 7
    }
    setDraftStartDate(s)
    setDraftEndDate(addDaysToIso(s, days - 1))
  }

  // 4. Selected Places in Destination City
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Reset state when opening
  useEffect(() => {
    if (visible) {
      setErrorMessage('')
      setIsSubmitting(false)
      setCitySearchQuery('')
    }
  }, [visible])

  // Destination City Places Catalog (Authentic places for THAT specific city!)
  const availablePlaces = useMemo(() => {
    return getPlacesForDestination(selectedCity.name)
  }, [selectedCity.name])

  // Pre-select top 6 places when destination changes
  useEffect(() => {
    if (Array.isArray(availablePlaces) && availablePlaces.length > 0) {
      setSelectedPlaceIds(availablePlaces.slice(0, 6).map((p) => p.id))
    } else {
      setSelectedPlaceIds([])
    }
  }, [availablePlaces, selectedCity.name])

  // Calculate duration
  const daysCount = useMemo(() => {
    const s = toNormalizedIsoDate(startDate)
    const e = toNormalizedIsoDate(endDate)
    if (!s || !e || e < s) return 1
    return countDaysBetweenIso(s, e)
  }, [startDate, endDate])

  // Open & Confirm Calendar Picker Modal (Strictly Future Dates)
  function openDateModal() {
    let s = startDate
    if (!s || s < todayIso) {
      s = todayIso
    }
    let e = endDate
    if (!e || e < s) {
      e = addDaysToIso(s, 3)
    }
    setDraftStartDate(s)
    setDraftEndDate(e)
    setIsDateModalOpen(true)
  }

  function handleConfirmDates() {
    let finalStart = draftStartDate || startDate || todayIso
    if (finalStart < todayIso) {
      finalStart = todayIso
    }
    let finalEnd = draftEndDate || finalStart
    if (finalEnd < finalStart) {
      finalEnd = finalStart
    }
    setStartDate(finalStart)
    setEndDate(finalEnd)
    setIsDateModalOpen(false)
  }

  // Toggle single place selection
  function handleTogglePlace(placeId) {
    if (selectedPlaceIds.includes(placeId)) {
      setSelectedPlaceIds((prev) => prev.filter((id) => id !== placeId))
    } else {
      setSelectedPlaceIds((prev) => [...prev, placeId])
    }
  }

  // Final Trip Creation Execution
  async function handleCreateTrip() {
    if (!selectedCity || !selectedCity.name) {
      setErrorMessage('Please select a destination city.')
      return
    }

    const normStart = toNormalizedIsoDate(startDate) || addDaysToIso(todayIso, 7)
    const normEnd = toNormalizedIsoDate(endDate) || addDaysToIso(normStart, 3)

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const destCoords = getDestinationCoordinates(selectedCity.name)
      const chosenPlaces = availablePlaces.filter((p) => selectedPlaceIds.includes(p.id))
      const rawPlaces = chosenPlaces.length > 0 ? chosenPlaces : availablePlaces.slice(0, 4)

      // TSP 2-Opt Optimization for realistic sequence
      const fullTourOpt = optimizePlaceSequence(
        rawPlaces,
        destCoords.lat,
        destCoords.lon,
        30.0,
        false
      )
      const sequencedTour = fullTourOpt.orderedPlaces || rawPlaces

      // Distribute places across days
      const totalDays = Math.max(1, daysCount)
      const days = []
      let cursor = 0
      const placesPerDayBase = Math.floor(sequencedTour.length / totalDays)
      const remainder = sequencedTour.length % totalDays

      for (let i = 1; i <= totalDays; i++) {
        const countForThisDay = placesPerDayBase + (i <= remainder ? 1 : 0)
        const daySlice = sequencedTour.slice(cursor, cursor + countForThisDay)
        cursor += countForThisDay

        const dayOpt = daySlice.length >= 2
          ? optimizePlaceSequence(daySlice, destCoords.lat, destCoords.lon, 30.0, false)
          : { orderedPlaces: daySlice, legs: [], metrics: { totalDistanceKm: 0, estimatedTravelTimeHours: 0 } }
        const orderedDayPlaces = dayOpt.orderedPlaces || daySlice

        let currentMin = 9 * 60 + 30 // 09:30 AM
        const dayItems = orderedDayPlaces.map((p, idx) => {
          const coords = getPlaceLatLon(p)
          if (idx > 0 && dayOpt.legs && dayOpt.legs[idx - 1]) {
            currentMin += Math.max(10, dayOpt.legs[idx - 1].timeMin || 15)
          }
          const sH = Math.floor(currentMin / 60)
          const sM = currentMin % 60
          const startTime = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`
          currentMin += 90 // 1.5 hr visit
          const eH = Math.floor(currentMin / 60)
          const eM = currentMin % 60
          const endTime = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`

          return {
            id: p.id || `place_${Date.now()}_${i}_${idx}`,
            title: p.name || p.title,
            subtitle: p.address || p.destination || selectedCity.name,
            category: p.category || 'attraction',
            lat: coords ? coords.lat : null,
            lon: coords ? coords.lon : null,
            image: p.image || p.photo || '',
            photo: p.photo || p.image || '',
            startTime,
            endTime,
            note: p.description || p.note || '',
            visitDetails: { visited: false, notes: '' },
            type: 'place',
          }
        })

        const dayIso = addDaysToIso(normStart, i - 1)
        const dateStr = isoToDateString(dayIso)
        const formattedDay = formatDayLabel(dateStr, `Day ${i}`)

        days.push({
          id: `day-${i}`,
          label: `${formattedDay} • ${selectedCity.name}`,
          shortLabel: `Day ${i}`,
          date: dateStr,
          isoDate: dayIso,
          items: dayItems,
          optimization: dayOpt.metrics ? {
            success: true,
            dayId: `day-${i}`,
            order: dayItems.map((item) => String(item.id)),
            metrics: dayOpt.metrics,
            legs: dayOpt.legs || [],
            algorithm: { name: 'TSP 2-Opt', version: '1.0' },
            updatedAt: Date.now(),
          } : null,
        })
      }

      const tripPayload = {
        id: Date.now(),
        tripId: Date.now(),
        title: `Trip to ${selectedCity.name}`,
        name: selectedCity.name,
        destination: selectedCity.name,
        startDate: normStart,
        endDate: normEnd,
        dates: `${normStart} - ${normEnd}`,
        daysCount: totalDays,
        days,
        hero: getDestinationImage(selectedCity.name),
        budget: 65000,
        targetBudget: 65000,
        totalBudget: 65000,
        status: 'active',
        isOptimized: true,
        isCustom: false,
      }

      if (onTripCreated) {
        await onTripCreated(tripPayload)
      }
      onClose()
    } catch (err) {
      setErrorMessage(err?.message || 'Could not create trip. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtered Cities for search modal
  const filteredCities = useMemo(() => {
    const q = citySearchQuery.trim().toLowerCase()
    let list = ALL_PAKISTAN_CITIES

    if (selectedProvinceFilter !== 'All') {
      list = list.filter((c) => {
        if (selectedProvinceFilter === 'KPK') {
          return c.province.toLowerCase().includes('khyber') || c.province.toLowerCase().includes('kpk')
        }
        return c.province.toLowerCase().includes(selectedProvinceFilter.toLowerCase())
      })
    }

    if (!q) return list

    return list.filter((c) => {
      const nameL = c.name.toLowerCase()
      const provL = c.province.toLowerCase()
      if (nameL.includes(q) || provL.includes(q)) return true
      if (
        (q === 'kashmir' || q === 'ajk' || q === 'azad kashmir') &&
        (provL.includes('kashmir') ||
          nameL.includes('neelum') ||
          nameL.includes('muzaffarabad') ||
          nameL.includes('rawalakot') ||
          nameL.includes('mirpur') ||
          nameL.includes('leepa') ||
          nameL.includes('bagh') ||
          nameL.includes('kotli') ||
          nameL.includes('sharda') ||
          nameL.includes('ratti gali'))
      ) {
        return true
      }
      return false
    })
  }, [citySearchQuery, selectedProvinceFilter])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* ==================================================== */}
        {/* 1. TOP HEADER (44px Touch Target Back & Title)       */}
        {/* ==================================================== */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={26} color="#0F172A" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Plan Your Trip</Text>

          <TouchableOpacity
            style={styles.headerRightAction}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* ==================================================== */}
          {/* 2. MODERN EXECUTIVE ROUTE CARD                        */}
          {/* (Matches the user's mockup design pattern)           */}
          {/* ==================================================== */}
          <View style={styles.modernCard}>
            {/* Row 1: Destination City */}
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => {
                setCitySearchQuery('')
                setIsCityModalOpen(true)
              }}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="navigate-circle" size={22} color="#2563EB" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Destination City</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {selectedCity.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* Row 2: Travel Dates (Opens Visual Calendar Picker) */}
            <TouchableOpacity
              style={styles.cardRow}
              onPress={openDateModal}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Departure - Return Dates</Text>
                <Text style={styles.rowValue}>
                  {`${formatMonthDayDisplay(startDate)} - ${formatMonthDayDisplay(endDate)} (${daysCount} Days)`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* ==================================================== */}
          {/* 3. DESTINATION QUICK-SELECT CHIPS                    */}
          {/* ==================================================== */}
          <View style={styles.quickCitiesSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.quickCitiesHeader}>CHOOSE DESTINATION CITY:</Text>
              <TouchableOpacity
                onPress={() => {
                  setCitySearchQuery('')
                  setIsCityModalOpen(true)
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>All Pakistan (80+)</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickCitiesScroll}>
              {QUICK_DESTINATIONS.map((c) => {
                const isSelected = selectedCity.name === c.name
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.cityChip, isSelected && styles.cityChipActive]}
                    onPress={() => setSelectedCity(c)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="location"
                      size={13}
                      color={isSelected ? '#FFFFFF' : '#2563EB'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.cityChipText, isSelected && styles.cityChipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                style={[styles.cityChip, { borderColor: '#2563EB', borderWidth: 1.5, borderStyle: 'dashed' }]}
                onPress={() => {
                  setCitySearchQuery('')
                  setIsCityModalOpen(true)
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={14} color="#2563EB" style={{ marginRight: 2 }} />
                <Text style={[styles.cityChipText, { color: '#2563EB', fontWeight: '700' }]}>
                  More Cities...
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* ==================================================== */}
          {/* 4. SUGGESTED ATTRACTIONS FOR SAME CITY               */}
          {/* ==================================================== */}
          <View style={styles.placesSection}>
            <View style={styles.placesHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.placesSectionTitle}>
                  Suggested Sights in {selectedCity.name}
                </Text>
                <Text style={styles.placesSectionSub}>
                  {selectedPlaceIds.length} of {availablePlaces.length} places selected for your {daysCount}-day itinerary
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {selectedPlaceIds.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setSelectedPlaceIds([])}
                    style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#F1F5F9' }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>Clear All</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setSelectedPlaceIds(availablePlaces.map((p) => p.id))}
                    style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#EFF6FF' }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Select All</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.selectedCountPill}>
                  <Text style={styles.selectedCountText}>{selectedPlaceIds.length} Stops</Text>
                </View>
              </View>
            </View>

            {/* Place Items List */}
            {availablePlaces.map((place) => {
              const isChecked = selectedPlaceIds.includes(place.id)
              return (
                <TouchableOpacity
                  key={place.id}
                  style={[styles.placeCard, isChecked && styles.placeCardChecked]}
                  onPress={() => handleTogglePlace(place.id)}
                  activeOpacity={0.8}
                >
                  <SafeImage
                    source={{ uri: place.image || place.photo }}
                    fallbackUri={getDestinationImage(selectedCity.name)}
                    style={styles.placeThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.placeInfoCol}>
                    <View style={styles.placeTitleRow}>
                      <Text style={styles.placeTitle} numberOfLines={1}>
                        {place.name || place.title}
                      </Text>
                    </View>
                    <Text style={styles.placeDesc} numberOfLines={2}>
                      {place.description || place.note || `Authentic attraction in ${selectedCity.name}`}
                    </Text>
                    <View style={styles.placeCategoryBadge}>
                      <Text style={styles.placeCategoryText}>{place.category || 'Sight'}</Text>
                    </View>
                  </View>

                  <View style={[styles.checkboxCircle, isChecked && styles.checkboxCircleActive]}>
                    {isChecked ? (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        {/* ==================================================== */}
        {/* 5. BOTTOM STICKY ACTION BAR                          */}
        {/* ==================================================== */}
        <View style={[styles.bottomStickyBar, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <TouchableOpacity
            style={styles.createTripButton}
            onPress={handleCreateTrip}
            disabled={isSubmitting}
            activeOpacity={0.88}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                <Text style={styles.createTripButtonText}>
                  Build {daysCount}-Day {selectedCity.name} Itinerary ({selectedPlaceIds.length} Sights)
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ==================================================== */}
        {/* 6. DESTINATION CITY PICKER MODAL                     */}
        {/* ==================================================== */}
        <Modal
          visible={isCityModalOpen}
          animationType="slide"
          onRequestClose={() => setIsCityModalOpen(false)}
        >
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setIsCityModalOpen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={26} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Select Destination City</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.citySearchBox}>
              <Ionicons name="search" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.citySearchInput}
                placeholder="Search city, valley, Kashmir..."
                placeholderTextColor="#94A3B8"
                value={citySearchQuery}
                onChangeText={setCitySearchQuery}
                autoFocus={false}
              />
              {citySearchQuery ? (
                <TouchableOpacity onPress={() => setCitySearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Province Filter Tabs */}
            <View style={styles.modalFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalFilterScroll}>
                {['All', 'Azad Kashmir', 'Gilgit-Baltistan', 'KPK', 'Punjab', 'Sindh', 'Balochistan'].map((p) => {
                  const active = selectedProvinceFilter === p
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.modalFilterChip, active && styles.modalFilterChipActive]}
                      onPress={() => setSelectedProvinceFilter(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalFilterChipText, active && styles.modalFilterChipTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
              {/* Custom Destination Option if user typed anything */}
              {citySearchQuery.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.customCityOption}
                  onPress={() => {
                    const q = citySearchQuery.trim()
                    const prov = guessProvinceFromTripName(q)
                    setSelectedCity({ id: q, name: q, province: prov })
                    setIsCityModalOpen(false)
                    setCitySearchQuery('')
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.customCityOptionIcon}>
                    <Ionicons name="add-circle" size={24} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.customCityOptionTitle}>Use "{citySearchQuery.trim()}"</Text>
                    <Text style={styles.customCityOptionSub}>Custom Destination in Pakistan</Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={24} color="#2563EB" />
                </TouchableOpacity>
              )}

              {/* Live Search Results from 44,989 Pakistan Locations Database */}
              {liveSearchResults.map((loc) => {
                const isSelected = selectedCity.name.toLowerCase() === loc.name.toLowerCase()
                return (
                  <TouchableOpacity
                    key={`live-${loc.id}`}
                    style={[styles.cityPickerItem, isSelected && styles.cityPickerItemActive]}
                    onPress={() => {
                      setSelectedCity({
                        id: loc.id,
                        name: loc.name,
                        province: loc.province || guessProvinceFromTripName(loc.name),
                        lat: loc.lat,
                        lon: loc.lon,
                      })
                      setIsCityModalOpen(false)
                      setCitySearchQuery('')
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cityPickerIconCircle}>
                      <Ionicons name="sparkles" size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cityNameText}>{loc.name}</Text>
                      <Text style={styles.cityProvinceText}>{loc.province} • {loc.category}</Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color="#2563EB" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    )}
                  </TouchableOpacity>
                )
              })}

              {filteredCities.map((city) => {
                const isSelected = selectedCity.name === city.name
                return (
                  <TouchableOpacity
                    key={city.id}
                    style={[styles.cityPickerItem, isSelected && styles.cityPickerItemActive]}
                    onPress={() => {
                      setSelectedCity(city)
                      setIsCityModalOpen(false)
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cityPickerIconCircle}>
                      <Ionicons name="location" size={20} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cityNameText}>{city.name}</Text>
                      <Text style={styles.cityProvinceText}>{city.province}</Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color="#2563EB" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    )}
                  </TouchableOpacity>
                )
              })}

              {filteredCities.length === 0 && (
                <View style={styles.emptyCitySearch}>
                  <Ionicons name="location-outline" size={42} color="#94A3B8" />
                  <Text style={styles.emptyCitySearchTitle}>No matching city in this category</Text>
                  <Text style={styles.emptyCitySearchSub}>
                    {citySearchQuery.trim().length > 0
                      ? `Tap "Use \\"${citySearchQuery.trim()}\\"" above to create your trip for this destination!`
                      : 'Try selecting "All" or typing the city or valley name above.'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* ==================================================== */}
        {/* 7. INTERACTIVE VISUAL CALENDAR PICKER MODAL          */}
        {/* ==================================================== */}
        <Modal
          visible={isDateModalOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsDateModalOpen(false)}
        >
          <View style={styles.dateModalBackdrop}>
            <View style={styles.dateModalContent}>
              <View style={styles.dateModalHeader}>
                <View>
                  <Text style={styles.dateModalTitle}>Select Travel Dates</Text>
                  <Text style={styles.dateModalSub}>
                    Choose departure & return dates
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsDateModalOpen(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Editable Date Range Card */}
              <View style={styles.modalRangeSummaryBox}>
                <View style={styles.modalRangeCol}>
                  <Text style={styles.modalRangeLabel}>DEPARTURE DATE</Text>
                  <TextInput
                    style={styles.editableDateInput}
                    value={draftStartDate}
                    onChangeText={(text) => {
                      setDraftStartDate(text)
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                  />
                  <Text style={styles.modalRangeVal}>
                    {formatMonthDayDisplay(draftStartDate) || 'Select date'}
                  </Text>
                </View>

                <View style={styles.modalRangeArrowCol}>
                  <Ionicons name="arrow-forward" size={18} color="#2563EB" />
                  <View style={styles.modalDaysPill}>
                    <Text style={styles.modalDaysPillText}>
                      {draftStartDate && draftEndDate
                        ? `${countDaysBetweenIso(draftStartDate, draftEndDate)} Days`
                        : '1 Day'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalRangeCol}>
                  <Text style={styles.modalRangeLabel}>RETURN DATE</Text>
                  <TextInput
                    style={styles.editableDateInput}
                    value={draftEndDate || ''}
                    onChangeText={(text) => {
                      setDraftEndDate(text)
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                  />
                  <Text style={styles.modalRangeVal}>
                    {formatMonthDayDisplay(draftEndDate) || 'Select date'}
                  </Text>
                </View>
              </View>

              {/* Quick Future Date Presets */}
              <View style={styles.quickFuturePresetsRow}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'tomorrow', label: 'Tomorrow' },
                  { id: 'weekend', label: 'This Weekend' },
                  { id: 'next_week', label: 'Next Week' },
                  { id: 'next_month', label: 'Next Month' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.quickFuturePresetChip}
                    onPress={() => handleSelectFuturePreset(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="flash-outline" size={12} color="#2563EB" style={{ marginRight: 3 }} />
                    <Text style={styles.quickFuturePresetText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Calendar Picker Component (Strictly Future Dates Only) */}
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 370 }}>
                <CalendarPicker
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  minDate={todayIso}
                  onDateRangeChange={({ startDate: s, endDate: e }) => {
                    setDraftStartDate(s)
                    setDraftEndDate(e)
                  }}
                />
              </ScrollView>

              {/* 1 TO 30 DAYS DURATION SELECTOR */}
              <View style={styles.daySelectorSection}>
                <View style={styles.dayStepperRow}>
                  <Text style={styles.daySelectorHeader}>TRIP DURATION (1 - 30 DAYS):</Text>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleSetDays(draftDaysCount - 1)}
                      disabled={draftDaysCount <= 1}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={18} color={draftDaysCount <= 1 ? '#CBD5E1' : '#2563EB'} />
                    </TouchableOpacity>
                    <View style={styles.stepperValueBadge}>
                      <Text style={styles.stepperValueText}>{draftDaysCount} {draftDaysCount === 1 ? 'Day' : 'Days'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleSetDays(draftDaysCount + 1)}
                      disabled={draftDaysCount >= 30}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color={draftDaysCount >= 30 ? '#CBD5E1' : '#2563EB'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 1 to 30 Days Scrollable Pills */}
                <ScrollView
                  ref={daysScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.daysScrollContent}
                >
                  {DAY_OPTIONS.map((num) => {
                    const isSelected = draftDaysCount === num
                    return (
                      <TouchableOpacity
                        key={num}
                        style={[styles.dayOptionChip, isSelected && styles.dayOptionChipActive]}
                        onPress={() => handleSetDays(num)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dayOptionText, isSelected && styles.dayOptionTextActive]}>
                          {num} {num === 1 ? 'Day' : 'Days'}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={styles.confirmDatesBtn}
                onPress={handleConfirmDates}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.confirmDatesBtnText}>Confirm Travel Dates</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

export default TripCreationWizard

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRightAction: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },

  // Modern Executive Route Card (From user's mockup)
  modernCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTextCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 3,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // Destination Quick-Select Chips
  quickCitiesSection: {
    marginBottom: 20,
  },
  quickCitiesHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  quickCitiesScroll: {
    flexDirection: 'row',
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
  },
  cityChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  cityChipTextActive: {
    color: '#FFFFFF',
  },

  // Places Section
  placesSection: {
    marginBottom: 24,
  },
  placesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  placesSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  placesSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectedCountPill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  placeCardChecked: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  placeThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  placeInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  placeCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  placeCategoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxCircleActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },

  // Bottom Sticky Action Bar
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  createTripButton: {
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createTripButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // City Search Box & Modal
  citySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    height: 44,
  },
  citySearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  cityPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cityPickerItemActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  cityPickerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cityProvinceText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalFilterRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  modalFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  modalFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  modalFilterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  modalFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customCityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  customCityOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customCityOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E40AF',
  },
  customCityOptionSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  emptyCitySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyCitySearchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptyCitySearchSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // Date Modal Styles
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateModalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  editableDateInput: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
    marginVertical: 4,
  },
  modalRangeSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  quickFuturePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickFuturePresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickFuturePresetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalRangeCol: {
    flex: 1,
    alignItems: 'center',
  },
  modalRangeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  modalRangeVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalRangeYear: {
    fontSize: 11,
    color: '#94A3B8',
  },
  modalRangeArrowCol: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  modalDaysPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  modalDaysPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  daySelectorSection: {
    marginVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayStepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  daySelectorHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValueBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  stepperValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  daysScrollContent: {
    paddingVertical: 4,
    gap: 6,
  },
  dayOptionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  dayOptionChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dayOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  dayOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  durationPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 12,
  },
  durationPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  durationPresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  confirmDatesBtn: {
    height: 50,
    backgroundColor: '#2563EB',
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  confirmDatesBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
