export const ICON_CHOICES = [
  { id: '123', label: '123' },
  { id: 'car', label: '🚗' },
  { id: 'food', label: '🍽' },
  { id: 'hotel', label: '🛏' },
  { id: 'map', label: '🗺' },
  { id: 'pin', label: '📍' },
  { id: 'coffee', label: '☕' },
  { id: 'ticket', label: '🎟' },
]

export const DAY_FALLBACK_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#f97316', '#dc2626']

export function getIconLabel(iconId) {
  return ICON_CHOICES.find((entry) => entry.id === iconId)?.label || '123'
}

export function getSectionAppearance(trip, sectionId, options = {}) {
  const fallbackColor = options.fallbackColor || '#3b82f6'
  const fallbackIndex = Number.isFinite(options.fallbackIndex) ? options.fallbackIndex : 0

  if (sectionId === 'pool') {
    const pool = trip?.sectionAppearance?.pool || {}
    return {
      color: pool.color || '#3b82f6',
      icon: pool.icon || '123',
    }
  }

  if (String(sectionId).startsWith('custom:')) {
    const listId = String(sectionId).slice('custom:'.length)
    const list = (trip?.customLists || []).find((entry) => entry.id === listId)
    return {
      color: list?.color || '#10b981',
      icon: list?.icon || '123',
    }
  }

  if (String(sectionId).startsWith('day:')) {
    const dayId = String(sectionId).slice('day:'.length)
    const dayIndex = (trip?.days || []).findIndex((entry) => entry.id === dayId)
    const day = dayIndex >= 0 ? trip.days[dayIndex] : null
    return {
      color: day?.color || DAY_FALLBACK_COLORS[dayIndex >= 0 ? dayIndex % DAY_FALLBACK_COLORS.length : fallbackIndex % DAY_FALLBACK_COLORS.length],
      icon: day?.icon || '123',
    }
  }

  return {
    color: fallbackColor,
    icon: '123',
  }
}

