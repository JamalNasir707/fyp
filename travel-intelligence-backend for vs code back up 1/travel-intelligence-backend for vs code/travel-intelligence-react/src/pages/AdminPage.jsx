import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { fetchAdminOverviewRequest } from '../lib/session'

function formatRoleLabel(role) {
  return role === 'admin' ? 'Admin' : 'User'
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { token, user, logout } = useApp()
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState({ counts: { users: 0, trips: 0 }, users: [], trips: [] })

  async function handleLogout() {
    setConfirmLogoutOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      if (!token) return
      setLoading(true)
      setError('')

      try {
        const data = await fetchAdminOverviewRequest(token)
        if (!cancelled) {
          setOverview({
            counts: data.counts || { users: 0, trips: 0 },
            users: Array.isArray(data.users) ? data.users : [],
            trips: Array.isArray(data.trips) ? data.trips : [],
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load admin overview')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOverview()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setConfirmLogoutOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="TripHubPage">
      <header className="TripHubTopbar">
        <a
          className="TripHubTopbar__brand"
          href="/home"
          onClick={(event) => {
            event.preventDefault()
            navigate('/home')
          }}
        >
          🧭 TripNest
        </a>
        <nav className="TripHubTopbar__nav">
          <a
            href="/home"
            onClick={(event) => {
              event.preventDefault()
              navigate('/home')
            }}
          >
            Home
          </a>
          <a
            href="/about"
            onClick={(event) => {
              event.preventDefault()
              navigate('/about')
            }}
          >
            About Us
          </a>
          <a
            href="/admin"
            className="is-active"
            onClick={(event) => {
              event.preventDefault()
              navigate('/admin')
            }}
          >
            Admin Dashboard
          </a>
          <a
            href="/admin-v2"
            onClick={(event) => {
              event.preventDefault()
              navigate('/admin-v2')
            }}
            style={{ background: 'linear-gradient(135deg, #ffede6, #fff4ef)', color: '#f25e25', border: '1px solid #ffd3c2', borderRadius: 999, padding: '8px 14px', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Admin V2 ✦
          </a>
        </nav>
        <div className="TripHubTopbar__actions">
          <div className="TripHubTopbar__identity">
            <span className="TripHubTopbar__user">{user?.username || ''}</span>
            <span className="TripHubRoleBadge TripHubRoleBadge--admin">{formatRoleLabel(user?.role)}</span>
          </div>
          <button
            type="button"
            className="PlannerPillButton PlannerPillButton--dark"
            onClick={() => setConfirmLogoutOpen(true)}
          >
            Logout
          </button>
        </div>
      </header>
      <main className="TripHubMain">
        <section className="AdminDashboardHero">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="TripHubHero__sub">Overview of users and trips stored in the MongoDB-backed system.</p>
          </div>
        </section>

        {error ? <div className="AdminDashboardAlert" role="alert">{error}</div> : null}

        <section className="AdminDashboardStats">
          <article className="AdminDashboardStatCard">
            <span>Total Users</span>
            <strong>{loading ? '...' : overview.counts.users || 0}</strong>
          </article>
          <article className="AdminDashboardStatCard">
            <span>Total Trips</span>
            <strong>{loading ? '...' : overview.counts.trips || 0}</strong>
          </article>
        </section>

        <section className="AdminDashboardGrid">
          <div className="AdminDashboardPanel">
            <div className="AdminDashboardPanel__header">
              <h2>Users</h2>
              <span>{loading ? 'Loading...' : `${overview.users.length} records`}</span>
            </div>
            {loading ? (
              <p className="AdminDashboardEmpty">Loading users...</p>
            ) : !overview.users.length ? (
              <p className="AdminDashboardEmpty">No users found.</p>
            ) : (
              <div className="AdminDashboardList">
                {overview.users.map((entry) => (
                  <article key={entry.id} className="AdminDashboardListItem">
                    <div className="AdminDashboardListItem__titleRow">
                      <strong>{entry.username}</strong>
                      <span className={`TripHubRoleBadge ${entry.role === 'admin' ? 'TripHubRoleBadge--admin' : 'TripHubRoleBadge--user'}`}>
                        {formatRoleLabel(entry.role)}
                      </span>
                    </div>
                    <p>{entry.email}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="AdminDashboardPanel">
            <div className="AdminDashboardPanel__header">
              <h2>Trips</h2>
              <span>{loading ? 'Loading...' : `${overview.trips.length} records`}</span>
            </div>
            {loading ? (
              <p className="AdminDashboardEmpty">Loading trips...</p>
            ) : !overview.trips.length ? (
              <p className="AdminDashboardEmpty">No trips found.</p>
            ) : (
              <div className="AdminDashboardList">
                {overview.trips.map((trip) => (
                  <article key={`${trip.id}-${trip.name}`} className="AdminDashboardListItem">
                    <div className="AdminDashboardListItem__titleRow">
                      <strong>{trip.name || 'My Trip'}</strong>
                    </div>
                    <p>{trip.startDate || 'No start date'} - {trip.endDate || 'No end date'}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="TripHubDeleteModal" hidden={!confirmLogoutOpen} aria-hidden={confirmLogoutOpen ? 'false' : 'true'}>
        <div className="TripHubDeleteModal__backdrop" onClick={() => setConfirmLogoutOpen(false)} />
        <div className="TripHubDeleteModal__dialog" role="dialog" aria-modal="true" aria-labelledby="admin-logout-title">
          <h2 id="admin-logout-title">Log out</h2>
          <p>Are you sure you want to log out?</p>
          <div className="TripHubDeleteModal__actions">
            <button type="button" className="TripHubDeleteModal__cancel" onClick={() => setConfirmLogoutOpen(false)}>Cancel</button>
            <button type="button" className="TripHubDeleteModal__confirm" onClick={handleLogout}>Yes, log out</button>
          </div>
        </div>
      </div>
    </div>
  )
}
