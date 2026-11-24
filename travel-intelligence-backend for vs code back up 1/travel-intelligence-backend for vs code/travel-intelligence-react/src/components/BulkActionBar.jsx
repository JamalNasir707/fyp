export default function BulkActionBar({
  count,
  destinations,
  onMove,
  onCopy,
  onDelete,
  onClear,
}) {
  if (!count) return null

  return (
    <div className="PlannerBulkBar" role="region" aria-label="Bulk actions">
      <div className="PlannerBulkBar__count">{count} item{count === 1 ? '' : 's'} selected</div>
      <div className="PlannerBulkBar__spacer" />
      <select className="PlannerBulkBar__select" defaultValue="" onChange={(event) => { const value = event.target.value; event.target.value = ''; if (value) onMove(value) }}>
        <option value="">Move to</option>
        {destinations.map((dest) => (
          <option key={dest.id} value={dest.id}>{dest.label}</option>
        ))}
      </select>
      <select className="PlannerBulkBar__select" defaultValue="" onChange={(event) => { const value = event.target.value; event.target.value = ''; if (value) onCopy(value) }}>
        <option value="">Copy to</option>
        {destinations.map((dest) => (
          <option key={dest.id} value={dest.id}>{dest.label}</option>
        ))}
      </select>
      <button type="button" className="PlannerBulkBar__danger" onClick={onDelete}>Delete</button>
      <button type="button" className="PlannerBulkBar__clear" onClick={onClear} aria-label="Clear selection">✕</button>
    </div>
  )
}

