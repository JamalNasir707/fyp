import { AdminBadge } from './AdminBadge'

/**
 * AdminStatusIndicator
 * ─────────────────────
 * Specialised badge for account status (Active / Suspended / Unknown).
 * Has an optional animated pulse dot for live/online states.
 *
 * Props:
 *   status    {string}    'active' | 'suspended' | 'online' | 'offline' | 'error' | string
 *   pulse     {boolean}   Optional. Show animated dot. Default false.
 *
 * Future integration:
 *   In Phase 1, status will be driven by user.status field from the API.
 *   In Phase 3, system service statuses will replace hardcoded values.
 *
 * TODO(Phase 3): Replace hardcoded 'Connected'/'Running' with live API values
 *   from GET /api/admin/system/health
 */
const STATUS_CONFIG = {
  active:    { color: 'green',  label: 'Active'     },
  suspended: { color: 'red',    label: 'Suspended'  },
  online:    { color: 'green',  label: 'Online'     },
  connected: { color: 'green',  label: 'Connected'  },
  running:   { color: 'green',  label: 'Running'    },
  enabled:   { color: 'green',  label: 'Enabled'    },
  inactive:  { color: 'green',  label: 'Inactive'   }, // fallback inactive = good (e.g. demo mode off)
  reachable: { color: 'blue',   label: 'Reachable'  },
  active_svc:{ color: 'blue',   label: 'Active'     },
  offline:   { color: 'red',    label: 'Offline'    },
  error:     { color: 'red',    label: 'Error'      },
  unknown:   { color: 'amber',  label: 'Unknown'    },
}

export function AdminStatusIndicator({ status = 'unknown', pulse = false, label }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown
  const displayLabel = label ?? cfg.label

  return (
    <AdminBadge color={cfg.color}>
      {pulse && (
        <span
          className="AV2Header__dot AV2Header__dot--pulse"
          style={{ marginRight: 5 }}
        />
      )}
      {displayLabel}
    </AdminBadge>
  )
}
