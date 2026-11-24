import { AdminBadge } from './AdminBadge'

/**
 * AdminRoleBadge
 * ──────────────
 * Displays a user role with the correct colour for the permission level.
 * Aligned to the frozen role model: root_admin | admin | user
 *
 * Props:
 *   role  {string}   'root_admin' | 'admin' | 'user' | string
 *
 * Permission model note:
 *   Roles are colour-coded intentionally to make privilege level instantly visible.
 *   root_admin → amber (highest caution)
 *   admin      → purple
 *   user       → blue (default)
 *
 * Future integration:
 *   Role values will come from user.role field (Phase 1).
 *   The promote/demote actions will be guarded at the API level.
 *   This component renders display only — no action is connected.
 */
const ROLE_CONFIG = {
  root_admin: { color: 'amber',  label: 'Root Admin' },
  admin:      { color: 'purple', label: 'Admin'      },
  user:       { color: 'blue',   label: 'User'       },
  // Aliases used in current placeholder data
  'Admin':    { color: 'purple', label: 'Admin'      },
  'User':     { color: 'blue',   label: 'User'       },
}

export function AdminRoleBadge({ role = 'user' }) {
  const cfg = ROLE_CONFIG[role] ?? { color: 'gray', label: role }
  return <AdminBadge color={cfg.color}>{cfg.label}</AdminBadge>
}
