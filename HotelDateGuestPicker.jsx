import { useEffect, useRef } from 'react'

export default function HotelDateGuestPicker({
  isOpen,
  onClose,
  adults,
  onAdultsChange,
  rooms,
  onRoomsChange,
}) {
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose()
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="TripNest-HotelsGuestPopover" ref={popoverRef} role="dialog" aria-label="Guests and Rooms Selector">
      {/* Adults Row */}
      <div className="TripNest-HotelsStepperRow">
        <div className="TripNest-HotelsStepperInfo">
          <h4>Adults</h4>
          <p>Ages 18 or above</p>
        </div>
        <div className="TripNest-HotelsStepperControls">
          <button
            type="button"
            className="TripNest-HotelsStepperBtn"
            onClick={() => onAdultsChange(Math.max(1, adults - 1))}
            disabled={adults <= 1}
            aria-label="Decrease adults"
          >
            -
          </button>
          <span className="TripNest-HotelsStepperValue" aria-live="polite">{adults}</span>
          <button
            type="button"
            className="TripNest-HotelsStepperBtn"
            onClick={() => onAdultsChange(Math.min(10, adults + 1))}
            disabled={adults >= 10}
            aria-label="Increase adults"
          >
            +
          </button>
        </div>
      </div>

      {/* Rooms Row */}
      <div className="TripNest-HotelsStepperRow">
        <div className="TripNest-HotelsStepperInfo">
          <h4>Rooms</h4>
          <p>Number of rooms</p>
        </div>
        <div className="TripNest-HotelsStepperControls">
          <button
            type="button"
            className="TripNest-HotelsStepperBtn"
            onClick={() => onRoomsChange(Math.max(1, rooms - 1))}
            disabled={rooms <= 1}
            aria-label="Decrease rooms"
          >
            -
          </button>
          <span className="TripNest-HotelsStepperValue" aria-live="polite">{rooms}</span>
          <button
            type="button"
            className="TripNest-HotelsStepperBtn"
            onClick={() => onRoomsChange(Math.min(5, rooms + 1))}
            disabled={rooms >= 5}
            aria-label="Increase rooms"
          >
            +
          </button>
        </div>
      </div>

      <button type="button" className="TripNest-HotelsPopoverCloseBtn" onClick={onClose}>
        Done
      </button>
    </div>
  )
}

