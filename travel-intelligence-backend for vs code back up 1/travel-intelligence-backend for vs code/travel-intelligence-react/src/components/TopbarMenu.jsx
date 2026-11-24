import { useEffect, useRef, useState } from 'react'

export default function TopbarMenu({ items = [] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuRef = useRef(null)

  // #region debug-point A:init
  const __dbgUrl = 'http://127.0.0.1:7779/event'
  const __dbgSession = 'topbar-menu-clip'
  const __dbgRun = 'pre-fix'
  const __dbg = (hypothesisId, msg, data) => {
    fetch(__dbgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: __dbgSession,
        runId: __dbgRun,
        hypothesisId,
        location: 'TopbarMenu.jsx',
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    }).catch(() => {})
  }
  // #endregion

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (event) => {
      // #region debug-point B:outside-click
      const root = rootRef.current
      const menu = menuRef.current
      const rect = menu?.getBoundingClientRect?.() || null
      __dbg('B', 'window mousedown', {
        targetTag: event.target?.tagName || null,
        targetClass: event.target?.className || null,
        clientX: event.clientX,
        clientY: event.clientY,
        rootContains: Boolean(root && root.contains(event.target)),
        menuRect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
        viewport: { w: window.innerWidth, h: window.innerHeight },
      })
      // #endregion
      const rootContains = Boolean(root && root.contains(event.target))
      const inMenuRect = Boolean(rect
        && event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom)

      if (!rootContains && !inMenuRect) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  useEffect(() => {
    if (!open || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) {
      menuRef.current.style.right = '0px'
      menuRef.current.style.left = 'auto'
    }
  }, [open])


  return (
    <div className="PlannerTopbarMenu" ref={rootRef}>
      <button
        type="button"
        className="PlannerIconButton"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-label="Trip menu"
        onClick={() => {
          // #region debug-point C:toggle
          __dbg('C', 'toggle click', { nextOpen: !open, itemCount: items.length })
          // #endregion
          setOpen((prev) => !prev)
        }}
      >
        ...
      </button>
      {open ? (
        <div
          className="dropdown-menu dropdown-menu-right show"
          role="menu"
          ref={menuRef}
          // #region debug-point D:menu-hooks
          onMouseEnter={() => __dbg('D', 'menu mouseenter', null)}
          onMouseLeave={() => __dbg('D', 'menu mouseleave', null)}
          onScroll={() => __dbg('D', 'menu scroll', { scrollTop: menuRef.current?.scrollTop || 0 })}
          // #endregion
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`divider-${idx}`} style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
            }
            return (
              <button
                key={item.label}
                type="button"
                className="dropdown-item"
                role="menuitem"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => {
                  // #region debug-point E:item-click
                  __dbg('E', 'menu item click', { label: item.label })
                  // #endregion
                  setOpen(false)
                  item.onClick?.()
                }}
              >
                {item.icon ? <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span> : null}
                <span>{item.label}</span>
              </button>
            )
          })}

        </div>
      ) : null}
    </div>
  )
}
