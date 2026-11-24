import { API_BASE } from './constants'

export function formatDisplayName(user) {
  const source = user?.name || user?.username || user?.email || 'Traveler'
  return String(source)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatUsername(user) {
  const source = user?.username || user?.email?.split('@')[0] || 'traveler'
  return `@${String(source).replace(/^@+/, '')}`
}

export function getInitials(user) {
  const words = formatDisplayName(user).split(' ').filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TN'
}

export function buildProfileLink(user) {
  const username = String(user?.username || 'traveler').trim() || 'traveler'
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/profile/${encodeURIComponent(username)}`
  }
  return `http://localhost:5173/profile/${encodeURIComponent(username)}`
}

export function createProfileDraft(user) {
  return {
    name: String(user?.name || formatDisplayName(user) || '').trim(),
    username: String(user?.username || '').trim(),
    email: String(user?.email || '').trim(),
    profileImage: user?.profileImage || '',
    bio: String(user?.bio || '').trim(),
  }
}

export async function fetchPublicTripsByUsernameRequest(username) {
  const clean = String(username || '').trim().replace(/^@/, '')
  if (!clean) throw new Error('Username is required')
  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(clean)}/public-trips`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    if (response.status === 404) {
      throw new Error('User not found')
    }
    throw new Error(data.detail || data.message || 'Failed to load public trips')
  }
  return data
}

export async function fetchPublicTripByIdRequest(tripId) {
  const clean = String(tripId || '').trim()
  if (!clean) throw new Error('Trip ID is required')
  const response = await fetch(`${API_BASE}/api/trips/public/${encodeURIComponent(clean)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    if (response.status === 404) {
      throw new Error('This trip is not publicly available.')
    }
    throw new Error(data.detail || data.message || 'Failed to load public trip')
  }
  return data
}

export async function followUserRequest(token, username) {
  const clean = String(username || '').trim().replace(/^@/, '')
  if (!clean) throw new Error('Username is required')
  if (!token) throw new Error('You must be logged in to follow users')
  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(clean)}/follow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    if (response.status === 404) throw new Error('User not found')
    if (response.status === 400) throw new Error(data.detail || data.error || 'Cannot follow this user')
    throw new Error(data.detail || data.error || data.message || 'Failed to follow user')
  }
  return data
}

export async function unfollowUserRequest(token, username) {
  const clean = String(username || '').trim().replace(/^@/, '')
  if (!clean) throw new Error('Username is required')
  if (!token) throw new Error('You must be logged in to unfollow users')
  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(clean)}/follow`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    if (response.status === 404) throw new Error('User not found')
    throw new Error(data.detail || data.error || data.message || 'Failed to unfollow user')
  }
  return data
}

export async function fetchFollowStatusRequest(username, token = null) {
  const clean = String(username || '').trim().replace(/^@/, '')
  if (!clean) throw new Error('Username is required')
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(clean)}/follow-status`, {
    headers,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    if (response.status === 404) throw new Error('User not found')
    throw new Error(data.detail || data.error || data.message || 'Failed to get follow status')
  }
  return data
}


