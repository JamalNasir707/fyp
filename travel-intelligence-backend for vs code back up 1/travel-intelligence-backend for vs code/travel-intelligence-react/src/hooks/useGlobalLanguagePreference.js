import { useCallback, useEffect, useState } from 'react'
import {
  readSettingsPreferences,
  subscribeToSettingsPreferences,
  updateSettingsPreference,
} from '../lib/settingsPreferences'

export default function useGlobalLanguagePreference() {
  const [language, setLanguage] = useState(() => readSettingsPreferences().language)

  useEffect(() => (
    subscribeToSettingsPreferences((preferences) => {
      setLanguage(preferences.language)
    })
  ), [])

  const updateLanguage = useCallback((nextLanguage) => {
    const nextPreferences = updateSettingsPreference('language', nextLanguage)
    setLanguage(nextPreferences.language)
  }, [])

  return [language, updateLanguage]
}
