import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { formatDisplayName, getInitials } from '../lib/profile'
import {
  fetchNotificationsRequest,
  markAllNotificationsAsReadRequest,
  markNotificationAsReadRequest,
  respondToTripInvitationRequest,
  getUserInvitationsRequest,
  getSharedTripmateTripRequest,
  searchUsersRequest,
} from '../lib/session'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 3.75a6.75 6.75 0 1 0 4.22 12.02l4.28 4.28a.75.75 0 1 0 1.06-1.06l-4.28-4.28A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" fill="currentColor" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.25a4 4 0 0 0-4 4v1.17c0 .7-.19 1.38-.55 1.98L6.1 12.58a2.8 2.8 0 0 0 2.39 4.17h7.02a2.8 2.8 0 0 0 2.39-4.17l-1.35-2.18A3.8 3.8 0 0 1 16 8.42V7.25a4 4 0 0 0-4-4Zm0 18.5a2.7 2.7 0 0 1-2.53-1.75h5.06A2.7 2.7 0 0 1 12 21.75Z" fill="currentColor" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2c-4.1 0-7.5 2.35-8.37 5.75h16.74c-.87-3.4-4.27-5.75-8.37-5.75Z" fill="currentColor" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m19.3 12.94.9-.52a1 1 0 0 0 .37-1.37l-1.4-2.42a1 1 0 0 0-1.31-.4l-.92.43a7.27 7.27 0 0 0-1.63-.95l-.13-1.03a1 1 0 0 0-.99-.88h-2.8a1 1 0 0 0-.99.88l-.13 1.03c-.57.2-1.12.51-1.63.95l-.92-.43a1 1 0 0 0-1.31.4l-1.4 2.42a1 1 0 0 0 .37 1.37l.9.52a7.48 7.48 0 0 0 0 1.9l-.9.52a1 1 0 0 0-.37 1.37l1.4 2.42a1 1 0 0 0 1.31.4l.92-.43c.5.43 1.05.75 1.63.95l.13 1.03a1 1 0 0 0 .99.88h2.8a1 1 0 0 0 .99-.88l.13-1.03c.57-.2 1.12-.52 1.63-.95l.92.43a1 1 0 0 0 1.31-.4l1.4-2.42a1 1 0 0 0-.37-1.37l-.9-.52c.08-.31.12-.63.12-.95s-.04-.64-.12-.95ZM12 15.25A3.25 3.25 0 1 1 12 8.75a3.25 3.25 0 0 1 0 6.5Z" fill="currentColor" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.25a8.75 8.75 0 1 0 0 17.5 8.75 8.75 0 0 0 0-17.5Zm5.88 7.75h-2.4a13.57 13.57 0 0 0-1.1-4.26A7.29 7.29 0 0 1 17.88 11Zm-5.13-5.2c.6.78 1.28 2.69 1.53 5.2h-4.56c.25-2.51.93-4.42 1.53-5.2.24-.3.47-.43.75-.43s.51.13.75.43ZM9.62 6.74A13.57 13.57 0 0 0 8.52 11h-2.4a7.29 7.29 0 0 1 3.5-4.26ZM5.58 12.5h2.79c.06 1.53.28 2.99.65 4.27a13.46 13.46 0 0 0-1.47.76A7.25 7.25 0 0 1 5.58 12.5Zm6.42 6c-.28 0-.51-.13-.75-.43-.6-.78-1.28-2.69-1.53-5.2h4.56c-.25 2.51-.93 4.42-1.53 5.2-.24.3-.47.43-.75.43Zm2.36-.57c.59-1.27 1-2.73 1.06-4.18h2.79a7.25 7.25 0 0 1-1.97 5.03c-.46-.28-.95-.54-1.88-.85Z" fill="currentColor" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.25a7.75 7.75 0 1 1-7.17 10.68 1 1 0 1 1 1.85-.77A5.75 5.75 0 1 0 6.25 12H4.6a1 1 0 0 1 0-2h3.1a1 1 0 0 1 1 1v3.1a1 1 0 0 1-2 0v-.88A7.75 7.75 0 0 1 12 4.25Zm-.75 3.5a1 1 0 0 1 2 0v3.69l2.46 1.48a1 1 0 1 1-1.03 1.72l-2.94-1.77a1 1 0 0 1-.49-.86V7.75Z" fill="currentColor" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.25 4.75a1 1 0 0 1 0-2h4A2.75 2.75 0 0 1 17 5.5v13a2.75 2.75 0 0 1-2.75 2.75h-4a1 1 0 1 1 0-2h4A.75.75 0 0 0 15 18.5v-13a.75.75 0 0 0-.75-.75h-4Zm-5.96 6.54a1 1 0 0 1 0-1.58l3.5-3a1 1 0 1 1 1.3 1.52L7.52 9.5H13a1 1 0 1 1 0 2H7.52l1.57 1.27a1 1 0 1 1-1.26 1.56l-3.54-3.04Z" fill="currentColor" />
    </svg>
  )
}

const profileMenuIcons = {
  profile: <UserIcon />,
  settings: <SettingsIcon />,
  language: <GlobeIcon />,
  history: <HistoryIcon />,
  logout: <LogoutIcon />,
}

function formatNotificationTime(isoString) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffSec = Math.floor((now - date) / 1000)
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function TripHubHeader({ activePage = 'home', onLanguageClick }) {
  const navigate = useNavigate()
  const { token, user, logout, openSavedTrip, reloadTrips } = useApp()
  const actionRef = useRef(null)
  const searchRef = useRef(null)

  const [notificationOpen, setNotificationOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)

  // Notification states
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [respondingInviteId, setRespondingInviteId] = useState(null)
  const [inviteStatusMap, setInviteStatusMap] = useState({})

  const handleRespondInvite = async (e, notif, action) => {
    e.stopPropagation()
    const inviteId = notif?.metadata?.inviteId
    if (!token || !inviteId || respondingInviteId) return

    setRespondingInviteId(inviteId)
    try {
      const res = await respondToTripInvitationRequest(token, inviteId, action)
      const statusLabel = action === 'accept' ? 'accepted' : 'declined'
      setInviteStatusMap((prev) => ({ ...prev, [inviteId]: statusLabel }))

      if (!notif.read && notif.id) {
        markNotificationAsReadRequest(token, notif.id).catch(() => {})
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      if (action === 'accept' && typeof reloadTrips === 'function') {
        reloadTrips().catch(() => {})
      }
      await loadNotifications()
    } catch {
      // Ignore network errors silently
    } finally {
      setRespondingInviteId(null)
    }
  }

  const loadNotifications = async () => {
    if (!token) return
    try {
      setNotificationsLoading(true)
      const data = await fetchNotificationsRequest(token)
      if (data?.success) {
        const notifs = data.notifications || []
        setNotifications(notifs)
        setUnreadCount(data.unreadCount || 0)

        // Synchronize tripmate notification statuses with authoritative backend status
        const tripmateNotifs = notifs.filter(
          (n) => n?.type === 'tripmate_invite' && n?.metadata?.inviteId
        )

        if (tripmateNotifs.length > 0) {
          getUserInvitationsRequest(token)
            .then(async (invRes) => {
              const pendingIds = new Set(
                (invRes?.invitations || []).map((inv) => String(inv.id || inv._id))
              )

              const newStatusEntries = {}
              for (const notif of tripmateNotifs) {
                const inviteId = String(notif.metadata.inviteId)
                const tripId = notif.metadata.tripId

                if (pendingIds.has(inviteId)) {
                  newStatusEntries[inviteId] = 'pending'
                } else if (tripId) {
                  try {
                    const tripRes = await getSharedTripmateTripRequest(token, tripId)
                    if (tripRes?.success && tripRes?.trip) {
                      newStatusEntries[inviteId] = 'accepted'
                    } else {
                      newStatusEntries[inviteId] = 'inactive'
                    }
                  } catch {
                    newStatusEntries[inviteId] = 'inactive'
                  }
                }
              }

              if (Object.keys(newStatusEntries).length > 0) {
                setInviteStatusMap((prev) => ({ ...prev, ...newStatusEntries }))
              }
            })
            .catch(() => {})
        }
      }
    } catch {
      // Ignore network errors silently
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadNotifications()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [token])

  const handleToggleNotifications = () => {
    const next = !notificationOpen
    setNotificationOpen(next)
    setProfileOpen(false)
    if (next && token) {
      loadNotifications()
    }
  }

  const handleNotificationClick = async (notif) => {
    if (!notif) return
    if (!notif.read && token && notif.id) {
      try {
        await markNotificationAsReadRequest(token, notif.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // Fallback silently
      }
    }
    setNotificationOpen(false)
    if (notif.actor?.username) {
      navigate(`/profile/${encodeURIComponent(notif.actor.username)}`)
    }
  }

  const handleMarkAllRead = async () => {
    if (!token || unreadCount === 0) return
    try {
      await markAllNotificationsAsReadRequest(token)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // Fallback silently
    }
  }

  // User search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

  // Debounced user search
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      setSearchLoading(false)
      setSearchError(null)
      return
    }

    setSearchLoading(true)
    setSearchError(null)

    const timer = setTimeout(async () => {
      try {
        const res = await searchUsersRequest(trimmed, 8)
        if (res?.success) {
          setSearchResults(res.users || [])
        } else {
          setSearchResults([])
        }
      } catch {
        setSearchError('Failed to search users')
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const navItems = useMemo(() => {
    const items = [
      { key: 'home', label: 'Home', href: '/home', type: 'route' },
      { key: 'features', label: 'Features', href: '/#features', type: 'href' },
      { key: 'how-it-works', label: 'How It Works', href: '/#how-it-works', type: 'href' },
      { key: 'destinations', label: 'Destinations', href: '/#destinations', type: 'href' },
      { key: 'about', label: 'About', href: '/about', type: 'route' },
      { key: 'contact', label: 'Contact', href: '/#contact', type: 'href' },
    ]
    if (user?.role === 'admin') {
      items.push({ key: 'admin',    label: 'Admin Dashboard', href: '/admin',    type: 'route' })
      items.push({ key: 'admin-v2', label: 'Admin V2 ✦',     href: '/admin-v2', type: 'route' })
    }
    return items
  }, [user?.role])

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target
      if (actionRef.current && target instanceof Node && !actionRef.current.contains(target)) {
        setNotificationOpen(false)
        setProfileOpen(false)
      }
      if (searchRef.current && target instanceof Node && !searchRef.current.contains(target)) {
        setSearchOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setNotificationOpen(false)
      setProfileOpen(false)
      setConfirmLogoutOpen(false)
      setSearchOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function handleLogout() {
    setConfirmLogoutOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  function handleSelectUser(userItem) {
    setSearchOpen(false)
    if (userItem?.username) {
      navigate(`/profile/${userItem.username}`)
    }
  }

  const profileItems = [
    { key: 'profile', label: 'Your Profile', onClick: () => navigate('/profile') },
    {
      key: 'settings',
      label: 'Settings',
      onClick: () => {
        setProfileOpen(false)
        navigate('/settings')
      },
    },
    {
      key: 'language',
      label: 'Language',
      onClick: () => {
        setProfileOpen(false)
        if (typeof onLanguageClick === 'function') {
          onLanguageClick()
          return
        }
        navigate('/settings')
      },
    },
    {
      key: 'history',
      label: 'History',
      onClick: () => {
        setProfileOpen(false)
        navigate('/history')
      },
    },
    {
      key: 'logout',
      label: 'Logout',
      onClick: () => {
        setProfileOpen(false)
        setConfirmLogoutOpen(true)
      },
    },
  ]

  return (
    <>
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
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={activePage === item.key ? 'is-active' : ''}
              onClick={item.type === 'route'
                ? (event) => {
                    event.preventDefault()
                    navigate(item.href)
                  }
                : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Global Search Bar */}
        <div className="TripHubGlobalSearch" ref={searchRef}>
          <div className={`TripHubGlobalSearch__inputWrap${searchOpen ? ' is-focused' : ''}`}>
            <span className="TripHubGlobalSearch__icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              className="TripHubGlobalSearch__input"
              placeholder="Search places or people"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (!searchOpen) setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              aria-label="Search places or people"
              autoComplete="off"
              spellCheck="false"
            />
            {searchQuery && (
              <button
                type="button"
                className="TripHubGlobalSearch__clear"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                  setSearchError(null)
                }}
              >
                ×
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="TripHubGlobalSearch__dropdown" role="listbox">
              {searchLoading && (
                <div className="TripHubGlobalSearch__status">Searching...</div>
              )}

              {searchError && !searchLoading && (
                <div className="TripHubGlobalSearch__status TripHubGlobalSearch__status--error">{searchError}</div>
              )}

              {!searchLoading && !searchError && searchQuery.trim() && searchResults.length === 0 && (
                <div className="TripHubGlobalSearch__status">No people found</div>
              )}

              {!searchLoading && !searchError && !searchQuery.trim() && (
                <div className="TripHubGlobalSearch__status TripHubGlobalSearch__status--hint">
                  Search places or people
                </div>
              )}

              {!searchLoading && searchResults.length > 0 && (
                <div className="TripHubGlobalSearch__group">
                  <div className="TripHubGlobalSearch__groupTitle">PEOPLE</div>
                  <div className="TripHubGlobalSearch__list">
                    {searchResults.map((person) => {
                      const personInitial = (person.name || person.username || 'U').trim().charAt(0).toUpperCase()
                      return (
                        <button
                          key={person.id || person.username}
                          type="button"
                          className="TripHubGlobalSearch__resultItem"
                          onClick={() => handleSelectUser(person)}
                        >
                          <div className="TripHubGlobalSearch__avatar">
                            {person.profileImage ? (
                              <img src={person.profileImage} alt={person.name || person.username} />
                            ) : (
                              <span>{personInitial}</span>
                            )}
                          </div>
                          <div className="TripHubGlobalSearch__meta">
                            <span className="TripHubGlobalSearch__name">{person.name || person.username}</span>
                            <span className="TripHubGlobalSearch__username">@{person.username}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="TripHubTopbar__actions" ref={actionRef}>
          <div className="TripHubTopbarMenu">
            <button
              type="button"
              className={`TripHubTopbarMenu__iconButton${notificationOpen ? ' is-open' : ''}`}
              aria-label="Open notifications"
              aria-haspopup="dialog"
              aria-expanded={notificationOpen ? 'true' : 'false'}
              onClick={handleToggleNotifications}
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="TripHubTopbarMenu__badge" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <div className={`TripHubTopbarMenu__panel TripHubTopbarMenu__panel--notification${notificationOpen ? ' is-open' : ''}`}>
              <div className="TripHubNotificationPanel__header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="TripHubNotificationPanel__markAllBtn"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="TripHubNotificationPanel__body">
                {notificationsLoading && notifications.length === 0 ? (
                  <p className="TripHubNotificationPanel__empty">Loading...</p>
                ) : notifications.length === 0 ? (
                  <p className="TripHubNotificationPanel__empty">You don&apos;t have any notifications.</p>
                ) : (
                  <div className="TripHubNotificationList">
                    {notifications.map((notif) => {
                      const actorName = notif.actor?.name || notif.actor?.username || 'Someone'
                      const actorInitial = actorName.charAt(0).toUpperCase()
                      return (
                        <button
                          key={notif.id}
                          type="button"
                          className={`TripHubNotificationItem${!notif.read ? ' is-unread' : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className="TripHubNotificationItem__avatar">
                            {notif.actor?.profileImage ? (
                              <img src={notif.actor.profileImage} alt={actorName} />
                            ) : (
                              <span>{actorInitial}</span>
                            )}
                          </div>
                          <div className="TripHubNotificationItem__content">
                            <p className="TripHubNotificationItem__msg">
                              <strong>{actorName}</strong> {notif.type === 'follow' ? 'started following you.' : (notif.message || 'sent you a notification.')}
                            </p>
                            {notif.type === 'tripmate_invite' && (
                              notif.metadata?.inviteId && inviteStatusMap[notif.metadata.inviteId] && inviteStatusMap[notif.metadata.inviteId] !== 'pending' ? (
                                <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: inviteStatusMap[notif.metadata.inviteId] === 'accepted' ? '#16a34a' : '#64748b' }}>
                                  {inviteStatusMap[notif.metadata.inviteId] === 'accepted' ? '✓ Invitation Accepted' : '✗ Invitation Inactive'}
                                  {inviteStatusMap[notif.metadata.inviteId] === 'accepted' && notif.metadata?.tripId && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const targetTripId = notif.metadata?.tripId
                                        if (!targetTripId) return
                                        let opened = openSavedTrip(targetTripId)
                                        if (opened) {
                                          navigate('/workspace')
                                        } else if (typeof reloadTrips === 'function') {
                                          reloadTrips().then((freshTrips) => {
                                            const retryOpened = openSavedTrip(targetTripId, freshTrips)
                                            if (retryOpened) {
                                              navigate('/workspace')
                                            }
                                          }).catch(() => {})
                                        }
                                      }}
                                      style={{
                                        marginLeft: '8px',
                                        padding: '2px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#ffffff',
                                        color: '#0f172a',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      View Trip
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      border: 'none',
                                      backgroundColor: '#2563eb',
                                      color: '#ffffff',
                                      cursor: respondingInviteId === notif.metadata?.inviteId ? 'wait' : 'pointer',
                                      opacity: respondingInviteId === notif.metadata?.inviteId ? 0.7 : 1,
                                    }}
                                    disabled={respondingInviteId === notif.metadata?.inviteId}
                                    onClick={(e) => handleRespondInvite(e, notif, 'accept')}
                                  >
                                    {respondingInviteId === notif.metadata?.inviteId ? 'Responding...' : 'Accept'}
                                  </button>
                                  <button
                                    type="button"
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                      cursor: respondingInviteId === notif.metadata?.inviteId ? 'wait' : 'pointer',
                                      opacity: respondingInviteId === notif.metadata?.inviteId ? 0.7 : 1,
                                    }}
                                    disabled={respondingInviteId === notif.metadata?.inviteId}
                                    onClick={(e) => handleRespondInvite(e, notif, 'decline')}
                                  >
                                    Decline
                                  </button>
                                </div>
                              )
                            )}
                            <span className="TripHubNotificationItem__time">
                              {formatNotificationTime(notif.createdAt)}
                            </span>
                          </div>
                          {!notif.read && <span className="TripHubNotificationItem__dot" aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>


          <div className="TripHubTopbarMenu">
            <button
              type="button"
              className={`TripHubTopbarMenu__avatarButton${profileOpen ? ' is-open' : ''}`}
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen ? 'true' : 'false'}
              onClick={() => {
                setProfileOpen((prev) => !prev)
                setNotificationOpen(false)
              }}
            >
              {user?.profileImage ? (
                <img src={user.profileImage} alt={formatDisplayName(user)} />
              ) : (
                <span>{getInitials(user)}</span>
              )}
            </button>

            <div className={`TripHubTopbarMenu__panel TripHubTopbarMenu__panel--profile${profileOpen ? ' is-open' : ''}`} role="menu">
              {profileItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="TripHubTopbarMenu__item"
                  role="menuitem"
                  onClick={item.onClick}
                >
                  <span className="TripHubTopbarMenu__itemIcon" aria-hidden="true">{profileMenuIcons[item.key]}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="TripHubDeleteModal" hidden={!confirmLogoutOpen} aria-hidden={confirmLogoutOpen ? 'false' : 'true'}>
        <div className="TripHubDeleteModal__backdrop" onClick={() => setConfirmLogoutOpen(false)} />
        <div className="TripHubDeleteModal__dialog" role="dialog" aria-modal="true" aria-labelledby="shared-logout-title">
          <h2 id="shared-logout-title">Log out</h2>
          <p>Are you sure you want to log out?</p>
          <div className="TripHubDeleteModal__actions">
            <button type="button" className="TripHubDeleteModal__cancel" onClick={() => setConfirmLogoutOpen(false)}>Cancel</button>
            <button type="button" className="TripHubDeleteModal__confirm" onClick={handleLogout}>Yes, log out</button>
          </div>
        </div>
      </div>
    </>
  )
}
