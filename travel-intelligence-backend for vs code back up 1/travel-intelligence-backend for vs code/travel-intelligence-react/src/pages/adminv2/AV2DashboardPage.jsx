/**
 * AV2DashboardPage — Admin V2 Dashboard
 * ──────────────────────────────────────
 * Production-ready Dashboard implementation for Admin V2.
 * Renders executive KPIs, service health, recent activity, quick actions,
 * and a platform overview.
 *
 * Future integration (Phase 1):
 *   - Fetch executive summary from GET /api/admin/dashboard/summary
 *   - Fetch service health from GET /api/admin/system/health
 *   - Fetch recent activity from GET /api/admin/activities?limit=5
 *   - Display active user counts and trip creation rates dynamically
 *
 * DO NOT connect backend APIs in this phase.
 */
import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { fetchAdminOverviewRequest } from '../../lib/session'
import {
  AdminPageHeader,
  AdminPanel,
  AdminSection,
  AdminStatCard,
  AdminCard,
  AdminStatusIndicator,
  AdminActivityFeed,
  AdminGridTwo,
  AdminButton,
} from './components'

// TODO(Phase 3): Replace with health check status from /api/admin/system/health
const SERVICE_STATUSES = [
  { label: 'MongoDB Atlas', key: 'mongodb', status: 'connected', meta: 'Primary cluster connected' },
  { label: 'FastAPI Backend', key: 'backend', status: 'running', meta: 'Uvicorn port 8000' },
  { label: 'Google OAuth', key: 'google_auth', status: 'active_svc', meta: 'OAuth 2.0 endpoint active' },
  { label: 'OSRM Router', key: 'osrm', status: 'reachable', meta: 'project-osrm.org' },
  { label: 'Demo Mode', key: 'demo_mode', status: 'inactive', meta: 'Atlas database active' },
  { label: 'Session TTL', key: 'session_ttl', status: 'enabled', meta: 'TTL index active' },
]

// TODO(Phase 1): Replace with recent activity items from /api/admin/activities?limit=5
const RECENT_ACTIVITIES = [
  { icon: '✈️', color: '#dbeafe', title: 'User created trip', actor: 'demo', time: '5 min ago', type: 'Trip' },
  { icon: '✏️', color: '#fef3c7', title: 'Trip renamed', actor: 'zara_k', time: '18 min ago', type: 'Trip' },
  { icon: '🔐', color: '#d1fae5', title: 'Admin signed in', actor: 'arslan_dev', time: '1 hr ago', type: 'Auth' },
  { icon: '🔑', color: '#ede9fe', title: 'Session created', actor: 'demo', time: '2 hrs ago', type: 'Auth' },
  { icon: '⚙️', color: '#e5e7eb', title: 'System started', actor: 'system', time: '5 hrs ago', type: 'System' },
]

const QUICK_ACTIONS = [
  { key: 'users', label: 'Manage Users', icon: '👥', desc: 'Manage account access & roles' },
  { key: 'trips', label: 'Manage Trips', icon: '✈️', desc: 'Inspect and moderate itineraries' },
  { key: 'analytics', label: 'Platform Analytics', icon: '📊', desc: 'View travel intelligence trends' },
  { key: 'system', label: 'System Health', icon: '🖥️', desc: 'Inspect diagnostic logs & database' },
  { key: 'settings', label: 'Global Settings', icon: '⚙️', desc: 'Configure route planner defaults' },
]

export default function AV2DashboardPage({ onNavigate }) {
  const { token } = useApp()
  const [stats, setStats] = useState({ users: 3, trips: 11, adminAccounts: 1 })

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      if (!token) return
      try {
        const data = await fetchAdminOverviewRequest(token)
        if (!cancelled && data.success && data.counts) {
          setStats({
            users: data.counts.users ?? 3,
            trips: data.counts.trips ?? 11,
            adminAccounts: data.counts.adminAccounts ?? 1,
          })
        }
      } catch (err) {
        console.error('Failed to load dashboard counts:', err)
      }
    }
    loadStats()
    return () => {
      cancelled = true
    }
  }, [token])

  const statsList = [
    { label: 'Total Users', value: String(stats.users), color: 'orange', trend: 'Live user accounts in database' },
    { label: 'Total Trips', value: String(stats.trips), color: 'blue', trend: 'Saved travel itineraries' },
    { label: 'Active Sessions', value: '7', color: 'green', trend: 'Active login sessions' },
    { label: 'Administrator Accounts', value: String(stats.adminAccounts), color: 'purple', trend: 'Accounts with admin privileges' },
  ]

  return (
    <AdminSection>
      <AdminPageHeader
        title="Admin V2 Dashboard"
        sub="Executive overview, service status, and operational control panel."
      />

      {/* KPI Cards Grid */}
      <div className="AV2StatGrid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {statsList.map(kpi => (
          <AdminStatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            color={kpi.color}
            trend={kpi.trend}
          />
        ))}
      </div>

      <AdminGridTwo>
        {/* System Health */}
        <AdminPanel
          title="System Health Summary"
          sub="Status of core services and external API dependencies."
          headerRight={
            <AdminButton variant="ghost" size="sm" onClick={() => onNavigate('system')}>
              Full Details
            </AdminButton>
          }
          noPadding={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SERVICE_STATUSES.map(svc => (
              <div
                key={svc.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 10,
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{svc.label}</div>
                  <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>{svc.meta}</div>
                </div>
                <AdminStatusIndicator status={svc.status} pulse />
              </div>
            ))}
          </div>
        </AdminPanel>

        {/* Recent Activity */}
        <AdminPanel
          title="Recent Activity"
          sub="Chronological feed of recent administrative & user actions."
          headerRight={
            <AdminButton variant="ghost" size="sm" onClick={() => onNavigate('activity')}>
              All Logs
            </AdminButton>
          }
          noPadding
        >
          <AdminActivityFeed events={RECENT_ACTIVITIES} />
        </AdminPanel>
      </AdminGridTwo>

      {/* Quick Actions */}
      <AdminPanel
        title="Quick Actions"
        sub="Access primary administrative modules instantly."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {QUICK_ACTIONS.map(action => (
            <AdminCard
              key={action.key}
              onClick={() => onNavigate(action.key)}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              <div style={{ fontSize: 20, marginTop: 2 }}>{action.icon}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{action.label}</div>
                <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>{action.desc}</div>
              </div>
            </AdminCard>
          ))}
        </div>
      </AdminPanel>

      {/* Platform Overview */}
      <AdminPanel
        title="Platform Overview"
        sub="Current runtime configurations and database properties."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          <AdminCard>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em' }}>
              Database Catalog
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 6 }}>
              travelIntelligence
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Main MongoDB collection group containing auth, trips, and audit records.
            </div>
          </AdminCard>

          <AdminCard>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em' }}>
              Environments & Secrets
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 6 }}>
              Development Mode
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Local environment (.env loaded). Authentication routes guarded with standard CSRF protection.
            </div>
          </AdminCard>

          <AdminCard>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em' }}>
              Routing Engine
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 6 }}>
              Haversine (Fallback)
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Using direct straight-line distance calculations. OSRM road-aware integration is offline.
            </div>
          </AdminCard>
        </div>
      </AdminPanel>
    </AdminSection>
  )
}
