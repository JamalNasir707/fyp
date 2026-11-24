/**
 * AdminCard
 * ─────────
 * A simple card container with consistent border, background, and padding.
 * Differs from AdminPanel in that it is lightweight and doesn't require header structures.
 *
 * Props:
 *   children  {ReactNode}   Required.
 *   style     {object}      Optional. Custom styles.
 *   onClick   {function}    Optional. Click handler.
 */
export function AdminCard({ children, style, onClick }) {
  const isClickable = typeof onClick === 'function'

  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '16px',
        boxSizing: 'border-box',
        cursor: isClickable ? 'pointer' : 'default',
        transition: isClickable ? 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease' : 'none',
        ...style,
      }}
      onMouseEnter={isClickable ? e => {
        e.currentTarget.style.background = '#fff1eb'
        e.currentTarget.style.borderColor = '#ffd3c2'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(242,94,37,.12)'
      } : undefined}
      onMouseLeave={isClickable ? e => {
        e.currentTarget.style.background = '#ffffff'
        e.currentTarget.style.borderColor = '#e5e7eb'
        e.currentTarget.style.boxShadow = 'none'
      } : undefined}
    >
      {children}
    </div>
  )
}
