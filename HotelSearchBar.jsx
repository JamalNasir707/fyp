import { useState } from 'react'
import HotelDateGuestPicker from './HotelDateGuestPicker'

function LocationPinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function formatDateString(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return formatDateString(d)
}

export default function HotelSearchBar({ onSearch, prefillDestination = '' }) {
  const today = formatDateString(new Date())
  const tomorrow = addDays(today, 1)
  const defaultCheckOut = addDays(today, 3)

  const [destination, setDestination] = useState(prefillDestination)
  const [checkIn, setCheckIn] = useState(tomorrow)
  const [checkOut, setCheckOut] = useState(defaultCheckOut)
  const [adults, setAdults] = useState(2)
  const [rooms, setRooms] = useState(1)
  const [guestPickerOpen, setGuestPickerOpen] = useState(false)
  const [validationError, setValidationError] = useState('')

  // Handle Check-In change with automatic Check-Out shift
  function handleCheckInChange(newCheckIn) {
    setCheckIn(newCheckIn)
    setValidationError('')
    if (newCheckIn >= checkOut) {
      setCheckOut(addDays(newCheckIn, 1))
    }
  }

  // Handle Check-Out change
  function handleCheckOutChange(newCheckOut) {
    setCheckOut(newCheckOut)
    setValidationError('')
  }

  function calculateNights() {
    if (!checkIn || !checkOut) return 1
    const diff = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)
    return Math.max(1, Math.round(diff))
  }

  function handleSubmit(e) {
    e.preventDefault()

    const trimmedDestination = destination.trim()
    if (!trimmedDestination) {
      setValidationError('Please enter a destination or city to search hotels.')
      return
    }

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setValidationError('Check-out date must be after check-in date.')
      return
    }

    setValidationError('')
    const nights = calculateNights()

    if (typeof onSearch === 'function') {
      onSearch({
        destination: trimmedDestination,
        checkIn,
        checkOut,
        nights,
        adults,
        rooms,
      })
    }
  }

  return (
    <div className="TripNest-HotelsSearchCard">
      <form onSubmit={handleSubmit} noValidate>
        <div className="TripNest-HotelsSearchGrid">
          {/* 1. Destination Field */}
          <div className={`TripNest-HotelsField${validationError && !destination.trim() ? ' TripNest-HotelsField--hasError' : ''}`}>
            <label className="TripNest-HotelsFieldLabel" htmlFor="hotel-destination-input">
              <span className="TripNest-HotelsFieldIcon"><LocationPinIcon /></span>
              Destination
            </label>
            <input
              id="hotel-destination-input"
              type="text"
              className="TripNest-HotelsInput"
              placeholder="Where do you want to stay?"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value)
                if (validationError) setValidationError('')
              }}
              autoComplete="off"
            />
          </div>

          {/* 2. Check-In Date Field */}
          <div className="TripNest-HotelsField">
            <label className="TripNest-HotelsFieldLabel" htmlFor="hotel-checkin-input">
              <span className="TripNest-HotelsFieldIcon"><CalendarIcon /></span>
              Check-in
            </label>
            <input
              id="hotel-checkin-input"
              type="date"
              className="TripNest-HotelsDateInput"
              min={today}
              value={checkIn}
              onChange={(e) => handleCheckInChange(e.target.value)}
            />
          </div>

          {/* 3. Check-Out Date Field */}
          <div className="TripNest-HotelsField">
            <label className="TripNest-HotelsFieldLabel" htmlFor="hotel-checkout-input">
              <span className="TripNest-HotelsFieldIcon"><CalendarIcon /></span>
              Check-out
            </label>
            <input
              id="hotel-checkout-input"
              type="date"
              className="TripNest-HotelsDateInput"
              min={addDays(checkIn || today, 1)}
              value={checkOut}
              onChange={(e) => handleCheckOutChange(e.target.value)}
            />
          </div>

          {/* 4. Guests & Rooms Field with Popover */}
          <div className="TripNest-HotelsField">
            <span className="TripNest-HotelsFieldLabel">
              <span className="TripNest-HotelsFieldIcon"><UserIcon /></span>
              Guests & Rooms
            </span>
            <button
              type="button"
              className="TripNest-HotelsGuestTrigger"
              onClick={() => setGuestPickerOpen((prev) => !prev)}
              aria-expanded={guestPickerOpen}
              aria-haspopup="dialog"
            >
              <div className="TripNest-HotelsGuestDisplay">
                {adults} adult{adults > 1 ? 's' : ''}, {rooms} room{rooms > 1 ? 's' : ''}
              </div>
            </button>

            <HotelDateGuestPicker
              isOpen={guestPickerOpen}
              onClose={() => setGuestPickerOpen(false)}
              adults={adults}
              onAdultsChange={setAdults}
              rooms={rooms}
              onRoomsChange={setRooms}
            />
          </div>

          {/* 5. Submit Button */}
          <button type="submit" className="TripNest-HotelsSubmitButton">
            <SearchIcon />
            <span>Search Hotels</span>
          </button>
        </div>

        {/* Validation Notice */}
        {validationError && (
          <div className="TripNest-HotelsErrorNotice" role="alert">
            <span>⚠️</span>
            <span>{validationError}</span>
          </div>
        )}
      </form>
    </div>
  )
}

