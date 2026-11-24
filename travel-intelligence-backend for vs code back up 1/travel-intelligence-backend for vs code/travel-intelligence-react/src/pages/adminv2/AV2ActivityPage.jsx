/**
 * AV2ActivityPage — Activity Logs
 * ────────────────────────────────
 * Refactored in Phase 0.5 to use the shared component library.
 * Visual output is IDENTICAL to Phase 0. Zero behaviour changes.
 *
 * Future integration (Phase 2):
 *   - Replace PLACEHOLDER_EVENTS with paginated data from GET /api/admin/activities
 *   - Wire AdminSearchBar onChange → search by actor username
 *   - Wire filter buttons → type and date range query params
 *   - Wire AdminPagination → page state
 *
 * Architecture note (frozen spec):
 *   Audit logs are IMMUTABLE. No delete or edit actions exist here.
 *   The `actorRole` field must be added to the activity_history schema
 *   in Phase 1 before this page can distinguish admin vs user actions.
 *
 * DO NOT connect any actions in this phase.
 */
import {
  AdminPageHeader,
  AdminPanel,
  AdminSection,
  AdminFilterBar,
  AdminActivityFeed,
  AdminPagination,
  AdminPlaceholderBanner,
} from './components'

// ─── Placeholder data ─────────────────────────────────────────
// TODO(Phase 2): Replace with paginated GET /api/admin/activities response
const PLACEHOLDER_EVENTS = [
  { icon: '🔐', color: '#d1fae5', title: 'User logged in',        actor: 'arslan_dev', time: '2 min ago',   type: 'Auth'  },
  { icon: '✈️', color: '#dbeafe', title: 'Trip created',           actor: 'zara_k',     time: '14 min ago',  type: 'Trip'  },
  { icon: '✏️', color: '#fef3c7', title: 'Trip renamed',           actor: 'demo',       time: '1 hr ago',    type: 'Trip'  },
  { icon: '🚫', color: '#fee2e2', title: 'User suspended',         actor: 'admin',      time: '3 hrs ago',   type: 'Admin' },
  { icon: '🗑️', color: '#fee2e2', title: 'Trip deleted',           actor: 'admin',      time: '5 hrs ago',   type: 'Admin' },
  { icon: '👤', color: '#ede9fe', title: 'Profile updated',        actor: 'sarah_p',    time: '8 hrs ago',   type: 'User'  },
  { icon: '🔓', color: '#d1fae5', title: 'User registered',        actor: 'new_user_x', time: '1 day ago',   type: 'Auth'  },
  { icon: '🔑', color: '#dbeafe', title: 'Role changed to Admin',  actor: 'admin',      time: '2 days ago',  type: 'Admin' },
]

const FILTERS = ['All Event Types ▾', 'Date Range ▾']

export default function AV2ActivityPage() {
  return (
    <AdminSection>
      <AdminPageHeader
        title="Activity Logs"
        sub="Full audit trail of all user, admin, and system actions."
      />

      {/* Toolbar */}
      <AdminPanel>
        <AdminFilterBar
          searchPlaceholder="Search by actor or action…"
          filters={FILTERS}
        />
      </AdminPanel>

      {/* Feed */}
      <AdminPanel
        title="Recent Events"
        sub={`Showing ${PLACEHOLDER_EVENTS.length} placeholder records`}
        noPadding
      >
        <AdminActivityFeed events={PLACEHOLDER_EVENTS} />
        <AdminPagination />
      </AdminPanel>

      <AdminPlaceholderBanner
        title="Live Audit Log Coming in Phase 2"
        sub="Real activity_history records from MongoDB will be paginated and filterable by event class, actor, and date range in Phase 2."
        phase="Phase 0.5 — Component Library"
      />
    </AdminSection>
  )
}
