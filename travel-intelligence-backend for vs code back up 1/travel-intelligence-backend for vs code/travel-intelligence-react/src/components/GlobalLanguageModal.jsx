import { useEffect, useMemo, useState } from 'react'

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8.75 3.5a5.25 5.25 0 1 0 3.39 9.26l3.05 3.05a.75.75 0 1 0 1.06-1.06l-3.05-3.05A5.25 5.25 0 0 0 8.75 3.5Zm0 1.5a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z" fill="currentColor" />
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

export default function GlobalLanguageModal({ open, languages, value, onClose, onSelect }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setQuery('')
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  const filteredLanguages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return languages
    return languages.filter((language) => language.toLowerCase().includes(normalizedQuery))
  }, [languages, query])

  if (!open) return null

  return (
    <div className="TripHubLanguageModal" aria-hidden="false">
      <div className="TripHubLanguageModal__backdrop" onClick={onClose} />

      <div
        className="TripHubLanguageModal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tripnest-language-modal-title"
      >
        <button type="button" className="TripHubModalCard__close" aria-label="Close" onClick={onClose}>×</button>

        <div className="TripHubLanguageModal__header">
          <h2 id="tripnest-language-modal-title">Choose your preferred language</h2>
          <p>Select the language you&apos;d like to use throughout TripNest.</p>
        </div>

        <label className="TripHubLanguageModal__search">
          <span className="TripHubLanguageModal__searchIcon" aria-hidden="true"><SearchIcon /></span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search languages"
            autoFocus
          />
        </label>

        <div className="TripHubLanguageModal__list" role="listbox" aria-label="Available languages">
          {filteredLanguages.length ? (
            filteredLanguages.map((language) => (
              <button
                key={language}
                type="button"
                role="option"
                aria-selected={value === language ? 'true' : 'false'}
                className={`TripHubLanguageModal__option${value === language ? ' is-selected' : ''}`}
                onClick={() => onSelect(language)}
              >
                <span>{language}</span>
                {value === language ? (
                  <span className="TripHubLanguageModal__check" aria-hidden="true"><CheckIcon /></span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="TripHubLanguageModal__empty">No languages found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
