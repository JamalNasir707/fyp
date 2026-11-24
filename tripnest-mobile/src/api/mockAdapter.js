/**
 * TripNest Mock Adapter
 * 
 * STRICT COMPLIANCE:
 * - Emulates the exact response shapes of the audited TripNest FastAPI backend.
 * - Full in-memory state for Owned Trips, Tripmates, Shared Budget, Settlements,
 *   Social/Discovery, Notifications, AI Assistant, and Reservations.
 * - Preserves the rich trip schema (days, placesPool, customLists, budget, enginePreferences,
 *   reservations, attachments, visitDetails).
 * - Kept strictly isolated behind the API service layer.
 * - Zero network activity occurs while in MOCK mode.
 */

import { RECOMMENDED_PLACES_CATALOG } from '../constants/images.js'
import { optimizePlaceSequence, calculateHaversineDistance, ensureWorkspaceParityTrip } from '../utils/tripUtils.js'
import { fetchDynamicPlacesForCity, KNOWN_CITY_COORDS, resolvePakistaniCity } from '../utils/locationService.js'

// ==================== IN-MEMORY DATABASE FIXTURES ====================

const CURRENT_USER = {
  id: 'usr_mock_mobile_1',
  username: 'mobile_traveler',
  name: 'Mobile Explorer',
  displayName: 'Mobile Explorer',
  email: 'traveler@tripnest.dev',
  role: 'user',
  profileImage: null,
  bio: 'Exploring Pakistan with TripNest Mobile',
  travelInterests: ['Mountain Trekking', 'Historical Heritage', 'Scenic Photography', 'Alpine Lakes'],
  travelStyle: 'Balanced',
  budgetTier: 'Standard',
  homeCity: 'Islamabad',
}

const PUBLIC_USERS = [
  CURRENT_USER,
  {
    id: 'usr_arslan_0',
    username: 'arslan',
    name: 'Arslan Tariq',
    displayName: 'Arslan Tariq',
    email: 'arslan@tripnest.dev',
    role: 'creator',
    profileImage: null,
    bio: 'Lead TripNest Architect & Explorer.',
  },
  {
    id: 'usr_arslan_1',
    username: 'ali_tariq',
    name: 'Ali Tariq',
    displayName: 'Ali Tariq',
    email: 'ali@tripnest.dev',
    role: 'user',
    profileImage: null,
    bio: 'Alpine mountaineer & northern route explorer.',
  },
  {
    id: 'usr_sara_2',
    username: 'sara_khan',
    name: 'Sara Khan',
    email: 'sara@tripnest.dev',
    role: 'user',
    profileImage: null,
    bio: 'Heritage and cultural architecture photographer.',
  },
  {
    id: 'usr_hamza_3',
    username: 'hamza99',
    name: 'Hamza Abbasi',
    email: 'hamza@tripnest.dev',
    role: 'user',
    profileImage: null,
    bio: 'Food street connoisseur & road trip enthusiast.',
  },
]

let mockFollowedUsernames = new Set(['ali_tariq'])

let mockTrips = [
  ensureWorkspaceParityTrip({
    id: 1712492800001,
    tripId: 1712492800001,
    title: 'Trip to Islamabad & Margalla Hills',
    name: 'Islamabad',
    destination: 'Islamabad',
    startDate: '2026-04-10',
    endDate: '2026-04-14',
    dates: '2026-04-10 - 2026-04-14',
    privacy: 'private',
    notes: 'Family spring tour around federal capital landmarks.',
    budget: { currency: 'PKR', amount: 45000 },
    enginePreferences: {
      province: 'Punjab',
      startLat: 33.6844,
      startLon: 73.0479,
      maxBudget: 45000,
      maxTravelHours: 10,
      preferredCategories: ['park', 'scenic', 'museum'],
    },
    days: [
      {
        id: 'day-1',
        label: 'Friday, 10th April',
        shortLabel: 'Fri 10/4',
        date: 'Fri Apr 10 2026',
        items: [
          {
            id: 'faisal-masjid',
            title: 'Faisal Mosque',
            subtitle: 'Iconic Islamabad Landmark',
            category: 'attraction',
            lat: 33.7295,
            lon: 73.0372,
            startTime: '09:30',
            endTime: '11:00',
            note: 'Morning visit for photography',
            visitDetails: {
              visited: true,
              visitedDate: '2026-04-10',
              visitedTime: '10:15',
              notes: 'Peaceful atmosphere',
            },
          },
          {
            id: 'daman-e-koh',
            title: 'Daman-e-Koh Viewpoint',
            subtitle: 'Margalla Hills Viewpoint',
            category: 'scenic',
            lat: 33.7466,
            lon: 73.0583,
            startTime: '12:00',
            endTime: '14:00',
            note: 'Panoramic view of the city',
            visitDetails: {
              visited: false,
              visitedDate: null,
              visitedTime: null,
              notes: '',
            },
          },
        ],
      },
      {
        id: 'day-2',
        label: 'Saturday, 11th April',
        shortLabel: 'Sat 11/4',
        date: 'Sat Apr 11 2026',
        items: [
          {
            id: 'pakistan-monument',
            title: 'Pakistan Monument Museum',
            subtitle: 'Shakarparian Hills',
            category: 'museum',
            lat: 33.6938,
            lon: 73.0686,
            startTime: '10:00',
            endTime: '12:30',
            note: 'Explore national heritage exhibits',
            visitDetails: {
              visited: false,
              visitedDate: null,
              visitedTime: null,
              notes: '',
            },
          },
          {
            id: 'rawal-lake',
            title: 'Rawal Lake View Park',
            subtitle: 'Lakeside Recreational Area',
            category: 'park',
            lat: 33.693,
            lon: 73.1235,
            startTime: '15:00',
            endTime: '17:30',
            note: 'Boating and sunset view',
            visitDetails: {
              visited: false,
              visitedDate: null,
              visitedTime: null,
              notes: '',
            },
          },
        ],
      },
    ],
    placesPool: [
      {
        id: 'lok-virsa',
        title: 'Lok Virsa Heritage Museum',
        subtitle: 'Cultural & Folklore Museum',
        category: 'museum',
        lat: 33.684,
        lon: 73.0728,
        note: 'Saved for spare afternoon',
        startTime: '',
        endTime: '',
        visitDetails: { visited: false, notes: '' },
      },
      {
        id: 'monal-restaurant',
        title: 'Monal Margalla Hills',
        subtitle: 'Scenic Hilltop Dining',
        category: 'food',
        lat: 33.7554,
        lon: 73.0622,
        note: 'Dinner reservation recommended',
        startTime: '',
        endTime: '',
        visitDetails: { visited: false, notes: '' },
      },
    ],
    customLists: [
      { id: 'packing', title: 'Essentials', items: ['Camera', 'Power Bank', 'Walking Shoes'] },
    ],
    expenses: [
      { id: 'exp_1', name: 'Car Rental & Fuel', amount: 12000, category: 'Transport', date: '2026-04-10' },
      { id: 'exp_2', name: 'Museum Entry Tickets', amount: 1500, category: 'See & Do', date: '2026-04-10' },
    ],
    reservations: [
      {
        id: 'res_1',
        type: 'hotel',
        title: 'Serena Hotel Islamabad',
        confirmationCode: 'ISB-SRN-9912',
        checkInDate: '2026-04-10',
        checkOutDate: '2026-04-14',
        notes: 'Deluxe mountain-view room reserved with breakfast.',
      },
    ],
  }),
  ensureWorkspaceParityTrip({
    id: 1712492800002,
    tripId: 1712492800002,
    title: 'Gilgit & Karakoram Highway Expedition',
    name: 'Gilgit',
    destination: 'Gilgit',
    startDate: '2026-05-15',
    endDate: '2026-05-18',
    dates: '2026-05-15 - 2026-05-18',
    privacy: 'private',
    notes: 'Epic Karakoram road trip through Gilgit river valleys and mountain suspension bridges.',
    budget: { currency: 'PKR', amount: 85000 },
    enginePreferences: {
      province: 'Gilgit-Baltistan',
      startLat: 35.9208,
      startLon: 74.3144,
      maxBudget: 85000,
      maxTravelHours: 12,
      preferredCategories: ['scenic', 'attraction', 'nature'],
    },
    days: [
      {
        id: 'day-1',
        label: 'Friday, 15th May',
        shortLabel: 'Fri 15/5',
        date: 'Fri May 15 2026',
        items: [
          {
            id: 'gilgit-naltar-lakes',
            title: 'Naltar Valley & Emerald Lakes',
            subtitle: 'Alpine Forest & Glacial Lakes',
            category: 'scenic',
            lat: 36.1667,
            lon: 74.1833,
            startTime: '08:30',
            endTime: '12:00',
            note: '4x4 Jeep excursion to colorful Satrangi Lake',
            visitDetails: { visited: false, notes: '' },
          },
          {
            id: 'danyore-suspension-bridge',
            title: 'Danyore Suspension Bridge & Tunnel',
            subtitle: 'Historic Single-Lane Tunnel Bridge',
            category: 'attraction',
            lat: 35.9234,
            lon: 74.3725,
            startTime: '13:00',
            endTime: '14:30',
            note: 'Engineering marvel over the Hunza River',
            visitDetails: { visited: false, notes: '' },
          },
          {
            id: 'kargah-buddha-gilgit',
            title: 'Kargah Buddha Rock Carving',
            subtitle: '7th-Century Tibetan Buddhist Relic',
            category: 'attraction',
            lat: 35.9189,
            lon: 74.2547,
            startTime: '15:00',
            endTime: '16:30',
            note: 'Carved cliffside statue in Kargah Nala',
            visitDetails: { visited: false, notes: '' },
          },
          {
            id: 'gilgit-central-bazaar',
            title: 'Gilgit City Central Bazaar',
            subtitle: 'Traditional Silk Route Market',
            category: 'shopping',
            lat: 35.9208,
            lon: 74.3144,
            startTime: '17:00',
            endTime: '18:30',
            note: 'Handmade wool caps, dry fruits, and local rubies',
            visitDetails: { visited: false, notes: '' },
          },
          {
            id: 'jutial-viewpoint',
            title: 'Jutial Viewpoint & Monument',
            subtitle: 'Panoramic Gilgit Basin Vantage',
            category: 'scenic',
            lat: 35.8942,
            lon: 74.3411,
            startTime: '19:00',
            endTime: '20:30',
            note: 'Sunset views over Karakoram peaks',
            visitDetails: { visited: false, notes: '' },
          },
        ],
      },
      {
        id: 'day-2',
        label: 'Saturday, 16th May',
        shortLabel: 'Sat 16/5',
        date: 'Sat May 16 2026',
        items: [
          {
            id: 'rakaposhi-viewpoint',
            title: 'Rakaposhi View Point',
            subtitle: 'Ghizer-Karakoram Highway',
            category: 'scenic',
            lat: 36.1833,
            lon: 74.4500,
            startTime: '10:00',
            endTime: '12:30',
            note: '7,788m snow-capped peak vista',
            visitDetails: { visited: false, notes: '' },
          },
          {
            id: 'altit-fort',
            title: 'Altit Fort & Royal Garden',
            subtitle: '900-Year Ancient Fortress',
            category: 'attraction',
            lat: 36.3142,
            lon: 74.6897,
            startTime: '14:00',
            endTime: '16:30',
            note: 'Overlooking Hunza River gorge',
            visitDetails: { visited: false, notes: '' },
          },
        ],
      },
    ],
    placesPool: [],
    customLists: [
      { id: 'packing', title: 'Mountain Essentials', items: ['Thermal Jacket', 'Trekking Boots', 'Water Purification', 'Sunscreen'] },
    ],
    expenses: [],
    reservations: [],
  }),
]

let mockSharedTrips = [
  ensureWorkspaceParityTrip({
    id: 1712492999999,
    tripId: 1712492999999,
    title: 'Northern Expedition: Hunza & Skardu',
    name: 'Hunza Valley',
    destination: 'Hunza Valley',
    startDate: '2026-05-01',
    endDate: '2026-05-08',
    dates: '2026-05-01 - 2026-05-08',
    privacy: 'private',
    isTripmate: true,
    tripmateRole: 'member',
    ownerId: 'usr_arslan_1',
    ownerName: 'Ali Tariq (Organizer)',
    notes: 'Joint expedition with group road-trip logistics.',
    budget: { currency: 'PKR', amount: 180000 },
    days: [
      {
        id: 'day-1',
        label: 'Friday, 1st May',
        shortLabel: 'Fri 1/5',
        date: 'Fri May 01 2026',
        items: [
          {
            id: 'karimabad-bazaar',
            title: 'Karimabad Traditional Bazaar',
            subtitle: 'Central Hunza Market',
            category: 'shopping',
            lat: 36.3276,
            lon: 74.6633,
            startTime: '14:00',
            endTime: '17:00',
            note: 'Local gems and dry fruit',
            visitDetails: { visited: false, notes: '' },
          },
        ],
      },
    ],
    placesPool: [
      {
        id: 'baltit-fort',
        title: 'Baltit Fort',
        subtitle: 'Ancient 700-year palace',
        category: 'attraction',
        lat: 36.3262,
        lon: 74.6698,
        visitDetails: { visited: false, notes: '' },
      },
    ],
    customLists: [],
    expenses: [],
    reservations: [],
  }),
]

// In-Memory Shared Budget Storage: Map<tripId, Array<Expense>>
let mockSharedBudgetExpenses = {
  '1712492999999': [
    {
      id: 'sb_exp_1',
      tripId: '1712492999999',
      name: 'Hunza Serena Inn Cottage Booking',
      amount: 48000,
      currency: 'PKR',
      category: 'Sleep',
      date: '2026-05-01',
      status: 'paid',
      destinationReference: 'Hunza Valley',
      payers: [{ userId: 'usr_arslan_1', name: 'Ali Tariq', amount: 48000 }],
      participants: [
        { userId: 'usr_arslan_1', name: 'Ali Tariq', share: 24000 },
        { userId: 'usr_mock_mobile_1', name: 'Mobile Explorer', share: 24000 },
      ],
    },
    {
      id: 'sb_exp_2',
      tripId: '1712492999999',
      name: 'Prado 4x4 Mountain Charter & Fuel',
      amount: 32000,
      currency: 'PKR',
      category: 'Transport',
      date: '2026-05-02',
      status: 'paid',
      destinationReference: 'Karakoram Highway',
      payers: [{ userId: 'usr_mock_mobile_1', name: 'Mobile Explorer', amount: 32000 }],
      participants: [
        { userId: 'usr_arslan_1', name: 'Ali Tariq', share: 16000 },
        { userId: 'usr_mock_mobile_1', name: 'Mobile Explorer', share: 16000 },
      ],
    },
    {
      id: 'sb_exp_3',
      tripId: '1712492999999',
      name: 'Traditional Yak Meat Dinner & Tea',
      amount: 8500,
      currency: 'PKR',
      category: 'Eat & Drink',
      date: '2026-05-02',
      status: 'paid',
      destinationReference: 'Karimabad',
      payers: [{ userId: 'usr_arslan_1', name: 'Ali Tariq', amount: 8500 }],
      participants: [
        { userId: 'usr_arslan_1', name: 'Ali Tariq', share: 4250 },
        { userId: 'usr_mock_mobile_1', name: 'Mobile Explorer', share: 4250 },
      ],
    },
  ],
}

// In-Memory Shared Budget Settlements: Map<tripId, Array<Settlement>>
let mockSharedBudgetSettlements = {
  '1712492999999': [
    {
      id: 'sb_stl_1',
      tripId: '1712492999999',
      payerId: 'usr_mock_mobile_1',
      payerName: 'Mobile Explorer',
      receiverId: 'usr_arslan_1',
      receiverName: 'Ali Tariq',
      amount: 8000,
      currency: 'PKR',
      date: '2026-05-03',
      note: 'Partial Raast bank transfer settlement',
    },
  ],
}

// In-Memory Tripmate Members: Map<tripId, { owner, members, pendingInvites }>
let mockTripMembers = {
  '1712492999999': {
    owner: {
      id: 'usr_arslan_1',
      userId: 'usr_arslan_1',
      name: 'Ali Tariq',
      username: 'ali_tariq',
      role: 'owner',
    },
    members: [
      {
        id: 'usr_mock_mobile_1',
        userId: 'usr_mock_mobile_1',
        userName: 'Mobile Explorer',
        username: 'mobile_traveler',
        status: 'accepted',
        role: 'editor',
      },
    ],
    pendingInvites: [
      {
        id: 'inv_pending_1',
        tripId: '1712492999999',
        invitedUserId: 'usr_sara_2',
        invitedUserName: 'Sara Khan',
        invitedEmail: 'sara@tripnest.dev',
        status: 'pending',
      },
    ],
  },
  '1712492800001': {
    owner: {
      id: CURRENT_USER.id,
      userId: CURRENT_USER.id,
      name: CURRENT_USER.name,
      username: CURRENT_USER.username,
      role: 'owner',
    },
    members: [],
    pendingInvites: [],
  },
}

let mockUserInvitations = [
  {
    id: 'user_inv_101',
    tripId: '1712493000002',
    tripTitle: 'Swat Valley & Kalam Expedition',
    ownerName: 'Ali Tariq',
    destination: 'Swat Valley',
    status: 'pending',
  },
]

// In-Memory Notifications
let mockNotifications = [
  {
    id: 'notif_1',
    type: 'trip_invitation',
    title: 'Trip Invitation',
    message: 'Ali Tariq invited you to join "Swat Valley & Kalam Expedition".',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    metadata: { tripId: '1712493000002', inviteId: 'user_inv_101' },
  },
  {
    id: 'notif_2',
    type: 'shared_budget',
    title: 'New Shared Expense',
    message: 'Ali Tariq added "Hunza Serena Inn Cottage Booking" (PKR 48,000).',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    metadata: { tripId: '1712492999999' },
  },
  {
    id: 'notif_3',
    type: 'system',
    title: 'Welcome to TripNest',
    message: 'Your offline mock development environment is fully operational.',
    read: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    metadata: {},
  },
]

// In-Memory Activity History (mirroring backend get_user_activity)
let mockActivities = [
  {
    id: 'act_1',
    tripId: '1712492800001',
    eventType: 'trip_created',
    title: 'Created Trip to Islamabad & Margalla Hills',
    description: 'Initial itinerary created with 4 days and 7 stops across Punjab & ICT.',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    actionUrl: '/workspace',
  },
  {
    id: 'act_2',
    tripId: '1712492800001',
    eventType: 'trip_updated',
    title: 'Optimized Day 1 Itinerary Route',
    description: 'Applied TSP sequencing with nearest neighbor 2-opt route optimization.',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    actionUrl: '/workspace',
  },
  {
    id: 'act_3',
    tripId: '1712492999999',
    eventType: 'trip_created',
    title: 'Joined Northern Expedition: Hunza & Skardu',
    description: 'Collaborative tripmate workspace initialized with Ali Tariq.',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    actionUrl: '/workspace',
  },
  {
    id: 'act_4',
    tripId: '1712492800001',
    eventType: 'trip_updated',
    title: 'Recorded Visit to Daman-e-Koh Lookout',
    description: 'Logged visit journal details, arrival time, and photos.',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    actionUrl: '/workspace',
  },
]

// ==================== MOCK ADAPTER IMPLEMENTATION ====================

export const mockAdapter = {
  // ==================== AUTH & ACCOUNT ====================
  async login(credentials) {
    const username = credentials?.username || CURRENT_USER.username
    const user = { ...CURRENT_USER, username }
    return {
      success: true,
      message: 'Mock login successful (Offline Development)',
      token: 'mock_session_token_' + Date.now(),
      user,
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    }
  },

  async register(payload) {
    return {
      success: true,
      message: 'Mock registration successful',
      user_id: 'usr_new_mock_' + Date.now(),
      username: payload.username,
    }
  },

  async googleLogin(accessToken) {
    return {
      success: true,
      message: 'Mock Google login successful',
      token: 'mock_google_session_' + Date.now(),
      user: {
        ...CURRENT_USER,
        email: 'google_explorer@tripnest.dev',
        name: 'Google Explorer',
      },
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    }
  },

  async verifyToken(token) {
    if (!token) throw new Error('Invalid token')
    return {
      success: true,
      user: CURRENT_USER,
    }
  },

  async logout() {
    return { success: true, message: 'Logged out successfully' }
  },

  async updateProfile(payload) {
    if (payload.name) CURRENT_USER.name = payload.name
    if (payload.displayName) CURRENT_USER.displayName = payload.displayName
    else if (payload.name) CURRENT_USER.displayName = payload.name
    if (payload.username) CURRENT_USER.username = payload.username
    if (payload.bio !== undefined) CURRENT_USER.bio = payload.bio
    if (payload.email) CURRENT_USER.email = payload.email
    if (payload.profileImage !== undefined) CURRENT_USER.profileImage = payload.profileImage
    if (Array.isArray(payload.travelInterests)) CURRENT_USER.travelInterests = payload.travelInterests
    if (payload.travelStyle) CURRENT_USER.travelStyle = payload.travelStyle
    if (payload.budgetTier) CURRENT_USER.budgetTier = payload.budgetTier
    if (payload.homeCity !== undefined) CURRENT_USER.homeCity = payload.homeCity
    return {
      success: true,
      user: { ...CURRENT_USER },
    }
  },

  async deleteAccount() {
    return { success: true, message: 'Account deleted successfully' }
  },

  // ==================== OWNED TRIPS ====================
  async getTrips() {
    return {
      success: true,
      trips: mockTrips,
    }
  },

  async createTrip(trip) {
    const normalized = ensureWorkspaceParityTrip({
      ...trip,
      id: trip.id || Date.now(),
      tripId: trip.tripId || trip.id || Date.now(),
    })
    mockTrips.unshift(normalized)
    return { success: true, trip: normalized }
  },

  async updateTrip(tripId, trip) {
    const index = mockTrips.findIndex((t) => String(t.id || t.tripId) === String(tripId))
    if (index >= 0) {
      mockTrips[index] = ensureWorkspaceParityTrip({ ...mockTrips[index], ...trip })
      return { success: true, trip: mockTrips[index] }
    }
    return { success: true, trip: ensureWorkspaceParityTrip(trip) }
  },

  async deleteTrip(tripId) {
    mockTrips = mockTrips.filter((t) => String(t.id || t.tripId) !== String(tripId))
    return { success: true }
  },

  // ==================== SHARING & CAN-EDIT COPY ====================
  async getTripShareToken(tripId, permission = 'view') {
    const isEdit = permission === 'edit'
    const token = (isEdit ? 'sh_edit_mock_' : 'sh_mock_') + Math.random().toString(36).substring(2, 10)
    return {
      success: true,
      shareToken: token,
      editShareToken: isEdit ? token : null,
      permission,
    }
  },

  async getSharedTrip(shareToken) {
    const sampleTrip = mockTrips[0] || mockSharedTrips[0]
    return {
      success: true,
      trip: sampleTrip,
      owner: { name: 'TripNest Explorer', username: 'traveler' },
      permission: 'view',
    }
  },

  async getSharedEditTrip(editShareToken) {
    const sampleTrip = mockTrips[0] || mockSharedTrips[0]
    return {
      success: true,
      trip: sampleTrip,
      owner: { name: 'TripNest Explorer', username: 'traveler' },
      permission: 'edit',
    }
  },

  async copySharedEditTrip(editShareToken) {
    const sampleTrip = mockTrips[0] || mockSharedTrips[0]
    const clonedTrip = ensureWorkspaceParityTrip({
      ...sampleTrip,
      id: Date.now(),
      tripId: Date.now(),
      title: `${sampleTrip.title || sampleTrip.name} (Copy)`,
      copiedFromEditToken: editShareToken,
      sourceTripId: sampleTrip.id,
      isTripmate: false,
    })
    mockTrips.unshift(clonedTrip)
    return {
      success: true,
      trip: clonedTrip,
      isExistingCopy: false,
    }
  },

  // ==================== TRIPMATES COLLABORATION ====================
  async getSharedTripmateTrips() {
    return {
      success: true,
      trips: mockSharedTrips,
    }
  },

  async getSharedTripmateTrip(tripId) {
    const found = mockSharedTrips.find((t) => String(t.id || t.tripId) === String(tripId))
    if (!found) throw new Error('Shared trip not found')
    return { success: true, trip: found }
  },

  async updateTripmateItinerary(tripId, { days, placesPool, customLists }) {
    const index = mockSharedTrips.findIndex((t) => String(t.id || t.tripId) === String(tripId))
    if (index >= 0) {
      mockSharedTrips[index] = {
        ...mockSharedTrips[index],
        days: days || mockSharedTrips[index].days,
        placesPool: placesPool || mockSharedTrips[index].placesPool,
        customLists: customLists || mockSharedTrips[index].customLists,
      }
      return { success: true, trip: mockSharedTrips[index] }
    }
    return { success: true, message: 'Itinerary updated' }
  },

  async getTripMembers(tripId) {
    const sid = String(tripId)
    const roster = mockTripMembers[sid] || {
      owner: {
        id: CURRENT_USER.id,
        userId: CURRENT_USER.id,
        name: CURRENT_USER.name,
        displayName: CURRENT_USER.name,
        username: CURRENT_USER.username,
        role: 'owner',
      },
      members: [],
      pendingInvites: [],
    }
    const ownerWithDisplay = roster.owner ? {
      ...roster.owner,
      displayName: roster.owner.displayName || roster.owner.name || roster.owner.username || 'Trip Organizer',
    } : null
    return {
      success: true,
      owner: ownerWithDisplay,
      members: roster.members,
      pendingInvites: roster.pendingInvites,
    }
  },

  async inviteTripMember(tripId, identifier) {
    const sid = String(tripId)
    if (!mockTripMembers[sid]) {
      mockTripMembers[sid] = {
        owner: {
          id: CURRENT_USER.id,
          userId: CURRENT_USER.id,
          name: CURRENT_USER.name,
          displayName: CURRENT_USER.name,
          username: CURRENT_USER.username,
          role: 'owner',
        },
        members: [],
        pendingInvites: [],
      }
    }
    const clean = String(identifier || '').trim()
    const matched = PUBLIC_USERS.find(
      (u) => u.username.toLowerCase() === clean.toLowerCase() || u.email.toLowerCase() === clean.toLowerCase()
    )
    const newInvite = {
      id: 'inv_' + Date.now(),
      tripId: sid,
      invitedUserId: matched?.id || 'usr_invited_' + Date.now(),
      invitedUserName: matched?.name || clean,
      invitedEmail: matched?.email || (clean.includes('@') ? clean : `${clean}@tripnest.dev`),
      status: 'pending',
    }
    mockTripMembers[sid].pendingInvites.unshift(newInvite)
    return { success: true, invitation: newInvite }
  },

  async getUserInvitations() {
    return {
      success: true,
      invitations: mockUserInvitations,
    }
  },

  async respondToTripInvitation(inviteId, action) {
    const cleanAction = action === 'accept' ? 'accepted' : 'declined'
    const invIndex = mockUserInvitations.findIndex((inv) => String(inv.id) === String(inviteId))
    if (invIndex >= 0) {
      const inv = mockUserInvitations[invIndex]
      mockUserInvitations.splice(invIndex, 1)
      if (cleanAction === 'accepted') {
        const targetTripId = Number(inv.tripId) || Date.now()
        // Deduplicate: check if trip already exists in mockSharedTrips
        const existingIdx = mockSharedTrips.findIndex(
          (t) => String(t.id || t.tripId) === String(targetTripId)
        )
        if (existingIdx >= 0) {
          mockSharedTrips[existingIdx] = {
            ...mockSharedTrips[existingIdx],
            isTripmate: true,
            tripmateRole: 'member',
          }
        } else {
          const shared = ensureWorkspaceParityTrip({
            id: targetTripId,
            tripId: targetTripId,
            title: inv.tripTitle,
            name: inv.destination || inv.tripTitle,
            destination: inv.destination || 'Pakistan',
            isTripmate: true,
            tripmateRole: 'member',
            ownerName: inv.ownerName,
            days: [],
            placesPool: [],
            customLists: [],
          })
          mockSharedTrips.unshift(shared)
        }
      }
    }
    return { success: true, status: cleanAction }
  },

  async removeTripMember(tripId, userId) {
    const sid = String(tripId)
    if (mockTripMembers[sid]) {
      mockTripMembers[sid].members = mockTripMembers[sid].members.filter(
        (m) => String(m.id || m.userId) !== String(userId)
      )
      mockTripMembers[sid].pendingInvites = mockTripMembers[sid].pendingInvites.filter(
        (inv) => String(inv.id || inv.invitedUserId) !== String(userId)
      )
    }
    return { success: true }
  },

  // ==================== DEDICATED SHARED BUDGET & SETTLEMENTS ====================
  async listSharedBudgetExpenses(tripId) {
    const sid = String(tripId)
    const expenses = mockSharedBudgetExpenses[sid] || []
    return { success: true, expenses }
  },

  async getSharedBudgetExpense(tripId, expenseId) {
    const sid = String(tripId)
    const list = mockSharedBudgetExpenses[sid] || []
    const item = list.find((e) => String(e.id) === String(expenseId))
    if (!item) throw new Error('Expense not found')
    return { success: true, expense: item }
  },

  async createSharedBudgetExpense(tripId, payload) {
    const sid = String(tripId)
    if (!mockSharedBudgetExpenses[sid]) {
      mockSharedBudgetExpenses[sid] = []
    }
    const newExpense = {
      id: 'sb_exp_' + Date.now(),
      tripId: sid,
      name: payload.name || 'Untitled Expense',
      amount: Number(payload.amount) || 0,
      currency: payload.currency || 'PKR',
      category: payload.category || 'Other',
      date: payload.date || new Date().toISOString().slice(0, 10),
      status: payload.status || 'paid',
      destinationReference: payload.destinationReference || '',
      payers: Array.isArray(payload.payers) && payload.payers.length > 0
        ? payload.payers
        : [{ userId: CURRENT_USER.id, name: CURRENT_USER.name, amount: Number(payload.amount) || 0 }],
      participants: Array.isArray(payload.participants) && payload.participants.length > 0
        ? payload.participants
        : [{ userId: CURRENT_USER.id, name: CURRENT_USER.name, share: Number(payload.amount) || 0 }],
    }
    mockSharedBudgetExpenses[sid].unshift(newExpense)
    return { success: true, expense: newExpense }
  },

  async updateSharedBudgetExpense(tripId, expenseId, payload) {
    const sid = String(tripId)
    const list = mockSharedBudgetExpenses[sid] || []
    const index = list.findIndex((e) => String(e.id) === String(expenseId))
    if (index >= 0) {
      list[index] = { ...list[index], ...payload }
      return { success: true, expense: list[index] }
    }
    throw new Error('Expense not found')
  },

  async deleteSharedBudgetExpense(tripId, expenseId) {
    const sid = String(tripId)
    if (mockSharedBudgetExpenses[sid]) {
      mockSharedBudgetExpenses[sid] = mockSharedBudgetExpenses[sid].filter(
        (e) => String(e.id) !== String(expenseId)
      )
    }
    return { success: true }
  },

  async listSharedBudgetSettlements(tripId) {
    const sid = String(tripId)
    const settlements = mockSharedBudgetSettlements[sid] || []
    return { success: true, settlements }
  },

  async createSharedBudgetSettlement(tripId, payload) {
    const sid = String(tripId)
    if (!mockSharedBudgetSettlements[sid]) {
      mockSharedBudgetSettlements[sid] = []
    }
    const newSettlement = {
      id: 'sb_stl_' + Date.now(),
      tripId: sid,
      payerId: payload.payerId || CURRENT_USER.id,
      payerName: payload.payerName || CURRENT_USER.name,
      receiverId: payload.receiverId || 'usr_arslan_1',
      receiverName: payload.receiverName || 'Ali Tariq',
      amount: Number(payload.amount) || 0,
      currency: payload.currency || 'PKR',
      date: payload.date || new Date().toISOString().slice(0, 10),
      note: payload.note || 'Settlement logged via mobile',
    }
    mockSharedBudgetSettlements[sid].unshift(newSettlement)
    return { success: true, settlement: newSettlement }
  },

  async deleteSharedBudgetSettlement(tripId, settlementId) {
    const sid = String(tripId)
    if (mockSharedBudgetSettlements[sid]) {
      mockSharedBudgetSettlements[sid] = mockSharedBudgetSettlements[sid].filter(
        (s) => String(s.id) !== String(settlementId)
      )
    }
    return { success: true }
  },

  // ==================== SOCIAL & DISCOVERY ====================
  async searchUsers(query, limit = 10) {
    const clean = String(query || '').toLowerCase().trim()
    if (!clean) return { success: true, users: PUBLIC_USERS.slice(0, limit) }
    const matches = PUBLIC_USERS.filter(
      (u) => u.username.toLowerCase().includes(clean) || u.name.toLowerCase().includes(clean)
    ).slice(0, limit)
    return { success: true, users: matches }
  },

  async getPublicUserByUsername(username) {
    const clean = String(username || '').toLowerCase().trim().replace(/^@/, '')
    const user = PUBLIC_USERS.find((u) => u.username.toLowerCase() === clean)
    if (!user) throw new Error('User not found')
    return { success: true, user }
  },

  async getPublicTripsByUsername(username) {
    const clean = String(username || '').toLowerCase().trim().replace(/^@/, '')
    const user = PUBLIC_USERS.find((u) => u.username.toLowerCase() === clean) || {
      username: clean,
      name: clean,
      bio: 'Traveler on TripNest',
    }
    const samplePublicTrip = {
      id: 'pub_' + Date.now(),
      title: `${user.name}'s Scenic Highlights`,
      destination: 'Hunza & Nagar',
      dates: 'May 2026',
      daysCount: 5,
      stopsCount: 12,
      coverImage: 'https://images.unsplash.com/photo-1596761226463-c78201b1be0d?auto=format&fit=crop&w=600&q=80',
    }
    return {
      success: true,
      username: clean,
      user,
      trips: [samplePublicTrip],
    }
  },

  async getPublicTripById(tripId) {
    const trip = mockTrips.find((t) => String(t.id || t.tripId) === String(tripId)) || mockTrips[0]
    return { success: true, trip: { ...trip, privacy: 'public' } }
  },

  async followUser(username) {
    const clean = String(username || '').toLowerCase().trim().replace(/^@/, '')
    mockFollowedUsernames.add(clean)
    return { success: true, isFollowing: true, message: `Following @${clean}` }
  },

  async unfollowUser(username) {
    const clean = String(username || '').toLowerCase().trim().replace(/^@/, '')
    mockFollowedUsernames.delete(clean)
    return { success: true, isFollowing: false, message: `Unfollowed @${clean}` }
  },

  async getFollowStatus(username) {
    const clean = String(username || '').toLowerCase().trim().replace(/^@/, '')
    const isFollowing = mockFollowedUsernames.has(clean)
    return {
      success: true,
      username: clean,
      isFollowing,
      followersCount: isFollowing ? 14 : 13,
      followingCount: 8,
    }
  },

  // ==================== NOTIFICATIONS ====================
  async getNotifications() {
    return {
      success: true,
      notifications: mockNotifications,
      unreadCount: mockNotifications.filter((n) => !n.read).length,
    }
  },

  async markNotificationRead(notificationId) {
    const notif = mockNotifications.find((n) => String(n.id) === String(notificationId))
    if (notif) notif.read = true
    return { success: true, notification: notif }
  },

  async markAllNotificationsRead() {
    mockNotifications.forEach((n) => {
      n.read = true
    })
    return { success: true }
  },

  // ==================== SEQUENCING (TSP & ROUTING) ====================
  async sequenceDay(dayIdOrPayload, maybeLocations, maybeOptions = {}) {
    let dayId
    let locations = []
    let options = {}
    let start = null

    if (typeof dayIdOrPayload === 'object' && dayIdOrPayload !== null) {
      dayId = dayIdOrPayload.dayId
      locations = Array.isArray(dayIdOrPayload.locations) ? dayIdOrPayload.locations : []
      options = dayIdOrPayload.options || {}
      start = dayIdOrPayload.start || null
    } else {
      dayId = dayIdOrPayload
      locations = Array.isArray(maybeLocations) ? maybeLocations : []
      options = maybeOptions || {}
      start = options.start || null
    }

    if (!locations || locations.length < 2) {
      return {
        success: true,
        dayId: String(dayId || ''),
        order: (locations || []).map((l) => String(l.id)),
        optimizedStops: locations || [],
        metrics: { totalDistanceKm: 0, estimatedTravelTimeHours: 0, distanceSavedKm: 0 },
        legs: [],
        algorithm: { name: 'TSP 2-Opt (Single / Trivial)', version: '1.0' },
      }
    }

    const startLat = start && Number.isFinite(Number(start.lat)) ? Number(start.lat) : Number(locations[0].lat)
    const startLon = start && Number.isFinite(Number(start.lon)) ? Number(start.lon) : Number(locations[0].lon)
    const speedKmh = Number(options.speedKmh) || 30.0
    const returnToStart = Boolean(options.returnToStart)

    const res = optimizePlaceSequence(locations, startLat, startLon, speedKmh, returnToStart)
    const optimized = res.orderedPlaces || locations
    const order = optimized.map((l) => String(l.id))

    return {
      success: true,
      dayId: String(dayId || ''),
      order,
      optimizedStops: optimized,
      metrics: {
        totalDistanceKm: Math.round((res.totalDistanceKm || 0) * 10) / 10,
        estimatedTravelTimeHours: Math.round(((res.totalDurationMin || 0) / 60) * 10) / 10,
        distanceSavedKm: Math.round((res.distanceSavedKm || 0) * 10) / 10,
      },
      legs: res.legs || [],
      algorithm: { name: 'TSP 2-Opt', version: '1.0' },
    }
  },

  // ==================== AI ASSISTANT ====================
  async chatWithAi(prompt, tripContext = '') {
    const q = (prompt || '').toLowerCase()

    if (q.includes('food') || q.includes('dish') || q.includes('restaurant') || q.includes('eat') || q.includes('cafe')) {
      return {
        success: true,
        response: `Here are the top culinary experiences and dining spots for your itinerary! Local specialties include Chargha, Shinwari Karahi, Chapli Kababs, and rich Sajji.`,
        travelCards: [
          {
            type: 'RESTAURANT_CARD',
            cardData: {
              title: 'Monal Margalla Hills',
              subtitle: 'Pir Sohawa, Margalla Hills, Islamabad',
              category: 'Fine Dining & Viewpoint',
              rating: 4.8,
              reviewCount: 2840,
              priceLevel: 'PKR 2,500 - 4,500',
              distance: '8.4 km from city center',
              badges: ['Open-air Terrace', 'Margalla View', 'BBQ Grill'],
              thumbnail: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
              description: 'Famous mountain terrace restaurant overlooking the entire Islamabad cityscape with live barbecue and traditional curries.',
            },
          },
        ],
      }
    }

    if (q.includes('pack') || q.includes('gear') || q.includes('checklist') || q.includes('bring')) {
      return {
        success: true,
        response: `Here is your customized travel checklist. Mountain valleys can have sudden weather swings between day and night, so layering is essential!`,
        travelCards: [
          {
            type: 'CHECKLIST_CARD',
            cardData: {
              title: 'Northern Travel Essentials',
              subtitle: 'Recommended packing for Pakistan mountain trips',
              items: [
                { label: 'Thermal fleece & windproof jacket', checked: true },
                { label: 'Sturdy hiking boots with ankle support', checked: false },
                { label: 'High SPF sunscreen & UV polaroid sunglasses', checked: true },
                { label: 'High-capacity 20,000mAh power bank', checked: false },
                { label: 'Cash in small PKR denominations (ATMs are sparse)', checked: false },
                { label: 'Personal first aid kit with altitude remedies', checked: false },
              ],
            },
          },
        ],
      }
    }

    if (q.includes('budget') || q.includes('cost') || q.includes('money') || q.includes('price') || q.includes('expense')) {
      return {
        success: true,
        response: `Here is a realistic budget breakdown per person for a comfortable mid-range trip, including private transport, comfortable lodging, and meals.`,
        travelCards: [
          {
            type: 'BUDGET_CARD',
            cardData: {
              title: 'Estimated 4-Day Trip Budget',
              subtitle: 'Comfortable traveler tier in Northern Pakistan',
              totalBudget: 55000,
              currency: 'PKR ',
              items: [
                { name: 'Hotel / Boutique Lodge (3 nights)', cost: 24000 },
                { name: 'Private 4x4 or Prado Fuel Share', cost: 16000 },
                { name: 'Dining, Snacks & Spring Water', cost: 11000 },
                { name: 'Entry Tickets, Boating & Guides', cost: 4000 },
              ],
            },
          },
        ],
      }
    }

    if (q.includes('hotel') || q.includes('stay') || q.includes('resort') || q.includes('room') || q.includes('lodge')) {
      return {
        success: true,
        response: `Recommended top-tier stays offering outstanding comfort, mountain views, and genuine hospitality:`,
        travelCards: [
          {
            type: 'HOTEL_CARD',
            cardData: {
              title: 'Hunza Serena Inn & Heritage Lodges',
              subtitle: 'Karimabad, Hunza Valley',
              category: 'Boutique Heritage Resort',
              rating: 4.8,
              reviewCount: 980,
              priceLevel: 'Luxury Heritage',
              distance: 'Walking distance to Baltit Fort',
              badges: ['Ultar Peak View', 'Apricot Gardens', 'Organic Breakfast'],
              thumbnail: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
              description: 'Authentic local woodcraft architecture set inside 6 acres of terraced fruit orchards facing snow-covered Karakoram spires.',
            },
          },
        ],
      }
    }

    // Default: scenic highlights & travel insight
    return {
      success: true,
      response: `Based on your itinerary, mornings are the ideal time for scenic vantage points before afternoon haze. Make sure to allow travel buffer time on winding mountain roads!`,
      travelCards: [
        {
          type: 'PLACE_CARD',
          cardData: {
            title: 'Daman-e-Koh & Monal Vantage',
            subtitle: 'Margalla Hills National Park, Islamabad',
            category: 'Scenic Viewpoint',
            rating: 4.9,
            reviewCount: 1890,
            badges: ['Panoramic View', 'Pine Trails', 'Sunset Spot'],
            thumbnail: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80',
            description: 'Terraced garden lookout perched high above the capital grid with walking trails and sweeping views toward Rawal Lake.',
          },
        },
      ],
    }
  },

  // ==================== EXPLORE & WEATHER ====================
  async getWeather(lat, lon) {
    const isNorth = Number(lat) > 34
    const temp = isNorth ? 16 : 26
    return {
      city: isNorth ? 'Gilgit-Baltistan, PK' : 'Islamabad, PK',
      temperature: temp,
      temp_c: temp,
      feels_like: temp - 2,
      description: isNorth ? 'Partly cloudy with fresh mountain breeze' : 'Sunny and clear sky',
      condition: isNorth ? 'Partly Cloudy' : 'Sunny & Clear',
      humidity: isNorth ? 46 : 38,
      wind_speed: 3.2,
      wind_kph: 12,
      cloud_cover: isNorth ? 30 : 10,
      pressure: 1014,
      icon: isNorth ? 'partly-cloudy' : 'sunny',
    }
  },

  async getExplorePlaces(lat, lon, query = 'attractions') {
    const q = (query || '').toLowerCase().trim()

    // 1. Detect target Pakistani city name from query or coordinates
    let targetCity = ''
    const inMatch = q.match(/\bin\s+([a-z\s]+)/i)
    if (inMatch && inMatch[1]) {
      const candidate = inMatch[1].trim().split(/\s+/)[0]
      if (KNOWN_CITY_COORDS[candidate.toLowerCase()]) {
        targetCity = KNOWN_CITY_COORDS[candidate.toLowerCase()].name
      } else {
        targetCity = inMatch[1].trim()
      }
    }

    if (!targetCity) {
      for (const [key, val] of Object.entries(KNOWN_CITY_COORDS)) {
        if (q.includes(key)) {
          targetCity = val.name
          break
        }
      }
    }

    // If still no city detected in query string, resolve nearest known city by coordinates
    if (!targetCity && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      let minDist = Infinity
      let nearestName = 'Islamabad'
      for (const val of Object.values(KNOWN_CITY_COORDS)) {
        const d = calculateHaversineDistance({ lat, lon }, { lat: val.lat, lon: val.lon })
        if (d < minDist) {
          minDist = d
          nearestName = val.name
        }
      }
      if (minDist <= 60) {
        targetCity = nearestName
      }
    }

    // 2. Query dynamic OpenStreetMap / curated places with STRICT city-level isolation
    let results = []
    if (targetCity) {
      results = await fetchDynamicPlacesForCity(targetCity, Number(lat), Number(lon), 'All', q)
    } else {
      // General Pakistan attractions if no city specified
      results = RECOMMENDED_PLACES_CATALOG.slice(0, 15)
    }

    return {
      success: true,
      places: results,
      city: targetCity || 'Pakistan',
      source: 'pakistan_places_engine',
    }
  },

  async getPlaceDetails(placeId, dataId, fallbackPlace = null) {
    const catalogItem = RECOMMENDED_PLACES_CATALOG.find(
      (p) => String(p.id) === String(placeId) || String(p.data_id) === String(dataId)
    )

    if (catalogItem) {
      return {
        success: true,
        place: {
          ...catalogItem,
          hours: catalogItem?.hours || null,
          rating: catalogItem?.rating || null,
          reviewsCount: catalogItem?.reviews || catalogItem?.reviewsCount || null,
          website: catalogItem?.website || null,
          phoneNumber: catalogItem?.phoneNumber || catalogItem?.phone || null,
        },
        source: 'mock_catalog',
      }
    }

    // Dynamic / OSM place details preservation:
    // Retain the actual clicked place's attributes rather than falling back to Islamabad catalog items
    const base = fallbackPlace || {}
    const title = base.title || base.name || 'Historic Attraction'
    return {
      success: true,
      place: {
        id: String(placeId || base.id || `dyn-${Date.now()}`),
        place_id: String(placeId || base.place_id || ''),
        data_id: String(dataId || base.data_id || ''),
        title,
        name: title,
        category: base.category || 'attraction',
        rating: base.rating || 4.5,
        reviewCount: base.reviewCount || base.reviewsCount || 85,
        reviewsCount: base.reviewCount || base.reviewsCount || 85,
        address: base.address || base.subtitle || 'Pakistan',
        subtitle: base.subtitle || base.address || 'Pakistan',
        photo: base.photo || base.image || '',
        images: base.images || (base.photo ? [base.photo] : []),
        lat: base.lat !== undefined ? Number(base.lat) : null,
        lon: base.lon !== undefined ? Number(base.lon) : null,
        description: base.description || base.note || `${title} is a notable point of interest and cultural destination in Pakistan.`,
        openStatus: base.openStatus || 'Open',
        website: base.website || null,
        phoneNumber: base.phoneNumber || base.phone || null,
        source: 'dynamic_place',
      },
      source: 'dynamic_place',
    }
  },

  async getPlacePhotos(dataId) {
    return {
      success: true,
      photos: [],
      source: 'mock_catalog',
    }
  },

  // ==================== ACTIVITY HISTORY ====================
  async getHistory(limit = 100) {
    return {
      success: true,
      activities: mockActivities.slice(0, limit),
    }
  },

  // ==================== SEQUENCING (TSP & ROUTING) ====================
  async sequenceDay(dayIdOrPayload, maybeLocations, maybeOptions, maybeStart, maybeTripId) {
    let dayId, locations, options, start
    if (typeof dayIdOrPayload === 'object' && dayIdOrPayload !== null) {
      dayId = String(dayIdOrPayload.dayId)
      locations = dayIdOrPayload.locations || []
      options = dayIdOrPayload.options || {}
      start = dayIdOrPayload.start
    } else {
      dayId = String(dayIdOrPayload)
      locations = maybeLocations || []
      options = maybeOptions || {}
      start = maybeStart
    }

    if (!Array.isArray(locations) || locations.length < 2) {
      return {
        dayId,
        order: null,
        metrics: null,
        legs: [],
        algorithm: null,
        truth: null,
        warnings: ['NOT_ENOUGH_POINTS'],
        errors: ['Need at least 2 locations'],
      }
    }

    const startLat = start?.lat ? Number(start.lat) : Number(locations[0].lat)
    const startLon = start?.lon ? Number(start.lon) : Number(locations[0].lon)
    const speedKmh = Number(options.speedKmh) > 0 ? Number(options.speedKmh) : 30.0

    const optResult = optimizePlaceSequence(
      locations.map((loc) => ({
        id: String(loc.id),
        name: loc.name || loc.title || 'Stop',
        lat: Number(loc.lat),
        lon: Number(loc.lon),
      })),
      startLat,
      startLon,
      speedKmh,
      Boolean(options.returnToStart)
    )

    const order = optResult.orderedPlaces.map((p) => String(p.id))
    const legs = (optResult.legs || []).map((leg) => ({
      fromPlaceId: String(leg.fromPlaceId || leg.fromId || ''),
      toPlaceId: String(leg.toPlaceId || leg.toId || ''),
      fromName: leg.fromName || 'From',
      toName: leg.toName || 'To',
      distanceKm: Number(leg.distanceKm || 0),
      estimatedTravelTimeHours: Number(leg.estimatedTravelTimeHours || 0),
      estimatedTravelTimeMin: Number(leg.estimatedTravelTimeMin || Math.round((leg.estimatedTravelTimeHours || 0) * 60)),
    }))

    // Add activity record
    mockActivities.unshift({
      id: `act_${Date.now()}`,
      tripId: '1712492800001',
      eventType: 'trip_updated',
      title: `Optimized Itinerary Day (${dayId})`,
      description: `Backend sequencing sorted ${order.length} places. Total distance: ${optResult.totalDistanceKm.toFixed(1)} km.`,
      createdAt: new Date().toISOString(),
      actionUrl: '/workspace',
    })

    return {
      dayId,
      order,
      totalDistanceKm: Number(optResult.totalDistanceKm.toFixed(2)),
      totalDurationMin: optResult.totalDurationMin || Math.max(1, Math.round((optResult.totalDistanceKm / speedKmh) * 60)),
      metrics: {
        beforeDistanceKm: optResult.metrics?.beforeDistanceKm || Number((optResult.totalDistanceKm * 1.25).toFixed(2)),
        totalDistanceKm: Number(optResult.totalDistanceKm.toFixed(2)),
        distanceSavedKm: optResult.metrics?.distanceSavedKm || Number((optResult.totalDistanceKm * 0.25).toFixed(2)),
        beforeTravelTimeHours: optResult.metrics?.beforeTravelTimeHours || Number(((optResult.totalDistanceKm * 1.25) / speedKmh).toFixed(2)),
        estimatedTravelTimeHours: Number((optResult.totalDistanceKm / speedKmh).toFixed(2)),
        travelTimeSavedHours: optResult.metrics?.travelTimeSavedHours || Number(((optResult.totalDistanceKm * 0.25) / speedKmh).toFixed(2)),
        speedKmhUsed: speedKmh,
      },
      legs,
      algorithm: { name: 'nearest_neighbor_2opt', fallbackUsed: false },
      truth: {
        source: 'mock_backend_sequencing',
        distanceModel: 'haversine_straight_line',
        timeModel: 'fixed_speed_estimate',
        roadAware: Boolean(options.roadAware),
      },
      warnings: [],
      errors: [],
    }
  },

  // ==================== ADMIN PORTAL ====================
  async getAdminOverview() {
    return {
      success: true,
      counts: {
        users: PUBLIC_USERS.length,
        trips: mockTrips.length,
        activeSessions: 3,
      },
      users: PUBLIC_USERS,
      trips: mockTrips.map((t) => ({
        id: String(t.id || t.tripId),
        title: t.title || t.destination,
        destination: t.destination,
        dates: t.dates,
        owner: t.owner || 'traveler',
        privacy: t.privacy || 'private',
        createdAt: t.createdAt || '2026-04-10',
      })),
    }
  },

  async getAdminUsers({ search = '', role = '', status = '', provider = '', page = 1, limit = 10 } = {}) {
    let list = [...PUBLIC_USERS]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    }
    if (role) {
      list = list.filter((u) => (u.role || 'user').toLowerCase() === role.toLowerCase())
    }
    if (status) {
      list = list.filter((u) => (u.status || 'active').toLowerCase() === status.toLowerCase())
    }
    const total = list.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const startIdx = (page - 1) * limit
    const paged = list.slice(startIdx, startIdx + limit)
    return {
      success: true,
      users: paged,
      total,
      page,
      totalPages,
    }
  },

  async getAdminUserDetails(userId) {
    const user = PUBLIC_USERS.find((u) => String(u.id) === String(userId))
    if (!user) throw new Error('User not found')
    return {
      success: true,
      user: {
        ...user,
        tripsCount: mockTrips.length,
        activeSessionsCount: 1,
      },
    }
  },

  async updateAdminUserStatus(userId, status) {
    const user = PUBLIC_USERS.find((u) => String(u.id) === String(userId))
    if (!user) throw new Error('User not found')
    user.status = status
    return { success: true, user: { ...user } }
  },

  async updateAdminUserRole(userId, role) {
    const user = PUBLIC_USERS.find((u) => String(u.id) === String(userId))
    if (!user) throw new Error('User not found')
    user.role = role
    return { success: true, user: { ...user } }
  },

  async deleteAdminUser(userId) {
    const idx = PUBLIC_USERS.findIndex((u) => String(u.id) === String(userId))
    if (idx >= 0) PUBLIC_USERS.splice(idx, 1)
    return { success: true }
  },

  async getAdminTrips(search = '') {
    let list = [...mockTrips]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.destination || '').toLowerCase().includes(q)
      )
    }
    return {
      success: true,
      trips: list.map((t) => ({
        id: String(t.id || t.tripId),
        title: t.title || t.destination,
        destination: t.destination,
        dates: t.dates,
        owner: t.owner || 'traveler',
        privacy: t.privacy || 'private',
        createdAt: t.createdAt || '2026-04-10',
      })),
    }
  },

  async deleteAdminTrip(tripId) {
    const idx = mockTrips.findIndex((t) => String(t.id || t.tripId) === String(tripId))
    if (idx >= 0) mockTrips.splice(idx, 1)
    return { success: true }
  },
}
