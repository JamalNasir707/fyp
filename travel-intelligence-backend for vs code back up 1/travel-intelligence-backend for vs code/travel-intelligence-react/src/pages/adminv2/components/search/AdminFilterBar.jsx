import { AdminButton } from '../buttons/AdminButton'

/**
 * AdminFilterBar
 * ──────────────
 * Toolbar row combining a search bar with a set of filter dropdown buttons.
 * Used in Users, Trips, and Activity pages.
 *
 * Props:
 *   searchPlaceholder  {string}     Optional. Placeholder for the search input.
 *   filters            {Array}      Optional. Array of filter button labels.
 *                                   e.g. ['All Roles ▾', 'All Statuses ▾', 'Provider ▾']
 *   searchValue        {string}     Optional. Controlled search value.
 *   onSearchChange     {function}   Optional. Search onChange — wire in Phase 1/2.
 *   children           {ReactNode}  Optional. Additional custom filter controls.
 *
 * Future integration:
 *   Replace filter buttons with real <select> dropdowns in Phase 1/2 when API supports filtering.
 */
import { AdminSearchBar } from '../search/AdminSearchBar'

export function AdminFilterBar({
  searchPlaceholder = 'Search…',
  filters = [],
  searchValue,
  onSearchChange,
  children,
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <AdminSearchBar
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={onSearchChange}
      />
      {filters.map((label) => (
        <AdminButton key={label} variant="ghost" disabled>
          {label}
        </AdminButton>
      ))}
      {children}
    </div>
  )
}
