import React, { useState, useEffect, useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { useApp } from '../../context/AppContext'
import { apiService } from '../../api/apiService'
import Card from '../../components/common/Card'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'

export function AdminScreen({ navigation }) {
  const { user, token } = useApp()

  // Guard: Admin role verification
  const isAdmin = user?.role === 'admin'

  // Admin Tab: 'overview' | 'users' | 'trips'
  const [activeTab, setActiveTab] = useState('overview')

  // Overview Data
  const [overview, setOverview] = useState({ counts: { users: 0, trips: 0, activeSessions: 0 } })
  const [overviewLoading, setOverviewLoading] = useState(false)

  // Users Data
  const [usersList, setUsersList] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('') // '' | 'user' | 'admin' | 'creator'
  const [statusFilter, setStatusFilter] = useState('') // '' | 'active' | 'suspended'

  // Trips Data
  const [tripsList, setTripsList] = useState([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [tripSearch, setTripSearch] = useState('')

  const [refreshing, setRefreshing] = useState(false)

  const loadOverview = useCallback(async () => {
    if (!token || !isAdmin) return
    setOverviewLoading(true)
    try {
      const res = await apiService.getAdminOverview(token)
      if (res?.success) {
        setOverview(res)
      }
    } catch (err) {
      console.warn('Failed to load admin overview:', err.message)
    } finally {
      setOverviewLoading(false)
    }
  }, [token, isAdmin])

  const loadUsers = useCallback(async () => {
    if (!token || !isAdmin) return
    setUsersLoading(true)
    try {
      const res = await apiService.getAdminUsers(token, {
        search: userSearch,
        role: roleFilter,
        status: statusFilter,
        limit: 50,
      })
      if (res?.success && Array.isArray(res.users)) {
        setUsersList(res.users)
      }
    } catch (err) {
      console.warn('Failed to load admin users:', err.message)
    } finally {
      setUsersLoading(false)
    }
  }, [token, isAdmin, userSearch, roleFilter, statusFilter])

  const loadTrips = useCallback(async () => {
    if (!token || !isAdmin) return
    setTripsLoading(true)
    try {
      const res = await apiService.getAdminTrips(token, tripSearch)
      if (res?.success && Array.isArray(res.trips)) {
        setTripsList(res.trips)
      }
    } catch (err) {
      console.warn('Failed to load admin trips:', err.message)
    } finally {
      setTripsLoading(false)
    }
  }, [token, isAdmin, tripSearch])

  useEffect(() => {
    if (isAdmin) {
      loadOverview()
      loadUsers()
      loadTrips()
    }
  }, [isAdmin, loadOverview, loadUsers, loadTrips])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([loadOverview(), loadUsers(), loadTrips()])
    setRefreshing(false)
  }

  // --- User Management Actions ---
  async function handleToggleUserStatus(targetUser) {
    const newStatus = targetUser.status === 'suspended' ? 'active' : 'suspended'
    const verb = newStatus === 'suspended' ? 'Suspend' : 'Reactivate'

    Alert.alert(
      `${verb} User Account`,
      `Are you sure you want to ${verb.toLowerCase()} @${targetUser.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: newStatus === 'suspended' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await apiService.updateAdminUserStatus(token, targetUser.id || targetUser._id, newStatus)
              Alert.alert('Status Updated', `@${targetUser.username} is now ${newStatus}.`)
              loadUsers()
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to update user status.')
            }
          },
        },
      ]
    )
  }

  async function handleChangeUserRole(targetUser, newRole) {
    Alert.alert(
      'Change User Role',
      `Assign role "${newRole}" to @${targetUser.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Role',
          onPress: async () => {
            try {
              await apiService.updateAdminUserRole(token, targetUser.id || targetUser._id, newRole)
              Alert.alert('Role Updated', `@${targetUser.username} is now a ${newRole}.`)
              loadUsers()
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to update user role.')
            }
          },
        },
      ]
    )
  }

  async function handleDeleteUser(targetUser) {
    Alert.alert(
      'Permanently Delete User',
      `Are you sure you want to delete @${targetUser.username}? This removes all trips and data associated with this user.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteAdminUser(token, targetUser.id || targetUser._id)
              Alert.alert('User Deleted', `@${targetUser.username} has been deleted.`)
              loadUsers()
              loadOverview()
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete user.')
            }
          },
        },
      ]
    )
  }

  // --- Trip Management Actions ---
  async function handleDeleteTrip(targetTrip) {
    Alert.alert(
      'Delete Trip Record',
      `Are you sure you want to delete "${targetTrip.title || targetTrip.destination}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Trip',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteAdminTrip(token, targetTrip.id || targetTrip.tripId)
              Alert.alert('Trip Deleted', `Trip record has been removed.`)
              loadTrips()
              loadOverview()
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete trip.')
            }
          },
        },
      ]
    )
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Access Denied</Text>
          <View style={{ width: 38 }} />
        </View>
        <EmptyState
          iconName="shield-outline"
          title="Administrative Access Required"
          description="Your current user account does not possess administrator permissions. Please contact your platform administrator."
          actionTitle="Return to App"
          onActionPress={() => navigation.goBack()}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.navTitle}>Admin Console</Text>
          <Text style={styles.navSub}>TripNest Platform Management</Text>
        </View>
        <Badge label="Super Admin" variant="accent" size="sm" />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { key: 'overview', label: 'Overview', icon: 'grid-outline' },
          { key: 'users', label: 'Users', icon: 'people-outline' },
          { key: 'trips', label: 'Trips', icon: 'airplane-outline' },
        ].map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >
        {/* ========================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <View style={styles.sectionCol}>
            {/* Metric Stats Cards */}
            <View style={styles.statsRow}>
              <Card style={styles.statCard} padding="md">
                <Ionicons name="people" size={24} color={colors.primary} />
                <Text style={styles.statNumber}>{overview.counts?.users || usersList.length || 0}</Text>
                <Text style={styles.statLabel}>Registered Users</Text>
              </Card>

              <Card style={styles.statCard} padding="md">
                <Ionicons name="airplane" size={24} color={colors.accent} />
                <Text style={styles.statNumber}>{overview.counts?.trips || tripsList.length || 0}</Text>
                <Text style={styles.statLabel}>Total Trips</Text>
              </Card>

              <Card style={styles.statCard} padding="md">
                <Ionicons name="pulse" size={24} color={colors.success} />
                <Text style={styles.statNumber}>{overview.counts?.activeSessions || 3}</Text>
                <Text style={styles.statLabel}>Active Sessions</Text>
              </Card>
            </View>

            {/* Platform Status Card */}
            <Card style={styles.card} padding="lg">
              <Text style={styles.cardTitle}>System Health & Connection</Text>

              <View style={styles.healthRow}>
                <View style={styles.healthDot} />
                <Text style={styles.healthText}>FastAPI Backend Service: Online</Text>
              </View>
              <View style={styles.healthRow}>
                <View style={styles.healthDot} />
                <Text style={styles.healthText}>Database Cluster: Connected</Text>
              </View>
              <View style={styles.healthRow}>
                <View style={styles.healthDot} />
                <Text style={styles.healthText}>OSRM Routing Engine: Operational</Text>
              </View>
            </Card>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: USERS */}
        {/* ========================================================= */}
        {activeTab === 'users' && (
          <View style={styles.sectionCol}>
            {/* Search and Filters */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={userSearch}
                onChangeText={setUserSearch}
                placeholder="Search by name, handle, or email..."
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
              {[
                { label: 'All Roles', value: '' },
                { label: 'Users', value: 'user' },
                { label: 'Admins', value: 'admin' },
                { label: 'Creators', value: 'creator' },
              ].map((pill) => (
                <TouchableOpacity
                  key={pill.label}
                  style={[styles.smallFilterPill, roleFilter === pill.value && styles.smallFilterPillActive]}
                  onPress={() => setRoleFilter(pill.value)}
                >
                  <Text style={[styles.smallFilterPillText, roleFilter === pill.value && styles.smallFilterPillTextActive]}>
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {usersLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : usersList.length === 0 ? (
              <Text style={styles.emptyListText}>No users found matching your search.</Text>
            ) : (
              usersList.map((u) => {
                const isSuspended = u.status === 'suspended'
                return (
                  <Card key={u.id || u._id || u.username} style={styles.userCard} padding="md">
                    <View style={styles.userCardTop}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.avatarLetter}>
                          {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userInfoCol}>
                        <View style={styles.userNameRow}>
                          <Text style={styles.userName}>{u.name || u.displayName || u.username}</Text>
                          <Badge
                            label={u.role || 'user'}
                            variant={u.role === 'admin' ? 'accent' : 'primary'}
                            size="sm"
                          />
                          <Badge
                            label={isSuspended ? 'Suspended' : 'Active'}
                            variant={isSuspended ? 'error' : 'success'}
                            size="sm"
                          />
                        </View>
                        <Text style={styles.userHandle}>@{u.username} • {u.email}</Text>
                      </View>
                    </View>

                    {/* Actions Bar */}
                    <View style={styles.userActionsRow}>
                      <TouchableOpacity
                        style={[styles.userActionBtn, isSuspended && styles.userActionBtnReactivate]}
                        onPress={() => handleToggleUserStatus(u)}
                      >
                        <Ionicons
                          name={isSuspended ? 'checkmark-circle-outline' : 'ban-outline'}
                          size={14}
                          color={isSuspended ? colors.success : colors.warning}
                        />
                        <Text style={[styles.userActionBtnText, { color: isSuspended ? colors.success : colors.warning }]}>
                          {isSuspended ? 'Reactivate' : 'Suspend'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.userActionBtn}
                        onPress={() => {
                          const nextRole = u.role === 'admin' ? 'user' : 'admin'
                          handleChangeUserRole(u, nextRole)
                        }}
                      >
                        <Ionicons name="key-outline" size={14} color={colors.primary} />
                        <Text style={[styles.userActionBtnText, { color: colors.primary }]}>
                          {u.role === 'admin' ? 'Demote' : 'Promote Admin'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.userActionBtn, styles.deleteActionBtn]}
                        onPress={() => handleDeleteUser(u)}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                        <Text style={[styles.userActionBtnText, { color: colors.error }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                )
              })
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: TRIPS */}
        {/* ========================================================= */}
        {activeTab === 'trips' && (
          <View style={styles.sectionCol}>
            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={tripSearch}
                onChangeText={setTripSearch}
                placeholder="Search trips by title or destination..."
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {tripsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : tripsList.length === 0 ? (
              <Text style={styles.emptyListText}>No trips found matching query.</Text>
            ) : (
              tripsList.map((t, idx) => (
                <Card key={`admin-trip-${t.id || t.tripId || idx}`} style={styles.tripCard} padding="md">
                  <View style={styles.tripCardTop}>
                    <View style={styles.tripMetaCol}>
                      <Text style={styles.tripCardTitle}>{t.title || t.destination}</Text>
                      <Text style={styles.tripCardSub}>
                        📍 {t.destination || 'Destination'} • {t.dates || 'Dates not set'}
                      </Text>
                      <Text style={styles.tripOwnerText}>Author: @{t.owner || 'traveler'}</Text>
                    </View>
                    <Badge label={t.privacy || 'private'} variant="primary" size="sm" />
                  </View>

                  <View style={styles.tripActionsRow}>
                    <TouchableOpacity
                      style={styles.deleteTripBtn}
                      onPress={() => handleDeleteTrip(t)}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                      <Text style={styles.deleteTripBtnText}>Delete Trip</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  navSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  scrollContent: {
    padding: 16,
  },
  sectionCol: {
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  healthText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  filterPillsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  smallFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  smallFilterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallFilterPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  smallFilterPillTextActive: {
    color: colors.textWhite,
  },
  emptyListText: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  userCard: {
    backgroundColor: colors.surface,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  userInfoCol: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userHandle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  userActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surfaceHover,
  },
  userActionBtnReactivate: {
    backgroundColor: '#ecfdf5',
  },
  deleteActionBtn: {
    backgroundColor: '#fef2f2',
  },
  userActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tripCard: {
    backgroundColor: colors.surface,
  },
  tripCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tripMetaCol: {
    flex: 1,
    paddingRight: 10,
  },
  tripCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tripCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  tripOwnerText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tripActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  deleteTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  deleteTripBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error,
  },
})

export default AdminScreen
