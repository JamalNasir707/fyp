/**
 * Profile utilities for TripNest Mobile
 * Mirroring travel-intelligence-react/src/lib/profile.js
 */

export function formatDisplayName(user) {
  if (!user) return 'Traveler'
  const source = user.name || user.displayName || user.username || user.email || 'Traveler'
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
  if (!user) return '@traveler'
  const source = user.username || user.email?.split('@')[0] || 'traveler'
  return `@${String(source).replace(/^@+/, '')}`
}

export function getInitials(user) {
  if (!user) return 'TN'
  const words = formatDisplayName(user).split(' ').filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TN'
}

export const AVAILABLE_TRAVEL_INTERESTS = [
  'Mountain Trekking',
  'Historical Heritage',
  'Scenic Photography',
  'Alpine Lakes',
  'Food & Street Food',
  'Cultural Bazaars',
  'Road Trips',
  'Nature & Wildlife',
  'Camping & Stargazing',
  'Architecture & Mosques',
]

export const TRAVEL_STYLE_OPTIONS = [
  { key: 'Relaxed', label: 'Relaxed (Leisure)', icon: 'cafe-outline' },
  { key: 'Balanced', label: 'Balanced Explorer', icon: 'compass-outline' },
  { key: 'Fast-Paced', label: 'Action & Packed', icon: 'flash-outline' },
]

export const BUDGET_TIER_OPTIONS = [
  { key: 'Budget', label: 'Backpacker / Value' },
  { key: 'Standard', label: 'Standard Comfort' },
  { key: 'Luxury', label: 'Premium / Luxury' },
]

export function buildProfileLink(user) {
  const username = String(user?.username || 'traveler').trim().replace(/^@/, '') || 'traveler'
  return `https://tripnest.app/profile/${encodeURIComponent(username)}`
}

export function createProfileDraft(user) {
  return {
    name: String(user?.name || user?.displayName || formatDisplayName(user) || '').trim(),
    username: String(user?.username || '').trim().replace(/^@/, ''),
    email: String(user?.email || '').trim(),
    profileImage: user?.profileImage || '',
    bio: String(user?.bio || '').trim(),
    travelInterests: Array.isArray(user?.travelInterests) ? user.travelInterests : [],
    travelStyle: user?.travelStyle || '',
    budgetTier: user?.budgetTier || '',
    homeCity: user?.homeCity || '',
  }
}

export function getTravelerMetaKey(userId) {
  if (userId) return `tripnest_traveler_meta_${String(userId).toLowerCase().trim()}`
  return 'tripnest_traveler_meta_guest'
}

