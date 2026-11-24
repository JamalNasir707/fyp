/**
 * AdminSearchBar
 * ──────────────
 * Consistent search input used in Users, Trips, and Activity pages.
 * Currently renders as a static display element (no onChange wired).
 *
 * Props:
 *   placeholder  {string}     Optional. Placeholder text. Default 'Search…'
 *   value        {string}     Optional. Controlled value.
 *   onChange     {function}   Optional. onChange handler — wire in Phase 1/2.
 *   style        {object}     Optional. Additional styles.
 *
 * Future integration:
 *   Phase 1: wire onChange → API call with debounce for user search.
 *   Phase 2: wire onChange → trip search endpoint.
 */
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="currentColor">
      <path d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" />
    </svg>
  )
}

export function AdminSearchBar({ placeholder = 'Search…', value, onChange, style }) {
  return (
    <div className="AV2Search" style={{ flex: 1, minWidth: 200, ...style }}>
      <SearchIcon />
      {onChange ? (
        <input
          type="search"
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            color: '#6b7280',
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        // Phase 0.5 — static placeholder display only
        <span style={{ color: '#9ca3af' }}>{placeholder}</span>
      )}
    </div>
  )
}
