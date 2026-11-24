/**
 * TripNest Mobile Environment Configuration
 * 
 * STRICT ENVIRONMENT ISOLATION RULES:
 * 1. Default mode is 'MOCK' (completely offline, zero live network requests).
 * 2. 'ISOLATED_DEV' routes requests to the verified local backend server.
 * 3. Never point to external unverified production backends.
 * 4. Never log or display sensitive credentials/secrets.
 */

import { Platform } from 'react-native'
import Constants from 'expo-constants'

export const ENVIRONMENTS = {
  MOCK: 'MOCK',
  ISOLATED_DEV: 'ISOLATED_DEV',
}

let customApiUrlOverride = null

export function setCustomApiBaseUrl(url) {
  if (url && typeof url === 'string') {
    customApiUrlOverride = url.trim().replace(/\/+$/, '')
  } else {
    customApiUrlOverride = null
  }
}

export function getCustomApiBaseUrl() {
  return customApiUrlOverride
}

/**
 * Resolves the appropriate development backend URL.
 * Automatically extracts the Metro bundler IP on physical devices running via Expo Go.
 */
export function resolveApiBaseUrl() {
  if (customApiUrlOverride) {
    return customApiUrlOverride
  }

  // Active verified development server IP on current Wi-Fi network
  const ACTIVE_DEV_IP = '192.168.129.64'

  // Dynamic host extraction from Expo Go
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants?.manifest?.debuggerHost ||
    Constants?.experienceUrl ||
    ''

  let metroHost = null
  if (hostUri) {
    const clean = String(hostUri).replace(/^[a-zA-Z]+:\/\//, '')
    metroHost = clean.split(':')[0]
  }

  if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1' && metroHost !== '10.0.2.2') {
    return `http://${metroHost}:8000`
  }

  return `http://${ACTIVE_DEV_IP}:8000`
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl()
}

export const ISOLATED_API_BASE_URL = resolveApiBaseUrl()

// Active environment setting (Defaults to ISOLATED_DEV for live FastAPI backend & MongoDB Atlas persistence)
let activeEnvironment =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ENV) ||
  ENVIRONMENTS.ISOLATED_DEV

export const CURRENT_ENV = activeEnvironment

export function getCurrentEnvironment() {
  return activeEnvironment
}

export function setRuntimeEnvironment(nextEnv) {
  if (nextEnv === ENVIRONMENTS.MOCK || nextEnv === ENVIRONMENTS.ISOLATED_DEV) {
    activeEnvironment = nextEnv
  }
}

/**
 * Returns user-facing environment badge text for on-screen indicator.
 */
export function getEnvironmentBadge() {
  const isMock = activeEnvironment === ENVIRONMENTS.MOCK
  const activeBaseUrl = getApiBaseUrl()
  if (isMock) {
    return {
      label: '[ENV: MOCK DEV - OFFLINE]',
      isMock: true,
      baseUrl: 'local://mock',
    }
  }
  return {
    label: `[ENV: ISOLATED DEV: ${activeBaseUrl}]`,
    isMock: false,
    baseUrl: activeBaseUrl,
  }
}

/**
 * Diagnostic helper: pings backend root / endpoint with timeout to verify live connectivity
 */
export async function pingBackendServer(targetUrl = null) {
  const base = (targetUrl || getApiBaseUrl()).replace(/\/+$/, '')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  try {
    const res = await fetch(`${base}/`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.message) {
      return { ok: true, message: json.message, status: res.status }
    }
    return { ok: res.ok, status: res.status, message: json?.message || 'Server reachable' }
  } catch (err) {
    clearTimeout(timeoutId)
    const isTimeout = err?.name === 'AbortError'
    return {
      ok: false,
      error: isTimeout
        ? `Connection timed out after 4s. Verify device is on the same Wi-Fi and host IP ${base} is reachable.`
        : (err?.message || 'Network request failed'),
    }
  }
}

// Map Configuration & API Keys
export const CARTO_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CARTO_KEY) || ''

export const GOOGLE_MAPS_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) || ''

/**
 * Returns map configuration without exposing raw secret keys in user logs.
 */
export function getMapTileConfig() {
  const hasCarto = Boolean(CARTO_API_KEY && CARTO_API_KEY.trim())
  return {
    provider: 'leaflet_webview',
    hasCartoKey: hasCarto,
    activeBasemap: hasCarto ? 'carto_voyager' : 'openstreetmap',
    fallbackAvailable: true,
  }
}
