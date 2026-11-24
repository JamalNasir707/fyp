/**
 * AdminPanel
 * ──────────
 * Reusable white card panel used throughout every admin module.
 * Replaces the repeated AV2Panel + AV2Panel__header + AV2Panel__body pattern.
 *
 * Props:
 *   title        {string}      Optional. Panel header title.
 *   sub          {string}      Optional. Panel header subtitle.
 *   headerRight  {ReactNode}   Optional. Right-side slot in the header (badge / button).
 *   children     {ReactNode}   Required. Panel body content.
 *   noPadding    {boolean}     Optional. Skip body padding (e.g. for full-width tables). Default false.
 *   style        {object}      Optional. Additional styles on the outer wrapper.
 */
export function AdminPanel({ title, sub, headerRight, children, noPadding = false, style }) {
  const hasHeader = title || sub || headerRight

  return (
    <div className="AV2Panel" style={style}>
      {hasHeader && (
        <div className="AV2Panel__header">
          <div>
            {title && <p className="AV2Panel__title">{title}</p>}
            {sub   && <p className="AV2Panel__sub">{sub}</p>}
          </div>
          {headerRight && (
            <div className="AV2Panel__actions">{headerRight}</div>
          )}
        </div>
      )}
      <div className={noPadding ? undefined : 'AV2Panel__body'}>
        {children}
      </div>
    </div>
  )
}
