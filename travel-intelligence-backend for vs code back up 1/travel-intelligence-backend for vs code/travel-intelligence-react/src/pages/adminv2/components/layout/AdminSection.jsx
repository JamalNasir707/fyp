/**
 * AdminSection
 * ────────────
 * Semantic wrapper that adds consistent vertical spacing between
 * groups of content within a module page.
 *
 * Props:
 *   children  {ReactNode}   Required.
 *   gap       {number}      Optional. Pixel gap between children. Default 20.
 */
export function AdminSection({ children, gap = 20 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {children}
    </div>
  )
}
