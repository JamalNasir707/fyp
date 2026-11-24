import { AdminButton } from '../buttons/AdminButton'

/**
 * AdminPagination
 * ───────────────
 * Prev / Next pagination control for all table pages.
 *
 * Props:
 *   page        {number}     Optional. Current page (1-indexed). Default 1.
 *   totalPages  {number}     Optional. Total number of pages. Default 1.
 *   onPrev      {function}   Optional. Called on Prev click.
 *   onNext      {function}   Optional. Called on Next click.
 *
 * Phase 0.5 behaviour:
 *   All props default to disabled state — no navigation wired yet.
 *
 * Future integration:
 *   Phase 1: Pass page state managed by parent + API page param.
 */
export function AdminPagination({ page = 1, totalPages = 1, onPrev, onNext }) {
  const canPrev = page > 1 && typeof onPrev === 'function'
  const canNext = page < totalPages && typeof onNext === 'function'

  return (
    <div
      style={{
        padding: '12px 20px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
      }}
    >
      {totalPages > 1 && (
        <span style={{ flex: 1, fontSize: 12, color: '#9ca3af' }}>
          Page {page} of {totalPages}
        </span>
      )}
      <AdminButton disabled={!canPrev} onClick={onPrev} variant="ghost" size="sm">
        ← Prev
      </AdminButton>
      <AdminButton disabled={!canNext} onClick={onNext} variant="ghost" size="sm">
        Next →
      </AdminButton>
    </div>
  )
}
