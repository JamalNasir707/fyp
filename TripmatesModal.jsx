import React, { useEffect, useState } from 'react'
import { getTripMembersRequest, sendTripInvitationRequest } from '../lib/session'

const AVATAR_COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777']

export function getAvatarColor(identifier = '') {
  let hash = 0
  const str = String(identifier || 'user')
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export default function TripmatesModal({ isOpen, onClose, tripId, token, currentUser }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ownerData, setOwnerData] = useState(null)
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])

  // Invitation submission state
  const [inviteIdentifier, setInviteIdentifier] = useState('')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState(null)

  useEffect(() => {
    if (!isOpen || !tripId || !token) {
      if (!isOpen) {
        setOwnerData(null)
        setMembers([])
        setPendingInvites([])
        setError(null)
        setInviteIdentifier('')
        setInviteSubmitting(false)
        setInviteError(null)
      }
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    getTripMembersRequest(token, tripId)
      .then((data) => {
        if (!isMounted) return
        if (data?.success) {
          setOwnerData(data.owner || null)
          setMembers(data.members || [])
          setPendingInvites(data.pendingInvites || [])
        } else {
          setError(data?.error || 'Failed to load trip members')
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load trip members')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, tripId, token])

  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    const target = inviteIdentifier.trim()
    if (!target || inviteSubmitting || !token || !tripId) return

    setInviteSubmitting(true)
    setInviteError(null)

    try {
      const res = await sendTripInvitationRequest(token, tripId, target)
      if (res?.success && res?.invitation) {
        const newInv = res.invitation
        setPendingInvites((prev) => {
          const exists = prev.some((inv) => String(inv.id) === String(newInv.id))
          return exists ? prev : [newInv, ...prev]
        })
        setInviteIdentifier('')
      } else {
        setInviteError(res?.error || res?.detail || 'Failed to send invitation')
      }
    } catch (err) {
      setInviteError(err?.message || err?.detail || 'Failed to send invitation')
    } finally {
      setInviteSubmitting(false)
    }
  }

  if (!isOpen) return null

  const currentUserIdStr = String(currentUser?.user_id || currentUser?.id || currentUser?._id || '')

  const displayMembers = []
  if (ownerData) {
    displayMembers.push({
      id: ownerData.id,
      userId: ownerData.id,
      name: ownerData.name || ownerData.username || 'Owner',
      username: ownerData.username || '',
      profileImage: ownerData.profileImage,
      isOwner: true,
      role: 'owner',
    })
  }

  members.forEach((m) => {
    if (ownerData && String(m.userId || m.id) === String(ownerData.id)) return
    displayMembers.push({
      id: m.id || m.userId,
      userId: m.userId || m.id,
      name: m.userName || m.name || m.username || 'Member',
      username: m.userEmail ? m.userEmail.split('@')[0] : (m.username || 'user'),
      email: m.userEmail,
      profileImage: m.userProfileImage || m.profileImage,
      isOwner: false,
      role: 'member',
    })
  })

  return (
    <div className="PlannerModalOverlay" onClick={onClose}>
      <div 
        className="PlannerModalCard ShareTripModal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '100%', borderRadius: '16px', padding: '24px' }}
      >
        {/* Header */}
        <div className="ShareTripModal__header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Tripmates</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Travel together on this trip</p>
          </div>
          <button
            type="button"
            className="PlannerModalCloseButton"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="ShareTripModal__body" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Roster Error Banner */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* 1. INVITE PEOPLE SECTION */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
              INVITE PEOPLE
            </label>

            {inviteError && (
              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>
                {inviteError}
              </div>
            )}

            <form className="ShareInviteForm" onSubmit={handleInviteSubmit} style={{ display: 'flex', gap: '8px', position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  className="ShareInviteInput"
                  placeholder="Enter username or email address..."
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  disabled={inviteSubmitting}
                  style={{ paddingLeft: '36px', width: '100%' }}
                />
              </div>
              <button
                type="submit"
                className="PlannerPillButton PlannerPillButton--dark ShareInviteButton"
                disabled={inviteSubmitting || !inviteIdentifier.trim()}
              >
                {inviteSubmitting ? 'Inviting...' : 'Invite'}
              </button>
            </form>
          </div>

          {/* 2. MEMBERS SECTION */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', margin: 0 }}>
                MEMBERS <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8', marginLeft: '4px' }}>- {loading ? '...' : displayMembers.length}</span>
              </label>
            </div>
            
            {loading && displayMembers.length === 0 ? (
              <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                Loading tripmates...
              </div>
            ) : displayMembers.length === 0 ? (
              <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                Members will appear here once invitations are accepted.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayMembers.map((member) => {
                  const isCurrentUser = currentUserIdStr && String(member.userId) === currentUserIdStr
                  const initials = (member.name || member.username || 'U').slice(0, 2).toUpperCase()
                  const avatarBg = getAvatarColor(member.username || member.userId)
                  return (
                    <div 
                      key={member.userId}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: avatarBg, color: '#ffffff', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {member.profileImage ? (
                            <img src={member.profileImage} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            initials
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{member.name}</span>
                            {isCurrentUser && (
                              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 500 }}>(You)</span>
                            )}
                          </div>
                          {member.username && (
                            <div style={{ fontSize: '12px', color: '#64748b' }}>@{member.username}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {member.isOwner ? (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 600 }}>
                            Owner
                          </span>
                        ) : (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 600 }}>
                            Member
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 3. PENDING INVITES SECTION */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#d97706', margin: 0 }}>
                PENDING INVITES <span style={{ fontSize: '11px', fontWeight: 500, color: '#b45309', marginLeft: '4px' }}>- {loading ? '...' : pendingInvites.length}</span>
              </label>
            </div>
            
            {loading && pendingInvites.length === 0 ? (
              <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', textAlign: 'center', fontSize: '13px', color: '#b45309' }}>
                Loading invitations...
              </div>
            ) : pendingInvites.length === 0 ? (
              <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', textAlign: 'center', fontSize: '13px', color: '#b45309' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span>No pending invitations.</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingInvites.map((inv) => (
                  <div 
                    key={inv.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                          {inv.userName || inv.userEmail || 'Invited Traveler'}
                        </div>
                        {inv.userEmail && (
                          <div style={{ fontSize: '11px', color: '#b45309' }}>{inv.userEmail}</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <span style={{ padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '11px', fontWeight: 600 }}>
                        Invited
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="ShareTripModal__footer" style={{ marginTop: '24px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="PlannerPillButton PlannerPillButton--light"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
