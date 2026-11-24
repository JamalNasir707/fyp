/**
 * AdminPageHeader
 * ───────────────
 * Standard page title + subtitle header used at the top of every module page.
 *
 * Props:
 *   title   {string}       Required. Main page title (h1).
 *   sub     {string}       Optional. Subtitle / description line.
 *   actions {ReactNode}    Optional. Right-side action buttons slot.
 *
 * Future integration: No backend dependency. Static UI only.
 */
export function AdminPageHeader({ title, sub, actions }) {
  return (
    <div className="AV2PageHeader" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h1 className="AV2PageHeader__title">{title}</h1>
        {sub && <p className="AV2PageHeader__sub">{sub}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 4 }}>
          {actions}
        </div>
      )}
    </div>
  )
}
