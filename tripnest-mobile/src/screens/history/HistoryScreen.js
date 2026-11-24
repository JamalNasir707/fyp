import React, { useEffect, useState, useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { useApp } from '../../context/AppContext'
import EmptyState from '../../components/common/EmptyState'
import Card from '../../components/common/Card'
import Badge from '../../components/common/Badge'

function getActivityIconConfig(eventType) {
  switch (eventType) {
    case 'trip_created':
      return { name: 'add-circle', color: colors.success, bg: '#ecfdf5', label: 'Created' }
    case 'trip_deleted':
      return { name: 'trash-bin', color: colors.error, bg: '#fef2f2', label: 'Deleted' }
    case 'trip_renamed':
    case 'trip_updated':
      return { name: 'create-outline', color: colors.primary, bg: '#eff6ff', label: 'Updated' }
    default:
      return { name: 'time-outline', color: colors.accentDark, bg: '#fffbeb', label: 'Activity' }
  }
}

function formatTimestamp(value) {
  if (!value) return 'Recent'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function HistoryScreen({ navigation }) {
  const { token, activityHistory, historyLoading, loadHistory, savedTrips, setActiveTrip } = useApp()
  const [filterType, setFilterType] = useState('all') // 'all' | 'trip_created' | 'trip_updated' | 'trip_deleted'
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [token])

  async function handleRefresh() {
    setRefreshing(true)
    await loadHistory()
    setRefreshing(false)
  }

  const filteredActivities = useMemo(() => {
    if (filterType === 'all') return activityHistory
    return activityHistory.filter((act) => act.eventType === filterType)
  }, [activityHistory, filterType])

  function handleOpenActivityTrip(tripId) {
    if (!tripId) return
    const foundTrip = savedTrips.find((t) => String(t.id || t.tripId) === String(tripId))
    if (foundTrip) {
      setActiveTrip(foundTrip)
      navigation.navigate('TripDetail', { tripId: foundTrip.id || foundTrip.tripId })
    } else {
      navigation.navigate('TripsTab')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack()
            } else {
              navigation.navigate('MainTabs', { screen: 'TripsTab' })
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.navTitle}>Activity History</Text>
          <Text style={styles.navSub}>Chronological log of trip changes & edits</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterBar}>
        {[
          { key: 'all', label: 'All' },
          { key: 'trip_created', label: 'Created' },
          { key: 'trip_updated', label: 'Updated' },
          { key: 'trip_deleted', label: 'Deleted' },
        ].map((chip) => {
          const isActive = filterType === chip.key
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilterType(chip.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* List Content */}
      {historyLoading && activityHistory.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading activity history...</Text>
        </View>
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          iconName="time-outline"
          title="No History Found"
          description={
            filterType === 'all'
              ? 'Activity records will appear here as you create, edit, and optimize your trips.'
              : `No ${filterType.replace('trip_', '')} activity records matching the filter.`
          }
          actionTitle="Refresh History"
          onActionPress={handleRefresh}
        />
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item, index) => String(item.id || item._id || `act-${item.eventType || 'item'}-${item.createdAt || index}`)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
          renderItem={({ item }) => {
            const iconConfig = getActivityIconConfig(item.eventType)
            return (
              <Card style={styles.activityCard} padding="md">
                <View style={styles.activityHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: iconConfig.bg }]}>
                    <Ionicons name={iconConfig.name} size={18} color={iconConfig.color} />
                  </View>
                  <View style={styles.activityMeta}>
                    <View style={styles.metaTop}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {item.title || 'Trip Activity'}
                      </Text>
                      <Badge
                        label={iconConfig.label}
                        variant={iconConfig.color === colors.success ? 'success' : 'primary'}
                        size="sm"
                      />
                    </View>
                    <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.activityDesc}>{item.description}</Text>
                ) : null}

                {item.tripId ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleOpenActivityTrip(item.tripId)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>Open Trip</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
              </Card>
            )
          }}
        />
      )}
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
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleCol: {
    flex: 1,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  navSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textWhite,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  activityCard: {
    marginBottom: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityMeta: {
    flex: 1,
  },
  metaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  activityDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 4,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
})

export default HistoryScreen
