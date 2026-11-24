/**
 * AdminStatCard
 * ─────────────
 * KPI metric card used on Dashboard, Analytics, and System pages.
 *
 * Props:
 *   label   {string}      Required. Short metric name (uppercase label).
 *   value   {string}      Required. The displayed metric value. Use '—' for placeholder.
 *   trend   {string}      Optional. Small trend / context line below the value.
 *   color   {string}      Optional. Colour variant. One of:
 *                           'orange' | 'blue' | 'green' | 'purple' | 'amber' | 'teal'
 *                           Default: 'orange'
 *   icon    {ReactNode}   Optional. SVG icon shown in the top-right icon box.
 *
 * Future integration:
 *   Replace `value` prop with live data from /api/admin/dashboard/summary (Phase 1/3).
 */
export function AdminStatCard({ label, value, trend, color = 'orange', icon }) {
  return (
    <div className={`AV2StatCard AV2StatCard--${color}`}>
      <div className="AV2StatCard__header">
        <span className="AV2StatCard__label">{label}</span>
        {icon && (
          <div className="AV2StatCard__icon">
            {icon}
          </div>
        )}
      </div>
      <div className="AV2StatCard__value">{value}</div>
      {trend && <div className="AV2StatCard__trend">{trend}</div>}
    </div>
  )
}
