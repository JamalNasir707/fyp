/**
 * AdminEmptyState
 * ───────────────
 * Displayed in tables / panels when there are no records.
 *
 * Props:
 *   title  {string}      Required. "No users found" etc.
 *   sub    {string}      Optional. More detail.
 *   icon   {ReactNode}   Optional. Custom SVG icon.
 *   action {ReactNode}   Optional. Action button (e.g. "Add first item").
 */
export function AdminEmptyState({ title, sub, icon, action }) {
  return (
    <div className="AV2Placeholder" style={{ padding: '48px 24px' }}>
      {icon && <div className="AV2Placeholder__icon">{icon}</div>}
      <h3 className="AV2Placeholder__title" style={{ fontSize: 15 }}>{title}</h3>
      {sub && <p className="AV2Placeholder__sub">{sub}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  )
}
