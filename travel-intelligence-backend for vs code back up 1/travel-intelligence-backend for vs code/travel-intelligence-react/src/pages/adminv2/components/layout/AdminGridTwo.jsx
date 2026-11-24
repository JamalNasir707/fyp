/**
 * AdminGridTwo
 * ─────────────
 * Two-column responsive grid wrapper used in Analytics and System pages.
 * Collapses to single column on narrow screens automatically via CSS.
 *
 * Props:
 *   children  {ReactNode}   Required.
 *   gap       {number}      Optional. Gap in pixels. Default 20.
 */
export function AdminGridTwo({ children, gap = 20 }) {
  return (
    <div className="AV2GridTwo" style={{ gap }}>
      {children}
    </div>
  )
}
