/**
 * AdminDataTable
 * ──────────────
 * Reusable table component used in Users, Trips, and Activity pages.
 * Eliminates the repeated <table className="AV2Table"> pattern.
 *
 * Props:
 *   columns   {string[]}    Required. Array of column header labels.
 *   rows      {Array}       Optional. Array of row data objects. If empty, shows EmptyState.
 *   renderRow {function}    Required. (row, index) => <tr>…</tr>  — caller owns row rendering.
 *   emptyTitle {string}     Optional. Title shown when rows is empty.
 *   emptyText  {string}     Optional. Description shown when rows is empty.
 *   loading    {boolean}    Optional. Show loading skeleton instead of rows. Default false.
 *
 * Architecture note:
 *   renderRow is intentionally caller-owned so each page can render
 *   action buttons (Suspend/View/Delete) appropriate to its permission level.
 *   The component makes no assumptions about what actions are available.
 *
 * Future integration:
 *   Phase 1/2: Pass `rows` from API response. `loading` from fetch state.
 */
import { AdminEmptyState }       from '../common/AdminEmptyState'
import { AdminLoadingSkeleton }  from '../common/AdminLoadingSkeleton'

export function AdminDataTable({
  columns,
  rows = [],
  renderRow,
  emptyTitle = 'No records found',
  emptyText  = 'No data is available yet.',
  loading    = false,
}) {
  if (loading) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="AV2Table">
          <thead>
            <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c}>
                    <AdminLoadingSkeleton height={16} width="80%" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (rows.length === 0) {
    return <AdminEmptyState title={emptyTitle} sub={emptyText} />
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="AV2Table">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => renderRow(row, i))}
        </tbody>
      </table>
    </div>
  )
}
