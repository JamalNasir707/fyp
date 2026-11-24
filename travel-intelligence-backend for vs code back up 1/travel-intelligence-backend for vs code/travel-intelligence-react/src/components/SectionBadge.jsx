import { getIconLabel } from '../lib/sections'

export default function SectionBadge({ color = '#3b82f6', icon = '123', label = '', compact = false }) {
  const iconLabel = getIconLabel(icon)

  return (
    <span className={`SectionBadge${compact ? ' SectionBadge--compact' : ''}`} title={label || undefined}>
      <span className="SectionBadge__dot" style={{ backgroundColor: color }} />
      {iconLabel !== '123' ? <span className="SectionBadge__icon">{iconLabel}</span> : null}
      {compact ? null : <span className="SectionBadge__label">{label}</span>}
    </span>
  )
}

