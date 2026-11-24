/**
 * AV2UsersPage — User Management
 * ────────────────────────────────
 * Fully connected to the backend API in Phase 2.1 & 2.2.
 * Supports text search, filtering, pagination, details inspection drawer,
 * role promotion/demotion, account suspension, and deletion actions.
 *
 * Visual layout and reusable component library are fully preserved.
 */
import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import {
  fetchAdminUsersRequest,
  fetchAdminUserDetailsRequest,
  updateUserStatusRequest,
  updateUserRoleRequest,
  deleteUserRequest,
} from '../../lib/session'
import {
  AdminPageHeader,
  AdminPanel,
  AdminSection,
  AdminBadge,
  AdminRoleBadge,
  AdminStatusIndicator,
  AdminButton,
  AdminFilterBar,
  AdminDataTable,
  AdminPagination,
  AdminPlaceholderBanner,
  AdminDrawer,
  AdminConfirmModal,
  AdminLoadingSkeleton,
} from './components'

const COLUMNS = ['User ID', 'Username', 'Email', 'Provider', 'Role', 'Status', 'Joined', 'Last Login', 'Trips', 'Actions']

const selectStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 13,
  color: '#374151',
  cursor: 'pointer',
  fontFamily: 'inherit',
  outline: 'none',
  height: 34,
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const valueStyle = {
  fontSize: 14,
  fontWeight: 500,
  color: '#111827',
  wordBreak: 'break-all',
}

export default function AV2UsersPage() {
  const { token, user: loggedInAdmin } = useApp()
  
  // State variables for list data and pagination
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // State variables for search and filters
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [providerFilter, setProviderFilter] = useState('')

  // 1. Detail Drawer State
  const [selectedUserForDetail, setSelectedUserForDetail] = useState(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [detailUserLoading, setDetailUserLoading] = useState(false)
  const [detailUserError, setDetailUserError] = useState('')
  const [detailUserTrips, setDetailUserTrips] = useState([])
  const [detailUserSessions, setDetailUserSessions] = useState(0)

  // 2. Suspend/Unsuspend Confirmation Modal State
  const [selectedUserForStatus, setSelectedUserForStatus] = useState(null)
  const [targetStatus, setTargetStatus] = useState('active')
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusActionLoading, setStatusActionLoading] = useState(false)

  // 3. Delete Confirmation Modal State
  const [selectedUserForDelete, setSelectedUserForDelete] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteActionLoading, setDeleteActionLoading] = useState(false)

  // 4. Role Confirmation Modal State
  const [selectedUserForRole, setSelectedUserForRole] = useState(null)
  const [targetRole, setTargetRole] = useState('')
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleActionLoading, setRoleActionLoading] = useState(false)

  // Debounce search input changes
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Fetch users on query parameters or token changes
  const loadUsersList = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const params = {
        page,
        limit: 10,
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
        provider: providerFilter,
      }
      
      const response = await fetchAdminUsersRequest(token, params)
      if (response.success) {
        setUsers(response.users || [])
        setTotal(response.total || 0)
        setTotalPages(response.totalPages || 1)
      } else {
        setError(response.error || 'Failed to load users.')
      }
    } catch (err) {
      setError(err.message || 'Error communicating with the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsersList()
  }, [token, page, searchQuery, roleFilter, statusFilter, providerFilter])

  // Handlers for pagination
  const handlePrev = () => {
    if (page > 1) setPage(p => p - 1)
  }

  const handleNext = () => {
    if (page < totalPages) setPage(p => p + 1)
  }

  // Handlers for user details drawer
  const handleOpenDetail = async (userRecord) => {
    setSelectedUserForDetail(userRecord)
    setDetailDrawerOpen(true)
    setDetailUserLoading(true)
    setDetailUserError('')
    setDetailUserTrips([])
    setDetailUserSessions(0)
    try {
      const res = await fetchAdminUserDetailsRequest(token, userRecord.id)
      if (res.success) {
        setSelectedUserForDetail(res.user)
        setDetailUserTrips(res.user.recentTrips || [])
        setDetailUserSessions(res.user.activeSessions || 0)
      } else {
        setDetailUserError(res.error || 'Failed to load details.')
      }
    } catch (err) {
      setDetailUserError(err.message || 'Error communicating with server.')
    } finally {
      setDetailUserLoading(false)
    }
  }

  // Handlers for status suspension updates
  const handleOpenStatusModal = (userRecord, nextStatus) => {
    setSelectedUserForStatus(userRecord)
    setTargetStatus(nextStatus)
    setStatusModalOpen(true)
  }

  const handleConfirmStatusChange = async () => {
    if (!selectedUserForStatus) return
    setStatusActionLoading(true)
    try {
      const res = await updateUserStatusRequest(token, selectedUserForStatus.id, targetStatus)
      if (res.success) {
        // Update user record in list state
        setUsers(prev => prev.map(u => u.id === selectedUserForStatus.id ? { ...u, status: targetStatus } : u))
        
        // Update user record in details drawer state if open
        if (selectedUserForDetail && selectedUserForDetail.id === selectedUserForStatus.id) {
          setSelectedUserForDetail(prev => ({ ...prev, status: targetStatus }))
        }
        
        setStatusModalOpen(false)
      } else {
        alert(res.error || 'Failed to update account status.')
      }
    } catch (err) {
      alert(err.message || 'Error communicating with server.')
    } finally {
      setStatusActionLoading(false)
    }
  }

  // Handlers for role updates
  const handleOpenRoleModal = (userRecord, nextRole) => {
    setDetailUserError('')
    if (userRecord.id === loggedInAdmin?.id) {
      setDetailUserError("You cannot change or demote your own administrator role.")
      return
    }
    setSelectedUserForRole(userRecord)
    setTargetRole(nextRole)
    setRoleModalOpen(true)
  }

  const handleConfirmRoleChange = async () => {
    if (!selectedUserForRole || !targetRole) return
    setRoleActionLoading(true)
    setDetailUserError('')
    try {
      const res = await updateUserRoleRequest(token, selectedUserForRole.id, targetRole)
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === selectedUserForRole.id ? { ...u, role: targetRole } : u))
        if (selectedUserForDetail && selectedUserForDetail.id === selectedUserForRole.id) {
          setSelectedUserForDetail(prev => ({ ...prev, role: targetRole }))
        }
        setRoleModalOpen(false)
      } else {
        setDetailUserError(res.error || 'Failed to change user role.')
        setRoleModalOpen(false)
      }
    } catch (err) {
      setDetailUserError(err.message || 'Error communicating with server.')
      setRoleModalOpen(false)
    } finally {
      setRoleActionLoading(false)
    }
  }

  // Handlers for user deletion
  const handleOpenDeleteModal = (userRecord) => {
    setSelectedUserForDelete(userRecord)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedUserForDelete) return
    
    // Prevent self-deletion on client side
    if (selectedUserForDelete.id === loggedInAdmin?.user_id) {
      alert("You cannot delete your own active administrator account.");
      setDeleteModalOpen(false);
      return;
    }

    setDeleteActionLoading(true)
    try {
      const res = await deleteUserRequest(token, selectedUserForDelete.id)
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== selectedUserForDelete.id))
        setTotal(t => Math.max(0, t - 1))
        setDeleteModalOpen(false)
        if (detailDrawerOpen && selectedUserForDetail?.id === selectedUserForDelete.id) {
          setDetailDrawerOpen(false)
        }
      } else {
        alert(res.error || 'Failed to delete user account.')
      }
    } catch (err) {
      alert(err.message || 'Error communicating with server.')
    } finally {
      setDeleteActionLoading(false)
    }
  }

  // Render individual table row
  const renderUserRow = (row) => {
    const joinedDate = row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) : '—'

    const lastLoginStr = row.lastLogin ? new Date(row.lastLogin).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }) : 'Never'

    return (
      <tr key={row.id}>
        <td style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>
          {row.id}
        </td>
        <td><strong>{row.username}</strong></td>
        <td style={{ color: '#6b7280' }}>{row.email}</td>
        <td>
          <AdminBadge color={row.provider === 'google' ? 'red' : 'gray'}>
            {row.provider}
          </AdminBadge>
        </td>
        <td><AdminRoleBadge role={row.role} /></td>
        <td><AdminStatusIndicator status={row.status} /></td>
        <td style={{ color: '#6b7280' }}>{joinedDate}</td>
        <td style={{ color: '#6b7280' }}>{lastLoginStr}</td>
        <td><strong>{row.tripCount}</strong></td>
        <td>
          <div style={{ display: 'flex', gap: 6 }}>
            <AdminButton size="sm" onClick={() => handleOpenDetail(row)}>
              View
            </AdminButton>
            <AdminButton
              size="sm"
              variant={row.status === 'active' ? 'warning' : 'ghost'}
              onClick={() => handleOpenStatusModal(row, row.status === 'active' ? 'suspended' : 'active')}
              disabled={row.id === loggedInAdmin?.id}
            >
              {row.status === 'active' ? 'Suspend' : 'Unsuspend'}
            </AdminButton>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <AdminSection>
      <AdminPageHeader
        title="User Management"
        sub="Search, filter, and manage all platform accounts."
      />

      {/* Toolbar */}
      <AdminPanel noPadding={false}>
        <AdminFilterBar
          searchPlaceholder="Search users by name, email, or provider…"
          searchValue={searchInput}
          onSearchChange={(e) => setSearchInput(e.target.value)}
        >
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={selectStyle}
            aria-label="Filter by Role"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={selectStyle}
            aria-label="Filter by Status"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={providerFilter}
            onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
            style={selectStyle}
            aria-label="Filter by Provider"
          >
            <option value="">All Providers</option>
            <option value="credentials">Credentials</option>
            <option value="google">Google</option>
          </select>
        </AdminFilterBar>
      </AdminPanel>

      {/* Error state */}
      {error && (
        <div style={{ color: '#ef4444', background: '#fee2e2', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: 8, fontSize: 13.5 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <AdminPanel
        title="All Users"
        sub={`Showing ${users.length} of ${total} accounts`}
        noPadding
      >
        <AdminDataTable
          columns={COLUMNS}
          rows={users}
          renderRow={renderUserRow}
          emptyTitle="No users found"
          emptyText="No accounts match your current search queries or filter parameters."
          loading={loading}
        />
        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </AdminPanel>

      {/* ────────────────── 1. User Details Drawer ────────────────── */}
      <AdminDrawer
        open={detailDrawerOpen}
        title="User Account Details"
        onClose={() => setDetailDrawerOpen(false)}
        width={500}
      >
        {selectedUserForDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header Block (Avatar & Core details) */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {selectedUserForDetail.profileImage ? (
                <img
                  src={selectedUserForDetail.profileImage}
                  alt=""
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb' }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: '#fff1eb',
                    border: '1px solid #ffd3c2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--av2-accent)',
                  }}
                >
                  {selectedUserForDetail.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                  {selectedUserForDetail.name || selectedUserForDetail.username}
                </h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                  @{selectedUserForDetail.username}
                </p>
              </div>
            </div>

            {/* Error in Drawer */}
            {detailUserError && (
              <div style={{ color: '#ef4444', fontSize: 13, background: '#fee2e2', padding: 10, borderRadius: 6 }}>
                ⚠️ {detailUserError}
              </div>
            )}

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div>
                <div style={labelStyle}>User ID</div>
                <div style={{ ...valueStyle, fontFamily: 'monospace', fontSize: 12 }}>{selectedUserForDetail.id}</div>
              </div>
              <div>
                <div style={labelStyle}>Email Address</div>
                <div style={valueStyle}>{selectedUserForDetail.email}</div>
              </div>
              <div>
                <div style={labelStyle}>Authentication</div>
                <div>
                  <AdminBadge color={selectedUserForDetail.provider === 'google' ? 'red' : 'gray'}>
                    {selectedUserForDetail.provider || 'credentials'}
                  </AdminBadge>
                </div>
              </div>
              <div>
                <div style={labelStyle}>Joined Date</div>
                <div style={valueStyle}>
                  {selectedUserForDetail.createdAt ? new Date(selectedUserForDetail.createdAt).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }) : '—'}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Last Logged In</div>
                <div style={valueStyle}>
                  {selectedUserForDetail.lastLogin ? new Date(selectedUserForDetail.lastLogin).toLocaleString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  }) : 'Never'}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Role</div>
                <div>
                  {detailUserLoading ? (
                    <AdminLoadingSkeleton height={18} width={60} />
                  ) : (
                    <select
                      value={selectedUserForDetail.role || 'user'}
                      onChange={(e) => handleOpenRoleModal(selectedUserForDetail, e.target.value)}
                      disabled={selectedUserForDetail.id === loggedInAdmin?.id}
                      style={{
                        ...selectStyle,
                        height: 28,
                        padding: '2px 8px',
                        fontSize: 12.5,
                        borderColor: '#ffd3c2',
                        background: selectedUserForDetail.id === loggedInAdmin?.id ? '#f3f4f6' : '#ffffff',
                      }}
                      aria-label="Change Role"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Account Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AdminStatusIndicator status={selectedUserForDetail.status || 'active'} />
                  {selectedUserForDetail.id !== loggedInAdmin?.id && (
                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal(selectedUserForDetail, selectedUserForDetail.status === 'active' ? 'suspended' : 'active')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--av2-accent)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      (Toggle)
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Active Sessions</div>
                <div style={valueStyle}>
                  {detailUserLoading ? <AdminLoadingSkeleton height={16} width={40} /> : detailUserSessions}
                </div>
              </div>
            </div>

            {/* Travel Statistics */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
                Trip Itineraries ({selectedUserForDetail.tripCount})
              </h4>
              {detailUserLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <AdminLoadingSkeleton height={40} />
                  <AdminLoadingSkeleton height={40} />
                </div>
              ) : detailUserTrips.length === 0 ? (
                <div style={{ padding: '16px', background: '#fafafa', borderRadius: 8, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb' }}>
                  No saved trips found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detailUserTrips.map(trip => (
                    <div
                      key={trip.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>📍 {trip.destination || 'Custom Route'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          {trip.startDate ? new Date(trip.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—'}
                          {trip.endDate ? ` - ${new Date(trip.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        </div>
                      </div>
                      <AdminBadge color="blue">{trip.itinerary?.length || 0} stops</AdminBadge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Moderation actions (Delete Account) */}
            {selectedUserForDetail.id !== loggedInAdmin?.user_id && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <AdminButton variant="danger" size="sm" onClick={() => handleOpenDeleteModal(selectedUserForDetail)}>
                  Permanently Delete User Account
                </AdminButton>
              </div>
            )}
          </div>
        )}
      </AdminDrawer>

      {/* ────────────────── 2. Suspend/Unsuspend Modal ────────────────── */}
      <AdminConfirmModal
        open={statusModalOpen}
        title={targetStatus === 'suspended' ? 'Suspend User Account?' : 'Unsuspend User Account?'}
        message={
          targetStatus === 'suspended'
            ? `Are you sure you want to suspend account '${selectedUserForStatus?.username}'? Suspended accounts will be restricted from accessing the platform.`
            : `Are you sure you want to unsuspend account '${selectedUserForStatus?.username}'? This will restore their access to create, save, and edit travel itineraries.`
        }
        confirmLabel={targetStatus === 'suspended' ? 'Suspend Account' : 'Unsuspend Account'}
        variant={targetStatus === 'suspended' ? 'danger' : 'warning'}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusModalOpen(false)}
        disabled={statusActionLoading}
      />

      {/* ────────────────── 3. Delete Confirmation Modal ────────────────── */}
      <AdminConfirmModal
        open={deleteModalOpen}
        title="Permanently Delete Account?"
        message={`WARNING: This action is irreversible. Are you sure you want to permanently delete the account '${selectedUserForDelete?.username}'? Doing so will permanently wipe their profile, active sessions, and all ${selectedUserForDelete?.tripCount || 0} saved travel itineraries.`}
        confirmLabel="Wipe Account & Data"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
        disabled={deleteActionLoading}
      />

      {/* ────────────────── 4. Role Confirmation Modal ────────────────── */}
      <AdminConfirmModal
        open={roleModalOpen}
        title={targetRole === 'admin' ? 'Promote User to Admin?' : 'Demote Admin to User?'}
        message={
          targetRole === 'admin'
            ? `Are you sure you want to promote '${selectedUserForRole?.username}' to Administrator? This will grant them full access to all moderation dashboards and platform controls.`
            : `Are you sure you want to demote '${selectedUserForRole?.username}' to standard User? This will remove all their admin privileges and restrict their access to platform management.`
        }
        confirmLabel={targetRole === 'admin' ? 'Promote User' : 'Demote User'}
        variant={targetRole === 'admin' ? 'warning' : 'danger'}
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setRoleModalOpen(false)}
        disabled={roleActionLoading}
      />
    </AdminSection>
  )
}
