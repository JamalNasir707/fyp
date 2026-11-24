import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/constants'

export function isPlaceWithValidCoords(place) {
  if (!place || typeof place !== 'object') return false
  if (place.type === 'note' || place.type === 'checklist') return false

  const lat = Number(place.lat)
  const lon = Number(place.lon)

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  )
}

export function useWeather(place) {
  const [state, setState] = useState({
    weather: null,
    loading: false,
    error: false,
  })

  const isValid = isPlaceWithValidCoords(place)
  const lat = isValid ? Number(place.lat) : null
  const lon = isValid ? Number(place.lon) : null

  useEffect(() => {
    if (!isValid || lat === null || lon === null) {
      setState({ weather: null, loading: false, error: false })
      return undefined
    }

    let isMounted = true
    const controller = new AbortController()

    setState({ weather: null, loading: true, error: false })

    const url = `${API_BASE}/weather?lat=${lat}&lon=${lon}&units=metric`

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Weather fetch failed: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setState({ weather: data, loading: false, error: false })
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (isMounted) {
          setState({ weather: null, loading: false, error: true })
        }
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isValid, lat, lon])

  return state
}
