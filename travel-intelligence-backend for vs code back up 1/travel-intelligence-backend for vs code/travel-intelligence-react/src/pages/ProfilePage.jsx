import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ProfileEditModal from '../components/ProfileEditModal'
import ProfileShareModal from '../components/ProfileShareModal'
import TripHubHeader from '../components/TripHubHeader'
import TripHubSavedTripsGrid from '../components/TripHubSavedTripsGrid'
import LandingFooter from '../components/landing/LandingFooter'
import { useApp } from '../context/AppContext'
import {
  buildProfileLink,
  fetchFollowStatusRequest,
  fetchPublicTripsByUsernameRequest,
  followUserRequest,
  formatDisplayName,
  formatUsername,
  getInitials,
  unfollowUserRequest,
} from '../lib/profile'
import { fetchPublicUserByUsernameRequest } from '../lib/session'
import { formatTripDateRange } from '../lib/trips'
import '../styles/landing.css'

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.75a6.25 6.25 0 0 0-6.25 6.25c0 4.95 5.1 10.59 5.31 10.82a1.26 1.26 0 0 0 1.88 0c.22-.23 5.31-5.87 5.31-10.82A6.25 6.25 0 0 0 12 2.75Zm0 8.5a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" fill="currentColor" />
    </svg>
  )
}

const tabs = ['Trips', 'Guides', 'Journals']

export default function ProfilePage() {
  const navigate = useNavigate()
  const { username: routeUsername } = useParams()
  const { token, user, savedTrips, removeTrip, openSavedTrip, updateProfile } = useApp()
  const [activeTab, setActiveTab] = useState('Trips')
  const [editOpen, setEditOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [publicUser, setPublicUser] = useState(null)
  const [loadingPublic, setLoadingPublic] = useState(false)
  const [publicNotFound, setPublicNotFound] = useState(false)

  const [publicTrips, setPublicTrips] = useState([])
  const [loadingPublicTrips, setLoadingPublicTrips] = useState(false)
  const [publicTripsError, setPublicTripsError] = useState(null)

  const [followStats, setFollowStats] = useState({ followerCount: 0, followingCount: 0, isFollowing: false })
  const [followLoading, setFollowLoading] = useState(false)

  const cleanRouteUsername = (routeUsername || '').trim().replace(/^@/, '')
  const cleanCurrentUsername = (user?.username || '').trim().replace(/^@/, '')
  const isOwnProfile = !cleanRouteUsername || cleanRouteUsername.toLowerCase() === cleanCurrentUsername.toLowerCase()

  useEffect(() => {
    let cancelled = false
    const target = isOwnProfile ? cleanCurrentUsername : cleanRouteUsername
    if (!target) return

    fetchFollowStatusRequest(target, token)
      .then((res) => {
        if (!cancelled && res) {
          setFollowStats({
            followerCount: res.followerCount ?? 0,
            followingCount: res.followingCount ?? 0,
            isFollowing: !!res.isFollowing,
          })
        }
      })
      .catch(() => {
        // Safe fallback without breaking profile loading
      })

    return () => {
      cancelled = true
    }
  }, [cleanRouteUsername, cleanCurrentUsername, isOwnProfile, token])

  useEffect(() => {
    if (isOwnProfile) {
      setPublicUser(null)
      setLoadingPublic(false)
      setPublicNotFound(false)
      setPublicTrips([])
      setLoadingPublicTrips(false)
      setPublicTripsError(null)
      return
    }

    let cancelled = false
    setLoadingPublic(true)
    setPublicNotFound(false)
    setLoadingPublicTrips(true)
    setPublicTripsError(null)

    // 1. Fetch user identity
    fetchPublicUserByUsernameRequest(cleanRouteUsername)
      .then((res) => {
        if (!cancelled) {
          if (res?.success && res.user) {
            setPublicUser(res.user)
            setPublicNotFound(false)
            if (res.user.followerCount !== undefined && res.user.followingCount !== undefined) {
              setFollowStats((prev) => ({
                ...prev,
                followerCount: res.user.followerCount,
                followingCount: res.user.followingCount,
              }))
            }
          } else {
            setPublicNotFound(true)
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPublic(false)
        }
      })

    // 2. Fetch public trips
    fetchPublicTripsByUsernameRequest(cleanRouteUsername)
      .then((res) => {
        if (!cancelled) {
          if (res?.success && Array.isArray(res.trips)) {
            setPublicTrips(res.trips)
          } else {
            setPublicTrips([])
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPublicTrips([])
          setPublicTripsError(err?.message || 'Failed to load public trips')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPublicTrips(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [cleanRouteUsername, isOwnProfile])

  const activeUser = isOwnProfile ? user : publicUser

  const stats = useMemo(() => ([
    { label: 'Followers', value: followStats.followerCount || 0 },
    { label: 'Following', value: followStats.followingCount || 0 },
  ]), [followStats.followerCount, followStats.followingCount])
  const profileLink = useMemo(() => buildProfileLink(activeUser || user), [activeUser, user])

  function openTrip(tripId, tripObj) {
    if (!isOwnProfile) return
    const record = tripObj || savedTrips.find((entry) => String(entry.id || entry.tripId) === String(tripId))
    if (record) openSavedTrip(tripId)
    navigate('/workspace')
  }

  async function handleToggleFollow() {
    if (!token) {
      navigate('/login')
      return
    }
    if (!cleanRouteUsername || followLoading) return

    setFollowLoading(true)
    try {
      if (followStats.isFollowing) {
        const res = await unfollowUserRequest(token, cleanRouteUsername)
        setFollowStats({
          followerCount: res.followerCount ?? Math.max(0, followStats.followerCount - 1),
          followingCount: res.followingCount ?? followStats.followingCount,
          isFollowing: false,
        })
      } else {
        const res = await followUserRequest(token, cleanRouteUsername)
        setFollowStats({
          followerCount: res.followerCount ?? (followStats.followerCount + 1),
          followingCount: res.followingCount ?? followStats.followingCount,
          isFollowing: true,
        })
      }
    } catch (err) {
      console.error('Follow action failed:', err)
    } finally {
      setFollowLoading(false)
    }
  }

  if (!isOwnProfile && publicNotFound && !loadingPublic) {
    return (
      <div className="TripHubPage TripHubPage--profile">
        <TripHubHeader activePage="profile" />

        <main className="TripHubMain TripHubProfileMain">
          <div className="TripHubProfileNotFound">
            <h2>User not found</h2>
            <p>The profile @{cleanRouteUsername} does not exist or is unavailable.</p>
            <button type="button" className="TripHubProfileButton" onClick={() => navigate('/home')}>
              Back to Home
            </button>
          </div>
        </main>

        <LandingFooter />
      </div>
    )
  }

  return (
    <div className="TripHubPage TripHubPage--profile">
      <TripHubHeader activePage="profile" />

      <main className="TripHubMain TripHubProfileMain">
        <section className="TripHubProfileLayout">
          <aside className="TripHubProfileSidebar">
            <div className="TripHubProfileCard">
              <div className="TripHubProfileAvatar">
                {activeUser?.profileImage ? (
                  <img src={activeUser.profileImage} alt={formatDisplayName(activeUser)} />
                ) : (
                  <span>{getInitials(activeUser)}</span>
                )}
              </div>

              <div className="TripHubProfileIdentity">
                <h1>{formatDisplayName(activeUser)}</h1>
                <p>{formatUsername(activeUser)}</p>
                {activeUser?.bio ? (
                  <p className="TripHubProfileBio">{activeUser.bio}</p>
                ) : null}
              </div>

              <div className="TripHubProfileActions">
                {isOwnProfile ? (
                  <button type="button" className="TripHubProfileButton" onClick={() => setEditOpen(true)}>Edit Profile</button>
                ) : (
                  <button
                    type="button"
                    className={`TripHubProfileButton${followStats.isFollowing ? ' TripHubProfileButton--dark' : ''}`}
                    disabled={followLoading}
                    onClick={handleToggleFollow}
                  >
                    {followLoading ? '...' : followStats.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                <button
                  type="button"
                  className={`TripHubProfileButton${isOwnProfile ? ' TripHubProfileButton--dark' : ''}`}
                  onClick={() => setShareOpen(true)}
                >
                  Share Profile
                </button>
              </div>

              <div className="TripHubProfileStats">
                {stats.map((item) => (
                  <div key={item.label} className="TripHubProfileStat">
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="TripHubProfileContent">
            <div className="TripHubProfileMapCard">
              <div className="TripHubProfileMapHeader">
                <div>
                  <p className="TripHubProfileMapEyebrow">TripNest Profile</p>
                  <h2>Travel activity overview</h2>
                </div>
                <div className="TripHubProfileMapBadge">
                  <MapPinIcon />
                  <span>Map Preview</span>
                </div>
              </div>

              <div className="TripHubProfileMapPlaceholder" aria-hidden="true">
                <div className="TripHubProfileMapPlaceholder__grid" />
                <div className="TripHubProfileMapPlaceholder__route route-a" />
                <div className="TripHubProfileMapPlaceholder__route route-b" />
                <div className="TripHubProfileMapPlaceholder__pin pin-a" />
                <div className="TripHubProfileMapPlaceholder__pin pin-b" />
                <div className="TripHubProfileMapPlaceholder__pin pin-c" />
              </div>
            </div>

            <div className="TripHubProfileTabs">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`TripHubProfileTab${activeTab === tab ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="TripHubProfilePanel">
              {activeTab === 'Trips' ? (
                isOwnProfile ? (
                  <TripHubSavedTripsGrid
                    savedTrips={savedTrips}
                    onOpenTrip={openTrip}
                    onDeleteTrip={removeTrip}
                    emptyMessage="No saved trips yet."
                  />
                ) : loadingPublicTrips ? (
                  <div className="TripHubTrips__empty">
                    <p>Loading public trips...</p>
                  </div>
                ) : publicTripsError ? (
                  <div className="TripHubTrips__empty">
                    <p>Unable to load public trips right now.</p>
                  </div>
                ) : !publicTrips.length ? (
                  <div className="TripHubTrips__empty">
                    <p>No public trips yet.</p>
                  </div>
                ) : (
                  <div className="TripHubTrips__grid">
                    {publicTrips.map((trip) => {
                      const tripId = trip.tripId || trip.id
                      const title = trip.title || trip.destination || trip.name || 'My Trip'
                      const dateText = formatTripDateRange(trip.startDate, trip.endDate) || (trip.startDate ? trip.startDate : 'Dates not set')
                      const placeCount = trip.placeCount ?? 0
                      const dayCount = trip.dayCount

                      return (
                        <article
                          key={tripId}
                          className="TripHubCard TripHubCard--public"
                          data-trip-id={tripId}
                          data-open-trip="true"
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/trips/public/${tripId}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigate(`/trips/public/${tripId}`)
                            }
                          }}
                        >
                          <div
                            className="TripHubCard__image"
                            style={{ backgroundImage: "url('/assets/images/trip-pakistan.jpg')" }}
                          >
                            <span className="TripHubCard__badge TripHubCard__badge--public">Public</span>
                          </div>
                          <div className="TripHubCard__body">
                            <h3>{title}</h3>
                            <p className="TripHubCard__meta">{dateText}</p>
                            <div className="TripHubCard__metaDetails">
                              <span className="TripHubCard__meta">{placeCount} {placeCount === 1 ? 'place' : 'places'}</span>
                              {dayCount ? <span className="TripHubCard__meta"> • {dayCount} {dayCount === 1 ? 'day' : 'days'}</span> : null}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )
              ) : null}

              {activeTab === 'Guides' ? (
                <div className="TripHubProfileEmptyState">
                  <p>{isOwnProfile ? "You haven't written any guides yet." : "No guides written yet."}</p>
                  {isOwnProfile && (
                    <button type="button" className="TripHubCtaButton">Create Guide</button>
                  )}
                </div>
              ) : null}

              {activeTab === 'Journals' ? (
                <div className="TripHubProfileEmptyState">
                  <p>{isOwnProfile ? "You don't have any trip journals yet." : "No trip journals yet."}</p>
                  {isOwnProfile && (
                    <button type="button" className="TripHubCtaButton">Start Planning a Trip</button>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </main>

      <LandingFooter />

      {isOwnProfile && (
        <ProfileEditModal
          open={editOpen}
          user={user}
          saving={saving}
          onClose={() => {
            if (saving) return
            setEditOpen(false)
          }}
          onSave={async (draft) => {
            setSaving(true)
            try {
              await updateProfile(draft)
              setEditOpen(false)
            } finally {
              setSaving(false)
            }
          }}
        />
      )}

      <ProfileShareModal
        open={shareOpen}
        profileLink={profileLink}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}

