export const SETTINGS_PREFERENCES_KEY = 'tripnestUserPreferences'
export const SETTINGS_PREFERENCES_UPDATED_EVENT = 'tripnest:settings-preferences-updated'

export const LANGUAGE_OPTIONS = [
  'English',
  'Urdu',
  'Arabic',
  'French',
  'Spanish',
  'German',
  'Italian',
  'Turkish',
  'Chinese',
  'Japanese',
  'Hindi',
  'Malay',
  'Indonesian',
  'Russian',
  'Portuguese',
  'Korean',
]

export const DEFAULT_SETTINGS_PREFERENCES = {
  language: 'English',
  dateFormat: 'month-day',
  distanceFormat: 'kilometers',
  timeFormat: '12-hour',
  placeDescriptions: 'show-below-custom-notes',
  expertTravelTips: 'enabled',
  photoUpload: 'wifi-only',
  disableEmailNotifications: false,
  disablePushNotifications: false,
  emailNotifications: {
    tripInvitations: true,
    tripUpdates: true,
    sharedItineraryChanges: true,
    tripReminders: true,
    accountSecurity: true,
    productUpdates: true,
    newsAndAnnouncements: true,
  },
  pushNotifications: {
    tripInvitations: true,
    tripUpdates: true,
    sharedItineraryUpdates: true,
    tripReminders: true,
    collaborationActivity: true,
    productAnnouncements: true,
  },
}

function normalizeSettingsPreferences(preferences) {
  const safePreferences = preferences && typeof preferences === 'object' ? preferences : {}

  return {
    ...DEFAULT_SETTINGS_PREFERENCES,
    ...safePreferences,
    emailNotifications: {
      ...DEFAULT_SETTINGS_PREFERENCES.emailNotifications,
      ...(safePreferences.emailNotifications && typeof safePreferences.emailNotifications === 'object' ? safePreferences.emailNotifications : {}),
    },
    pushNotifications: {
      ...DEFAULT_SETTINGS_PREFERENCES.pushNotifications,
      ...(safePreferences.pushNotifications && typeof safePreferences.pushNotifications === 'object' ? safePreferences.pushNotifications : {}),
    },
  }
}

export function readSettingsPreferences() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS_PREFERENCES }
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_PREFERENCES_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS_PREFERENCES }
    const parsed = JSON.parse(raw)
    return normalizeSettingsPreferences(parsed)
  } catch {
    return { ...DEFAULT_SETTINGS_PREFERENCES }
  }
}

export function writeSettingsPreferences(preferences) {
  if (typeof window === 'undefined') return
  const normalizedPreferences = normalizeSettingsPreferences(preferences)
  window.localStorage.setItem(SETTINGS_PREFERENCES_KEY, JSON.stringify(normalizedPreferences))
  window.dispatchEvent(new CustomEvent(SETTINGS_PREFERENCES_UPDATED_EVENT, { detail: normalizedPreferences }))
}

export function updateSettingsPreference(key, value) {
  const currentPreferences = readSettingsPreferences()
  const nextPreferences = {
    ...currentPreferences,
    [key]: value,
  }

  writeSettingsPreferences(nextPreferences)
  return nextPreferences
}

export function subscribeToSettingsPreferences(listener) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  function handlePreferencesChange() {
    listener(readSettingsPreferences())
  }

  function handleStorage(event) {
    if (event.key && event.key !== SETTINGS_PREFERENCES_KEY) return
    handlePreferencesChange()
  }

  window.addEventListener(SETTINGS_PREFERENCES_UPDATED_EVENT, handlePreferencesChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(SETTINGS_PREFERENCES_UPDATED_EVENT, handlePreferencesChange)
    window.removeEventListener('storage', handleStorage)
  }
}
