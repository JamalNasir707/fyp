import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import '../styles/adminv2.css'

// ─── Lazy sub-page imports ────────────────────────────────────
import AV2DashboardPage from './adminv2/AV2DashboardPage'
import AV2UsersPage    from './adminv2/AV2UsersPage'
import AV2TripsPage    from './adminv2/AV2TripsPage'
import AV2AnalyticsPage from './adminv2/AV2AnalyticsPage'
import AV2ActivityPage from './adminv2/AV2ActivityPage'
import AV2SystemPage   from './adminv2/AV2SystemPage'
import AV2SettingsPage from './adminv2/AV2SettingsPage'

// ─── Shared Placeholder Helper (exported for sub-pages) ──────
export function AV2PlaceholderPage({ icon, title, sub }) {
  return (
    <div className="AV2Placeholder">
      {icon && (
        <div className="AV2Placeholder__icon">{icon}</div>
      )}
      <h2 className="AV2Placeholder__title">{title}</h2>
      <p className="AV2Placeholder__sub">{sub}</p>
      <span className="AV2Placeholder__tag">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
        </svg>
        Phase 0 — UI Scaffold Only
      </span>
    </div>
  )
}

// ─── SVG Icons ────────────────────────────────────────────────
const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 1-1.06 1.06L12 5.69 3.84 13.6a.75.75 0 0 1-1.06-1.06l8.69-8.69ZM12 7.5l7.47 7.47V20.25a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.5h-3v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75V14.97L12 7.5Z" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2c-4.1 0-7.5 2.35-8.37 5.75h16.74c-.87-3.4-4.27-5.75-8.37-5.75Zm7.5-3.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1.75c-1.06 0-2.04.26-2.9.71A9.28 9.28 0 0 1 16 19.25h6.62a6.25 6.25 0 0 0-6.12-6.5Z" />
    </svg>
  ),
  Trips: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
    </svg>
  ),
  Analytics: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.75 3a.75.75 0 0 1 .75.75v16.5a.75.75 0 0 1-1.5 0V3.75a.75.75 0 0 1 .75-.75ZM12 7.5a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0v-12A.75.75 0 0 1 12 7.5ZM5.25 12a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Z" />
    </svg>
  ),
  Activity: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.25a7.75 7.75 0 1 1 0 15.5 7.75 7.75 0 0 1 0-15.5Zm0 1.5a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5Zm-.75 2.5a.75.75 0 0 1 1.5 0v4l2.47 1.48a.75.75 0 0 1-.77 1.28L11.5 13.5a.75.75 0 0 1-.25-.56V8.25Z" />
    </svg>
  ),
  System: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v.75H4.875A2.625 2.625 0 0 0 2.25 7.125v10.5A2.625 2.625 0 0 0 4.875 20.25H19.5a2.625 2.625 0 0 0 2.625-2.625V7.125A2.625 2.625 0 0 0 19.5 4.5H18v-.75A2.25 2.25 0 0 0 15.75 1.5h-5.25Zm0 1.5h5.25a.75.75 0 0 1 .75.75v.75H9.75v-.75a.75.75 0 0 1 .75-.75ZM12 12.75a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" />
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m19.3 12.94.9-.52a1 1 0 0 0 .37-1.37l-1.4-2.42a1 1 0 0 0-1.31-.4l-.92.43a7.27 7.27 0 0 0-1.63-.95l-.13-1.03a1 1 0 0 0-.99-.88h-2.8a1 1 0 0 0-.99.88l-.13 1.03c-.57.2-1.12.51-1.63.95l-.92-.43a1 1 0 0 0-1.31.4l-1.4 2.42a1 1 0 0 0 .37 1.37l.9.52a7.48 7.48 0 0 0 0 1.9l-.9.52a1 1 0 0 0-.37 1.37l1.4 2.42a1 1 0 0 0 1.31.4l.92-.43c.5.43 1.05.75 1.63.95l.13 1.03a1 1 0 0 0 .99.88h2.8a1 1 0 0 0 .99-.88l.13-1.03c.57-.2 1.12-.52 1.63-.95l.92.43a1 1 0 0 0 1.31-.4l1.4-2.42a1 1 0 0 0-.37-1.37l-.9-.52c.08-.31.12-.63.12-.95s-.04-.64-.12-.95ZM12 15.25A3.25 3.25 0 1 1 12 8.75a3.25 3.25 0 0 1 0 6.5Z" />
    </svg>
  ),
  Collapse: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.03 8.22a.75.75 0 0 0-1.06 1.06L12.19 11.5l-2.22 2.22a.75.75 0 1 0 1.06 1.06l2.75-2.75a.75.75 0 0 0 0-1.06L11.03 8.22ZM3.75 4.5a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Zm0 6.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Zm0 6.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" />
    </svg>
  ),
  Back: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.22 6.22a.75.75 0 0 1 1.06 0l.53.53a.75.75 0 0 1 0 1.06L9.06 10.5H20.25a.75.75 0 0 1 0 1.5H9.06l2.75 2.69a.75.75 0 1 1-1.06 1.06L7.5 12.53a.75.75 0 0 1 0-1.06l2.72-5.25Z" />
    </svg>
  ),
}

// ─── Sidebar nav config ───────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard',    Icon: Icons.Dashboard },
  { key: 'users',     label: 'Users',        Icon: Icons.Users,    badge: null },
  { key: 'trips',     label: 'Trips',        Icon: Icons.Trips,    badge: null },
  { key: 'analytics', label: 'Analytics',    Icon: Icons.Analytics },
  { key: 'activity',  label: 'Activity Logs',Icon: Icons.Activity  },
  { key: 'system',    label: 'System',       Icon: Icons.System    },
  { key: 'settings',  label: 'Settings',     Icon: Icons.Settings  },
]

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  users:     'User Management',
  trips:     'Trip Management',
  analytics: 'Analytics',
  activity:  'Activity Logs',
  system:    'System Health',
  settings:  'Settings',
}

// ─── Main Shell ───────────────────────────────────────────────
export default function AdminV2Page() {
  const navigate   = useNavigate()
  const { user }   = useApp()
  const [activePage, setActivePage] = useState('dashboard')
  const [collapsed, setCollapsed]   = useState(false)

  const handleNavigate = useCallback((page) => setActivePage(page), [])

  const getInitials = (u) => {
    const name = u?.username || u?.name || 'A'
    return name.slice(0, 2).toUpperCase()
  }

  // Render active page content
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <AV2DashboardPage onNavigate={handleNavigate} />
      case 'users':     return <AV2UsersPage />
      case 'trips':     return <AV2TripsPage />
      case 'analytics': return <AV2AnalyticsPage />
      case 'activity':  return <AV2ActivityPage />
      case 'system':    return <AV2SystemPage />
      case 'settings':  return <AV2SettingsPage />
      default:          return <AV2DashboardPage onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="AV2Shell">
      {/* ── Sidebar ────────────────────────────── */}
      <aside className={`AV2Sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Admin navigation">
        {/* Brand */}
        <div className="AV2Sidebar__brand">
          <span className="AV2Sidebar__brandIcon" aria-hidden="true">🧭</span>
          <div className="AV2Sidebar__brandText">
            <span className="AV2Sidebar__brandName">TripNest</span>
            <span className="AV2Sidebar__brandSub">Admin V2</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="AV2Sidebar__nav">
          <div className="AV2NavGroup">
            <div className="AV2NavGroup__label">Main</div>
            {NAV_ITEMS.map(({ key, label, Icon, badge }) => (
              <button
                key={key}
                type="button"
                id={`av2-nav-${key}`}
                className={`AV2NavItem${activePage === key ? ' is-active' : ''}`}
                onClick={() => setActivePage(key)}
                title={collapsed ? label : undefined}
                aria-current={activePage === key ? 'page' : undefined}
              >
                <span className="AV2NavItem__icon"><Icon /></span>
                <span className="AV2NavItem__label">{label}</span>
                {badge && <span className="AV2NavItem__badge">{badge}</span>}
              </button>
            ))}
          </div>

          <div className="AV2NavGroup" style={{ marginTop: 8 }}>
            <div className="AV2NavGroup__label">Legacy</div>
            <button
              type="button"
              id="av2-nav-legacy-admin"
              className="AV2NavItem"
              onClick={() => navigate('/admin')}
              title={collapsed ? 'Admin Dashboard (v1)' : undefined}
            >
              <span className="AV2NavItem__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 0 1 0 1.971l-11.54 6.347a1.125 1.125 0 0 1-1.667-.985V5.653Z" />
                </svg>
              </span>
              <span className="AV2NavItem__label">Admin Dashboard v1</span>
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="AV2Sidebar__footer">
          <button
            type="button"
            id="av2-sidebar-collapse"
            className="AV2CollapseBtn"
            onClick={() => setCollapsed(prev => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="AV2CollapseBtn__icon">
              <Icons.Collapse />
            </span>
            <span className="AV2CollapseBtn__label">Collapse</span>
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────── */}
      <div className="AV2Main">
        {/* Header */}
        <header className="AV2Header">
          <div style={{ flex: 1 }}>
            <div className="AV2Header__breadcrumb">
              <span style={{ color: '#9ca3af' }}>TripNest</span>
              <span className="AV2Header__sep">›</span>
              <span style={{ color: '#9ca3af' }}>Admin V2</span>
              <span className="AV2Header__sep">›</span>
              <span>{PAGE_TITLES[activePage] || 'Dashboard'}</span>
            </div>
          </div>

          <div className="AV2Header__right">
            {/* Phase tag */}
            <span className="AV2Header__pill">
              Phase 0 — UI Only
            </span>

            {/* Live status */}
            <span className="AV2Header__pill AV2Header__pill--online">
              <span className="AV2Header__dot AV2Header__dot--pulse" />
              Backend Live
            </span>

            {/* Back to main app */}
            <button
              type="button"
              id="av2-header-back"
              className="AV2Btn AV2Btn--ghost"
              onClick={() => navigate('/home')}
              title="Back to TripNest"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M10.22 6.22a.75.75 0 0 1 1.06 0l.53.53a.75.75 0 0 1 0 1.06L9.06 10.5H20.25a.75.75 0 0 1 0 1.5H9.06l2.75 2.69a.75.75 0 1 1-1.06 1.06L7.5 12.53a.75.75 0 0 1 0-1.06l2.72-5.25Z" />
              </svg>
              App
            </button>

            {/* Avatar */}
            <div
              className="AV2Header__avatar"
              title={user?.username || 'Admin'}
              aria-label={`Logged in as ${user?.username || 'admin'}`}
            >
              {getInitials(user)}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="AV2Content" id="av2-main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
