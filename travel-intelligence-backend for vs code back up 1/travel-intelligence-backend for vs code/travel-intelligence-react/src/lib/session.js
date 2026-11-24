import { API_BASE } from './constants'

export function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

export function readStoredToken() {
  return localStorage.getItem('token')
}

export function persistSession(token, user) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

async function requestJson(path, { method = 'GET', body, token } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Backend not running. Start the server at ${API_BASE}`)
    }
    throw new Error('Network request failed')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    if (response.status === 401) {
      throw new Error('Invalid credentials')
    }
    if (response.status === 403) {
      throw new Error(data.detail || 'You do not have permission to perform this action')
    }
    if (response.status === 404) {
      throw new Error(data.detail || 'Requested resource was not found')
    }
    if (response.status >= 500) {
      throw new Error('Server error. Please try again.')
    }
    throw new Error(data.detail || data.message || 'Request failed')
  }
  return data
}

export async function loginRequest(credentials) {
  return requestJson('/auth/login', { method: 'POST', body: credentials })
}

export async function googleLoginRequest(accessToken) {
  return requestJson('/auth/google', { method: 'POST', body: { access_token: accessToken } })
}

export async function registerRequest(payload) {
  return requestJson('/auth/register', { method: 'POST', body: payload })
}

export async function verifyTokenRequest(token) {
  return requestJson('/auth/verify', { method: 'POST', body: { token } })
}

export async function logoutRequest(token) {
  try {
    await requestJson('/auth/logout', { method: 'POST', body: { token } })
  } catch {
    // Ignore logout network failures; local session is cleared anyway.
  }
}

export async function fetchTripsRequest(token) {
  return requestJson('/trips', { token })
}

export async function fetchActivityHistoryRequest(token, limit = 100) {
  return requestJson(`/history?limit=${encodeURIComponent(limit)}`, { token })
}

export async function fetchAdminOverviewRequest(token) {
  return requestJson('/admin/overview', { token })
}

export async function fetchAdminUsersRequest(token, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val)
    }
  })
  const queryStr = query.toString()
  const path = queryStr ? `/admin/users?${queryStr}` : '/admin/users'
  return requestJson(path, { token })
}

export async function fetchAdminUserDetailsRequest(token, userId) {
  return requestJson(`/admin/users/${encodeURIComponent(userId)}`, { token })
}

export async function updateUserStatusRequest(token, userId, status) {
  return requestJson(`/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  })
}

export async function updateUserRoleRequest(token, userId, role) {
  return requestJson(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    token,
    body: { role },
  })
}

export async function deleteUserRequest(token, userId) {
  return requestJson(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    token,
  })
}

export async function updateProfileRequest(token, payload) {
  return requestJson('/account/profile', { method: 'PUT', token, body: payload })
}

export async function deleteAccountRequest(token, payload) {
  return requestJson('/account', { method: 'DELETE', token, body: payload })
}

export async function createTripRequest(token, trip) {
  return requestJson('/trips', { method: 'POST', token, body: { trip } })
}

export async function updateTripRequest(token, trip) {
  const tripId = trip?.id ?? trip?.tripId
  return requestJson(`/trips/${tripId}`, { method: 'PUT', token, body: { trip } })
}

export async function deleteTripRequest(token, tripId) {
  return requestJson(`/trips/${tripId}`, { method: 'DELETE', token })
}

export async function getTripShareTokenRequest(token, tripId, permission = 'view') {
  return requestJson(`/trips/${tripId}/share-token`, {
    method: 'POST',
    token,
    body: { permission },
  })
}

export async function fetchSharedTripRequest(shareToken) {
  return requestJson(`/trips/shared/${encodeURIComponent(shareToken)}`)
}

export async function fetchSharedEditTripRequest(editShareToken) {
  return requestJson(`/trips/shared/edit/${encodeURIComponent(editShareToken)}`)
}

export async function copySharedEditTripRequest(token, editShareToken) {
  return requestJson(`/trips/shared/edit/${encodeURIComponent(editShareToken)}/copy`, {
    method: 'POST',
    token,
  })
}

export async function fetchAdminTripsRequest(token, search) {
  let url = '/admin/trips'
  if (search) {
    url += `?search=${encodeURIComponent(search)}`
  }
  return requestJson(url, { method: 'GET', token })
}

export async function deleteAdminTripRequest(token, tripId) {
  return requestJson(`/admin/trips/${encodeURIComponent(tripId)}`, { method: 'DELETE', token })
}

export async function fetchExplorePlacesRequest(lat, lon, query = 'tourist attractions') {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    query,
  })
  return requestJson(`/api/explore/places?${params.toString()}`)
}

export async function fetchPlaceDetailsRequest(placeId, dataId) {
  const params = new URLSearchParams()
  if (placeId) params.append('place_id', placeId)
  if (dataId) params.append('data_id', dataId)
  return requestJson(`/api/explore/place-details?${params.toString()}`)
}

export async function fetchPlacePhotosRequest(dataId) {
  const params = new URLSearchParams()
  if (dataId) params.append('data_id', dataId)
  return requestJson(`/api/explore/place-photos?${params.toString()}`)
}

export async function searchUsersRequest(query, limit = 10) {
  const clean = String(query || '').trim()
  if (!clean) return { success: true, users: [] }
  return requestJson(`/api/users/search?q=${encodeURIComponent(clean)}&limit=${encodeURIComponent(limit)}`)
}

export async function fetchPublicUserByUsernameRequest(username) {
  const clean = String(username || '').trim().replace(/^@/, '')
  if (!clean) throw new Error('Username is required')
  return requestJson(`/api/users/by-username/${encodeURIComponent(clean)}`)
}

export async function fetchNotificationsRequest(token, limit = 30) {
  return requestJson(`/api/notifications?limit=${encodeURIComponent(limit)}`, { token })
}

export async function markNotificationAsReadRequest(token, notificationId) {
  return requestJson(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    token,
  })
}

export async function markAllNotificationsAsReadRequest(token) {
  return requestJson('/api/notifications/read-all', {
    method: 'POST',
    token,
  })
}


export async function sendTripInvitationRequest(token, tripId, identifier) {
  return requestJson(`/api/trips/${encodeURIComponent(tripId)}/members/invite`, {
    method: 'POST',
    body: { identifier },
    token,
  })
}

export async function getTripMembersRequest(token, tripId) {
  return requestJson(`/api/trips/${encodeURIComponent(tripId)}/members`, {
    token,
  })
}


export async function getUserInvitationsRequest(token) {
  return requestJson('/api/trips/invitations', { token })
}

export async function respondToTripInvitationRequest(token, inviteId, action) {
  return requestJson(`/api/trips/invitations/${encodeURIComponent(inviteId)}/respond`, {
    method: 'POST',
    body: { action },
    token,
  })
}

export async function removeTripMemberRequest(token, tripId, userId) {
  return requestJson(`/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    token,
  })
}

export async function getSharedTripmateTripRequest(token, tripId) {
  return requestJson(`/api/tripmates/trips/${encodeURIComponent(tripId)}`, {
    token,
  })
}

export async function updateTripmateItineraryRequest(token, tripId, { days, placesPool, customLists } = {}) {
  return requestJson(`/api/tripmates/trips/${encodeURIComponent(tripId)}/itinerary`, {
    method: 'PUT',
    body: {
      days,
      placesPool,
      customLists,
    },
    token,
  })
}

export async function fetchMySharedTripmateTripsRequest(token) {
  return requestJson('/api/tripmates/shared-trips', {
    token,
  })
}

export async function listSharedBudgetExpensesRequest(token, tripId) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses`, {
    token,
  })
}

export async function getSharedBudgetExpenseRequest(token, tripId, expenseId) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
    token,
  })
}

export async function createSharedBudgetExpenseRequest(token, tripId, payload) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses`, {
    method: 'POST',
    body: payload,
    token,
  })
}

export async function updateSharedBudgetExpenseRequest(token, tripId, expenseId, payload) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
    method: 'PUT',
    body: payload,
    token,
  })
}

export async function deleteSharedBudgetExpenseRequest(token, tripId, expenseId) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
    method: 'DELETE',
    token,
  })
}

export async function listSharedBudgetSettlementsRequest(token, tripId) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/settlements`, {
    token,
  })
}

export async function createSharedBudgetSettlementRequest(token, tripId, payload) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/settlements`, {
    method: 'POST',
    body: payload,
    token,
  })
}

export async function deleteSharedBudgetSettlementRequest(token, tripId, settlementId) {
  return requestJson(`/api/shared-budget/trips/${encodeURIComponent(tripId)}/settlements/${encodeURIComponent(settlementId)}`, {
    method: 'DELETE',
    token,
  })
}




