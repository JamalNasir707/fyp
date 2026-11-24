export function isSpecialItem(item) {
  return item?.type === 'note' || item?.type === 'checklist'
}

export function getPlaceLatLon(place) {
  const lat = Number(place?.lat)
  const lon = Number(place?.lon)
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon }
  }
  const baseLat = 33.6844
  const baseLon = 73.0479
  const x = Number.isFinite(place?.x) ? Number(place.x) : 50
  const y = Number.isFinite(place?.y) ? Number(place.y) : 50
  return {
    lat: baseLat + ((50 - y) / 100) * 0.12,
    lon: baseLon + ((x - 50) / 100) * 0.12,
  }
}

export function getTripPlaceCollections(trip) {
  const poolPlaces = (trip?.placesPool || []).filter((item) => !isSpecialItem(item))
  const dayPlaces = (trip?.days || []).map((day, dayIndex) => {
    const items = (day.items || []).filter((item) => !isSpecialItem(item))
    return {
      dayId: day.id,
      dayIndex,
      day,
      items,
    }
  })
  return { poolPlaces, dayPlaces }
}

export function getAllTripPlaces(trip) {
  const { poolPlaces, dayPlaces } = getTripPlaceCollections(trip)
  return [...poolPlaces, ...dayPlaces.flatMap((entry) => entry.items)]
}

export function findTripPlaceById(trip, placeId) {
  return getAllTripPlaces(trip).find((item) => String(item.id) === String(placeId)) || null
}

export function buildSearchPlace(result) {
  return {
    id: `search-${result.place_id || Date.now()}`,
    title: (result.display_name || '').split(',')[0] || 'Search result',
    subtitle: result.display_name || '',
    note: result.display_name || '',
    category: 'search',
    lat: Number(result.lat),
    lon: Number(result.lon),
    type: 'place',
  }
}

export function buildRouteSignature(days, visibleDayIds) {
  return days
    .filter((day) => visibleDayIds.has(day.dayId))
    .map((day) => `${day.dayId}:${day.items.map((item) => `${item.id}:${getPlaceLatLon(item).lat.toFixed(5)},${getPlaceLatLon(item).lon.toFixed(5)}`).join('|')}`)
    .join('||')
}
