import { useEffect, useRef, useState } from 'react'

export default function SectionMenu({ label = 'Menu', items }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (event) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="PlannerSectionMenu" ref={rootRef}>
      <button
        type="button"
        className="PlannerSectionMenu__trigger"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((prev) => !prev)}
      >
        ⋯
        <span className="sr-only">{label}</span>
      </button>
      {open ? (
        <div className="PlannerSectionMenu__panel" role="menu">
          {(items || []).map((item) => (
            <button
              key={item.label}
              type="button"
              className={`PlannerSectionMenu__item${item.danger ? ' is-danger' : ''}`}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onClick?.()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

