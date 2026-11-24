/**
 * AdminBadge
 * ──────────
 * General-purpose inline badge / chip used for labels, types, states.
 *
 * Props:
 *   children  {ReactNode}   Required. Badge text content.
 *   color     {string}      Optional. One of:
 *                             'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray' | 'teal'
 *                             Default: 'gray'
 *
 * Usage:
 *   <AdminBadge color="green">Active</AdminBadge>
 *   <AdminBadge color="purple">Admin</AdminBadge>
 */
export function AdminBadge({ children, color = 'gray' }) {
  return (
    <span className={`AV2Badge AV2Badge--${color}`}>
      {children}
    </span>
  )
}
