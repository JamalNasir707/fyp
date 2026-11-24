/**
 * AV2SystemPage — System Health
 * ──────────────────────────────
 * Refactored in Phase 0.5 to use the shared component library.
 * Visual output is IDENTICAL to Phase 0. Zero behaviour changes.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TODO(Phase 3): Replace ALL hardcoded status values below   ║
 * ║  with live data from GET /api/admin/system/health           ║
 * ║                                                             ║
 * ║  The displayed "Connected", "Running", "Reachable"          ║
 * ║  statuses are PLACEHOLDER UI ONLY.                          ║
 * ║  They do NOT reflect the actual system state.               ║
 * ║  This is an intentional Phase 0.5 temporary state.          ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Future integration (Phase 3):
 *   - GET /api/admin/system/health   → SERVICE_STATUS rows
 *   - GET /api/admin/system/db-stats → COLLECTIONS rows
 *   - GET /api/admin/system/env-info → environment mode, dataset info
 *   - POST /api/admin/system/cleanup-sessions → Root Admin only
 *
 * DO NOT connect any actions in this phase.
 */
import {
  AdminPageHeader,
  AdminPanel,
  AdminSection,
  AdminStatCard,
  AdminStatusIndicator,
  AdminBadge,
  AdminButton,
  AdminGridTwo,
  AdminPlaceholderBanner,
} from './components'

// ─── Placeholder data ─────────────────────────────────────────
// TODO(Phase 3): Replace with GET /api/admin/system/health response
const SERVICE_STATUS = [
  { label: 'MongoDB Atlas',     meta: 'cluster0.x28rbha.mongodb.net',  status: 'connected' },
  { label: 'Demo Fallback',     meta: 'local JSON store',               status: 'inactive'  },
  { label: 'FastAPI Backend',   meta: 'http://127.0.0.1:8000',         status: 'running'   },
  { label: 'OSRM Router',       meta: 'router.project-osrm.org',       status: 'reachable' },
  { label: 'Google Auth',       meta: 'OAuth 2.0',                      status: 'active_svc'},
  { label: 'Session TTL Index', meta: 'MongoDB TTL auto-expire',        status: 'enabled'   },
]

// TODO(Phase 3): Replace with GET /api/admin/system/db-stats response
const COLLECTIONS = [
  { name: 'users',            docs: '—', size: '—' },
  { name: 'sessions',         docs: '—', size: '—' },
  { name: 'trips',            docs: '—', size: '—' },
  { name: 'activity_history', docs: '—', size: '—' },
]

// TODO(Phase 3): Replace with live session counts from /api/admin/system/health
const SESSION_STATS = [
  { label: 'Active Sessions',   value: '—', color: 'green' },
  { label: 'Expired (pending)', value: '—', color: 'amber' },
  { label: 'Session TTL',       value: '7 days', color: 'blue' },
]

export default function AV2SystemPage() {
  return (
    <AdminSection>
      <AdminPageHeader
        title="System Health"
        sub="Real-time infrastructure status, database info, and session management."
      />

      <AdminGridTwo>
        {/* Service Status */}
        <AdminPanel
          title="Service Status"
          headerRight={
            // TODO(Phase 3): Wire to GET /api/admin/system/health
            <AdminButton variant="ghost" size="sm">Run Diagnostics</AdminButton>
          }
          noPadding={false}
        >
          {SERVICE_STATUS.map(row => (
            <div key={row.label} className="AV2ServiceRow">
              <div>
                <div className="AV2ServiceRow__label">{row.label}</div>
                <div className="AV2ServiceRow__meta">{row.meta}</div>
              </div>
              {/* TODO(Phase 3): Replace hardcoded status with live API value */}
              <AdminStatusIndicator status={row.status} pulse />
            </div>
          ))}
        </AdminPanel>

        {/* DB Collections */}
        <AdminPanel
          title="Database Collections"
          headerRight={<AdminBadge color="gray">travelIntelligence</AdminBadge>}
          noPadding
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="AV2Table">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Documents</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {/* TODO(Phase 3): Replace with GET /api/admin/system/db-stats */}
                {COLLECTIONS.map(c => (
                  <tr key={c.name}>
                    <td>
                      <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                        {c.name}
                      </code>
                    </td>
                    <td style={{ color: '#6b7280' }}>{c.docs}</td>
                    <td style={{ color: '#6b7280' }}>{c.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              Live counts require backend GET /api/admin/system/db-stats (Phase 3)
            </p>
          </div>
        </AdminPanel>
      </AdminGridTwo>

      {/* Session Management */}
      <AdminPanel
        title="Session Management"
        headerRight={
          // TODO(Phase 3): Wire to POST /api/admin/system/cleanup-sessions (Root Admin only)
          // DO NOT enable this button until the Root Admin role check is implemented on the backend.
          <AdminButton variant="danger" size="sm">
            Clean Up Expired Sessions
          </AdminButton>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {SESSION_STATS.map(s => (
            /* TODO(Phase 3): Replace value='—' with live session counts */
            <AdminStatCard key={s.label} label={s.label} value={s.value} color={s.color} />
          ))}
        </div>
      </AdminPanel>

      <AdminPlaceholderBanner
        title="Live System Metrics Coming in Phase 3"
        sub="Real MongoDB ping latency, collection sizes, and session counts will be fetched via the diagnostics API in Phase 3."
        phase="Phase 0.5 — Component Library"
      />
    </AdminSection>
  )
}
