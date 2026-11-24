import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { getDayColor } from '../../utils/tripUtils'

export function DaySectionCard({
  day,
  dayIndex = 0,
  label,
  date,
  placesCount,
  distanceLabel,
  durationLabel,
  onAddStop,
  onOptimizeDay,
  onInsertDayAfter,
  onDeleteDay,
  canDelete = true,
  isCompleted = false,
  onCompleteDay,
}) {
  const [showOptions, setShowOptions] = useState(false)
  const displayLabel = label || day?.label || `Day ${dayIndex + 1}`
  const count =
    placesCount !== undefined
      ? placesCount
      : Array.isArray(day?.items)
      ? day.items.length
      : 0
  const accentColor = day?.color || getDayColor(dayIndex)

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={[styles.badgeContainer, { backgroundColor: accentColor }]}>
          <Text style={styles.dayIndex}>DAY {dayIndex + 1}</Text>
        </View>

        <View style={styles.details}>
          <View style={styles.titleRow}>
            <Text style={styles.dateLabel} numberOfLines={1}>
              {displayLabel}
            </Text>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#059669" />
                <Text style={styles.completedBadgeText}>Done</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtext}>
            {count} {count === 1 ? 'stop' : 'stops'}
            {date ? ` • ${date}` : ''}
            {distanceLabel ? ` • ${distanceLabel}` : ''}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {/* Quick Add Stop */}
          {onAddStop && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onAddStop}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={15} color={colors.primary} />
              <Text style={styles.actionBtnText}>Add</Text>
            </TouchableOpacity>
          )}

          {/* Quick Optimize Day Route */}
          {onOptimizeDay && count >= 2 && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.optimizeBtn]}
              onPress={onOptimizeDay}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={13} color="#f59e0b" />
              <Text style={[styles.actionBtnText, { color: '#b45309' }]}>Optimize</Text>
            </TouchableOpacity>
          )}

          {/* More Day Options Toggle */}
          <TouchableOpacity
            style={styles.moreOptionsBtn}
            onPress={() => setShowOptions(!showOptions)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showOptions ? 'chevron-up' : 'ellipsis-horizontal'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Optimization Summary Banner: only display when day has 2+ stops and positive distance */}
      {(() => {
        const stopsCount = (day?.items || []).filter((i) => i && i.type !== 'note' && i.type !== 'checklist').length
        const totalDist = Number(day?.optimization?.metrics?.totalDistanceKm ?? day?.optimization?.totalDistanceKm ?? 0)
        if (stopsCount < 2 || totalDist <= 0) return null

        return (
          <View style={styles.optimizationBanner}>
            <View style={styles.optimizationBannerRow}>
              <Ionicons name="flash" size={13} color="#d97706" />
              <Text style={styles.optimizationBannerTitle}>Route Optimized (TSP 2-Opt)</Text>
            </View>
            <Text style={styles.optimizationMetricsText}>
              Total: {totalDist.toFixed(1)} km
              {day.optimization.metrics?.estimatedTravelTimeHours
                ? ` • ~${Math.round(day.optimization.metrics.estimatedTravelTimeHours * 60)} min drive`
                : day.optimization.totalDurationMin
                ? ` • ~${day.optimization.totalDurationMin} min drive`
                : ''}
              {day.optimization.metrics?.distanceSavedKm > 0
                ? ` • Saved ${day.optimization.metrics.distanceSavedKm.toFixed(1)} km`
                : ''}
            </Text>
          </View>
        )
      })()}

      {/* Expanded Day Options Menu */}
      {showOptions && (
        <View style={styles.optionsDropdown}>
          {onCompleteDay && (
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowOptions(false)
                onCompleteDay()
              }}
            >
              <Ionicons name="trophy-outline" size={16} color="#059669" />
              <Text style={[styles.dropdownText, { color: '#059669', fontWeight: '700' }]}>
                {isCompleted ? 'View Day Summary (End / Next)' : 'Finish Day (End / Next)'}
              </Text>
            </TouchableOpacity>
          )}

          {onInsertDayAfter && (
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowOptions(false)
                onInsertDayAfter()
              }}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.dropdownText}>Insert a day after this</Text>
            </TouchableOpacity>
          )}

          {onOptimizeDay && (
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowOptions(false)
                onOptimizeDay()
              }}
            >
              <Ionicons name="sparkles-outline" size={16} color="#d97706" />
              <Text style={styles.dropdownText}>Optimize visiting sequence (TSP)</Text>
            </TouchableOpacity>
          )}

          {onDeleteDay && canDelete && (
            <TouchableOpacity
              style={[styles.dropdownItem, styles.deleteDropdownItem]}
              onPress={() => {
                setShowOptions(false)
                onDeleteDay()
              }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.dropdownText, { color: colors.error }]}>
                Delete day (moves places to pool)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  dayIndex: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.6,
  },
  details: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  dateLabel: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  optimizeBtn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  moreOptionsBtn: {
    padding: 6,
    borderRadius: 8,
  },
  optionsDropdown: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  deleteDropdownItem: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  dropdownText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optimizationBanner: {
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  optimizationBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  optimizationBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    letterSpacing: 0.3,
  },
  optimizationMetricsText: {
    ...typography.caption,
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
  },
})

export default DaySectionCard
