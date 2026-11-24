import { useEffect, useId, useMemo, useRef, useState } from 'react'

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.25a8.75 8.75 0 1 0 0 17.5 8.75 8.75 0 0 0 0-17.5Zm5.88 7.75h-2.4a13.57 13.57 0 0 0-1.1-4.26A7.29 7.29 0 0 1 17.88 11Zm-5.13-5.2c.6.78 1.28 2.69 1.53 5.2h-4.56c.25-2.51.93-4.42 1.53-5.2.24-.3.47-.43.75-.43s.51.13.75.43ZM9.62 6.74A13.57 13.57 0 0 0 8.52 11h-2.4a7.29 7.29 0 0 1 3.5-4.26ZM5.58 12.5h2.79c.06 1.53.28 2.99.65 4.27a13.46 13.46 0 0 0-1.47.76A7.25 7.25 0 0 1 5.58 12.5Zm6.42 6c-.28 0-.51-.13-.75-.43-.6-.78-1.28-2.69-1.53-5.2h4.56c-.25 2.51-.93 4.42-1.53 5.2-.24.3-.47.43-.75.43Zm2.36-.57c.59-1.27 1-2.73 1.06-4.18h2.79a7.25 7.25 0 0 1-1.97 5.03c-.46-.28-.95-.54-1.88-.85Z" fill="currentColor" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5.47 7.97 4.53 4.53 4.53-4.53a.75.75 0 1 1 1.06 1.06l-5.06 5.06a.75.75 0 0 1-1.06 0L4.41 9.03a.75.75 0 1 1 1.06-1.06Z" fill="currentColor" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M16.16 5.47a.75.75 0 0 1 .06 1.06l-7 7.83a.75.75 0 0 1-1.09.03L3.78 10.1a.75.75 0 1 1 1.06-1.06l3.79 3.79 6.47-7.24a.75.75 0 0 1 1.06-.06Z" fill="currentColor" />
    </svg>
  )
}

export default function SettingsLanguageDropdown({ label, helperText, options, value, onChange }) {
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const [open, setOpen] = useState(false)
  const selectedIndex = useMemo(() => Math.max(options.indexOf(value), 0), [options, value])
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex)
  const listboxId = useId()

  useEffect(() => {
    setHighlightedIndex(selectedIndex)
  }, [selectedIndex])

  useEffect(() => {
    function handlePointerDown(event) {
      const root = dropdownRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const target = optionRefs.current[highlightedIndex]
    if (target) {
      target.focus()
      target.scrollIntoView({ block: 'nearest' })
    }
  }, [open, highlightedIndex])

  function commitSelection(nextValue) {
    onChange(nextValue)
    setOpen(false)
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }

  function handleTriggerKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setHighlightedIndex(event.key === 'ArrowDown' ? selectedIndex : Math.max(selectedIndex, 0))
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((prev) => !prev)
    }
  }

  function handleListKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % options.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setHighlightedIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setHighlightedIndex(options.length - 1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      commitSelection(options[highlightedIndex])
    }
  }

  return (
    <div className="TripHubSettingsSectionBlock">
      <div className="TripHubSettingsSectionBlock__heading">
        <h2>{label}</h2>
        <span className="TripHubSettingsSectionBlock__icon" aria-hidden="true"><GlobeIcon /></span>
      </div>
      {helperText ? <p className="TripHubSettingsSectionBlock__helper">{helperText}</p> : null}

      <div ref={dropdownRef} className={`TripHubSettingsDropdown${open ? ' is-open' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className="TripHubSettingsDropdown__trigger"
          aria-haspopup="listbox"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={listboxId}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="TripHubSettingsDropdown__labelWrap">
            <small>Change language</small>
            <strong>{value}</strong>
          </span>
          <span className="TripHubSettingsDropdown__chevron" aria-hidden="true"><ChevronIcon /></span>
        </button>

        <div className="TripHubSettingsDropdown__menu" role="presentation">
          <ul
            id={listboxId}
            className="TripHubSettingsDropdown__list"
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
          >
            {options.map((option, index) => (
              <li key={option} role="presentation">
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node
                  }}
                  type="button"
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={value === option ? 'true' : 'false'}
                  className={`TripHubSettingsDropdown__option${value === option ? ' is-selected' : ''}${highlightedIndex === index ? ' is-highlighted' : ''}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commitSelection(option)}
                >
                  <span>{option}</span>
                  {value === option ? (
                    <span className="TripHubSettingsDropdown__check" aria-hidden="true"><CheckIcon /></span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
