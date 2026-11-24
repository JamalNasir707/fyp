import { useEffect } from 'react'

/**
 * AdminDrawer
 * ─────────────
 * Slide-in side panel for detailed inspection views.
 * Will be used in Phase 1 for user profile inspection and trip detail inspection.
 *
 * Props:
 *   open      {boolean}    Required. Whether the drawer is open.
 *   title     {string}     Required. Drawer header title.
 *   onClose   {function}   Required. Called when drawer should close.
 *   children  {ReactNode}  Required. Drawer body content.
 *   width     {number}     Optional. Width in pixels. Default 480.
 *
 * Future integration:
 *   Phase 1: User profile inspection panel.
 *   Phase 2: Trip itinerary inspection panel.
 */
export function AdminDrawer({ open, title, onClose, children, width = 480 }) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 100,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
        }}
      />

      {/* Drawer panel */}
      <aside
        role="complementary"
        aria-label={title}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          maxWidth: '100vw',
          background: '#ffffff',
          boxShadow: '-4px 0 32px rgba(0,0,0,.14)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : `translateX(${width}px)`,
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              color: '#6b7280',
              fontSize: 13,
              fontFamily: 'inherit',
              transition: 'background 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          {children}
        </div>
      </aside>
    </>
  )
}
