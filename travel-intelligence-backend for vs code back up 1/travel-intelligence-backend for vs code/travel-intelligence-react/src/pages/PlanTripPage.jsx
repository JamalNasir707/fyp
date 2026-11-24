import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { buildNewTripPayload } from '../lib/trips'

export default function PlanTripPage() {
  const navigate = useNavigate()
  const { createTrip } = useApp()
  const [tripName, setTripName] = useState('')
  const [province, setProvince] = useState('Punjab')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const today = new Date()
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  async function handleStartPlanning(event) {
    event.preventDefault()
    const normalizedTripName = tripName.trim()

    if (!normalizedTripName) {
      setHint('Destination or location cannot be empty.')
      return
    }
    if (!startDate || !endDate) {
      setHint('Please choose start and end dates.')
      return
    }
    if (startDate < minDate || endDate < minDate) {
      setHint('Past dates are not allowed.')
      return
    }
    if (endDate < startDate) {
      setHint('End date must be on or after start date.')
      return
    }

    const payload = buildNewTripPayload({ tripName: normalizedTripName, province, startDate, endDate })
    if (!payload) {
      setHint('End date must be on or after start date.')
      return
    }
    setBusy(true)
    try {
      await createTrip(payload)
      navigate('/workspace')
    } catch (error) {
      setHint(error.message || 'Could not create trip right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="TripHubTopbar TripHubTopbar--compact">
        <button type="button" className="TripHubTopbar__brand reset-btn" onClick={() => navigate('/home')}>TripNest</button>
        <button type="button" className="TripHubBackLink reset-btn" onClick={() => navigate('/home')}>Back to home</button>
      </header>
      <main className="PlanTripPage">
        <div className="PlanTripPage__shell">
          <section className="PlanTripCard" aria-labelledby="plan-trip-title">
            <div className="PlanTripCard__header">
              <h1 id="plan-trip-title" className="PlanTripCard__title">Plan a new trip</h1>
              <p className="PlanTripCard__subtitle">Your journey begins here.</p>
            </div>

            <form className="PlanTripForm" onSubmit={handleStartPlanning} noValidate>
              <div className="PlanTripField">
                <label htmlFor="plan-trip-destination">Where to?</label>
                <input
                  id="plan-trip-destination"
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g. Islamabad, Hunza, Karachi"
                />
              </div>

              <p className="PlanTripCard__note">Preferences like budget and time can still be adjusted later in the workspace.</p>

              <div className="PlanTripDateGrid">
                <div className="PlanTripField">
                  <label htmlFor="plan-trip-start-date">Start date</label>
                  <input
                    id="plan-trip-start-date"
                    type="date"
                    min={minDate}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="PlanTripField">
                  <label htmlFor="plan-trip-end-date">End date</label>
                  <input
                    id="plan-trip-end-date"
                    type="date"
                    min={startDate || minDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <button className="PlanTripSubmit" type="submit" disabled={busy}>{busy ? 'Creating trip...' : 'Start Planning'}</button>
              {hint ? <p className="PlanTripHint" role="alert">{hint}</p> : null}
            </form>
          </section>
        </div>
      </main>
    </>
  )
}
