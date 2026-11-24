/**
 * Real TripNest API Client
 * 
 * Configured to consume the REAL TripNest API contract once the isolated backend is active.
 * STRICT ENFORCEMENT:
 * - Does NOT invent GET /trips/{id}.
 * - Routes to ISOLATED_API_BASE_URL.
 * - Exact FastAPI request & response contracts matching web source of truth.
 */

import { getApiBaseUrl } from '../config/env.js'

async function requestJson(path, { method = 'GET', body, token } = {}) {
  const baseUrl = getApiBaseUrl()
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    throw new Error(`Cannot connect to backend at ${baseUrl}. Ensure backend is running and reachable on this network.`)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    if (response.status === 401) {
      const err = new Error(data.detail || data.error || 'Invalid credentials or expired session')
      err.isAuthExpired = true
      err.status = 401
      throw err
    }
    if (response.status === 403) {
      throw new Error(data.detail || data.error || 'Access denied: insufficient permissions')
    }
    if (response.status === 404) {
      throw new Error(data.detail || data.error || 'Resource not found')
    }
    throw new Error(data.detail || data.error || data.message || 'Request failed')
  }
  return data
}

export const apiClient = {
  // ==================== SYSTEM & HEALTH ====================
  async pingServer() {
    return requestJson('/')
  },

  // ==================== AUTH & ACCOUNT ====================
  async login(credentials) {
    return requestJson('/auth/login', { method: 'POST', body: credentials })
  },

  async register(payload) {
    return requestJson('/auth/register', { method: 'POST', body: payload })
  },

  async googleLogin(tokenPayload) {
    let body
    if (typeof tokenPayload === 'string') {
      body = tokenPayload.includes('.')
        ? { id_token: tokenPayload }
        : { access_token: tokenPayload }
    } else if (tokenPayload && typeof tokenPayload === 'object') {
      body = {
        id_token: tokenPayload.idToken || tokenPayload.id_token || undefined,
        access_token: tokenPayload.accessToken || tokenPayload.access_token || undefined,
      }
    } else {
      body = { access_token: tokenPayload }
    }
    return requestJson('/auth/google', { method: 'POST', body })
  },

  async verifyToken(token) {
    return requestJson('/auth/verify', { method: 'POST', body: { token } })
  },

  async logout(token) {
    try {
      await requestJson('/auth/logout', { method: 'POST', body: { token } })
    } catch {
      // Ignore network failure on logout
    }
  },

  async updateProfile(token, payload) {
    const body = {
      name: String(payload.name || payload.displayName || '').trim(),
      username: String(payload.username || '').trim().replace(/^@/, ''),
      email: String(payload.email || '').trim(),
      profileImage: payload.profileImage || null,
      bio: payload.bio !== undefined ? String(payload.bio).trim() : null,
    }
    return requestJson('/account/profile', { method: 'PUT', token, body })
  },

  async deleteAccount(token, payload = {}) {
    return requestJson('/account', { method: 'DELETE', token, body: payload })
  },

  // ==================== OWNED TRIPS ====================
  async getTrips(token) {
    return requestJson('/trips', { token })
  },

  async createTrip(token, trip) {
    return requestJson('/trips', { method: 'POST', token, body: { trip } })
  },

  async updateTrip(token, tripId, trip) {
    return requestJson(`/trips/${tripId}`, { method: 'PUT', token, body: { trip } })
  },

  async deleteTrip(token, tripId) {
    return requestJson(`/trips/${tripId}`, { method: 'DELETE', token })
  },

  // ==================== SHARING & CAN-EDIT COPY ====================
  async getTripShareToken(token, tripId, permission = 'view') {
    return requestJson(`/trips/${tripId}/share-token`, {
      method: 'POST',
      token,
      body: { permission },
    })
  },

  async getSharedTrip(shareToken) {
    return requestJson(`/trips/shared/${encodeURIComponent(shareToken)}`)
  },

  async getSharedEditTrip(editShareToken) {
    return requestJson(`/trips/shared/edit/${encodeURIComponent(editShareToken)}`)
  },

  async copySharedEditTrip(token, editShareToken) {
    return requestJson(`/trips/shared/edit/${encodeURIComponent(editShareToken)}/copy`, {
      method: 'POST',
      token,
    })
  },

  // ==================== TRIPMATES COLLABORATION ====================
  async getSharedTripmateTrips(token) {
    return requestJson('/api/tripmates/shared-trips', { token })
  },

  async getSharedTripmateTrip(token, tripId) {
    return requestJson(`/api/tripmates/trips/${encodeURIComponent(tripId)}`, { token })
  },

  async updateTripmateItinerary(token, tripId, { days, placesPool, customLists }) {
    return requestJson(`/api/tripmates/trips/${encodeURIComponent(tripId)}/itinerary`, {
      method: 'PUT',
      token,
      body: { days, placesPool, customLists },
    })
  },

  async getTripMembers(token, tripId) {
    return requestJson(`/api/trips/${encodeURIComponent(tripId)}/members`, { token })
  },

  async inviteTripMember(token, tripId, identifier) {
    return requestJson(`/api/trips/${encodeURIComponent(tripId)}/members/invite`, {
      method: 'POST',
      token,
      body: { identifier },
    })
  },

  async getUserInvitations(token) {
    return requestJson('/api/trips/invitations', { token })
  },

  async respondToTripInvitation(token, inviteId, action) {
    return requestJson(`/api/trips/invitations/${encodeURIComponent(inviteId)}/respond`, {
      method: 'POST',
      token,
      body: { action },
    })
  },

  async removeTripMember(token, tripId, userId) {
    return requestJson(`/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      token,
    })
  },

  // ==================== DEDICATED SHARED BUDGET & SETTLEMENTS ====================
  async listSharedBudgetExpenses(token, tripId) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses`, { token })
  },

  async getSharedBudgetExpense(token, tripId, expenseId) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, { token })
  },

  async createSharedBudgetExpense(token, tripId, payload) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses`, {
      method: 'POST',
      token,
      body: payload,
    })
  },

  async updateSharedBudgetExpense(token, tripId, expenseId, payload) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'PUT',
      token,
      body: payload,
    })
  },

  async deleteSharedBudgetExpense(token, tripId, expenseId) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'DELETE',
      token,
    })
  },

  async listSharedBudgetSettlements(token, tripId) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/settlements`, { token })
  },

  async createSharedBudgetSettlement(token, tripId, payload) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/settlements`, {
      method: 'POST',
      token,
      body: payload,
    })
  },

  async deleteSharedBudgetSettlement(token, tripId, settlementId) {
    return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/settlements/${encodeURIComponent(settlementId)}`, {
      method: 'DELETE',
      token,
    })
  },

  // ==================== SOCIAL & DISCOVERY ====================
  async searchUsers(query, limit = 10) {
    const clean = String(query || '').trim()
    if (!clean) return { success: true, users: [] }
    return requestJson(`/api/users/search?q=${encodeURIComponent(clean)}&limit=${encodeURIComponent(limit)}`)
  },

  async getPublicUserByUsername(username) {
    const clean = String(username || '').trim().replace(/^@/, '')
    if (!clean) throw new Error('Username is required')
    return requestJson(`/api/users/by-username/${encodeURIComponent(clean)}`)
  },

  async getPublicTripsByUsername(username) {
    const clean = String(username || '').trim().replace(/^@/, '')
    if (!clean) throw new Error('Username is required')
    return requestJson(`/api/users/${encodeURIComponent(clean)}/public-trips`)
  },

  async getPublicTripById(tripId) {
    const clean = String(tripId || '').trim()
    if (!clean) throw new Error('Trip ID is required')
    return requestJson(`/api/trips/public/${encodeURIComponent(clean)}`)
  },

  async followUser(token, username) {
    const clean = String(username || '').trim().replace(/^@/, '')
    return requestJson(`/api/users/${encodeURIComponent(clean)}/follow`, { method: 'POST', token })
  },

  async unfollowUser(token, username) {
    const clean = String(username || '').trim().replace(/^@/, '')
    return requestJson(`/api/users/${encodeURIComponent(clean)}/follow`, { method: 'DELETE', token })
  },

  async getFollowStatus(username, token = null) {
    const clean = String(username || '').trim().replace(/^@/, '')
    return requestJson(`/api/users/${encodeURIComponent(clean)}/follow-status`, { token })
  },

  // ==================== NOTIFICATIONS ====================
  async getNotifications(token, limit = 30) {
    return requestJson(`/api/notifications?limit=${encodeURIComponent(limit)}`, { token })
  },

  async markNotificationRead(token, notificationId) {
    return requestJson(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      token,
    })
  },

  async markAllNotificationsRead(token) {
    return requestJson('/api/notifications/read-all', { method: 'POST', token })
  },

  // ==================== AI ASSISTANT ====================
  async chatWithAi(prompt, tripContext = '') {
    return requestJson('/api/ai/chat', {
      method: 'POST',
      body: { prompt, trip_context: tripContext },
    })
  },

  // ==================== SEQUENCING (TSP & ROUTING) ====================
  async sequenceDay(dayIdOrPayload, maybeLocations, maybeOptions, maybeStart, maybeTripId) {
    let payload
    if (typeof dayIdOrPayload === 'object' && dayIdOrPayload !== null) {
      payload = {
        tripId: dayIdOrPayload.tripId,
        dayId: String(dayIdOrPayload.dayId),
        start: dayIdOrPayload.start || undefined,
        options: dayIdOrPayload.options || undefined,
        locations: (dayIdOrPayload.locations || []).map((loc) => ({
          id: String(loc.id),
          name: loc.name || loc.title || undefined,
          lat: Number(loc.lat),
          lon: Number(loc.lon),
        })),
      }
    } else {
      payload = {
        tripId: maybeTripId || undefined,
        dayId: String(dayIdOrPayload),
        start: maybeStart || undefined,
        options: maybeOptions || undefined,
        locations: (maybeLocations || []).map((loc) => ({
          id: String(loc.id),
          name: loc.name || loc.title || undefined,
          lat: Number(loc.lat),
          lon: Number(loc.lon),
        })),
      }
    }

    return requestJson('/v1/sequence/day', {
      method: 'POST',
      body: payload,
    })
  },

  // ==================== ACTIVITY HISTORY ====================
  async getHistory(token, limit = 100) {
    return requestJson(`/history?limit=${encodeURIComponent(limit)}`, { token })
  },

  // ==================== ADMIN PORTAL ====================
  async getAdminOverview(token) {
    return requestJson('/admin/overview', { token })
  },

  async getAdminUsers(token, { search = '', role = '', status = '', provider = '', page = 1, limit = 10 } = {}) {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (role) params.append('role', role)
    if (status) params.append('status', status)
    if (provider) params.append('provider', provider)
    params.append('page', String(page))
    params.append('limit', String(limit))
    return requestJson(`/admin/users?${params.toString()}`, { token })
  },

  async getAdminUserDetails(token, userId) {
    return requestJson(`/admin/users/${encodeURIComponent(userId)}`, { token })
  },

  async updateAdminUserStatus(token, userId, status) {
    return requestJson(`/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      token,
      body: { status },
    })
  },

  async updateAdminUserRole(token, userId, role) {
    return requestJson(`/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      token,
      body: { role },
    })
  },

  async deleteAdminUser(token, userId) {
    return requestJson(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      token,
    })
  },

  async getAdminTrips(token, search = '') {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    const query = params.toString() ? `?${params.toString()}` : ''
    return requestJson(`/admin/trips${query}`, { token })
  },

  async deleteAdminTrip(token, tripId) {
    return requestJson(`/admin/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
      token,
    })
  },

  // ==================== EXPLORE & WEATHER ====================
  async getWeather(lat, lon) {
    return requestJson(`/weather?lat=${lat}&lon=${lon}`)
  },

  async getExplorePlaces(lat, lon, query = 'tourist attractions') {
    return requestJson(`/api/explore/places?lat=${lat}&lon=${lon}&query=${encodeURIComponent(query)}`)
  },

  async getPlaceDetails(placeId, dataId) {
    const params = new URLSearchParams()
    if (placeId) params.append('place_id', placeId)
    if (dataId) params.append('data_id', dataId)
    return requestJson(`/api/explore/place-details?${params.toString()}`)
  },

  async getPlacePhotos(dataId) {
    return requestJson(`/api/explore/place-photos?data_id=${encodeURIComponent(dataId)}`)
  },

  // ==================== PAKISTAN-WIDE LOCATION & HOTEL SEARCH ====================
  async searchLocations(query = '', { province = '', category = '', limit = 25 } = {}) {
    const params = new URLSearchParams()
    if (query) params.append('query', query)
    if (province && province !== 'All') params.append('province', province)
    if (category && category !== 'All') params.append('category', category)
    if (limit) params.append('limit', limit)
    return requestJson(`/api/locations/search?${params.toString()}`)
  },

  async searchHotels(query = '', { province = '', lat = null, lon = null, radiusKm = 50, limit = 25 } = {}) {
    const params = new URLSearchParams()
    if (query) params.append('query', query)
    if (province && province !== 'All') params.append('province', province)
    if (lat !== null && lat !== undefined) params.append('lat', lat)
    if (lon !== null && lon !== undefined) params.append('lon', lon)
    if (radiusKm) params.append('radius_km', radiusKm)
    if (limit) params.append('limit', limit)
    return requestJson(`/api/hotels/search?${params.toString()}`)
  },

  async getLocationsInBounds(minLat, maxLat, minLon, maxLon, { category = '', limit = 50 } = {}) {
    const params = new URLSearchParams()
    params.append('min_lat', minLat)
    params.append('max_lat', maxLat)
    params.append('min_lon', minLon)
    params.append('max_lon', maxLon)
    if (category && category !== 'All') params.append('category', category)
    if (limit) params.append('limit', limit)
    return requestJson(`/api/locations/bounds?${params.toString()}`)
  },

  async getNearbyLocations(lat, lon, { radiusKm = 30, category = '', limit = 30 } = {}) {
    const params = new URLSearchParams()
    params.append('lat', lat)
    params.append('lon', lon)
    if (radiusKm) params.append('radius_km', radiusKm)
    if (category && category !== 'All') params.append('category', category)
    if (limit) params.append('limit', limit)
    return requestJson(`/api/locations/nearby?${params.toString()}`)
  },
}
