/**
 * TripNest Mobile — Native Google Sign-In Service
 * 
 * Configures and executes native Google authentication via @react-native-google-signin/google-signin.
 * Uses the Web Client ID as webClientId so Google issues an ID token verified by the backend.
 */

import { Platform } from 'react-native'

export const GOOGLE_WEB_CLIENT_ID = '936993641755-ah2t0aeg4hnqc0dj7s02pgv0okhq7ril.apps.googleusercontent.com'
export const GOOGLE_ANDROID_CLIENT_ID = '936993641755-tmcle1vo27naa7a81odnt0pet4qv24kapps.googleusercontent.com'

let isConfigured = false
let GoogleSignin = null
let statusCodes = null

try {
  const gModule = require('@react-native-google-signin/google-signin')
  GoogleSignin = gModule.GoogleSignin
  statusCodes = gModule.statusCodes
} catch (e) {
  console.warn('[GoogleAuth] Native GoogleSignin module not available:', e.message)
}

/**
 * Configure Google Sign-In with official Web Client ID
 */
export function configureGoogleSignIn() {
  if (isConfigured || !GoogleSignin) return
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
      scopes: ['profile', 'email'],
    })
    isConfigured = true
    console.log('[GoogleAuth] GoogleSignin configured with webClientId:', GOOGLE_WEB_CLIENT_ID)
  } catch (err) {
    console.warn('[GoogleAuth] Configure failed:', err)
  }
}

/**
 * Check if the native Google Sign-In library is available in current runtime
 */
export function isGoogleSignInAvailable() {
  return Boolean(GoogleSignin && typeof GoogleSignin.signIn === 'function')
}

/**
 * Execute native Google Sign-In flow
 * Returns: { success: true, idToken, accessToken, user } | { cancelled: true } | { error: string }
 */
export async function promptGoogleSignIn() {
  if (!GoogleSignin) {
    return {
      error: 'Native Google Sign-In requires a custom development build (npx expo run:android). It is not available in standard Expo Go.',
    }
  }

  configureGoogleSignIn()

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    }

    // Safely clear any previously selected app-level Google account so that
    // the native account chooser is always presented instead of silently
    // reusing the previous account. This only clears app-level session cache
    // and does NOT remove Google accounts from the device.
    try {
      await GoogleSignin.signOut()
    } catch {
      // Non-fatal if no account was currently active in the app
    }

    const response = await GoogleSignin.signIn()

    // Cancelled response check
    if (response?.type === 'cancelled') {
      return { cancelled: true }
    }

    // Extract ID token (support v13, v14, v17 formats)
    let idToken = response?.data?.idToken || response?.idToken || null
    let user = response?.data?.user || response?.user || null
    let accessToken = null

    try {
      const tokens = await GoogleSignin.getTokens()
      if (tokens) {
        if (!idToken) idToken = tokens.idToken
        accessToken = tokens.accessToken
      }
    } catch {
      // getTokens is optional fallback
    }

    if (!idToken && !accessToken) {
      return { error: 'No authentication tokens received from Google.' }
    }

    return {
      success: true,
      idToken,
      accessToken,
      user,
    }
  } catch (error) {
    if (statusCodes) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { cancelled: true }
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return { error: 'Google sign-in is already in progress.' }
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { error: 'Google Play Services is not available or outdated on this device.' }
      }
    }
    return { error: error.message || 'Google sign-in failed' }
  }
}

/**
 * Sign out from Google Identity
 */
export async function signOutGoogle() {
  if (!GoogleSignin) return
  try {
    await GoogleSignin.signOut()
  } catch {
    // Ignore sign-out errors
  }
}

