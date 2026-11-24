import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, PROVINCE_COORDS } from '../lib/constants'
import { getSectionAppearance } from '../lib/sections'
import { useApp } from '../context/AppContext'
import PlannerMapPanel from '../components/PlannerMapPanel'
import ArrangementModal from '../components/ArrangementModal'
import BulkActionBar from '../components/BulkActionBar'
import PlannerItemCard from '../components/PlannerItemCard'
import PlannerSectionCard from '../components/PlannerSectionCard'
import SectionMenu from '../components/SectionMenu'
import SectionBadge from '../components/SectionBadge'
import TopbarMenu from '../components/TopbarMenu'
import TripmatesModal from '../components/TripmatesModal'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import AiAssistantModal from '../components/AiAssistantModal'
import SharedBudgetSection from '../components/SharedBudgetSection'
import { fetchExplorePlacesRequest, fetchPlaceDetailsRequest, getTripShareTokenRequest, readStoredToken } from '../lib/session'



function formatDayLabel(dateStr, fallback) {
  const date = new Date(dateStr)
  if (!Number.isFinite(date.getTime())) return fallback || 'Day'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDurationMinutes(totalMinutes) {
  const minutesValue = Math.max(0, Math.round(Number(totalMinutes) || 0))
  if (minutesValue < 60) return `${minutesValue} min`
  const hours = Math.floor(minutesValue / 60)
  const minutes = minutesValue % 60
  if (minutes === 0) return `${hours} hr`
  return `${hours} hr ${minutes} min`
}

function toCoords(place) {
  const lat = Number(place?.lat)
  const lon = Number(place?.lon)
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  return { lat: 33.6844, lon: 73.0479 }
}

function haversineKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(to.lat - from.lat)
  const dLon = toRad(to.lon - from.lon)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistanceLabel(distanceKm) {
  const value = Number(distanceKm) || 0
  return `${value.toFixed(value < 10 ? 1 : 0)} km`
}

function formatTime12h(time) {
  if (!time) return ''
  const parts = String(time).split(':')
  if (parts.length < 2) return ''
  let hour = parseInt(parts[0], 10)
  const minute = parts[1]
  if (!Number.isFinite(hour)) return ''
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${ampm}`
}

function buildOptimizePayload(trip) {
  const prefs = trip.enginePreferences || {}
  const q = prefs.questionnaire || {}
  return {
    province: prefs.province || 'Punjab',
    start_lat: Number(prefs.startLat) || 31.5204,
    start_lon: Number(prefs.startLon) || 74.3587,
    max_budget: prefs.useBudget ? Number(prefs.maxBudget) || 5000 : 999999,
    max_travel_hours: prefs.useTimeLimit ? Number(prefs.maxTravelHours) || 12 : 999,
    preferred_categories: prefs.useCategories ? (prefs.preferredCategories || []) : [],
    score_weight: Number(prefs.scoreWeight) || 1,
    time_weight: Number(prefs.timeWeight) || 0.5,
    cost_weight: Number(prefs.costWeight) || 0.01,
    use_live_data: false,
    avoid_crowds: Boolean(prefs.useCrowdFilter),
    budget_level: q.budgetLevel,
    trip_duration_level: q.tripDuration,
    companions: q.travelCompanions,
    travel_style: q.travelStyle,
    personality: q.personality,
    environment: q.environment,
    crowd_preference: q.crowdPreference,
  }
}

function formatTripDateRange(startDate, endDate) {
  if (!startDate && !endDate) return ''
  if (startDate && endDate) return `${startDate} - ${endDate}`
  return startDate || endDate || ''
}

function toIsoDateString(dateVal) {
  return toNormalizedIsoDate(dateVal)
}

function toNormalizedIsoDate(value) {
  if (!value) return ''
  const str = String(value).trim()
  if (!str) return ''

  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (ymdMatch) {
    const y = ymdMatch[1]
    const m = String(ymdMatch[2]).padStart(2, '0')
    const d = String(ymdMatch[3]).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const parsed = new Date(str)
  if (Number.isFinite(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const m = String(slashMatch[1]).padStart(2, '0')
    const d = String(slashMatch[2]).padStart(2, '0')
    const y = slashMatch[3]
    return `${y}-${m}-${d}`
  }

  return ''
}

function addDaysToIso(isoDateStr, daysToAdd) {
  const ymd = isoDateStr.split('-').map(Number)
  const d = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2]))
  d.setUTCDate(d.getUTCDate() + daysToAdd)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function countDaysBetweenIso(startIso, endIso) {
  const ymd1 = startIso.split('-').map(Number)
  const ymd2 = endIso.split('-').map(Number)
  const d1 = Date.UTC(ymd1[0], ymd1[1] - 1, ymd1[2])
  const d2 = Date.UTC(ymd2[0], ymd2[1] - 1, ymd2[2])
  const diffMs = d2 - d1
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
}

function isoToDateString(isoDateStr) {
  const ymd = isoDateStr.split('-').map(Number)
  const d = new Date(ymd[0], ymd[1] - 1, ymd[2], 12, 0, 0)
  return d.toDateString()
}

function formatMonthDayDisplay(dateVal) {
  if (!dateVal) return ''
  const iso = toNormalizedIsoDate(dateVal)
  if (iso) {
    const ymd = iso.split('-').map(Number)
    const d = new Date(ymd[0], ymd[1] - 1, ymd[2], 12, 0, 0)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const d = new Date(dateVal)
  if (Number.isFinite(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return String(dateVal)
}

function formatDateRangeDisplay(startDate, endDate, fallback = '') {
  let normStart = toNormalizedIsoDate(startDate) || startDate
  let normEnd = toNormalizedIsoDate(endDate) || endDate

  if (!normStart && !normEnd && fallback) {
    const parts = String(fallback).split(/\s*[-–]\s*/)
    if (parts.length === 2) {
      normStart = toNormalizedIsoDate(parts[0]) || parts[0]
      normEnd = toNormalizedIsoDate(parts[1]) || parts[1]
    }
  }

  const startFmt = formatMonthDayDisplay(normStart)
  const endFmt = formatMonthDayDisplay(normEnd)
  if (startFmt && endFmt) return `${startFmt} – ${endFmt}`
  if (startFmt || endFmt) return startFmt || endFmt
  return fallback || 'Set dates'
}

function getItemTypeSummary(items = []) {
  if (!Array.isArray(items) || items.length === 0) return []
  let places = 0
  let notes = 0
  let checklists = 0
  let others = 0

  items.forEach((item) => {
    if (item?.type === 'note') notes += 1
    else if (item?.type === 'checklist') checklists += 1
    else if (item?.type === 'place' || (!item?.type && (item?.lat || item?.title || item?.location))) places += 1
    else others += 1
  })

  const lines = []
  if (places > 0) lines.push(`${places} ${places === 1 ? 'place' : 'places'}`)
  if (notes > 0) lines.push(`${notes} ${notes === 1 ? 'note' : 'notes'}`)
  if (checklists > 0) lines.push(`${checklists} ${checklists === 1 ? 'checklist' : 'checklists'}`)
  if (others > 0) lines.push(`${others} ${others === 1 ? 'item' : 'items'}`)
  return lines
}

function getDayActualDateIso(day, index, tripStartDateIso) {
  if (day?.date) {
    const iso = toNormalizedIsoDate(day.date)
    if (iso) return iso
  }
  if (tripStartDateIso) {
    const normTripStart = toNormalizedIsoDate(tripStartDateIso)
    if (normTripStart) {
      return addDaysToIso(normTripStart, index)
    }
  }
  return ''
}

function getAffectedOutOfRangeDays(trip, newStartDate, newEndDate) {
  const existingDays = Array.isArray(trip?.days) ? trip.days : []
  const normNewStart = toNormalizedIsoDate(newStartDate)
  const normNewEnd = toNormalizedIsoDate(newEndDate)
  if (!normNewStart || !normNewEnd) return []

  const rawStart = trip?.startDate || (existingDays[0]?.date || '')
  const tripStartDateIso = toNormalizedIsoDate(rawStart)

  const affected = []

  existingDays.forEach((day, index) => {
    const dayIso = getDayActualDateIso(day, index, tripStartDateIso)

    let isOutOfRange = false
    if (dayIso) {
      if (dayIso < normNewStart || dayIso > normNewEnd) {
        isOutOfRange = true
      }
    } else {
      const totalNewDays = countDaysBetweenIso(normNewStart, normNewEnd)
      if (index >= totalNewDays) {
        isOutOfRange = true
      }
    }

    if (isOutOfRange) {
      const items = Array.isArray(day?.items) ? day.items : []
      if (items.length > 0) {
        const summaryLines = getItemTypeSummary(items)
        const dateFormatted = formatMonthDayDisplay(dayIso || day.date) || day.label || `Day ${index + 1}`
        affected.push({
          dayId: day.id,
          index,
          dateIso: dayIso,
          dateFormatted,
          summary: summaryLines.join(', '),
          summaryLines,
          itemCount: items.length,
        })
      }
    }
  })

  return affected
}

function rebuildTripDays(existingDays, newStartDate, newEndDate, previousTripStartDate) {
  const normNewStart = toNormalizedIsoDate(newStartDate)
  const normNewEnd = toNormalizedIsoDate(newEndDate)
  if (!normNewStart || !normNewEnd) return existingDays

  const totalDays = countDaysBetweenIso(normNewStart, normNewEnd)
  const tripStartDateIso = toNormalizedIsoDate(previousTripStartDate || (existingDays[0]?.date || ''))

  // Index existing days strictly by their actual ISO date
  const daysByActualIso = new Map()
  existingDays.forEach((day, idx) => {
    const dayIso = getDayActualDateIso(day, idx, tripStartDateIso)
    if (dayIso && !daysByActualIso.has(dayIso)) {
      daysByActualIso.set(dayIso, day)
    }
  })

  const nextDays = []
  for (let i = 0; i < totalDays; i++) {
    const currentIso = addDaysToIso(normNewStart, i)
    const dateStr = isoToDateString(currentIso)

    const existingDayForDate = daysByActualIso.get(currentIso)

    if (existingDayForDate) {
      // Keep existing day data strictly associated with this calendar date
      nextDays.push({
        ...existingDayForDate,
        label: `Day ${i + 1}`,
        shortLabel: `Day ${i + 1}`,
        date: dateStr,
      })
    } else {
      // Newly added calendar date in range: starts with empty itinerary items
      nextDays.push({
        id: `day-${Date.now()}-${i + 1}`,
        label: `Day ${i + 1}`,
        shortLabel: `Day ${i + 1}`,
        date: dateStr,
        items: [],
      })
    }
  }

  return nextDays
}

const ENGINE_PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Azad Kashmir']
const QUESTIONNAIRE_FIELDS = [
  { key: 'budgetLevel', label: 'Budget level', options: ['Low', 'Medium', 'High'] },
  { key: 'tripDuration', label: 'Trip duration', options: ['1 Day', '2-3 Days', '4-7 Days'] },
  { key: 'travelCompanions', label: 'Companions', options: ['Solo', 'Friends', 'Family'] },
  { key: 'travelStyle', label: 'Travel style', options: ['Relaxation', 'Adventure', 'Cultural', 'Mixed'] },
  { key: 'personality', label: 'Personality', options: ['Introvert', 'Extrovert'] },
  { key: 'environment', label: 'Environment', options: ['Mountains', 'City', 'Historical', 'Nature'] },
  { key: 'crowdPreference', label: 'Crowds', options: ['Avoid crowds', 'Neutral', 'Enjoy crowds'] },
]

function mapBudgetToMaxBudget(level) {
  if (level === 'Low') return 3000
  if (level === 'High') return 10000
  return 5000
}

function mapDurationToMaxHours(duration) {
  if (duration === '1 Day') return 8
  if (duration === '4-7 Days') return 20
  return 12
}

function generateCategoriesFromQuestionnaire(questionnaire) {
  const categories = new Set()
  if (questionnaire.travelStyle === 'Adventure') categories.add('mountain')
  if (questionnaire.travelStyle === 'Cultural') categories.add('historical')
  if (questionnaire.travelStyle === 'Relaxation') categories.add('park')
  if (questionnaire.environment === 'Nature') categories.add('park')
  if (questionnaire.environment === 'City') categories.add('urban')
  if (questionnaire.environment === 'Historical') categories.add('historical')
  if (questionnaire.environment === 'Mountains') categories.add('scenic')
  if (questionnaire.personality === 'Introvert') categories.add('quiet')
  if (questionnaire.personality === 'Extrovert') categories.add('urban')
  return Array.from(categories).filter(Boolean)
}

const EXPENSE_CATEGORIES = ['Transport', 'Food', 'Tickets', 'Hotel', 'Shopping', 'Misc']

function formatMoney(value) {
  const amount = Number(value) || 0
  return `PKR ${amount.toLocaleString()}`
}

function formatShortDate(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function ensureVisitDetails(place) {
  const next = place?.visitDetails && typeof place.visitDetails === 'object'
    ? place.visitDetails
    : { visited: false, notes: '', media: [], visitedDate: null, visitedTime: null }
  if (!Array.isArray(next.media)) next.media = []
  if (typeof next.notes !== 'string') next.notes = ''
  if (typeof next.visited !== 'boolean') next.visited = false
  if (next.visitedDate === undefined) next.visitedDate = null
  if (next.visitedTime === undefined) next.visitedTime = null
  return next
}

function createPlaceFromEngineStop(stop, index) {
  return {
    id: `engine-${Date.now()}-${index}`,
    title: stop.name || stop.title || `Suggested stop ${index + 1}`,
    subtitle: stop.city || stop.province || stop.category || 'Pakistan',
    note: stop.description || '',
    image: stop.image || '',
    category: stop.category || 'general',
    lat: Number(stop.lat),
    lon: Number(stop.lon),
    budget: Number(stop.estimated_cost || 0),
    type: 'place',
    startTime: null,
    endTime: null,
    visitDetails: { visited: false, notes: '', media: [], visitedDate: null, visitedTime: null },
  }
}

function createManualPlace(title) {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    subtitle: 'Custom place',
    note: '',
    image: '',
    category: 'general',
    lat: 33.6844,
    lon: 73.0479,
    budget: 0,
    type: 'place',
    startTime: null,
    endTime: null,
    visitDetails: { visited: false, notes: '', media: [], visitedDate: null, visitedTime: null },
  }
}

function createNoteItem() {
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'note',
    title: 'Note',
    content: '',
  }
}

function createChecklistRow() {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: '',
    checked: false,
  }
}

function makeCloneId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createChecklistItem() {
  return {
    id: `checklist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'checklist',
    title: 'Checklist',
    items: [createChecklistRow()],
  }
}

function createCustomList(name = 'Untitled List') {
  return {
    id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color: '#10b981',
    items: [],
  }
}

function cloneData(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

function getCategoryIcon(category = '') {
  const cat = (category || '').toLowerCase()
  if (cat.includes('restaurant') || cat.includes('food') || cat.includes('dining')) return '🍴'
  if (cat.includes('cafe') || cat.includes('coffee') || cat.includes('bakery')) return '☕'
  if (cat.includes('hotel') || cat.includes('lodging') || cat.includes('resort')) return '🏨'
  if (cat.includes('nature') || cat.includes('park') || cat.includes('scenic') || cat.includes('garden')) return '🌳'
  if (cat.includes('historic') || cat.includes('fort') || cat.includes('museum') || cat.includes('mosque')) return '📜'
  if (cat.includes('shop') || cat.includes('bazaar') || cat.includes('mall') || cat.includes('market')) return '🛍️'
  return '📍'
}

function duplicateTripItem(item) {
  const copy = cloneData(item)
  copy.id = makeCloneId(item?.type || 'item')
  if (copy.type === 'checklist' && Array.isArray(copy.items)) {
    copy.items = copy.items.map((row) => ({ ...row, id: makeCloneId('row') }))
  }
  return copy
}

function getContainerItems(trip, containerId) {
  if (containerId === 'pool') return Array.isArray(trip.placesPool) ? trip.placesPool : []
  if (String(containerId).startsWith('custom:')) {
    const listId = String(containerId).slice('custom:'.length)
    return (trip.customLists || []).find((entry) => entry.id === listId)?.items || []
  }
  const day = (trip.days || []).find((entry) => entry.id === containerId)
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
    days: trip.days.map((day) => (day.id === containerId ? { ...day, items } : day)),
  }
}

function getPlaceItems(items) {
  return (items || []).filter((item) => item?.type !== 'note' && item?.type !== 'checklist')
}

function getNonPlaceItems(items) {
  return (items || []).filter((item) => item?.type === 'note' || item?.type === 'checklist')
}

function ensureMapState(trip) {
  return trip?.map && typeof trip.map === 'object' ? trip.map : { selectedPlaceId: null }
}

function ensureUiState(trip) {
  const ui = trip?.ui && typeof trip.ui === 'object' ? trip.ui : {}
  const collapsed = Array.isArray(ui.collapsedSectionIds) ? ui.collapsedSectionIds : []
  const sectionTitles = ui.sectionTitles && typeof ui.sectionTitles === 'object' ? ui.sectionTitles : { notes: 'Notes', pool: 'Places to visit' }
  return {
    ...ui,
    collapsedSectionIds: collapsed,
    allDaysCollapsed: Boolean(ui.allDaysCollapsed),
    sectionTitles,
    editingTitleKey: typeof ui.editingTitleKey === 'string' ? ui.editingTitleKey : null,
  }
}

function rebuildTripDayMetadata(prevTrip, rawDays) {
  const hasValidStart = Number.isFinite(new Date(prevTrip.startDate).getTime())
  const days = rawDays.map((day, index) => {
    let date = day.date
    if (hasValidStart) {
      const nextDate = new Date(prevTrip.startDate)
      nextDate.setDate(nextDate.getDate() + index)
      date = nextDate.toDateString()
    }
    return {
      ...day,
      label: `Day ${index + 1}`,
      shortLabel: `Day ${index + 1}`,
      date,
    }
  })

  if (!hasValidStart || !days.length) {
    return { ...prevTrip, days }
  }

  const endDate = new Date(prevTrip.startDate)
  endDate.setDate(endDate.getDate() + days.length - 1)
  const endDateIso = endDate.toISOString().slice(0, 10)
  return {
    ...prevTrip,
    days,
    endDate: endDateIso,
    dates: `${prevTrip.startDate} - ${endDateIso}`,
  }
}

function getAllPlaceItems(trip) {
  return [
    ...(trip?.placesPool || []),
    ...((trip?.customLists || []).flatMap((list) => list.items || [])),
    ...((trip?.days || []).flatMap((day) => day.items || [])),
  ].filter((item) => item?.type !== 'note' && item?.type !== 'checklist')
}

function findPlaceLocation(trip, placeId) {
  for (const place of trip?.placesPool || []) {
    if (String(place.id) === String(placeId)) return { containerId: 'pool', item: place }
  }
  for (const list of trip?.customLists || []) {
    const found = (list.items || []).find((item) => String(item.id) === String(placeId))
    if (found) return { containerId: `custom:${list.id}`, item: found }
  }
  for (const day of trip?.days || []) {
    const found = (day.items || []).find((item) => String(item.id) === String(placeId))
    if (found) return { containerId: day.id, item: found }
  }
  return null
}

export default function WorkspacePage() {
  const navigate = useNavigate()
  const { activeTrip, bootstrappedWorkspace, updateTrip, saveTrip, removeTrip, logout, queuePrint, token, user } = useApp()
  const tripTitleEditKey = 'trip-title'
  // #region debug-point E:workspace-mount
  useEffect(() => {
    const traceId = `${String(activeTrip?.id || 'unknown')}-${Date.now()}`
    fetch('http://127.0.0.1:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'saved-trip-open',
        runId: 'post-fix',
        hypothesisId: 'E',
        location: 'WorkspacePage.jsx:mount',
        msg: '[DEBUG] Workspace mounted with activeTrip snapshot',
        traceId,
        ts: Date.now(),
        data: {
          bootstrappedWorkspace,
          activeTripKeys: activeTrip ? Object.keys(activeTrip) : null,
          hasDays: Array.isArray(activeTrip?.days),
          daysLen: Array.isArray(activeTrip?.days) ? activeTrip.days.length : null,
          hasItinerary: Array.isArray(activeTrip?.itinerary),
          itineraryLen: Array.isArray(activeTrip?.itinerary) ? activeTrip.itinerary.length : null,
          hasPlacesPool: Array.isArray(activeTrip?.placesPool),
          placesPoolLen: Array.isArray(activeTrip?.placesPool) ? activeTrip.placesPool.length : null,
          startDate: activeTrip?.startDate,
          endDate: activeTrip?.endDate,
          name: activeTrip?.name,
          title: activeTrip?.title,
          nestedDataKeys: activeTrip?.data ? Object.keys(activeTrip.data) : null,
        },
      }),
    }).catch(() => { })
  }, [activeTrip?.id, bootstrappedWorkspace])
  // #endregion
  const [toast, setToast] = useState('')
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')
  const [dateError, setDateError] = useState('')
  const [dateWarningModal, setDateWarningModal] = useState({
    open: false,
    newStartDate: '',
    newEndDate: '',
    affectedDays: [],
  })
  const [showSerpExploreView, setShowSerpExploreView] = useState(false)
  const [serpSearchQuery, setSerpSearchQuery] = useState('')
  const [serpActiveCategory, setSerpActiveCategory] = useState('All')
  const [serpExploreState, setSerpExploreState] = useState({ loading: false, error: '', places: [] })
  const [selectedExplorePlace, setSelectedExplorePlace] = useState(null)

  // Asynchronously load rich Place Details when an Explore place is selected
  useEffect(() => {
    if (!selectedExplorePlace?.id) return
    const targetPlaceId = selectedExplorePlace.place_id
    const targetDataId = selectedExplorePlace.data_id || (selectedExplorePlace.id || '').replace(/^serp-/, '')

    if (!targetPlaceId && !targetDataId) return

    let isMounted = true
    fetchPlaceDetailsRequest(targetPlaceId, targetDataId)
      .then((res) => {
        if (isMounted && res && res.success && res.place) {
          setSelectedExplorePlace((prev) => {
            if (!prev || prev.id !== selectedExplorePlace.id) return prev
            const validNewHours = (res.place.operatingHours && Object.keys(res.place.operatingHours).length > 0)
              ? res.place.operatingHours
              : prev.operatingHours
            const validNewReviews = (res.place.userReviews && res.place.userReviews.length > 0)
              ? res.place.userReviews
              : (prev.userReviews || [])
            return {
              ...prev,
              ...res.place,
              operatingHours: validNewHours || {},
              userReviews: validNewReviews,
              photo: res.place.photo || prev.photo,
            }

          })

        }
      })
      .catch(() => {
        // Non-blocking catch: lightweight preview remains displayed smoothly
      })

    return () => {
      isMounted = false
    }
  }, [selectedExplorePlace?.id])

  const [selectedSuggestionIndexes, setSelectedSuggestionIndexes] = useState([])
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showArrangement, setShowArrangement] = useState(false)
  const [arrangementSectionId, setArrangementSectionId] = useState('pool')
  const [showTripSettings, setShowTripSettings] = useState(false)
  const [tripSettingsPrivacy, setTripSettingsPrivacy] = useState(activeTrip?.privacy || activeTrip?.data?.privacy || 'private')

  useEffect(() => {
    const currentPrivacy = activeTrip?.privacy || activeTrip?.data?.privacy || 'private'
    setTripSettingsPrivacy(currentPrivacy)
  }, [activeTrip?.id, activeTrip?.privacy, activeTrip?.data?.privacy])

  const [confirmDeleteTripOpen, setConfirmDeleteTripOpen] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
    const [showTripmatesModal, setShowTripmatesModal] = useState(false)
  const [sharePermission, setSharePermission] = useState('view')
  const [shareInviteInput, setShareInviteInput] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [shareToken, setShareToken] = useState(activeTrip?.shareToken || activeTrip?.data?.shareToken || '')
  const [editShareToken, setEditShareToken] = useState(activeTrip?.editShareToken || activeTrip?.data?.editShareToken || '')
  const [shareLoading, setShareLoading] = useState(false)
  const [tripTitleSaving, setTripTitleSaving] = useState(false)
  const [showTripJournal, setShowTripJournal] = useState(false)
  const [journalPlaceId, setJournalPlaceId] = useState(null)
  const [visitModalPlaceId, setVisitModalPlaceId] = useState(null)
  const [visitModalDraft, setVisitModalDraft] = useState({ visitedDate: '', visitedTime: '', notes: '' })
  const [chooseLocationPlaceId, setChooseLocationPlaceId] = useState(null)
  const [chooseLocationDraft, setChooseLocationDraft] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [activePlaceCardId, setActivePlaceCardId] = useState(null)
  const [timeEditorPlaceId, setTimeEditorPlaceId] = useState(null)
  const [activeInsertMenu, setActiveInsertMenu] = useState(null)
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [activeSidebarId, setActiveSidebarId] = useState('overview')
  const [mapPanelWidth, setMapPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return null
    const stored = Number(window.localStorage.getItem('mapPanelWidth'))
    return Number.isFinite(stored) ? Math.max(320, Math.min(760, stored)) : 520
  })
  const [isMapDividerDragging, setIsMapDividerDragging] = useState(false)
  const [expenseModal, setExpenseModal] = useState({ open: false, expenseId: null, placeId: null })
  const [engineState, setEngineState] = useState({ loading: false, error: '', data: null, requestPayload: null })
  const [dragMeta, setDragMeta] = useState(null)
  const [dragOverMeta, setDragOverMeta] = useState(null)
  const [showAiAssistant, setShowAiAssistant] = useState(false)
  const historyRef = useRef([])

  useEffect(() => {
    const viewTok = activeTrip?.shareToken || activeTrip?.data?.shareToken || ''
    if (viewTok) setShareToken(viewTok)
    const editTok = activeTrip?.editShareToken || activeTrip?.data?.editShareToken || ''
    if (editTok) setEditShareToken(editTok)
  }, [activeTrip?.shareToken, activeTrip?.editShareToken, activeTrip?.data?.shareToken, activeTrip?.data?.editShareToken])

  useEffect(() => {
    if (!showShareModal) return
    const tripId = activeTrip?.id || activeTrip?.tripId
    if (!tripId) return

    const isEdit = sharePermission === 'edit'
    const targetToken = isEdit ? editShareToken : shareToken
    if (targetToken) return

    let isSubscribed = true
    setShareLoading(true)
    const token = readStoredToken()
    getTripShareTokenRequest(token, tripId, sharePermission)
      .then((res) => {
        if (!isSubscribed) return
        if (isEdit && (res?.editShareToken || res?.shareToken)) {
          const newToken = res.editShareToken || res.shareToken
          setEditShareToken(newToken)
          updateTrip((prev) => ({
            ...prev,
            editShareToken: newToken,
            data: { ...(prev?.data || {}), editShareToken: newToken },
          }))
        } else if (!isEdit && res?.shareToken) {
          setShareToken(res.shareToken)
          updateTrip((prev) => ({
            ...prev,
            shareToken: res.shareToken,
            data: { ...(prev?.data || {}), shareToken: res.shareToken },
          }))
        }
      })
      .catch((err) => {
        console.error('Failed to get share token:', err)
      })
      .finally(() => {
        if (isSubscribed) setShareLoading(false)
      })

    return () => {
      isSubscribed = false
    }
  }, [showShareModal, sharePermission, activeTrip?.id, activeTrip?.tripId, shareToken, editShareToken])

  const futureRef = useRef([])
  const shellRef = useRef(null)

  const sections = useMemo(() => ([
    { id: 'overview', label: 'Overview', color: '#0f172a', icon: 'map' },
    { id: 'explore', label: 'Explore', color: '#fb7185', icon: 'coffee' },
    { id: 'notes', label: 'Notes', color: '#ec4899', icon: 'ticket' },
    { id: 'pool', label: 'Places to visit', ...getSectionAppearance(activeTrip, 'pool') },
    {
      id: 'itinerary',
      label: 'Itinerary',
      color: '#64748b',
      icon: 'map',
      children: activeTrip.days.map((day) => ({
        id: day.id,
        label: formatDayLabel(day.date, day.label),
      })),
    },
    { id: 'budget', label: 'Budget', color: '#16a34a', icon: 'ticket' },
    { id: 'shared-budget', label: '🤝 Shared Budget', color: '#6366f1', icon: 'ticket' },
  ]), [activeTrip])

  const moveDestinations = useMemo(() => ([
    { id: 'pool', label: 'Places to visit' },
    ...(activeTrip.customLists || []).map((list) => ({ id: `custom:${list.id}`, label: list.name || 'Custom List' })),
    ...activeTrip.days.map((day) => ({ id: day.id, label: formatDayLabel(day.date, day.label) })),
  ]), [activeTrip.days, activeTrip.customLists])
  const bulkDestinations = moveDestinations
  const selectedPlace = useMemo(() => findPlaceLocation(activeTrip, activeTrip.map?.selectedPlaceId || null)?.item || null, [activeTrip, activeTrip.map?.selectedPlaceId])
  const expenseTotalsByPlaceId = useMemo(() => {
    const totals = new Map()
      ; (activeTrip.expenses || []).forEach((expense) => {
        const placeId = String(expense.placeId || '')
        if (!placeId) return
        totals.set(placeId, (totals.get(placeId) || 0) + (Number(expense.amount) || 0))
      })
    return totals
  }, [activeTrip.expenses])
  const sortedExpenses = useMemo(() => {
    const entries = [...(activeTrip.expenses || [])]
    entries.sort((a, b) => {
      const timeA = new Date(a.date || '').getTime() || 0
      const timeB = new Date(b.date || '').getTime() || 0
      return timeB - timeA
    })
    return entries
  }, [activeTrip.expenses])
  const totalSpent = useMemo(() => sortedExpenses.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0), [sortedExpenses])
  const budgetAmount = Number(activeTrip.budget?.amount || activeTrip.budget || 0)
  const budgetProgress = budgetAmount > 0 ? Math.min(100, (totalSpent / budgetAmount) * 100) : 0
  const sectionRefs = useRef({})
  const placeRefs = useRef({})
  const tripJournalEntries = useMemo(() => {
    const entries = []
    const addEntry = (place, context) => {
      if (!place?.title || place?.type === 'note' || place?.type === 'checklist') return
      const details = ensureVisitDetails(place)
      entries.push({
        id: place.id,
        title: place.title,
        context,
        location: place.visitLocation || 'No location selected',
        note: details.notes || 'No note saved',
        visited: Boolean(details.visited),
        timeLabel: [details.visitedDate, details.visitedTime].filter(Boolean).join(' • ') || [place.startTime, place.endTime].filter(Boolean).join(' - ') || 'No time added',
      })
    }
      ; (activeTrip.placesPool || []).forEach((place) => addEntry(place, 'Places Pool'))
      ; (activeTrip.customLists || []).forEach((list) => (list.items || []).forEach((place) => addEntry(place, list.name || 'Custom List')))
      ; (activeTrip.days || []).forEach((day) => (day.items || []).forEach((place) => addEntry(place, formatDayLabel(day.date, day.label))))
    return entries
  }, [activeTrip])
  const dayConnectionsById = useMemo(() => {
    const next = new Map()
      ; (activeTrip.days || []).forEach((day) => {
        next.set(day.id, buildDayConnectionsMap(day))
      })
    return next
  }, [activeTrip.days])
  const poolAppearance = getSectionAppearance(activeTrip, 'pool')
  const exploreCards = useMemo(() => {
    const poolPlaces = (activeTrip.placesPool || []).filter((item) => item?.type !== 'note' && item?.type !== 'checklist')
    if (poolPlaces.length) return poolPlaces.slice(0, 3)
    return [
      createPlaceFromEngineStop({ name: 'Lok Virsa Heritage Museum', category: 'museum', city: 'Islamabad', description: 'National folk museum with galleries, craft displays, and regional culture.', lat: 33.684, lon: 73.0728 }, 0),
      createPlaceFromEngineStop({ name: 'Margalla Hills', category: 'scenic', city: 'Islamabad', description: 'Popular green escape with lookout points, easy hikes, and city views.', lat: 33.743, lon: 73.0551 }, 1),
      createPlaceFromEngineStop({ name: 'Rawal Lake', category: 'scenic', city: 'Islamabad', description: 'Waterfront stop with open views and picnic spots near the city.', lat: 33.693, lon: 73.1235 }, 2),
    ]
  }, [activeTrip.placesPool])

  useEffect(() => {
    const selectedId = activeTrip.map?.selectedPlaceId || null
    const activeId = activePlaceCardId || null

    if (String(selectedId) !== String(activeId)) {
      setActivePlaceCardId(selectedId)
    }

    if (!selectedId) {
      return
    }

    const scrollTimer = window.setTimeout(() => {
      const ref = placeRefs.current[selectedId]
      if (ref) {
        ref.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }
    }, 120)

    return () => window.clearTimeout(scrollTimer)
  }, [activeTrip.map?.selectedPlaceId])

  useEffect(() => {
    if (!activeInsertMenu) return undefined
    function handleDocumentClick(event) {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('.InsertMenu') || event.target.closest('.InsertBtn')) return
      setActiveInsertMenu(null)
    }
    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [activeInsertMenu])

  useEffect(() => {
    if (!isMapDividerDragging) return undefined
    function handleMouseMove(event) {
      const shell = shellRef.current
      if (!shell) return
      const rect = shell.getBoundingClientRect()
      const next = Math.max(320, Math.min(760, rect.right - event.clientX))
      setMapPanelWidth(next)
      window.localStorage.setItem('mapPanelWidth', String(next))
    }
    function handleMouseUp() {
      setIsMapDividerDragging(false)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isMapDividerDragging])
  const shellStyle = Number.isFinite(mapPanelWidth)
    ? {
      gridTemplateColumns: sidebarHidden
        ? `minmax(520px, 1fr) ${mapPanelWidth}px`
        : `112px minmax(520px, 1fr) ${mapPanelWidth}px`,
    }
    : undefined
  const dividerStyle = Number.isFinite(mapPanelWidth)
    ? { left: `calc(100% - ${mapPanelWidth}px - 3px)` }
    : undefined

  async function handleLogout() {
    setConfirmLogoutOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  function showToast(message, timeout = 1800) {
    setToast(message)
    window.clearTimeout(showToast._timer)
    showToast._timer = window.setTimeout(() => setToast(''), timeout)
  }

  function toggleBulkMode() {
    setBulkMode((prev) => {
      const next = !prev
      if (!next) {
        setSelectedItemIds([])
      }
      return next
    })
  }

  function toggleItemSelected(itemId, checked) {
    if (checked) setBulkMode(true)
    setSelectedItemIds((prev) => {
      const set = new Set(prev)
      if (checked) set.add(itemId)
      else set.delete(itemId)
      return Array.from(set)
    })
  }

  function clearSelection() {
    setSelectedItemIds([])
    setBulkMode(false)
  }

  function getAllContainers(trip) {
    return [
      { id: 'pool', items: Array.isArray(trip.placesPool) ? trip.placesPool : [] },
      ...(trip.customLists || []).map((list) => ({ id: `custom:${list.id}`, items: Array.isArray(list.items) ? list.items : [] })),
      ...(trip.days || []).map((day) => ({ id: day.id, items: Array.isArray(day.items) ? day.items : [] })),
    ]
  }

  function buildDayConnectionsMap(day) {
    const connections = new Map()
    const places = getPlaceItems(day?.items || [])
    const legs = Array.isArray(day?.optimization?.legs) ? day.optimization.legs : []
    if (legs.length) {
      legs.forEach((leg) => {
        const toPlaceId = String(leg.toPlaceId || leg.to_place_id || '')
        if (!toPlaceId) return
        const minutes = Number(leg.estimatedTravelTimeMin || leg.time_min || 0)
        const distanceKm = Number(leg.distanceKm || leg.distance_km || 0)
        connections.set(toPlaceId, {
          from: leg.fromName || leg.from_name || 'previous location',
          durationLabel: formatDurationMinutes(minutes),
          distanceLabel: formatDistanceLabel(distanceKm),
          optimized: true,
        })
      })
      return connections
    }

    places.forEach((place, index) => {
      if (index === 0) return
      const previous = places[index - 1]
      const distanceKm = haversineKm(toCoords(previous), toCoords(place))
      const minutes = Math.max(1, Math.round((distanceKm / 30) * 60))
      connections.set(String(place.id), {
        from: previous.title || 'previous location',
        durationLabel: formatDurationMinutes(minutes),
        distanceLabel: formatDistanceLabel(distanceKm),
        optimized: false,
      })
    })
    return connections
  }

  function submitQuickPlace(event, containerId) {
    event.preventDefault()
    const form = event.currentTarget
    const value = String(form.placeName?.value || '').trim()
    if (!value) return
    commitTripChange((prev) => {
      const items = [...getContainerItems(prev, containerId), createManualPlace(value)]
      return setContainerItems(prev, containerId, items)
    })
    form.reset()
    showToast('Place added')
  }

  function focusAddPlaceInput(containerId) {
    const selector = containerId === 'pool'
      ? '[data-add-form="pool"] input[name="placeName"]'
      : `[data-add-form="day"][data-day-id="${containerId}"] input[name="placeName"]`
    const input = document.querySelector(selector)
    input?.focus()
  }

  function insertSpecialItemAt(containerId, index, itemType) {
    let insertedId = null
    commitTripChange((prev) => {
      const items = [...getContainerItems(prev, containerId)]
      const item = itemType === 'note' ? createNoteItem() : createChecklistItem()
      const safeIndex = Number.isFinite(index) ? Math.max(0, Math.min(index, items.length)) : items.length
      items.splice(safeIndex, 0, item)
      insertedId = item.id
      return setContainerItems(prev, containerId, items)
    })
    setActiveInsertMenu(null)
    return insertedId
  }

  function getSelectedIdsInOrder(trip) {
    const selected = new Set(selectedItemIds)
    const ordered = []
    getAllContainers(trip).forEach((container) => {
      container.items.forEach((item) => {
        if (selected.has(item.id)) ordered.push(item.id)
      })
    })
    return ordered
  }

  function bulkMove(destinationId) {
    if (!destinationId || !selectedItemIds.length) return
    commitTripChange((prev) => {
      const selected = new Set(selectedItemIds)
      const orderedIds = getSelectedIdsInOrder(prev)
      const moved = []
      const strip = (items) => {
        const remaining = []
        items.forEach((item) => {
          if (selected.has(item.id)) moved.push(item)
          else remaining.push(item)
        })
        return remaining
      }

      let nextTrip = {
        ...prev,
        placesPool: strip(prev.placesPool || []),
        customLists: (prev.customLists || []).map((list) => ({ ...list, items: strip(list.items || []) })),
        days: (prev.days || []).map((day) => ({ ...day, items: strip(day.items || []) })),
      }

      if (!moved.length) return prev

      const destinationItems = [...getContainerItems(nextTrip, destinationId)]
      const itemsInOrder = orderedIds.map((id) => moved.find((item) => item.id === id)).filter(Boolean)
      destinationItems.push(...itemsInOrder)
      nextTrip = setContainerItems(nextTrip, destinationId, destinationItems)

      return {
        ...nextTrip,
        map: {
          ...ensureMapState(nextTrip),
          selectedPlaceId: nextTrip.map?.selectedPlaceId || null,
        },
      }
    })
    setSelectedItemIds([])
    setBulkMode(false)
    showToast('Moved selected items')
  }

  function bulkCopy(destinationId) {
    if (!destinationId || !selectedItemIds.length) return
    commitTripChange((prev) => {
      const orderedIds = getSelectedIdsInOrder(prev)
      const selectedSet = new Set(orderedIds)
      const selectedItems = []
      getAllContainers(prev).forEach((container) => {
        container.items.forEach((item) => {
          if (selectedSet.has(item.id)) selectedItems.push(item)
        })
      })
      const itemsInOrder = orderedIds.map((id) => selectedItems.find((item) => item.id === id)).filter(Boolean)
      if (!itemsInOrder.length) return prev
      const duplicates = itemsInOrder.map((item) => duplicateTripItem(item))
      const destinationItems = [...getContainerItems(prev, destinationId), ...duplicates]
      return setContainerItems(prev, destinationId, destinationItems)
    })
    setSelectedItemIds([])
    setBulkMode(false)
    showToast('Copied selected items')
  }

  function bulkDelete() {
    if (!selectedItemIds.length) return
    commitTripChange((prev) => {
      const selected = new Set(selectedItemIds)
      const strip = (items) => (items || []).filter((item) => !selected.has(item.id))
      const deletedPlaceIds = new Set(
        getAllContainers(prev)
          .flatMap((container) => container.items)
          .filter((item) => selected.has(item.id) && item.type !== 'note' && item.type !== 'checklist')
          .map((item) => item.id),
      )
      const nextTrip = {
        ...prev,
        placesPool: strip(prev.placesPool || []),
        customLists: (prev.customLists || []).map((list) => ({ ...list, items: strip(list.items || []) })),
        days: (prev.days || []).map((day) => ({ ...day, items: strip(day.items || []) })),
        expenses: (prev.expenses || []).filter((expense) => !deletedPlaceIds.has(String(expense.placeId || ''))),
      }
      const selectedPlaceId = nextTrip.map?.selectedPlaceId
      const stillExists = selectedPlaceId && !selected.has(String(selectedPlaceId))
      return {
        ...nextTrip,
        map: {
          ...ensureMapState(nextTrip),
          selectedPlaceId: stillExists ? selectedPlaceId : null,
        },
      }
    })
    setSelectedItemIds([])
    setBulkMode(false)
    showToast('Deleted selected items')
  }

  function commitTripChange(producer, { trackHistory = true } = {}) {
    updateTrip((prev) => {
      let next = producer(prev)
      if (next === prev) return prev

      const selectedId = next.map?.selectedPlaceId
      if (selectedId) {
        const placeLoc = findPlaceLocation(next, selectedId)
        if (placeLoc) {
          const containerId = placeLoc.containerId
          let sectionId = containerId
          if (containerId !== 'pool' && !containerId.startsWith('custom:')) {
            sectionId = `day:${containerId}`
          }
          const ui = ensureUiState(next)
          const set = new Set(ui.collapsedSectionIds)
          if (set.has(sectionId)) {
            set.delete(sectionId)
            next = {
              ...next,
              ui: {
                ...ui,
                collapsedSectionIds: Array.from(set),
              },
            }
          }
        }
      }

      if (trackHistory) {
        historyRef.current = [...historyRef.current.slice(-29), cloneData(prev)]
        futureRef.current = []
      }
      return next
    })
  }

  function isSectionCollapsed(sectionId) {
    const ui = ensureUiState(activeTrip)
    return ui.collapsedSectionIds.includes(sectionId)
  }

  function toggleSectionCollapsed(sectionId) {
    commitTripChange((prev) => {
      const ui = ensureUiState(prev)
      const set = new Set(ui.collapsedSectionIds)
      if (set.has(sectionId)) set.delete(sectionId)
      else set.add(sectionId)
      return { ...prev, ui: { ...ui, collapsedSectionIds: Array.from(set) } }
    }, { trackHistory: false })
  }

  function toggleAllDaysCollapsed() {
    commitTripChange((prev) => {
      const ui = ensureUiState(prev)
      const dayIds = (prev.days || []).map((day) => `day:${day.id}`)
      const set = new Set(ui.collapsedSectionIds)
      const allCollapsed = dayIds.length > 0 && dayIds.every((id) => set.has(id))
      if (allCollapsed) {
        dayIds.forEach((id) => set.delete(id))
      } else {
        dayIds.forEach((id) => set.add(id))
      }
      return { ...prev, ui: { ...ui, collapsedSectionIds: Array.from(set) } }
    }, { trackHistory: false })
  }

  function getSelectToggleLabel(containerId) {
    const ids = (getContainerItems(activeTrip, containerId) || []).map((item) => item.id)
    if (!ids.length) return 'Select all'
    const selected = new Set(selectedItemIds)
    const allSelected = ids.every((id) => selected.has(id))
    return allSelected ? 'Deselect all' : 'Select all'
  }

  function toggleSelectAll(containerId) {
    const items = getContainerItems(activeTrip, containerId) || []
    if (!items.length) return
    const ids = items.map((item) => item.id)
    const selected = new Set(selectedItemIds)
    const allSelected = ids.every((id) => selected.has(id))
    const next = new Set(selectedItemIds)
    if (allSelected) {
      ids.forEach((id) => next.delete(id))
    } else {
      ids.forEach((id) => next.add(id))
    }
    setSelectedItemIds(Array.from(next))
    setBulkMode(true)
  }

  function getPreItinerarySectionIds(trip) {
    return ['notes', 'pool', ...(trip.customLists || []).map((list) => `custom:${list.id}`)]
  }

  function getCollapseAllLabel(trip) {
    const ui = ensureUiState(trip)
    const targetIds = getPreItinerarySectionIds(trip)
    const set = new Set(ui.collapsedSectionIds)
    const allCollapsed = targetIds.every((id) => set.has(id))
    return allCollapsed ? 'Expand all sections' : 'Collapse all sections'
  }

  function collapseOrExpandAllPreSections() {
    commitTripChange((prev) => {
      const ui = ensureUiState(prev)
      const targetIds = getPreItinerarySectionIds(prev)
      const set = new Set(ui.collapsedSectionIds)
      const allCollapsed = targetIds.every((id) => set.has(id))
      if (allCollapsed) {
        targetIds.forEach((id) => set.delete(id))
      } else {
        targetIds.forEach((id) => set.add(id))
      }
      return { ...prev, ui: { ...ui, collapsedSectionIds: Array.from(set) } }
    }, { trackHistory: false })
  }

  function openArrangementFor(sectionId) {
    setArrangementSectionId(sectionId)
    setShowArrangement(true)
  }

  function clearPool() {
    commitTripChange((prev) => {
      const removedIds = new Set((prev.placesPool || []).map((item) => item.id))
      const nextTrip = { ...prev, placesPool: [] }
      const selectedPlaceId = nextTrip.map?.selectedPlaceId
      const stillExists = selectedPlaceId && !removedIds.has(String(selectedPlaceId))
      return {
        ...nextTrip,
        map: {
          ...ensureMapState(nextTrip),
          selectedPlaceId: stillExists ? selectedPlaceId : null,
        },
      }
    })
    showToast('Places pool cleared')
  }

  function deleteNotesSection() {
    commitTripChange((prev) => ({ ...prev, notes: '' }))
  }

  function startEditingTitle(titleKey) {
    commitTripChange((prev) => {
      const ui = ensureUiState(prev)
      return { ...prev, ui: { ...ui, editingTitleKey: titleKey } }
    }, { trackHistory: false })
  }

  function stopEditingTitle() {
    commitTripChange((prev) => {
      const ui = ensureUiState(prev)
      return { ...prev, ui: { ...ui, editingTitleKey: null } }
    }, { trackHistory: false })
  }

  async function commitTripTitleEdit(nextValue) {
    const previousTitle = String(activeTrip.title || 'My Trip').trim() || 'My Trip'
    const title = String(nextValue || '').trim() || 'My Trip'
    stopEditingTitle()
    if (title === previousTitle) return

    const nextTrip = {
      ...activeTrip,
      title,
      ui: {
        ...ensureUiState(activeTrip),
        editingTitleKey: null,
      },
    }

    setTripTitleSaving(true)
    try {
      await saveTrip(nextTrip)
      showToast('Trip title updated')
    } catch (error) {
      showToast(error.message || 'Could not update trip title', 2400)
    } finally {
      setTripTitleSaving(false)
    }
  }

  function commitEditingTitle(titleKey, nextValue, fallbackValue) {
    commitTripChange((prev) => {
      const ui = ensureUiState(prev)
      const value = String(nextValue || '').trim()
      const sectionTitles = { ...(ui.sectionTitles || {}) }
      sectionTitles[titleKey] = value || fallbackValue
      return { ...prev, ui: { ...ui, sectionTitles, editingTitleKey: null } }
    }, { trackHistory: false })
  }

  function commitCustomListTitle(listId, nextValue) {
    commitTripChange((prev) => {
      const value = String(nextValue || '').trim()
      const ui = ensureUiState(prev)
      return {
        ...prev,
        customLists: (prev.customLists || []).map((list) => (list.id === listId ? { ...list, name: value || 'Untitled' } : list)),
        ui: { ...ui, editingTitleKey: null },
      }
    })
  }

  function handleUndo() {
    if (!historyRef.current.length) {
      showToast('Nothing to undo')
      return
    }
    const previous = historyRef.current.pop()
    futureRef.current = [cloneData(activeTrip), ...futureRef.current].slice(0, 30)
    updateTrip(previous)
    setDragMeta(null)
    setDragOverMeta(null)
    showToast('Undid last change')
  }

  function handleRedo() {
    if (!futureRef.current.length) {
      showToast('Nothing to redo')
      return
    }
    const next = futureRef.current.shift()
    historyRef.current = [...historyRef.current.slice(-29), cloneData(activeTrip)]
    updateTrip(next)
    setDragMeta(null)
    setDragOverMeta(null)
    showToast('Redid last change')
  }

  async function handleSaveTrip() {
    try {
      await saveTrip()
      showToast('Trip saved')
    } catch (error) {
      showToast(error.message || 'Could not save trip', 2400)
    }
  }

  function scrollToSection(sectionId) {
    if (showSerpExploreView && sectionId !== 'explore') {
      setShowSerpExploreView(false)
    }
    setActiveSidebarId(sectionId)
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function getContainerAppearance(containerId) {
    const sectionId = containerId === 'pool' || String(containerId).startsWith('custom:') ? containerId : `day:${containerId}`
    return getSectionAppearance(activeTrip, sectionId)
  }

  async function fetchSuggestions() {
    const payload = buildOptimizePayload(activeTrip)
    setEngineState({ loading: true, error: '', data: null, requestPayload: payload })
    setShowSuggestions(true)
    try {
      const response = await fetch(`${API_BASE}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Optimization failed')
      setSelectedSuggestionIndexes((data.optimized_route || []).map((_, index) => index))
      setEngineState({ loading: false, error: '', data, requestPayload: payload })
      setShowSuggestions(true)
    } catch (error) {
      setSelectedSuggestionIndexes([])
      setEngineState({ loading: false, error: error.message, data: null, requestPayload: payload })
      setShowSuggestions(true)
    }
  }

  async function fetchSerpExplorePlaces(queryText = serpSearchQuery, categoryName = serpActiveCategory) {
    setSerpExploreState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const province = activeTrip?.enginePreferences?.province || 'Punjab'
      const coords = PROVINCE_COORDS[province] || PROVINCE_COORDS['Punjab'] || { lat: 31.5204, lon: 74.3587 }
      const dest = activeTrip?.destination || activeTrip?.title || 'Lahore'
      
      const qClean = (queryText || '').trim()
      let finalQuery = 'tourist attractions'

      if (categoryName !== 'All' && qClean) {
        finalQuery = `${categoryName} ${qClean}`
      } else if (categoryName !== 'All') {
        finalQuery = `${categoryName} in ${dest}`
      } else if (qClean) {
        finalQuery = `${qClean} in ${dest}`
      }

      const data = await fetchExplorePlacesRequest(coords.lat, coords.lon, finalQuery)
      setSerpExploreState({ loading: false, error: '', places: data.places || [] })
    } catch (error) {
      setSerpExploreState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to fetch explore places' }))
    }
  }

  async function handleOpenSerpExplore() {
    setShowSerpExploreView(true)
    if (!serpExploreState.places.length) {
      void fetchSerpExplorePlaces(serpSearchQuery, serpActiveCategory)
    }
  }

  useEffect(() => {
    if (!showSerpExploreView) {
      setSelectedExplorePlace(null)
      return
    }
    const timer = setTimeout(() => {
      void fetchSerpExplorePlaces(serpSearchQuery, serpActiveCategory)
    }, 450)
    return () => clearTimeout(timer)
  }, [serpSearchQuery, serpActiveCategory, showSerpExploreView])

  function addSuggestionsToPool() {
    const stops = (engineState.data?.optimized_route || []).filter((_, index) => selectedSuggestionIndexes.includes(index))
    if (!stops.length) return
    const created = stops.map(createPlaceFromEngineStop)
    commitTripChange((prev) => ({
      ...prev,
      placesPool: [...prev.placesPool, ...created],
      map: {
        ...ensureMapState(prev),
        selectedPlaceId: created[0]?.id || prev.map?.selectedPlaceId || null,
      },
    }))
    showToast('Suggestions added to pool')
    setShowSuggestions(false)
  }

  function applySystemItinerary() {
    const itinerary = engineState.data?.itinerary || []
    const stops = (engineState.data?.optimized_route || []).filter((_, index) => selectedSuggestionIndexes.includes(index))
    if (!Array.isArray(itinerary) || !Array.isArray(stops) || !activeTrip.days.length) return
    const created = stops.map(createPlaceFromEngineStop)
    commitTripChange((prev) => ({
      ...prev,
      placesPool: [],
      days: prev.days.map((day, index) => ({
        ...day,
        items: created[index] ? [{ ...created[index], startTime: itinerary[selectedSuggestionIndexes[index]]?.arrival_time || null, endTime: itinerary[selectedSuggestionIndexes[index]]?.departure_time || null }] : [],
      })),
      map: {
        ...ensureMapState(prev),
        selectedPlaceId: created[0]?.id || null,
      },
    }))
    showToast('Applied as system itinerary')
    setShowSuggestions(false)
  }

  function toggleSuggestionIndex(index, checked) {
    setSelectedSuggestionIndexes((prev) => {
      if (checked) return Array.from(new Set([...prev, index])).sort((a, b) => a - b)
      return prev.filter((value) => value !== index)
    })
  }

  async function optimizeDay(dayId) {
    const day = activeTrip.days.find((entry) => entry.id === dayId)
    const places = getPlaceItems(day?.items || [])
    if (places.length < 2) {
      showToast('Need at least two places in a day to optimize')
      return
    }
    const prefs = activeTrip.enginePreferences || {}
    const payload = {
      dayId,
      start: { lat: Number(prefs.startLat) || 31.5204, lon: Number(prefs.startLon) || 74.3587 },
      options: { algorithm: 'nearest_neighbor', returnToStart: false, speedKmh: 30, roadAware: true },
      locations: places.map((place) => ({ id: place.id, name: place.title, lat: Number(place.lat), lon: Number(place.lon) })),
    }
    try {
      const response = await fetch(`${API_BASE}/v1/sequence/day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Day optimization failed')
      const order = Array.isArray(data.order) ? data.order : []
      if (!order.length) return
      commitTripChange((prev) => ({
        ...prev,
        days: prev.days.map((entry) => {
          if (entry.id !== dayId) return entry
          const placeMap = new Map(getPlaceItems(entry.items).map((item) => [item.id, item]))
          const orderedPlaces = order.map((id) => placeMap.get(id)).filter(Boolean)
          const nonPlaceItems = getNonPlaceItems(entry.items)
          return { ...entry, items: [...orderedPlaces, ...nonPlaceItems], optimization: data }
        }),
      }))
      showToast('Day optimized')
    } catch (error) {
      showToast(error.message, 2400)
    }
  }



  function updatePrefs(field, value) {
    commitTripChange((prev) => ({
      ...prev,
      enginePreferences: { ...prev.enginePreferences, [field]: value },
    }))
  }

  function updateProvincePreference(province) {
    const coords = PROVINCE_COORDS[province]
    commitTripChange((prev) => ({
      ...prev,
      enginePreferences: {
        ...prev.enginePreferences,
        province,
        ...(coords ? { startLat: coords.lat, startLon: coords.lon } : {}),
      },
    }))
  }

  function updateQuestionnaire(field, value) {
    commitTripChange((prev) => {
      const enginePreferences = prev.enginePreferences || {}
      const questionnaire = { ...(enginePreferences.questionnaire || {}), [field]: value }
      return {
        ...prev,
        enginePreferences: {
          ...enginePreferences,
          questionnaire,
          maxBudget: mapBudgetToMaxBudget(questionnaire.budgetLevel),
          maxTravelHours: mapDurationToMaxHours(questionnaire.tripDuration),
          preferredCategories: generateCategoriesFromQuestionnaire(questionnaire),
          useCrowdFilter: String(questionnaire.crowdPreference || '').toLowerCase().includes('avoid'),
        },
      }
    })
  }

  function savePreferencesModal() {
    setShowPrefs(false)
    showToast('Trip preferences saved')
  }

  function openDateModal() {
    const rawStart = activeTrip.startDate || (activeTrip.days?.[0]?.date || '')
    const rawEnd = activeTrip.endDate || (activeTrip.days?.[activeTrip.days.length - 1]?.date || '')
    setDraftStartDate(toIsoDateString(rawStart))
    setDraftEndDate(toIsoDateString(rawEnd))
    setDateError('')
    setDateModalOpen(true)
  }

  function handleDateFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (!draftStartDate || !draftEndDate) {
      setDateError('Please select both start and end dates.')
      return
    }
    if (draftEndDate < draftStartDate) {
      setDateError('End date must be on or after start date.')
      return
    }

    const affected = getAffectedOutOfRangeDays(activeTrip, draftStartDate, draftEndDate)
    if (affected.length > 0) {
      setDateModalOpen(false)
      setDateWarningModal({
        open: true,
        newStartDate: draftStartDate,
        newEndDate: draftEndDate,
        affectedDays: affected,
      })
      return
    }

    applyTripDates(draftStartDate, draftEndDate)
    setDateModalOpen(false)
  }

  function handleCancelDateWarning() {
    setDateWarningModal({ open: false, newStartDate: '', newEndDate: '', affectedDays: [] })
  }

  function handleConfirmDateWarning() {
    const { newStartDate, newEndDate } = dateWarningModal
    setDateWarningModal({ open: false, newStartDate: '', newEndDate: '', affectedDays: [] })
    applyTripDates(newStartDate, newEndDate)
  }

  function applyTripDates(newStartDate, newEndDate) {
    commitTripChange((prev) => {
      const nextDays = rebuildTripDays(prev.days || [], newStartDate, newEndDate, prev.startDate)
      return {
        ...prev,
        startDate: newStartDate,
        endDate: newEndDate,
        dates: `${newStartDate} - ${newEndDate}`,
        days: nextDays,
      }
    })
    showToast('Trip dates updated')
  }

  function openSuggestionsFromPreferences() {
    setShowPrefs(false)
    fetchSuggestions()
  }

  function editPreferencesFromSuggestions() {
    setShowSuggestions(false)
    setShowPrefs(true)
  }

  function moveItemBetweenContainers(sourceContainerId, itemId, targetContainerId, targetIndex) {
    commitTripChange((prev) => {
      const sourceItems = [...getContainerItems(prev, sourceContainerId)]
      const sourceIndex = sourceItems.findIndex((item) => item.id === itemId)
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
      nextTrip = {
        ...nextTrip,
        map: {
          ...ensureMapState(nextTrip),
          selectedPlaceId: item?.type === 'place' ? item.id : nextTrip.map?.selectedPlaceId || null,
        },
      }
      return nextTrip
    })
    setDragMeta(null)
    setDragOverMeta(null)
  }

  function handleDragStart(sourceContainerId, itemId) {
    setDragMeta({ sourceContainerId, itemId })
  }

  function handleDragEnd() {
    setDragMeta(null)
    setDragOverMeta(null)
  }

  function handleDrop(targetContainerId, targetIndex) {
    if (!dragMeta) return
    moveItemBetweenContainers(dragMeta.sourceContainerId, dragMeta.itemId, targetContainerId, targetIndex)
  }

  function removeItem(containerId, itemId) {
    commitTripChange((prev) => {
      const nextItems = getContainerItems(prev, containerId).filter((item) => item.id !== itemId)
      const nextTrip = setContainerItems(prev, containerId, nextItems)
      return {
        ...nextTrip,
        expenses: (nextTrip.expenses || []).filter((expense) => String(expense.placeId || '') !== String(itemId)),
        map: {
          ...ensureMapState(nextTrip),
          selectedPlaceId: String(nextTrip.map?.selectedPlaceId || '') === String(itemId) ? null : nextTrip.map?.selectedPlaceId || null,
        },
      }
    })
    setSelectedItemIds((prev) => prev.filter((id) => String(id) !== String(itemId)))
  }

  function addSpecialItem(dayId, itemType) {
    commitTripChange((prev) => {
      const item = itemType === 'note' ? createNoteItem() : createChecklistItem()
      const items = [...getContainerItems(prev, dayId), item]
      return setContainerItems(prev, dayId, items)
    })
  }

  function updateNote(containerId, noteId, value) {
    commitTripChange((prev) => {
      const items = getContainerItems(prev, containerId).map((item) => (item.id === noteId ? { ...item, content: value } : item))
      return setContainerItems(prev, containerId, items)
    })
  }

  function updateChecklist(containerId, checklistId, updater) {
    commitTripChange((prev) => {
      const items = getContainerItems(prev, containerId).map((item) => (item.id === checklistId ? updater(item) : item))
      return setContainerItems(prev, containerId, items)
    })
  }

  function addChecklistRowToItem(containerId, checklistId) {
    updateChecklist(containerId, checklistId, (item) => ({
      ...item,
      items: [...(item.items || []), createChecklistRow()],
    }))
  }

  function addDay() {
    commitTripChange((prev) => {
      const nextIndex = prev.days.length + 1
      const anchorDate = prev.endDate ? new Date(prev.endDate) : new Date()
      anchorDate.setDate(anchorDate.getDate() + 1)
      return rebuildTripDayMetadata(prev, [
        ...prev.days,
        {
          id: `day-${Date.now()}`,
          label: `Day ${nextIndex}`,
          shortLabel: `Day ${nextIndex}`,
          date: anchorDate.toDateString(),
          items: [],
        },
      ])
    })
  }

  function insertDayAfter(dayId) {
    commitTripChange((prev) => {
      const index = prev.days.findIndex((day) => day.id === dayId)
      if (index === -1) return prev
      const days = [...prev.days]
      days.splice(index + 1, 0, {
        id: `day-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '',
        shortLabel: '',
        date: '',
        items: [],
      })
      return rebuildTripDayMetadata(prev, days)
    })
    showToast('Inserted a new day')
  }

  function deleteDay(dayId) {
    commitTripChange((prev) => {
      if ((prev.days || []).length <= 1) return prev
      const day = prev.days.find((entry) => entry.id === dayId)
      if (!day) return prev
      const nextTrip = {
        ...prev,
        placesPool: [...prev.placesPool, ...(day.items || [])],
        days: prev.days.filter((entry) => entry.id !== dayId),
      }
      return rebuildTripDayMetadata(nextTrip, nextTrip.days)
    })
    showToast('Deleted day and moved its items to pool')
  }

  function selectTripPlace(placeId) {
    setSelectedExplorePlace(null)
    commitTripChange((prev) => ({
      ...prev,
      map: {
        ...ensureMapState(prev),
        selectedPlaceId: placeId,
      },
    }), { trackHistory: false })
  }

  function addMapPlaceToPool(place) {
    commitTripChange((prev) => ({
      ...prev,
      placesPool: [...prev.placesPool, place],
      map: {
        ...ensureMapState(prev),
        selectedPlaceId: place.id,
      },
    }))
    showToast('Added map place to pool')
  }

  function addCustomListSection() {
    const nextList = createCustomList(`List ${((activeTrip.customLists || []).length || 0) + 1}`)
    commitTripChange((prev) => ({
      ...prev,
      customLists: [...(prev.customLists || []), nextList],
    }))
    window.setTimeout(() => scrollToSection(`custom:${nextList.id}`), 60)
    showToast('Custom list created')
  }

  function applyArrangement(nextTrip) {
    commitTripChange(() => ({
      ...activeTrip,
      ...nextTrip,
      map: ensureMapState(nextTrip),
    }))
    showToast('Arrangement updated')
  }

  function renameCustomList(listId, name) {
    commitTripChange((prev) => ({
      ...prev,
      customLists: (prev.customLists || []).map((list) => (list.id === listId ? { ...list, name } : list)),
    }))
  }

  function deleteCustomList(listId) {
    commitTripChange((prev) => {
      const target = (prev.customLists || []).find((list) => list.id === listId)
      if (!target) return prev
      return {
        ...prev,
        placesPool: [...prev.placesPool, ...(target.items || [])],
        customLists: (prev.customLists || []).filter((list) => list.id !== listId),
      }
    })
    showToast('Deleted custom list and moved its items to pool')
  }

  function updatePlaceById(placeId, updater) {
    commitTripChange((prev) => {
      let changed = false
      const apply = (item) => {
        if (String(item.id) !== String(placeId)) return item
        changed = true
        return updater(item)
      }
      const nextTrip = {
        ...prev,
        placesPool: (prev.placesPool || []).map(apply),
        customLists: (prev.customLists || []).map((list) => ({ ...list, items: (list.items || []).map(apply) })),
        days: (prev.days || []).map((day) => ({ ...day, items: (day.items || []).map(apply) })),
      }
      return changed ? nextTrip : prev
    })
  }

  function openExpenseEditor(placeId = null, expenseId = null) {
    setExpenseModal({ open: true, placeId, expenseId })
  }

  function closeExpenseEditor() {
    setExpenseModal({ open: false, placeId: null, expenseId: null })
  }

  function saveExpenseForm(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('amount')) || 0
    const category = String(form.get('category') || 'Misc')
    const date = String(form.get('date') || '')
    const note = String(form.get('note') || '').trim()
    const placeId = String(form.get('placeId') || '') || null
    const editingId = expenseModal.expenseId
    if (amount <= 0) {
      showToast('Enter a valid expense amount')
      return
    }
    commitTripChange((prev) => {
      const nextExpenses = [...(prev.expenses || [])]
      if (editingId) {
        const index = nextExpenses.findIndex((expense) => String(expense.id) === String(editingId))
        if (index >= 0) {
          nextExpenses[index] = { ...nextExpenses[index], amount, category, date, note, placeId }
        }
      } else {
        nextExpenses.unshift({
          id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          amount,
          category,
          date,
          note,
          placeId,
        })
      }
      return { ...prev, expenses: nextExpenses }
    })
    closeExpenseEditor()
    showToast(editingId ? 'Expense updated' : 'Expense added')
  }

  function deleteExpense(expenseId) {
    commitTripChange((prev) => ({
      ...prev,
      expenses: (prev.expenses || []).filter((expense) => String(expense.id) !== String(expenseId)),
    }))
    if (expenseModal.expenseId === expenseId) closeExpenseEditor()
    showToast('Expense deleted')
  }

  function saveBudgetForm(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('budgetAmount')) || 0
    commitTripChange((prev) => ({
      ...prev,
      budget: { ...(typeof prev.budget === 'object' ? prev.budget : { currency: 'PKR' }), amount },
    }))
    setShowBudgetModal(false)
    showToast('Budget saved')
  }

  async function saveTripSettingsForm(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('tripTitle') || '').trim() || 'My Trip'
    const name = String(form.get('tripName') || '').trim()
    const startDate = String(form.get('startDate') || '')
    const endDate = String(form.get('endDate') || '')
    const notes = String(form.get('tripNotes') || '')
    const privacy = String(tripSettingsPrivacy || activeTrip?.privacy || activeTrip?.data?.privacy || 'private')

    const nextTrip = rebuildTripDayMetadata({
      ...activeTrip,
      title,
      name,
      startDate,
      endDate,
      notes,
      privacy,
      dates: formatTripDateRange(startDate, endDate),
    }, activeTrip.days || [])

    commitTripChange(() => nextTrip)
    setShowTripSettings(false)

    try {
      await saveTrip(nextTrip)
      showToast('Trip settings saved')
    } catch (error) {
      showToast(error?.message || 'Could not save trip settings', 2400)
    }
  }

  function toggleActivePlaceCard(placeId) {
    const isAlreadyActive = String(activePlaceCardId || '') === String(placeId)
    const targetId = isAlreadyActive ? null : placeId

    const clickedLoc = placeId ? findPlaceLocation(activeTrip, placeId) : null
    const isClickedPlace = clickedLoc && clickedLoc.item?.type !== 'note' && clickedLoc.item?.type !== 'checklist'

    if (isClickedPlace) {
      selectTripPlace(targetId)
    } else {
      setActivePlaceCardId(targetId)
    }

    setTimeEditorPlaceId((prev) => (String(prev || '') === String(placeId) ? prev : null))
  }

  function openPlaceTimeEditor(placeId) {
    setActivePlaceCardId(placeId)
    setTimeEditorPlaceId(placeId)
  }

  function cancelPlaceTimeEditor() {
    setTimeEditorPlaceId(null)
  }

  function savePlaceTime(placeId, startTime, endTime) {
    updatePlaceById(placeId, (item) => ({
      ...item,
      startTime: startTime || null,
      endTime: endTime || null,
    }))
    setTimeEditorPlaceId(null)
  }

  function openVisitModal(placeId) {
    if (!placeId) return
    selectTripPlace(placeId)
    const place = getAllPlaceItems(activeTrip).find((entry) => String(entry.id) === String(placeId))
    if (!place) return
    const details = ensureVisitDetails(place)
    setVisitModalDraft({
      visitedDate: String(details?.visitedDate || ''),
      visitedTime: String(details?.visitedTime || ''),
      notes: String(details?.notes || ''),
    })
    setVisitModalPlaceId(placeId)
  }

  function markPlaceNotVisited(placeId) {
    updatePlaceById(placeId, (item) => {
      const details = ensureVisitDetails(item)
      return {
        ...item,
        visited: false,
        visitDetails: { ...details, visited: false },
      }
    })
  }

  function openJournalForPlace(placeId) {
    selectTripPlace(placeId)
    setJournalPlaceId(placeId)
  }

  function triggerLegacyUiAction() {
    showToast('This frontend keeps the planner UI active without backend actions.')
  }

  function closeVisitModal() {
    setVisitModalPlaceId(null)
  }

  function saveVisitModal() {
    const placeId = visitModalPlaceId
    if (!placeId) return
    const visitedDate = String(visitModalDraft.visitedDate || '').trim()
    const visitedTime = String(visitModalDraft.visitedTime || '').trim()
    const notes = String(visitModalDraft.notes || '')
    updatePlaceById(placeId, (item) => {
      const details = ensureVisitDetails(item)
      return {
        ...item,
        visited: true,
        visitDetails: {
          ...details,
          visited: true,
          notes,
          visitedDate: visitedDate || null,
          visitedTime: visitedTime || null,
        },
      }
    })
    setVisitModalPlaceId(null)
    const place = getAllPlaceItems(activeTrip).find((entry) => String(entry.id) === String(placeId))
    setChooseLocationDraft(String(place?.visitLocation || ''))
    setChooseLocationPlaceId(placeId)
  }

  function openJournalEntry(placeId) {
    selectTripPlace(placeId)
    setShowTripJournal(false)
    setJournalPlaceId(placeId)
  }

  function closeChooseLocationModal() {
    setChooseLocationPlaceId(null)
  }

  function saveChooseLocationModal() {
    const placeId = chooseLocationPlaceId
    if (!placeId) return
    const locationValue = String(chooseLocationDraft || '').trim()
    updatePlaceById(placeId, (item) => ({ ...item, visitLocation: locationValue }))
    setChooseLocationPlaceId(null)
  }

  function duplicateItem(containerId, itemId) {
    commitTripChange((prev) => {
      const items = [...getContainerItems(prev, containerId)]
      const index = items.findIndex((item) => item.id === itemId)
      if (index === -1) return prev
      const copy = duplicateTripItem(items[index])
      items.splice(index + 1, 0, copy)
      const nextTrip = setContainerItems(prev, containerId, items)
      return {
        ...nextTrip,
        map: {
          ...ensureMapState(nextTrip),
          selectedPlaceId: copy.type === 'place' ? copy.id : nextTrip.map?.selectedPlaceId || null,
        },
      }
    })
    showToast('Duplicated item')
  }

  function moveItemBySelect(sourceContainerId, itemId, destinationId) {
    if (!destinationId || destinationId === sourceContainerId) return
    moveItemBetweenContainers(sourceContainerId, itemId, destinationId, getContainerItems(activeTrip, destinationId).length)
    showToast('Moved item')
  }

  function addChecklistRowAfter(containerId, checklistId, rowId) {
    updateChecklist(containerId, checklistId, (item) => {
      const rows = [...(item.items || [])]
      const index = rows.findIndex((row) => row.id === rowId)
      const insertAt = index >= 0 ? index + 1 : rows.length
      rows.splice(insertAt, 0, createChecklistRow())
      return { ...item, items: rows }
    })
  }

  function removeChecklistRowFromItem(containerId, checklistId, rowId) {
    updateChecklist(containerId, checklistId, (item) => {
      const rows = (item.items || []).filter((row) => row.id !== rowId)
      return { ...item, items: rows.length ? rows : [createChecklistRow()] }
    })
  }

  function renderDropZone(containerId, index, itemCount) {
    const isActive = dragOverMeta?.containerId === containerId && dragOverMeta?.index === index
    const isLegacyInsertContainer = containerId === 'pool' || activeTrip.days.some((day) => day.id === containerId)
    const showInsertZone = isLegacyInsertContainer && index > 0 && index < itemCount
    const isInsertMenuOpen = Boolean(activeInsertMenu && activeInsertMenu.containerId === containerId && activeInsertMenu.index === index)
    return (
      <div
        className={`PlannerDropZone${isActive ? ' is-active' : ''}${showInsertZone ? ' PlannerDropZone--withInsert' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOverMeta({ containerId, index })
        }}
        onDragLeave={() => {
          if (dragOverMeta?.containerId === containerId && dragOverMeta?.index === index) {
            setDragOverMeta(null)
          }
        }}
        onDrop={() => handleDrop(containerId, index)}
      >
        {showInsertZone ? (
          <div className={`InsertZone${isInsertMenuOpen ? ' is-open' : ''}`} data-container-id={containerId} data-index={index}>
            <div className="InsertLine" />
            <button
              type="button"
              className="InsertBtn"
              onClick={(event) => {
                event.stopPropagation()
                setActiveInsertMenu((prev) => {
                  if (prev?.containerId === containerId && prev?.index === index) return null
                  return { containerId, index }
                })
              }}
            >
              +
            </button>
            {isInsertMenuOpen ? (
              <div className="InsertMenu" onClick={(event) => event.stopPropagation()}>
                <div
                  onClick={() => {
                    setActiveInsertMenu(null)
                    focusAddPlaceInput(containerId)
                  }}
                >
                  📍 Add a place
                </div>
                <div
                  onClick={() => {
                    const noteId = insertSpecialItemAt(containerId, index, 'note')
                    if (!noteId) return
                    window.setTimeout(() => {
                      const input = document.querySelector(`[data-note-input="${noteId}"]`)
                      input?.focus()
                      input?.select?.()
                    }, 0)
                  }}
                >
                  📝 Add a note
                </div>
                <div
                  onClick={() => {
                    const checklistId = insertSpecialItemAt(containerId, index, 'checklist')
                    if (!checklistId) return
                    window.setTimeout(() => {
                      const input = document.querySelector(`[data-checklist-title="${checklistId}"]`)
                      input?.focus()
                      input?.select?.()
                    }, 0)
                  }}
                >
                  ✔ Add a checklist
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  function renderItemCard(item, containerId, index) {
    const appearance = getContainerAppearance(containerId)
    const connection = activeTrip.days.some((day) => day.id === containerId)
      ? dayConnectionsById.get(containerId)?.get(String(item.id)) || null
      : null
    const expenseTotal = expenseTotalsByPlaceId.get(String(item.id)) || 0
    return (
      <PlannerItemCard
        key={item.id}
        item={item}
        containerId={containerId}
        index={index}
        appearance={appearance}
        connection={connection}
        isChecked={selectedItemIds.includes(item.id)}
        isActive={String(activePlaceCardId || '') === String(item.id)}
        isTimeEditing={String(timeEditorPlaceId || '') === String(item.id)}
        expenseTotal={expenseTotal}
        moveDestinations={moveDestinations}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onToggleActive={toggleActivePlaceCard}
        onToggleSelected={toggleItemSelected}
        onUpdateNote={updateNote}
        onUpdateChecklist={updateChecklist}
        onAddChecklistRowAfter={addChecklistRowAfter}
        onAddChecklistRow={addChecklistRowToItem}
        onRemoveChecklistRow={removeChecklistRowFromItem}
        onMoveItem={moveItemBySelect}
        onRemoveItem={removeItem}
        onOpenTimeEditor={openPlaceTimeEditor}
        onCancelTimeEditor={cancelPlaceTimeEditor}
        onSaveTime={savePlaceTime}
        onMarkVisited={openVisitModal}
        onMarkNotVisited={markPlaceNotVisited}
        onOpenJournal={openJournalForPlace}
        onOpenExpense={openExpenseEditor}
        onUiAction={triggerLegacyUiAction}
        onOpenMap={selectTripPlace}
        formatTimeLabel={formatTime12h}
        elementRef={(node) => {
          if (node) {
            placeRefs.current[item.id] = node
          } else {
            delete placeRefs.current[item.id]
          }
        }}
      />
    )
  }

  const enginePrefs = activeTrip.enginePreferences || {}
  const questionnaire = enginePrefs.questionnaire || {}
  const suggestionStops = Array.isArray(engineState.data?.optimized_route) ? engineState.data.optimized_route : []
  const suggestionItinerary = Array.isArray(engineState.data?.itinerary) ? engineState.data.itinerary : []
  const suggestionMeta = engineState.data?.meta && typeof engineState.data.meta === 'object' ? engineState.data.meta : {}
  const selectedStops = suggestionStops.filter((_, index) => selectedSuggestionIndexes.includes(index))
  const suggestionCards = [
    { label: 'Province', value: suggestionMeta.province || engineState.requestPayload?.province || enginePrefs.province || 'Punjab' },
    { label: 'Places selected', value: suggestionMeta.total_locations_selected ?? suggestionStops.length },
    { label: 'Utility score', value: suggestionMeta.utility_score ?? engineState.data?.utility_score ?? 'n/a' },
    { label: 'Budget used', value: suggestionMeta.budget_used ?? engineState.data?.budget_used ?? 'n/a' },
    { label: 'Total time (h)', value: suggestionMeta.total_time_hours ?? engineState.data?.total_time_hours ?? 'n/a' },
    { label: 'Distance (km)', value: suggestionMeta.total_distance_km ?? engineState.data?.total_distance_km ?? 'n/a' },
  ]
  const suggestionConstraints = [
    enginePrefs.useBudget ? `max_budget: ${Number(enginePrefs.maxBudget) || 5000}` : null,
    enginePrefs.useTimeLimit ? `max_travel_hours: ${Number(enginePrefs.maxTravelHours) || 12}` : null,
  ].filter(Boolean).join('  ·  ')

  if (!bootstrappedWorkspace) return null

  return (
    <div className="PlannerPage">
      <div className="PlannerApp">
        <header className="PlannerTopbar">
          <div className="PlannerTopbar__left">
            <button type="button" className="PlannerTopbar__brand reset-btn" onClick={() => navigate('/home')}>TripNest</button>
            <div className="PlannerTopbar__status">Saved</div>
            <button type="button" className="PlannerTopbar__link" onClick={handleSaveTrip}>Save Trip</button>
            <button type="button" className="PlannerTopbar__link reset-btn" onClick={handleUndo}>Undo</button>
            <button type="button" className="PlannerTopbar__link reset-btn" onClick={handleRedo}>Redo</button>
          </div>
          <div className="PlannerTopbar__actions">
            <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => navigate('/home')}>Home</button>
            <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => navigate('/plan-trip')}>Plan new trip</button>
            <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => setShowPrefs(true)}>Preferences</button>
            <button type="button" className="PlannerPillButton PlannerPillButton--accent" onClick={fetchSuggestions}>Get suggestions</button>
            <button type="button" className="PlannerPillButton PlannerPillButton--dark" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowTripmatesModal(true)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#ffffff', fontSize: '10px', fontWeight: 700 }}>
                  U
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>+</span>
                <span>Tripmates</span>
              </button>
              <button type="button" className="PlannerPillButton PlannerPillButton--dark" onClick={() => setShowShareModal(true)}>Share</button>
            <button type="button" className="PlannerPillButton PlannerPillButton--dark" onClick={() => setConfirmLogoutOpen(true)}>Logout</button>
            <TopbarMenu
              items={[
                { icon: '⚙️', label: 'Trip settings', onClick: () => { setTripSettingsPrivacy(activeTrip?.privacy || activeTrip?.data?.privacy || 'private'); setShowTripSettings(true) } },
                { icon: '🎛️', label: 'Trip preferences & engine', onClick: () => setShowPrefs(true) },
                { divider: true },
                { icon: '👁️', label: 'View only mode', onClick: () => navigate('/trip-view') },
                { divider: true },
                { icon: '📖', label: 'View trip journal', onClick: () => setShowTripJournal(true) },
                { divider: true },
                { icon: '☑️', label: bulkMode ? 'Cancel select mode' : 'Select mode', onClick: toggleBulkMode },
                { divider: true },
                { icon: '🖨️', label: 'Print this trip', onClick: () => { queuePrint(); navigate('/print-trip') } },
              ]}
            />

          </div>
        </header>
        <div className={`PlannerShell${sidebarHidden ? ' is-sidebar-hidden' : ''}`} ref={shellRef} style={shellStyle}>
          {sidebarHidden ? null : (
            <WorkspaceSidebar
              sections={sections}
              activeSectionId={activeSidebarId === 'itinerary' ? 'itinerary' : activeSidebarId}
              activeChildId={activeTrip.days.some((day) => day.id === activeSidebarId) ? activeSidebarId : null}
              onGoToSection={scrollToSection}
              onToggleAllSections={collapseOrExpandAllPreSections}
              onHideSidebar={() => setSidebarHidden(true)}
              onToggleAiAssistant={() => setShowAiAssistant(true)}
            />

          )}
          {showSerpExploreView ? (
            <>
              <main className="PlannerExploreMain">
                <header className="PlannerExploreHeader">
                  <button
                    type="button"
                    className="PlannerPillButton PlannerPillButton--light"
                    onClick={() => {
                      setShowSerpExploreView(false)
                      setSelectedExplorePlace(null)
                    }}
                  >
                    ← Back to trip
                  </button>
                  <h2 className="PlannerExploreTitle">{activeTrip.destination || activeTrip.title || 'Explore Places'}</h2>
                </header>

                <div className="PlannerExploreContent">
                  <div className="PlannerExploreSearchArea">
                    <div className="PlannerExploreSearchBox">
                      <span className="PlannerExploreSearchIcon">🔍</span>
                      <input
                        type="text"
                        className="PlannerExploreSearchInput"
                        value={serpSearchQuery}
                        onChange={(e) => setSerpSearchQuery(e.target.value)}
                        placeholder={`Search places in ${activeTrip.destination || activeTrip.title || 'destination'}...`}
                      />
                      {serpSearchQuery ? (
                        <button
                          type="button"
                          className="reset-btn"
                          style={{ color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}
                          onClick={() => setSerpSearchQuery('')}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="PlannerExploreCategoriesArea">
                    <div className="PlannerExploreCategoryPills">
                      {['All', 'Attractions', 'Restaurants', 'Cafes', 'Hotels', 'Nature', 'Historical', 'Shopping'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`PlannerExploreCategoryPill ${serpActiveCategory === cat ? 'is-active' : ''}`}
                          onClick={() => {
                            if (serpActiveCategory !== cat) {
                              setSerpActiveCategory(cat)
                            }
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="PlannerExploreResultsArea">
                    {serpExploreState.loading && !serpExploreState.places.length ? (
                      <div className="PlannerExploreCardList">
                        {[1, 2, 3, 4].map((n) => (
                          <div key={n} className="PlannerExploreCardSkeleton">
                            <div className="PlannerExploreCardSkeleton__photo" />
                            <div className="PlannerExploreCardSkeleton__body">
                              <div className="PlannerExploreCardSkeleton__line PlannerExploreCardSkeleton__line--title" />
                              <div className="PlannerExploreCardSkeleton__line PlannerExploreCardSkeleton__line--meta" />
                              <div className="PlannerExploreCardSkeleton__line PlannerExploreCardSkeleton__line--address" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (serpExploreState.error || !serpExploreState.places.length) ? (
                      <div className="PlannerExploreState PlannerExploreState--empty">
                        <p>No places found for your search.</p>
                      </div>
                    ) : (

                      <div className="PlannerExploreCardList">
                        {serpExploreState.places.map((place) => (
                          <article
                            key={place.id}
                            className={`PlannerExploreCardItem${selectedExplorePlace?.id === place.id ? ' is-selected' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              if (place && place.lat !== null && place.lon !== null && Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon))) {
                                setSelectedExplorePlace(place)
                              }
                            }}
                          >
                            <div className="PlannerExploreCardItem__media">
                              {place.photo ? (
                                <img
                                  src={place.photo}
                                  alt={place.title}
                                  className="PlannerExploreCardItem__img"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    if (e.currentTarget.nextSibling) {
                                      e.currentTarget.nextSibling.style.display = 'flex'
                                    }
                                  }}
                                />
                              ) : null}
                              <div
                                className="PlannerExploreCardItem__fallback"
                                style={{ display: place.photo ? 'none' : 'flex' }}
                              >
                                {getCategoryIcon(place.category)}
                              </div>
                            </div>

                            <div className="PlannerExploreCardItem__body">
                              <div className="PlannerExploreCardItem__header">
                                <h4 className="PlannerExploreCardItem__title" title={place.title}>{place.title}</h4>
                                {place.rating ? (
                                  <span className="PlannerExploreCardItem__ratingBadge">
                                    ⭐ {place.rating}
                                    {place.reviewCount ? (
                                      <span className="PlannerExploreCardItem__reviewCount">
                                        ({place.reviewCount.toLocaleString()})
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                              </div>

                              <div className="PlannerExploreCardItem__meta">
                                <span className="PlannerExploreCardItem__categoryTag">{place.category}</span>
                                {place.openStatus ? (
                                  <span className={`PlannerExploreCardItem__statusTag ${place.openStatus.toLowerCase().includes('open') ? 'is-open' : 'is-closed'}`}>
                                    {place.openStatus}
                                  </span>
                                ) : null}
                                {place.priceLevel ? (
                                  <span className="PlannerExploreCardItem__priceTag">{place.priceLevel}</span>
                                ) : null}
                              </div>

                              <div className="PlannerExploreCardItem__address">
                                <span>📍</span> <span>{place.address || 'Address not specified'}</span>
                              </div>

                              {place.description ? (
                                <p className="PlannerExploreCardItem__snippet">{place.description}</p>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </main>
              <div
                className={`PlannerPanelDivider${isMapDividerDragging ? ' is-dragging' : ''}`}
                style={dividerStyle}
                onMouseDown={(event) => {
                  event.preventDefault()
                  setIsMapDividerDragging(true)
                }}
              />
              <aside className="PlannerMapPanel PlannerMapPanel--react">
                <PlannerMapPanel
                  trip={activeTrip}
                  selectedPlaceId={activeTrip.map?.selectedPlaceId || null}
                  selectedExplorePlace={selectedExplorePlace}
                  onSelectPlace={selectTripPlace}
                  onAddPlaceToPool={addMapPlaceToPool}
                />
              </aside>
            </>
          ) : activeSidebarId === 'shared-budget' ? (
            <main className="PlannerSharedBudgetMain" style={{ flex: 1, minWidth: 0, padding: '24px', overflowY: 'auto' }}>
              <SharedBudgetSection sectionRef={(node) => { sectionRefs.current['shared-budget'] = node }} />
            </main>
          ) : (
            <>
              <main className="PlannerMain PlannerMainReact">
            <BulkActionBar
              count={selectedItemIds.length}
              destinations={bulkDestinations}
              onMove={bulkMove}
              onCopy={bulkCopy}
              onDelete={bulkDelete}
              onClear={clearSelection}
            />
            <section className="PlannerHeroSection PlannerSection--hero" ref={(node) => { sectionRefs.current.overview = node }}>
              <div className="PlannerTripCard">
                <div className="PlannerTripCard__banner" />
                <div className="PlannerTripCard__content">
                  <div>
                    {activeTrip.isTripmate ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 10px',
                          marginBottom: '6px',
                          borderRadius: '12px',
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        🤝 Shared Trip · Member
                      </div>
                    ) : null}
                    <h1 className="PlannerTripCard__title">
                      {ensureUiState(activeTrip).editingTitleKey === tripTitleEditKey ? (
                        <input
                          type="text"
                          className="PlannerTitleInput PlannerTripTitleInput"
                          defaultValue={activeTrip.title || 'My Trip'}
                          autoFocus
                          disabled={tripTitleSaving}
                          onFocus={(event) => event.target.select()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              event.currentTarget.blur()
                            }
                            if (event.key === 'Escape') {
                              stopEditingTitle()
                            }
                          }}
                          onBlur={(event) => {
                            void commitTripTitleEdit(event.currentTarget.value)
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="PlannerTripTitleButton reset-btn"
                          onClick={() => startEditingTitle(tripTitleEditKey)}
                          aria-label="Edit trip title"
                        >
                          <span className="PlannerTripTitleButton__text">{activeTrip.title || 'My Trip'}</span>
                        </button>
                      )}
                    </h1>
                    <div className="PlannerTripCard__metaRow">
                      <button
                        type="button"
                        className="PlannerTripCard__dateBtn reset-btn"
                        onClick={openDateModal}
                        aria-label="Change trip dates"
                        title="Click to change trip dates"
                      >
                        <span className="PlannerTripCard__dateIcon" aria-hidden="true">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </span>
                        <span className="PlannerTripCard__dateText">
                          {formatDateRangeDisplay(activeTrip.startDate, activeTrip.endDate, activeTrip.dates)}
                        </span>
                      </button>
                      <button type="button" className="PlannerTextButton PlannerTripCard__prefs reset-btn" onClick={() => setShowPrefs(true)}>Trip preferences & questionnaire</button>
                    </div>
                  </div>
                  <div className="PlannerTripCard__avatars">
                    <div className="PlannerTripCard__avatar" />
                    <button type="button" className="PlannerIconCircle" onClick={() => showToast('Collaboration flow is not wired yet')}>+</button>
                  </div>
                </div>
              </div>
            </section>
            <PlannerSectionCard
              sectionRef={(node) => { sectionRefs.current.explore = node }}
              titleContent={(
                <>
                  <h3>Explore</h3>
                  <p>Add suggestions to the places pool first, then move them into a day.</p>
                </>
              )}
              actions={(
                <>
                  <button type="button" className="PlannerPillButton PlannerPillButton--accent" onClick={handleOpenSerpExplore}>Browse all</button>
                  <button type="button" className="PlannerPillButton PlannerPillButton--dark" onClick={fetchSuggestions}>Get engine suggestions</button>
                  <button type="button" className="PlannerTextButton reset-btn" onClick={() => setShowPrefs(true)}>Trip preferences</button>
                </>
              )}
            >
              <div className="PlannerExploreGrid">
                {exploreCards.map((place, index) => {
                  const alreadyAdded = (activeTrip.placesPool || []).some((entry) => String(entry.id) === String(place.id))
                  return (
                    <article key={place.id || index} className="PlannerExploreCardReact">
                      <div className="PlannerExploreCardReact__thumb" />
                      <div className="PlannerExploreCardReact__body">
                        <div>
                          <h4>{place.title}</h4>
                          <p>{place.note || place.subtitle || 'Suggested stop for your trip.'}</p>
                        </div>
                        <button
                          type="button"
                          className={`PlannerPillButton ${alreadyAdded ? 'PlannerPillButton--light' : 'PlannerPillButton--accent'}`}
                          onClick={() => (alreadyAdded ? scrollToSection('pool') : addMapPlaceToPool(place))}
                        >
                          {alreadyAdded ? 'In trip' : 'Add to trip'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </PlannerSectionCard>
            <PlannerSectionCard
              sectionRef={(node) => { sectionRefs.current.notes = node }}
              titleContent={(
                <div className="PlannerSectionTitleRow">
                  <button
                    type="button"
                    className="PlannerCollapseToggle"
                    onClick={() => toggleSectionCollapsed('notes')}
                    aria-label={isSectionCollapsed('notes') ? 'Expand section' : 'Collapse section'}
                  >
                    {isSectionCollapsed('notes') ? '▶' : '▼'}
                  </button>
                  <div className="PlannerTitleWrap" data-title-key="notes">
                    {ensureUiState(activeTrip).editingTitleKey === 'notes' ? (
                      <input
                        type="text"
                        className="PlannerTitleInput"
                        data-title-input="notes"
                        defaultValue={ensureUiState(activeTrip).sectionTitles.notes || 'Notes'}
                        autoFocus
                        onFocus={(event) => event.target.select()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitEditingTitle('notes', event.currentTarget.value, 'Notes')
                          }
                          if (event.key === 'Escape') {
                            stopEditingTitle()
                          }
                        }}
                        onBlur={(event) => commitEditingTitle('notes', event.currentTarget.value, 'Notes')}
                      />
                    ) : (
                      <>
                        <h2
                          className="PlannerTitleText"
                          data-title-start="notes"
                          onClick={() => startEditingTitle('notes')}
                        >
                          {ensureUiState(activeTrip).sectionTitles.notes || 'Notes'}
                        </h2>
                        <button
                          type="button"
                          className="PlannerTitleEdit"
                          data-title-start="notes"
                          aria-label="Rename"
                          onClick={() => startEditingTitle('notes')}
                        >
                          ✎
                        </button>
                      </>
                    )}
                  </div>
                  <p>Write or paste anything here: how to get around, tips and tricks.</p>
                </div>
              )}
              actions={(
                <>
                  <SectionMenu
                    label="Notes menu"
                    items={[
                      { label: 'Delete section', danger: true, onClick: deleteNotesSection },
                      { label: getCollapseAllLabel(activeTrip), onClick: collapseOrExpandAllPreSections },
                    ]}
                  />
                </>
              )}
            >
              {isSectionCollapsed('notes') ? null : (
                <textarea
                  className="PlannerNotesInput"
                  id="plannerNotesInput"
                  placeholder="Write or paste anything here"
                  value={activeTrip.notes || ''}
                  onChange={(event) => updateTrip((prev) => ({ ...prev, notes: event.target.value }))}
                />
              )}
            </PlannerSectionCard>
            <PlannerSectionCard
              sectionRef={(node) => { sectionRefs.current.pool = node }}
              titleContent={(
                <div className="PlannerSectionTitleRow">
                  <button
                    type="button"
                    className="PlannerCollapseToggle"
                    onClick={() => toggleSectionCollapsed('pool')}
                    aria-label={isSectionCollapsed('pool') ? 'Expand section' : 'Collapse section'}
                  >
                    {isSectionCollapsed('pool') ? '▶' : '▼'}
                  </button>
                  <div className="PlannerTitleWrap" data-title-key="pool">
                    {ensureUiState(activeTrip).editingTitleKey === 'pool' ? (
                      <input
                        type="text"
                        className="PlannerTitleInput"
                        data-title-input="pool"
                        defaultValue={ensureUiState(activeTrip).sectionTitles.pool || 'Places to visit'}
                        autoFocus
                        onFocus={(event) => event.target.select()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitEditingTitle('pool', event.currentTarget.value, 'Places to visit')
                          }
                          if (event.key === 'Escape') {
                            stopEditingTitle()
                          }
                        }}
                        onBlur={(event) => commitEditingTitle('pool', event.currentTarget.value, 'Places to visit')}
                      />
                    ) : (
                      <>
                        <h2
                          className="PlannerTitleText"
                          data-title-start="pool"
                          onClick={() => startEditingTitle('pool')}
                        >
                          {ensureUiState(activeTrip).sectionTitles.pool || 'Places to visit'}
                        </h2>
                        <button
                          type="button"
                          className="PlannerTitleEdit"
                          data-title-start="pool"
                          aria-label="Rename"
                          onClick={() => startEditingTitle('pool')}
                        >
                          ✎
                        </button>
                      </>
                    )}
                  </div>
                  <p>Places added here stay in the pool until you move them into a day.</p>
                </div>
              )}
              actions={(
                <SectionMenu
                  label="Pool menu"
                  items={[
                    { label: 'Delete section', danger: true, onClick: clearPool },
                    { label: 'Rearrange sections', onClick: () => openArrangementFor('pool') },
                    { label: 'Change color or icon', onClick: () => openArrangementFor('pool') },
                    { label: getSelectToggleLabel('pool'), onClick: () => toggleSelectAll('pool') },
                    { label: getCollapseAllLabel(activeTrip), onClick: collapseOrExpandAllPreSections },
                  ]}
                />
              )}
            >
              {isSectionCollapsed('pool') ? null : (
                <>
                  <form className="PlannerAddRow" data-add-form="pool" onSubmit={(event) => submitQuickPlace(event, 'pool')}>
                    <input type="text" name="placeName" placeholder="Add a place" />
                    <button type="submit" className="PlannerIconCircle">+</button>
                  </form>
                  {!activeTrip.placesPool.length ? <p className="PlannerEmptyState">Use Get suggestions to fetch backend recommendations.</p> : (
                    <div className="PlannerListStack" onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop('pool', activeTrip.placesPool.length)}>
                      {renderDropZone('pool', 0, activeTrip.placesPool.length)}
                      {activeTrip.placesPool.map((place, index) => (
                        <div key={place.id}>
                          {renderItemCard(place, 'pool', index)}
                          {renderDropZone('pool', index + 1, activeTrip.placesPool.length)}
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={addCustomListSection}>+ New list</button>
                </>
              )}
            </PlannerSectionCard>
            {(activeTrip.customLists || []).map((list) => (
              <PlannerSectionCard
                key={list.id}
                sectionRef={(node) => { sectionRefs.current[`custom:${list.id}`] = node }}
                titleContent={(
                  <div className="PlannerSectionTitleRow">
                    <button
                      type="button"
                      className="PlannerCollapseToggle"
                      onClick={() => toggleSectionCollapsed(`custom:${list.id}`)}
                      aria-label={isSectionCollapsed(`custom:${list.id}`) ? 'Expand section' : 'Collapse section'}
                    >
                      {isSectionCollapsed(`custom:${list.id}`) ? '▶' : '▼'}
                    </button>
                    <div className="PlannerTitleWrap" data-title-key={`custom:${list.id}`}>
                      {ensureUiState(activeTrip).editingTitleKey === `custom:${list.id}` ? (
                        <input
                          type="text"
                          className="PlannerTitleInput"
                          data-list-title-input={list.id}
                          defaultValue={list.name || 'Untitled'}
                          autoFocus
                          onFocus={(event) => event.target.select()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitCustomListTitle(list.id, event.currentTarget.value)
                            }
                            if (event.key === 'Escape') {
                              stopEditingTitle()
                            }
                          }}
                          onBlur={(event) => commitCustomListTitle(list.id, event.currentTarget.value)}
                        />
                      ) : (
                        <>
                          <h2
                            className="PlannerTitleText"
                            data-list-title-start={list.id}
                            onClick={() => startEditingTitle(`custom:${list.id}`)}
                          >
                            {list.name || 'Untitled'}
                          </h2>
                          <button
                            type="button"
                            className="PlannerTitleEdit"
                            data-list-title-start={list.id}
                            aria-label="Rename"
                            onClick={() => startEditingTitle(`custom:${list.id}`)}
                          >
                            ✎
                          </button>
                        </>
                      )}
                    </div>
                    <p>Custom lists are separate containers that do not auto-enter the itinerary.</p>
                  </div>
                )}
                actions={(
                  <>
                    <SectionMenu
                      label="Custom list menu"
                      items={[
                        { label: 'Delete section', danger: true, onClick: () => deleteCustomList(list.id) },
                        { label: 'Rearrange sections', onClick: () => openArrangementFor(`custom:${list.id}`) },
                        { label: 'Change color or icon', onClick: () => openArrangementFor(`custom:${list.id}`) },
                        { label: getSelectToggleLabel(`custom:${list.id}`), onClick: () => toggleSelectAll(`custom:${list.id}`) },
                        { label: getCollapseAllLabel(activeTrip), onClick: collapseOrExpandAllPreSections },
                      ]}
                    />
                  </>
                )}
              >
                {isSectionCollapsed(`custom:${list.id}`) ? null : (
                  <>
                    {!(list.items || []).length ? <p className="PlannerEmptyState">Drag places here to build a custom list.</p> : null}
                    <div className="PlannerListStack" onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(`custom:${list.id}`, (list.items || []).length)}>
                      {renderDropZone(`custom:${list.id}`, 0, (list.items || []).length)}
                      {(list.items || []).map((item, index) => (
                        <div key={item.id}>
                          {renderItemCard(item, `custom:${list.id}`, index)}
                          {renderDropZone(`custom:${list.id}`, index + 1, (list.items || []).length)}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </PlannerSectionCard>
            ))}
            <section className="PlannerSection" id="section-itinerary" ref={(node) => { sectionRefs.current.itinerary = node }}>
              <div className="PlannerSection__header">
                <div>
                  <h2>Itinerary</h2>
                  <p>Days are ordered containers. Connections and markers update when their contents change.</p>
                </div>
                <div className="PlannerDatePill">{activeTrip.dates}</div>
              </div>
              <div className="PlannerDayStack">
                {activeTrip.days.map((day) => (
                  <PlannerSectionCard
                    key={day.id}
                    className="PlannerDaySection"
                    sectionRef={(node) => { sectionRefs.current[day.id] = node }}
                    titleContent={(
                      <div className="PlannerSectionTitleRow PlannerDayHeading">
                        <button
                          type="button"
                          className="PlannerCollapseToggle"
                          onClick={() => toggleSectionCollapsed(`day:${day.id}`)}
                          aria-label={isSectionCollapsed(`day:${day.id}`) ? 'Expand day' : 'Collapse day'}
                        >
                          {isSectionCollapsed(`day:${day.id}`) ? '▶' : '▼'}
                        </button>
                        <div className="PlannerDayHeading__text">
                          <h3>{formatDayLabel(day.date, day.label)}</h3>
                          <p>Add subheading</p>
                        </div>
                      </div>
                    )}
                    actions={(
                      <div className="PlannerDaySection__tools">
                        <button type="button" className="PlannerDayToolButton reset-btn" onClick={() => showToast('Auto-fill day is not wired yet')}>Auto-fill day</button>
                        <button type="button" className="PlannerDayToolButton PlannerDayToolButton--accent reset-btn" onClick={() => optimizeDay(day.id)}>Optimize route</button>
                        <SectionMenu
                          label="Day menu"
                          items={[
                            { label: 'Rearrange sections', onClick: () => openArrangementFor(`day:${day.id}`) },
                            { label: 'Change color', onClick: () => { } },
                            { label: getSelectToggleLabel(day.id), onClick: () => toggleSelectAll(day.id) },
                            {
                              label: (() => {
                                const dayIds = (activeTrip.days || []).map((d) => `day:${d.id}`)
                                const ui = ensureUiState(activeTrip)
                                const allCollapsed = dayIds.length > 0 && dayIds.every((id) => ui.collapsedSectionIds.includes(id))
                                return allCollapsed ? 'Expand all days' : 'Collapse all days'
                              })(),
                              onClick: toggleAllDaysCollapsed
                            },
                            { label: 'Add places to journal', onClick: () => { } },
                            { label: 'Insert day after', onClick: () => insertDayAfter(day.id) },
                            { label: 'Delete day', danger: true, onClick: () => deleteDay(day.id) },
                          ]}
                        />
                      </div>
                    )}
                  >
                    {isSectionCollapsed(`day:${day.id}`) ? null : (
                      <div className="PlannerSection__body">
                        {day.optimization?.metrics ? (
                          <div className="PlannerOptimizationSummary">
                            <span>Total distance: {Number(day.optimization.metrics.totalDistanceKm || 0).toFixed(1)} km</span>
                            <span>Travel time: {Number(day.optimization.metrics.estimatedTravelTimeHours || 0).toFixed(1)} hr</span>
                          </div>
                        ) : null}
                        <form className="PlannerAddRow" data-add-form="day" data-day-id={day.id} onSubmit={(event) => submitQuickPlace(event, day.id)}>
                          <input type="text" name="placeName" placeholder="Add a place" />
                          <button type="submit" className="PlannerIconCircle">+</button>
                        </form>
                        {!day.items?.length ? <p className="PlannerEmptyState">No places scheduled for this day yet. Drag places here or add a note/checklist.</p> : null}
                        <div className="PlannerListStack" onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(day.id, day.items.length)}>
                          {renderDropZone(day.id, 0, day.items.length)}
                          {(day.items || []).map((item, index) => (
                            <div key={item.id}>
                              {renderItemCard(item, day.id, index)}
                              {renderDropZone(day.id, index + 1, day.items.length)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </PlannerSectionCard>
                ))}
              </div>
            </section>
            <div className="PlannerSectionOrder PlannerSectionOrder--budget">
              <PlannerSectionCard
                sectionRef={(node) => { sectionRefs.current.budget = node }}
                titleContent={(
                  <>
                    <SectionBadge color="#16a34a" icon="ticket" label="" compact />
                    <h3>Budget & Expenses</h3>
                    <p>{formatMoney(totalSpent)} spent of {formatMoney(budgetAmount)}</p>
                  </>
                )}
                actions={(
                  <>
                    <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => toggleSectionCollapsed('budget')}>{isSectionCollapsed('budget') ? 'Expand' : 'Collapse'}</button>
                    <SectionMenu
                      label="Budget menu"
                      items={[
                        { label: isSectionCollapsed('budget') ? 'Expand' : 'Collapse', onClick: () => toggleSectionCollapsed('budget') },
                        { label: 'Arrangement and color', onClick: () => openArrangementFor('pool') },
                      ]}
                    />
                    <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => setShowBudgetModal(true)}>Set Budget</button>
                    <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => openExpenseEditor(selectedPlace?.id || null, null)}>Add Expense</button>
                  </>
                )}
              >
                {isSectionCollapsed('budget') ? null : (
                  <>
                    <div className="BudgetProgress">
                      <div className="BudgetProgress__bar"><div className="BudgetProgress__fill" style={{ width: `${budgetProgress}%` }} /></div>
                      <span>{budgetAmount > 0 ? `${budgetProgress.toFixed(0)}% used` : 'No budget set'}</span>
                    </div>
                    {!sortedExpenses.length ? <p className="PlannerEmptyState">No expenses added yet.</p> : (
                      <div className="PlannerExpenseList">
                        {sortedExpenses.slice(0, 8).map((expense) => (
                          <article key={expense.id} className="PlannerExpenseCard">
                            <div>
                              <strong>{formatMoney(expense.amount)}</strong>
                              <div className="PlannerPlaceCard__meta">{expense.category} {expense.date ? `· ${formatShortDate(expense.date)}` : ''}</div>
                              {expense.note ? <div className="PlannerPlaceCard__note">{expense.note}</div> : null}
                            </div>
                            <div className="PlannerItemActionBar">
                              <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => openExpenseEditor(expense.placeId || null, expense.id)}>Edit</button>
                              <button type="button" className="PlannerInlineDanger" onClick={() => deleteExpense(expense.id)}>Delete</button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </PlannerSectionCard>
            </div>

          </main>
          <div
            className={`PlannerPanelDivider${isMapDividerDragging ? ' is-dragging' : ''}`}
            style={dividerStyle}
            onMouseDown={(event) => {
              event.preventDefault()
              setIsMapDividerDragging(true)
            }}
          />
          <aside className="PlannerMapPanel PlannerMapPanel--react">
            <PlannerMapPanel
              trip={activeTrip}
              selectedPlaceId={activeTrip.map?.selectedPlaceId || null}
              selectedExplorePlace={selectedExplorePlace}
              onSelectPlace={selectTripPlace}
              onAddPlaceToPool={addMapPlaceToPool}
            />
          </aside>
        </>
      )}
        </div>
      </div>
      {toast ? <div className="PlannerToast PlannerToast--visible">{toast}</div> : null}
      <div className="TripHubDeleteModal" hidden={!confirmLogoutOpen} aria-hidden={confirmLogoutOpen ? 'false' : 'true'}>
        <div className="TripHubDeleteModal__backdrop" onClick={() => setConfirmLogoutOpen(false)} />
        <div className="TripHubDeleteModal__dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-logout-title">
          <h2 id="workspace-logout-title">Log out</h2>
          <p>Are you sure you want to log out?</p>
          <div className="TripHubDeleteModal__actions">
            <button type="button" className="TripHubDeleteModal__cancel" onClick={() => setConfirmLogoutOpen(false)}>Cancel</button>
            <button type="button" className="TripHubDeleteModal__confirm" onClick={handleLogout}>Yes, log out</button>
          </div>
        </div>
      </div>
      {visitModalPlaceId ? (
        <div className="PlannerModalOverlay" onClick={closeVisitModal}>
          <div className="PlannerModal VisitModal" role="dialog" aria-modal="true" aria-label="Add more about your visit" onClick={(event) => event.stopPropagation()}>
            {(() => {
              const place = getAllPlaceItems(activeTrip).find((entry) => String(entry.id) === String(visitModalPlaceId))
              const scheduleLabel = place?.startTime || place?.endTime
                ? `${formatTime12h(place?.startTime)}${place?.startTime && place?.endTime ? ' - ' : ''}${formatTime12h(place?.endTime)}`
                : ''
              return (
                <>
                  <div className="PlannerModalHeader">
                    <div className="PlannerModalTitle">Add more about your visit</div>
                    <button type="button" className="PlannerModalClose" aria-label="Close" onClick={closeVisitModal}>×</button>
                  </div>
                  <div className="PlannerModalBody">
                    <div className="VisitModalHeader">
                      <div className="VisitModalHeader__text">
                        <div className="VisitModalHeader__title">{place?.title || 'Place'}</div>
                        {scheduleLabel ? <div className="VisitModalHeader__time">{scheduleLabel}</div> : null}
                        <div className="VisitModalHeader__stamps">
                          <label className="TripPrefField">
                            <span>Visited Date</span>
                            <input
                              type="date"
                              value={visitModalDraft.visitedDate}
                              onChange={(event) => setVisitModalDraft((prev) => ({ ...prev, visitedDate: event.target.value }))}
                            />
                          </label>
                          <label className="TripPrefField">
                            <span>Visited Time</span>
                            <input
                              type="time"
                              step="1800"
                              value={visitModalDraft.visitedTime}
                              onChange={(event) => setVisitModalDraft((prev) => ({ ...prev, visitedTime: event.target.value }))}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="VisitModalNotes">
                      <div className="VisitModalNotes__label">Notes</div>
                      <textarea
                        className="VisitModalNotes__input"
                        value={visitModalDraft.notes}
                        onChange={(event) => setVisitModalDraft((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder="Write a note..."
                      />
                    </div>
                    <div className="VisitModalFooter">
                      <button type="button" className="PlannerModalDone VisitModalSave" onClick={saveVisitModal}>Save</button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ) : null}
      {chooseLocationPlaceId ? (
        <div className="PlannerModalOverlay" onClick={closeChooseLocationModal}>
          <div className="PlannerModal ChooseLocationModal" role="dialog" aria-modal="true" aria-label="Choose a location" onClick={(event) => event.stopPropagation()}>
            <div className="PlannerModalHeader">
              <div className="PlannerModalTitle">Choose a location</div>
              <button type="button" className="PlannerModalClose" aria-label="Close" onClick={closeChooseLocationModal}>×</button>
            </div>
            <div className="PlannerModalBody">
              <input
                className="ChooseLocationInput"
                type="text"
                placeholder="Where have you been?"
                value={chooseLocationDraft}
                onChange={(event) => setChooseLocationDraft(event.target.value)}
              />
              <div className="ChooseLocationFooter">
                <button type="button" className="PlannerModalDone ChooseLocationSelect" onClick={saveChooseLocationModal}>Select this location</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {dateModalOpen ? (
        <div className="PlannerModalOverlay" onClick={() => setDateModalOpen(false)}>
          <div className="PlannerModalCard TripPrefsModalReact" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="TripPrefsModalReact__header">
              <div>
                <h3 className="TripPrefsModalReact__title">Edit trip dates</h3>
                <p className="TripPrefsModalReact__intro">Choose start and end dates. Your itinerary days and stops will update automatically.</p>
              </div>
              <button type="button" className="PlannerModalCloseButton" aria-label="Close" onClick={() => setDateModalOpen(false)}>×</button>
            </div>
            <form
              className="TripPrefsModalReact__body"
              onSubmit={handleDateFormSubmit}
            >
              <div className="PlanTripDateGrid" style={{ marginBottom: '16px' }}>
                <div className="PlanTripField">
                  <label htmlFor="workspace-start-date">Start date</label>
                  <input
                    id="workspace-start-date"
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => {
                      setDraftStartDate(e.target.value)
                      setDateError('')
                    }}
                  />
                </div>
                <div className="PlanTripField">
                  <label htmlFor="workspace-end-date">End date</label>
                  <input
                    id="workspace-end-date"
                    type="date"
                    min={draftStartDate || undefined}
                    value={draftEndDate}
                    onChange={(e) => {
                      setDraftEndDate(e.target.value)
                      setDateError('')
                    }}
                  />
                </div>
              </div>
              {dateError ? (
                <p className="PlanTripHint" style={{ color: '#ef4444', marginBottom: '14px' }} role="alert">
                  {dateError}
                </p>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="PlannerPillButton PlannerPillButton--light"
                  onClick={() => setDateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="PlannerPillButton PlannerPillButton--accent"
                  style={{ minWidth: '120px' }}
                >
                  Save dates
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {dateWarningModal.open ? (
        <div className="PlannerModalOverlay" onClick={handleCancelDateWarning}>
          <div className="PlannerModalCard TripDateWarningModal" onClick={(e) => e.stopPropagation()}>
            <div className="TripDateWarningModal__header">
              <div className="TripDateWarningModal__icon">⚠️</div>
              <div>
                <h3 className="TripDateWarningModal__title">Confirm trip date change</h3>
                <p className="TripPrefsModalReact__intro" style={{ margin: '4px 0 0' }}>
                  Changing your trip dates will remove itinerary data outside the new date range.
                </p>
              </div>
              <button
                type="button"
                className="PlannerModalCloseButton"
                aria-label="Close"
                onClick={handleCancelDateWarning}
              >
                ×
              </button>
            </div>

            <div className="TripDateWarningModal__tripComparison">
              <div>
                <div className="TripDateWarningModal__tripLabel">Current trip</div>
                <div className="TripDateWarningModal__tripDates">
                  {formatDateRangeDisplay(activeTrip.startDate, activeTrip.endDate, activeTrip.dates || 'Current dates')}
                </div>
              </div>
              <div>
                <div className="TripDateWarningModal__tripLabel">New trip</div>
                <div className="TripDateWarningModal__tripDates">
                  {formatDateRangeDisplay(dateWarningModal.newStartDate, dateWarningModal.newEndDate)}
                </div>
              </div>
            </div>

            <p className="TripDateWarningModal__warningText">
              You're changing your trip dates from{' '}
              <strong>{formatDateRangeDisplay(activeTrip.startDate, activeTrip.endDate, activeTrip.dates || 'current dates')}</strong>{' '}
              to{' '}
              <strong>{formatDateRangeDisplay(dateWarningModal.newStartDate, dateWarningModal.newEndDate)}</strong>.
              <br /><br />
              The following dates contain existing itinerary data. If you continue, this data will be removed from those dates:
            </p>

            <div className="TripDateWarningModal__affectedList">
              {dateWarningModal.affectedDays.map((day) => (
                <div key={day.dayId || day.dateIso || day.index} className="TripDateWarningModal__affectedItem">
                  <div className="TripDateWarningModal__affectedDate">{day.dateFormatted}</div>
                  <div className="TripDateWarningModal__affectedSummary">{day.summary}</div>
                </div>
              ))}
            </div>

            <div className="TripDateWarningModal__actions">
              <button
                type="button"
                className="PlannerPillButton PlannerPillButton--light"
                onClick={handleCancelDateWarning}
              >
                Keep current dates
              </button>
              <button
                type="button"
                className="PlannerPillButton PlannerPillButton--danger"
                onClick={handleConfirmDateWarning}
              >
                Change dates & remove data
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showPrefs ? (
        <div className="PlannerModalOverlay" onClick={() => setShowPrefs(false)}>
          <div className="PlannerModalCard TripPrefsModalReact" onClick={(e) => e.stopPropagation()}>
            <div className="TripPrefsModalReact__header">
              <div>
                <h3 className="TripPrefsModalReact__title">Trip preferences & engine</h3>
                <p className="TripPrefsModalReact__intro">Turn constraints on or off. The engine only uses what you enable. Your days are never changed automatically.</p>
              </div>
              <button type="button" className="PlannerModalCloseButton" aria-label="Close" onClick={() => setShowPrefs(false)}>×</button>
            </div>
            <div className="TripPrefsModalReact__body">
              <section className="TripPrefsSection">
                <label className="TripPrefField TripPrefField--full">
                  <span>Province (dataset filter)</span>
                  <select value={enginePrefs.province || 'Punjab'} onChange={(event) => updateProvincePreference(event.target.value)}>
                    {ENGINE_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select>
                </label>
              </section>

              <section className="TripPrefsSection">
                <h4 className="TripPrefsSection__title">Constraints</h4>
                <div className="TripPrefToggleGrid">
                  <div className="TripPrefToggleCard">
                    <label className="TripPrefCheckbox">
                      <input type="checkbox" checked={Boolean(enginePrefs.useBudget)} onChange={(event) => updatePrefs('useBudget', event.target.checked)} />
                      <span>Use budget limit</span>
                    </label>
                    <label className="TripPrefField">
                      <span>Max budget (PKR)</span>
                      <input type="number" min="0" step="500" value={enginePrefs.maxBudget || 5000} onChange={(event) => updatePrefs('maxBudget', Number(event.target.value))} />
                    </label>
                  </div>

                  <div className="TripPrefToggleCard">
                    <label className="TripPrefCheckbox">
                      <input type="checkbox" checked={Boolean(enginePrefs.useTimeLimit)} onChange={(event) => updatePrefs('useTimeLimit', event.target.checked)} />
                      <span>Use time limit</span>
                    </label>
                    <label className="TripPrefField">
                      <span>Max travel hours</span>
                      <input type="number" min="1" max="1000" step="1" value={enginePrefs.maxTravelHours || 12} onChange={(event) => updatePrefs('maxTravelHours', Number(event.target.value))} />
                    </label>
                  </div>

                  <div className="TripPrefToggleCard TripPrefToggleCard--full">
                    <label className="TripPrefCheckbox">
                      <input type="checkbox" checked={Boolean(enginePrefs.useCategories)} onChange={(event) => updatePrefs('useCategories', event.target.checked)} />
                      <span>Use category preferences</span>
                    </label>
                    <label className="TripPrefField TripPrefField--full">
                      <span>Categories (comma-separated)</span>
                      <input
                        type="text"
                        value={(enginePrefs.preferredCategories || []).join(', ')}
                        onChange={(event) => updatePrefs('preferredCategories', event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean))}
                        placeholder="park, scenic, historical"
                      />
                    </label>
                  </div>

                  <div className="TripPrefToggleCard TripPrefToggleCard--full">
                    <label className="TripPrefCheckbox">
                      <input type="checkbox" checked={Boolean(enginePrefs.useCrowdFilter)} onChange={(event) => updatePrefs('useCrowdFilter', event.target.checked)} />
                      <span>Avoid crowded places</span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="TripPrefsSection">
                <h4 className="TripPrefsSection__title">Travel questionnaire</h4>
                <p className="TripPrefsSection__hint">Answers map to budget, time, and categories when those toggles are on.</p>
                <div className="TripPrefGrid TripPrefGrid--questionnaire">
                  {QUESTIONNAIRE_FIELDS.map((field) => (
                    <label key={field.key} className="TripPrefField">
                      <span>{field.label}</span>
                      <select value={questionnaire[field.key] || field.options[0]} onChange={(event) => updateQuestionnaire(field.key, event.target.value)}>
                        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            </div>
            <div className="TripPrefsModalReact__footer">
              <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={savePreferencesModal}>Save preferences</button>
              <button type="button" className="PlannerPillButton PlannerPillButton--accent" onClick={openSuggestionsFromPreferences}>Get suggestions now</button>
            </div>
          </div>
        </div>
      ) : null}
      {showBudgetModal ? (
        <div className="PlannerModalOverlay" onClick={() => setShowBudgetModal(false)}>
          <div className="PlannerModalCard TripPrefsModal" onClick={(e) => e.stopPropagation()}>
            <h3>Trip Budget</h3>
            <form onSubmit={saveBudgetForm} className="PlannerModalForm">
              <label className="TripPrefField TripPrefField--full">
                <span>Total Budget (PKR)</span>
                <input type="number" name="budgetAmount" min="0" step="500" defaultValue={budgetAmount || 0} />
              </label>
              <div className="PlannerModalActions">
                <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => setShowBudgetModal(false)}>Cancel</button>
                <button type="submit" className="PlannerPillButton PlannerPillButton--accent">Save Budget</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <ArrangementModal
        open={showArrangement}
        trip={activeTrip}
        initialSectionId={arrangementSectionId}
        onClose={() => setShowArrangement(false)}
        onApply={applyArrangement}
      />
      {showTripSettings ? (
        <div className="PlannerModalOverlay" onClick={() => setShowTripSettings(false)}>
          <div className="PlannerModalCard TripPrefsModal TripSettingsModal" onClick={(e) => e.stopPropagation()}>
            <div className="TripSettingsModal__header">
              <h3>Trip settings</h3>
              <button type="button" className="PlannerModalCloseButton" aria-label="Close" onClick={() => setShowTripSettings(false)}>×</button>
            </div>
            <form onSubmit={saveTripSettingsForm} className="PlannerModalForm">
              <div className="TripSettingsSection">
                <label className="TripSettingsSection__heading">Privacy</label>
                <div className="TripPrivacyRadioGroup">
                  <label className={`TripPrivacyOption ${tripSettingsPrivacy === 'public' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="privacy"
                      value="public"
                      checked={tripSettingsPrivacy === 'public'}
                      onChange={() => setTripSettingsPrivacy('public')}
                    />
                    <div className="TripPrivacyOption__body">
                      <span className="TripPrivacyOption__title">Public</span>
                      <span className="TripPrivacyOption__subtitle">Anyone can view</span>
                    </div>
                  </label>
                  <label className={`TripPrivacyOption ${tripSettingsPrivacy === 'friends' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="privacy"
                      value="friends"
                      checked={tripSettingsPrivacy === 'friends'}
                      onChange={() => setTripSettingsPrivacy('friends')}
                    />
                    <div className="TripPrivacyOption__body">
                      <span className="TripPrivacyOption__title">Friends</span>
                      <span className="TripPrivacyOption__subtitle">Only mutual followers can view</span>
                    </div>
                  </label>
                  <label className={`TripPrivacyOption ${tripSettingsPrivacy === 'private' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="privacy"
                      value="private"
                      checked={tripSettingsPrivacy === 'private'}
                      onChange={() => setTripSettingsPrivacy('private')}
                    />
                    <div className="TripPrivacyOption__body">
                      <span className="TripPrivacyOption__title">Private</span>
                      <span className="TripPrivacyOption__subtitle">Only you and others with the link can view</span>
                    </div>
                  </label>
                </div>
              </div>

              <details className="TripSettingsDetailsToggle">
                <summary className="TripSettingsDetailsToggle__summary">
                  <span>Edit trip details (Title, Destination, Dates, Notes)</span>
                </summary>
                <div className="TripSettingsDetailsToggle__content">
                  <label className="TripPrefField TripPrefField--full">
                    <span>Trip Title</span>
                    <input name="tripTitle" defaultValue={activeTrip.title || ''} placeholder="Trip to Islamabad" />
                  </label>
                  <label className="TripPrefField TripPrefField--full">
                    <span>Destination</span>
                    <input name="tripName" defaultValue={activeTrip.name || ''} placeholder="Where to?" />
                  </label>
                  <div className="TripPrefGrid">
                    <label className="TripPrefField">
                      <span>Start Date</span>
                      <input type="date" name="startDate" defaultValue={activeTrip.startDate || ''} />
                    </label>
                    <label className="TripPrefField">
                      <span>End Date</span>
                      <input type="date" name="endDate" defaultValue={activeTrip.endDate || ''} />
                    </label>
                  </div>
                  <label className="TripPrefField TripPrefField--full">
                    <span>Trip Notes</span>
                    <textarea name="tripNotes" className="PlannerNoteInput" defaultValue={activeTrip.notes || ''} rows="3" />
                  </label>
                </div>
              </details>

              <div className="TripSettingsActionList">
                <button
                  type="button"
                  className="TripSettingsActionRow reset-btn"
                  onClick={() => showToast('Guide generation coming soon')}
                >
                  <div className="TripSettingsActionRow__icon">🧭</div>
                  <div className="TripSettingsActionRow__body">
                    <div className="TripSettingsActionRow__title">Convert to guide</div>
                    <div className="TripSettingsActionRow__subtitle">Transfer places and notes to a new guide. Your trip will not be changed or deleted.</div>
                  </div>
                </button>

                {!activeTrip?.isTripmate && (
                  <button
                    type="button"
                    className="TripSettingsActionRow TripSettingsActionRow--danger reset-btn"
                    onClick={() => {
                      setShowTripSettings(false)
                      setConfirmDeleteTripOpen(true)
                    }}
                  >
                    <div className="TripSettingsActionRow__icon">🗑️</div>
                    <div className="TripSettingsActionRow__body">
                      <div className="TripSettingsActionRow__title">Delete this trip</div>
                    </div>
                  </button>
                )}
              </div>

              <div className="PlannerModalActions">
                <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => setShowTripSettings(false)}>Close</button>
                <button type="submit" className="PlannerPillButton PlannerPillButton--accent">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <TripmatesModal 
        isOpen={showTripmatesModal} 
        onClose={() => setShowTripmatesModal(false)}
        tripId={activeTrip?.id || activeTrip?.tripId}
        token={token}
        currentUser={user}
      />
      {showShareModal ? (
        <div className="PlannerModalOverlay" onClick={() => setShowShareModal(false)}>
          <div className="PlannerModalCard ShareTripModal" onClick={(e) => e.stopPropagation()}>
            <div className="ShareTripModal__header">
              <h3>Share trip</h3>
              <button
                type="button"
                className="PlannerModalCloseButton"
                aria-label="Close"
                onClick={() => setShowShareModal(false)}
              >
                ×
              </button>
            </div>

            <div className="ShareTripModal__body">
              <div className="SharePermissionSegment">
                <button
                  type="button"
                  className={`SharePermissionSegment__btn ${sharePermission === 'edit' ? 'is-active' : ''}`}
                  onClick={() => setSharePermission('edit')}
                >
                  <span className="SharePermissionSegment__icon" aria-hidden="true">✏️</span>
                  <span>Can edit</span>
                </button>
                <button
                  type="button"
                  className={`SharePermissionSegment__btn ${sharePermission === 'view' ? 'is-active' : ''}`}
                  onClick={() => setSharePermission('view')}
                >
                  <span className="SharePermissionSegment__icon" aria-hidden="true">👁️</span>
                  <span>View only</span>
                </button>
              </div>

              <div className="ShareLinkSection">
                <label className="ShareSectionLabel">Share with link</label>
                <div className="ShareLinkInputRow">
                  <input
                    type="text"
                    readOnly
                    className="ShareLinkInput"
                    value={
                      sharePermission === 'edit'
                        ? (editShareToken
                            ? (typeof window !== 'undefined' ? `${window.location.origin}/share/edit/${editShareToken}` : `/share/edit/${editShareToken}`)
                            : (shareLoading ? 'Generating secure edit link...' : ''))
                        : (shareToken
                            ? (typeof window !== 'undefined' ? `${window.location.origin}/share/${shareToken}` : `/share/${shareToken}`)
                            : (shareLoading ? 'Generating secure share link...' : ''))
                    }
                    placeholder={shareLoading ? 'Generating link...' : 'No share link available'}
                    onFocus={(e) => {
                      e.target.select()
                    }}
                  />
                  <button
                    type="button"
                    className="PlannerPillButton PlannerPillButton--accent ShareCopyButton"
                    disabled={
                      shareLoading ||
                      (sharePermission === 'edit' ? !editShareToken : !shareToken)
                    }
                    onClick={async () => {
                      const activeToken = sharePermission === 'edit' ? editShareToken : shareToken
                      if (!activeToken) {
                        showToast('Generating share link...')
                        return
                      }
                      const path = sharePermission === 'edit' ? `/share/edit/${activeToken}` : `/share/${activeToken}`
                      const link = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
                      try {
                        await navigator.clipboard.writeText(link)
                        setShareCopied(true)
                        showToast(`${sharePermission === 'edit' ? 'Edit' : 'View-only'} link copied to clipboard`)
                        setTimeout(() => setShareCopied(false), 2000)
                      } catch {
                        showToast('Could not copy link')
                      }
                    }}
                  >
                    {shareCopied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
                <p className="ShareLinkHint">
                  {sharePermission === 'edit'
                    ? 'This edit-share link is ready for the shared editing experience.'
                    : 'Anyone with this view-only link can view this itinerary and map without making changes.'}
                </p>
              </div>

              <div className="ShareInviteSection">
                <label className="ShareSectionLabel">Invite by email or username</label>
                <form
                  className="ShareInviteForm"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!shareInviteInput.trim()) return
                    showToast(`Invitation sent to ${shareInviteInput.trim()} (${sharePermission === 'edit' ? 'Can edit' : 'View only'})`)
                    setShareInviteInput('')
                  }}
                >
                  <input
                    type="text"
                    className="ShareInviteInput"
                    placeholder="Enter email or @username..."
                    value={shareInviteInput}
                    onChange={(e) => setShareInviteInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="PlannerPillButton PlannerPillButton--dark ShareInviteButton"
                    disabled={!shareInviteInput.trim()}
                  >
                    Invite
                  </button>
                </form>
              </div>
            </div>

            <div className="ShareTripModal__footer">
              <button
                type="button"
                className="PlannerPillButton PlannerPillButton--light"
                onClick={() => setShowShareModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showTripJournal ? (
        <div className="PlannerModalOverlay" onClick={() => setShowTripJournal(false)}>
          <div className="PlannerModalCard TripJournalModalReact" onClick={(e) => e.stopPropagation()}>
            <h3>Trip Journal</h3>
            {!tripJournalEntries.length ? <p className="PlannerEmptyState">No journal entries yet. Mark places as visited and add notes from the itinerary.</p> : (
              <div className="TripJournalList">
                {tripJournalEntries.map((entry) => (
                  <article key={entry.id} className="TripJournalRowReact">
                    <div>
                      <div className="TripJournalRowReact__title">{entry.title}</div>
                      <div className="TripJournalRowReact__meta">{entry.context}{entry.visited ? ' · Visited' : ''}</div>
                      <div className="TripJournalRowReact__label">Time</div>
                      <div>{entry.timeLabel}</div>
                      <div className="TripJournalRowReact__label">Location</div>
                      <div>{entry.location}</div>
                      <div className="TripJournalRowReact__label">Notes</div>
                      <div>{entry.note}</div>
                    </div>
                    <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => openJournalEntry(entry.id)}>Open Place</button>
                  </article>
                ))}
              </div>
            )}
            <div className="PlannerModalActions">
              <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => setShowTripJournal(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
      {journalPlaceId ? (
        <div className="PlannerModalOverlay" onClick={() => setJournalPlaceId(null)}>
          <div className="PlannerModal VisitModal" role="dialog" aria-modal="true" aria-label="Trip Journal" onClick={(event) => event.stopPropagation()}>
            {(() => {
              const place = getAllPlaceItems(activeTrip).find((entry) => String(entry.id) === String(journalPlaceId))
              const details = place ? ensureVisitDetails(place) : null
              const visitStamp = [details?.visitedDate, details?.visitedTime].filter(Boolean).join(' • ')
              const scheduleLabel = place?.startTime || place?.endTime
                ? `${formatTime12h(place?.startTime)}${place?.startTime && place?.endTime ? ' - ' : ''}${formatTime12h(place?.endTime)}`
                : ''
              const timeLabel = visitStamp || scheduleLabel || 'No time added'
              const locationLabel = String(place?.visitLocation || '').trim() || 'No location selected'
              const noteLabel = String(details?.notes || '').trim() || 'No note saved'
              return (
                <>
                  <div className="PlannerModalHeader">
                    <div className="PlannerModalTitle">Trip Journal</div>
                    <button type="button" className="PlannerModalClose" aria-label="Close" onClick={() => setJournalPlaceId(null)}>×</button>
                  </div>
                  <div className="PlannerModalBody">
                    <div className="VisitModalHeader">
                      <div className="VisitModalHeader__text">
                        <div className="VisitModalHeader__title">{place?.title || 'Place'}</div>
                        <div className="VisitModalHeader__time">{timeLabel}</div>
                      </div>
                    </div>
                    <div className="VisitModalNotes">
                      <div className="VisitModalNotes__label">Location</div>
                      <div>{locationLabel}</div>
                    </div>
                    <div className="VisitModalNotes">
                      <div className="VisitModalNotes__label">Notes</div>
                      <div>{noteLabel}</div>
                    </div>
                    <div className="VisitModalFooter">
                      <button type="button" className="PlannerModalDone" onClick={() => setJournalPlaceId(null)}>Done</button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ) : null}
      {expenseModal.open ? (
        <div className="PlannerModalOverlay" onClick={closeExpenseEditor}>
          <div className="PlannerModalCard TripPrefsModal" onClick={(e) => e.stopPropagation()}>
            <h3>{expenseModal.expenseId ? 'Edit Expense' : 'Add Expense'}</h3>
            <form onSubmit={saveExpenseForm} className="PlannerModalForm">
              {(() => {
                const editing = (activeTrip.expenses || []).find((expense) => String(expense.id) === String(expenseModal.expenseId || ''))
                const expensePlaceId = editing?.placeId || expenseModal.placeId || selectedPlace?.id || ''
                const linkedPlace = getAllPlaceItems(activeTrip).find((place) => String(place.id) === String(expensePlaceId))
                return (
                  <>
                    <input type="hidden" name="placeId" value={expensePlaceId} />
                    <div className="TripPrefGrid">
                      <label className="TripPrefField">
                        <span>Amount</span>
                        <input type="number" name="amount" min="0" step="1" defaultValue={editing?.amount || ''} required />
                      </label>
                      <label className="TripPrefField">
                        <span>Category</span>
                        <select name="category" defaultValue={editing?.category || 'Misc'}>
                          {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </label>
                      <label className="TripPrefField">
                        <span>Date</span>
                        <input type="date" name="date" defaultValue={editing?.date || activeTrip.startDate || ''} />
                      </label>
                      <label className="TripPrefField">
                        <span>Linked Place</span>
                        <input type="text" value={linkedPlace?.title || 'General trip expense'} disabled readOnly />
                      </label>
                    </div>
                    <label className="TripPrefField TripPrefField--full">
                      <span>Note</span>
                      <textarea name="note" className="PlannerNoteInput" defaultValue={editing?.note || ''} placeholder="Taxi, ticket, lunch, etc." />
                    </label>
                    <div className="PlannerModalActions">
                      <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={closeExpenseEditor}>Cancel</button>
                      <button type="submit" className="PlannerPillButton PlannerPillButton--accent">{expenseModal.expenseId ? 'Save Changes' : 'Add Expense'}</button>
                    </div>
                  </>
                )
              })()}
            </form>
          </div>
        </div>
      ) : null}
      {showSuggestions ? (
        <div className="PlannerModalOverlay" onClick={() => setShowSuggestions(false)}>
          <div className="PlannerModalCard EngineSuggestionsModalReact" onClick={(e) => e.stopPropagation()}>
            <div className="EngineSuggestionsModalReact__header">
              <div>
                <h3 className="EngineSuggestionsModalReact__title">Engine suggestions → places pool</h3>
                <p className="EngineSuggestionsModalReact__intro">Selected places are added only to <strong>Places to visit</strong>. Drag them into days yourself.</p>
              </div>
              <button type="button" className="PlannerModalCloseButton" aria-label="Close" onClick={() => setShowSuggestions(false)}>×</button>
            </div>

            <div className="EngineSuggestionsModalReact__body">
              {engineState.loading ? <div className="EngineSuggestionsModalReact__empty">Calling optimization engine...</div> : null}
              {engineState.error ? <div className="EngineErrorBanner">{engineState.error}</div> : null}

              {engineState.data ? (
                <>
                  <div className="EngineMetaGridReact">
                    {suggestionCards.map((card) => (
                      <div key={card.label} className="EngineMetaCard">
                        <span>{card.label}</span>
                        <strong>{String(card.value)}</strong>
                      </div>
                    ))}
                  </div>

                  {suggestionConstraints ? <p className="TripPrefsSection__hint">Constraints used: {suggestionConstraints}</p> : null}

                  <div className="EngineStopListReact">
                    {suggestionStops.length ? suggestionStops.map((stop, index) => {
                      const duration = stop.visit_duration ?? stop.visit_duration_hours
                      return (
                        <label key={`${stop.name || stop.title || 'stop'}-${index}`} className="EngineStopRowReact">
                          <input
                            type="checkbox"
                            checked={selectedSuggestionIndexes.includes(index)}
                            onChange={(event) => toggleSuggestionIndex(index, event.target.checked)}
                          />
                          <div className="EngineStopRowReact__marker">{index + 1}</div>
                          <div className="EngineStopRowReact__content">
                            <div className="EngineStopRowReact__name">{stop.name || stop.title || `Stop ${index + 1}`}</div>
                            <div className="EngineStopRowReact__meta">
                              {[stop.category || 'general', stop.province || '', duration != null ? `${duration}h visit` : ''].filter(Boolean).join(' · ')}
                            </div>
                            {Array.isArray(stop.why_selected) && stop.why_selected.length ? (
                              <div className="EngineIntelligenceReact">
                                {stop.why_selected.map((reason, reasonIndex) => <span key={`${index}-${reasonIndex}`}>Why: {reason}</span>)}
                              </div>
                            ) : null}
                          </div>
                        </label>
                      )
                    }) : <div className="EngineSuggestionsModalReact__empty">No stops returned. Try relaxing constraints in Trip preferences.</div>}
                  </div>

                  <details className="EngineDetailCard" open={suggestionItinerary.length > 0}>
                    <summary>Backend itinerary preview</summary>
                    {suggestionItinerary.length ? (
                      <div className="EnginePreviewTableWrap">
                        <table className="EnginePreviewTable">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Place</th>
                              <th>Arrival</th>
                              <th>Visit</th>
                              <th>Departure</th>
                            </tr>
                          </thead>
                          <tbody>
                            {suggestionItinerary.map((row, index) => (
                              <tr key={`${row?.name || 'row'}-${index}`}>
                                <td>{index + 1}</td>
                                <td>{row?.name || ''}</td>
                                <td>{row?.arrival_time || ''}</td>
                                <td>{String(row?.visit_duration_hours ?? '')}</td>
                                <td>{row?.departure_time || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="EngineDetailCard__empty">No itinerary rows returned.</div>}
                  </details>

                  <details className="EngineDetailCard">
                    <summary>Engine trace (trust)</summary>
                    <div className="EngineTraceBlock">
                      <div><strong>Endpoint:</strong> {API_BASE}/optimize</div>
                      <div className="EngineTraceBlock__label">Request payload</div>
                      <pre>{JSON.stringify(engineState.requestPayload, null, 2)}</pre>
                      <div className="EngineTraceBlock__label">Response payload</div>
                      <pre>{JSON.stringify(engineState.data, null, 2)}</pre>
                    </div>
                  </details>
                </>
              ) : null}
            </div>

            <div className="EngineSuggestionsModalReact__footer">
              <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={addSuggestionsToPool} disabled={!selectedStops.length || engineState.loading}>Add selected to pool</button>
              <button type="button" className="PlannerPillButton PlannerPillButton--accent" onClick={applySystemItinerary} disabled={!selectedStops.length || engineState.loading}>Apply as system itinerary</button>
              <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={fetchSuggestions} disabled={engineState.loading}>Regenerate</button>
              <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={editPreferencesFromSuggestions}>Edit preferences</button>
            </div>
          </div>
        </div>
      ) : null}
      <AiAssistantModal isOpen={showAiAssistant} onClose={() => setShowAiAssistant(false)} />

      <div className="TripHubDeleteModal" hidden={!confirmDeleteTripOpen} aria-hidden={confirmDeleteTripOpen ? 'false' : 'true'}>
        <div className="TripHubDeleteModal__backdrop" onClick={() => setConfirmDeleteTripOpen(false)} />
        <div className="TripHubDeleteModal__dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-delete-title">
          <h2 id="workspace-delete-title">Delete</h2>
          <p>Are you sure you want to delete this trip plan? This action is not reversible!</p>
          <div className="TripHubDeleteModal__actions">
            <button type="button" className="TripHubDeleteModal__cancel" onClick={() => setConfirmDeleteTripOpen(false)}>No, don&apos;t delete</button>
            <button
              type="button"
              className="TripHubDeleteModal__confirm"
              onClick={async () => {
                if (!activeTrip?.id) return
                const tripIdToDelete = activeTrip.id
                setConfirmDeleteTripOpen(false)
                try {
                  await removeTrip(tripIdToDelete)
                } catch {
                  // ignore
                }
                navigate('/home')
              }}
            >
              Yes, delete it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

