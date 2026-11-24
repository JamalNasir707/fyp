import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlobalLanguageModal from '../components/GlobalLanguageModal'
import TripHubHeader from '../components/TripHubHeader'
import TripHubSavedTripsGrid from '../components/TripHubSavedTripsGrid'
import { useApp } from '../context/AppContext'
import useGlobalLanguagePreference from '../hooks/useGlobalLanguagePreference'
import { LANGUAGE_OPTIONS } from '../lib/settingsPreferences'

export default function HomePage() {
  const navigate = useNavigate()
  const { savedTrips, removeTrip, openSavedTrip } = useApp()
  const [language, setLanguage] = useGlobalLanguagePreference()
  const [languageModalOpen, setLanguageModalOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return undefined
    const timeoutId = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function openTrip(tripId, tripObj) {
    const record = tripObj || savedTrips.find((entry) => String(entry.id || entry.tripId) === String(tripId))
    if (record) openSavedTrip(tripId)
    navigate('/workspace')
  }

  function handleLanguageSelect(nextLanguage) {
    setLanguage(nextLanguage)
    setLanguageModalOpen(false)
    setToast('Language updated successfully.')
  }

  return (
    <div className="TripHubPage">
      <TripHubHeader activePage="home" onLanguageClick={() => setLanguageModalOpen(true)} />
      <main className="TripHubMain">
        <section className="TripHubHero">
          <div><h1>Recently viewed and upcoming</h1><p className="TripHubHero__sub">Your saved trips and plans in one place.</p></div>
          <button type="button" className="TripHubCtaButton" onClick={() => navigate('/plan-trip')}>+ Plan new trip</button>
        </section>
        <section className="TripHubTrips">
          <TripHubSavedTripsGrid
            savedTrips={savedTrips}
            onOpenTrip={openTrip}
            onDeleteTrip={removeTrip}
            emptyActionLabel="+ Plan new trip"
            onEmptyAction={() => navigate('/plan-trip')}
          />
        </section>
      </main>

      <GlobalLanguageModal
        open={languageModalOpen}
        languages={LANGUAGE_OPTIONS}
        value={language}
        onClose={() => setLanguageModalOpen(false)}
        onSelect={handleLanguageSelect}
      />

      <div className={`TripHubLanguageToast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
