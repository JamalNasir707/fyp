import React, { useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { getPlaceImage } from '../../constants/images'
import { findVerifiedLandmark } from '../../services/imageService'
import { formatTime12h, getPlaceLatLon } from '../../utils/tripUtils'
import Badge from '../common/Badge'
import { SafeImage } from '../common/SafeImage'

export function PlaceItemCard({
  item,
  dayIndex = 0,
  itemIndex = 0,
  accentColor = colors.primary,
  connection = null,
  onToggleVisited,
  onPress,
  onMapPress,
  onOpenTimeEditor,
  onOpenMove,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp = false,
  canMoveDown = false,
  expenseTotal = 0,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  if (!item) return null

  // Special item: NOTE
  if (item.type === 'note') {
    return (
      <View style={[styles.container, styles.noteContainer]}>
        <View style={styles.noteTopRow}>
          <View style={styles.specialItemBadge}>
            <Ionicons name="document-text" size={14} color="#ec4899" />
            <Text style={styles.noteBadgeText}>Note</Text>
          </View>
          <View style={styles.menuRow}>
            {canMoveUp && onMoveUp && (
              <TouchableOpacity onPress={onMoveUp} style={styles.iconMiniBtn}>
                <Ionicons name="arrow-up" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canMoveDown && onMoveDown && (
              <TouchableOpacity onPress={onMoveDown} style={styles.iconMiniBtn}>
                <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {onOpenMove && (
              <TouchableOpacity onPress={onOpenMove} style={styles.iconMiniBtn}>
                <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
              </TouchableOpacity>
            )}
            {onRemove && (
              <TouchableOpacity onPress={onRemove} style={styles.iconMiniBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.noteText}>{item.content || item.note || 'Empty note...'}</Text>
      </View>
    )
  }

  // Special item: CHECKLIST
  if (item.type === 'checklist') {
    return (
      <View style={[styles.container, styles.checklistContainer]}>
        <View style={styles.noteTopRow}>
          <View style={styles.specialItemBadge}>
            <Ionicons name="checkbox" size={14} color="#10b981" />
            <Text style={[styles.noteBadgeText, { color: '#059669' }]}>{item.title || 'Checklist'}</Text>
          </View>
          <View style={styles.menuRow}>
            {canMoveUp && onMoveUp && (
              <TouchableOpacity onPress={onMoveUp} style={styles.iconMiniBtn}>
                <Ionicons name="arrow-up" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canMoveDown && onMoveDown && (
              <TouchableOpacity onPress={onMoveDown} style={styles.iconMiniBtn}>
                <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {onOpenMove && (
              <TouchableOpacity onPress={onOpenMove} style={styles.iconMiniBtn}>
                <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
              </TouchableOpacity>
            )}
            {onRemove && (
              <TouchableOpacity onPress={onRemove} style={styles.iconMiniBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {(item.items || []).map((row, rIdx) => (
          <View key={row.id || rIdx} style={styles.checklistRow}>
            <Ionicons
              name={row.checked ? 'checkbox' : 'square-outline'}
              size={16}
              color={row.checked ? colors.success : colors.textTertiary}
            />
            <Text style={[styles.checklistRowText, row.checked && styles.checklistRowChecked]}>
              {row.text || 'Item'}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  // Standard Itinerary Place
  const isVisited = Boolean(item.visitDetails?.visited)
  const timeFormatted = item.startTime
    ? `${formatTime12h(item.startTime)}${item.endTime ? ` - ${formatTime12h(item.endTime)}` : ''}`
    : null
  const destination = item.destination || item.city || item.subtitle || ''
  const verified = findVerifiedLandmark(item.id || item.place_id, item.title || item.name, destination)
  const resolvedFallback = (verified && verified.imageUrl) || getPlaceImage(item.id, item.category, item.title || item.name, destination)
  const candidateUrl = item.image || item.photo || item.thumbnail || item.imageUrl
  const isCandidateValid = candidateUrl && typeof candidateUrl === 'string' && candidateUrl.startsWith('http') && !candidateUrl.includes('grass-cs')
  const imageUrl = isCandidateValid ? candidateUrl : resolvedFallback
  const fallbackUrls = [
    ...(Array.isArray(item.fallbackUrls) ? item.fallbackUrls : []),
    ...(verified && Array.isArray(verified.fallbackUrls) ? verified.fallbackUrls : []),
    resolvedFallback,
  ].filter((u, i, self) => u && typeof u === 'string' && u.startsWith('http') && !u.includes('grass-cs') && self.indexOf(u) === i)
  const coords = getPlaceLatLon(item)
  const isEstimated = Boolean(coords?.isEstimated || item.isEstimated)

  return (
    <View style={styles.cardWrapper}>
      {/* Driving Connection Badge between consecutive stops */}
      {connection && (
        <View style={styles.connectionConnector}>
          <View style={styles.connectionLine} />
          <View style={styles.connectionBadge}>
            <Ionicons name="car-outline" size={12} color={colors.primary} />
            <Text style={styles.connectionText}>
              {connection.from} ━━━━> {item.title || item.name}: {connection.distanceLabel}, ~{connection.durationLabel}
            </Text>
          </View>
          <View style={styles.connectionLine} />
        </View>
      )}

      <View style={[styles.container, isVisited && styles.visitedContainer]}>
        {/* Top Main Row */}
        <View style={styles.mainRow}>
          {/* Checkbox */}
          <TouchableOpacity
            style={[styles.checkbox, isVisited && styles.checkedCheckbox]}
            onPress={onToggleVisited}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isVisited ? <Ionicons name="checkmark" size={13} color={colors.textWhite} /> : null}
          </TouchableOpacity>

          {/* Marker Number Badge */}
          <View style={[styles.markerBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.markerBadgeText}>{itemIndex + 1}</Text>
          </View>

          {/* Place Thumbnail */}
          <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            <SafeImage source={{ uri: imageUrl }} fallbackUrls={fallbackUrls} style={styles.thumbnail} />
          </TouchableOpacity>

          {/* Place Info */}
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, isVisited && styles.visitedTitle]}
                numberOfLines={1}
              >
                {item.title || item.name || 'Unnamed Place'}
              </Text>
              {item.category ? (
                <Badge label={item.category} variant="category" size="sm" />
              ) : null}
              {isEstimated ? (
                <Badge label="Est. GPS" variant="warning" size="sm" style={{ marginLeft: 4 }} />
              ) : !coords ? (
                <Badge label="Unmapped" variant="outline" size="sm" style={{ marginLeft: 4 }} />
              ) : null}
            </View>

            {item.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                📍 {item.subtitle}
              </Text>
            ) : null}

            {/* Time & Cost Meta Row */}
            {(timeFormatted || Number(expenseTotal) > 0) && (
              <View style={styles.metaRow}>
                {timeFormatted && (
                  <View style={styles.timeBadge}>
                    <Ionicons name="time-outline" size={12} color={colors.primaryDark} />
                    <Text style={styles.timeLabel}>{timeFormatted}</Text>
                  </View>
                )}
                {Number(expenseTotal) > 0 && (
                  <View style={styles.costBadge}>
                    <Text style={styles.costLabel}>💰 PKR {Number(expenseTotal).toLocaleString()}</Text>
                  </View>
                )}
              </View>
            )}

            {item.note ? (
              <View style={styles.noteBox}>
                <Ionicons name="document-text-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.note} numberOfLines={1}>
                  {item.note}
                </Text>
              </View>
            ) : null}

            {isVisited && (
              <View style={styles.visitedRow}>
                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                <Text style={styles.visitedStatus}>
                  Visited {item.visitDetails?.visitedDate ? `on ${item.visitDetails.visitedDate}` : 'today'}
                  {item.visitDetails?.visitedTime ? ` at ${item.visitDetails.visitedTime}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Quick Menu Toggle */}
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => setMenuOpen(!menuOpen)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={menuOpen ? 'chevron-up' : 'ellipsis-vertical'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Action Strip (Expanded Menu or Quick Actions) */}
        {menuOpen && (
          <View style={styles.actionStrip}>
            {onOpenTimeEditor && (
              <TouchableOpacity style={styles.actionPill} onPress={onOpenTimeEditor}>
                <Ionicons name="time-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.actionPillText}>Time</Text>
              </TouchableOpacity>
            )}

            {onOpenMove && (
              <TouchableOpacity style={styles.actionPill} onPress={onOpenMove}>
                <Ionicons name="swap-horizontal" size={14} color={colors.primaryDark} />
                <Text style={styles.actionPillText}>Move</Text>
              </TouchableOpacity>
            )}

            {canMoveUp && onMoveUp && (
              <TouchableOpacity style={styles.actionPill} onPress={onMoveUp}>
                <Ionicons name="arrow-up" size={14} color={colors.textSecondary} />
                <Text style={styles.actionPillText}>Up</Text>
              </TouchableOpacity>
            )}

            {canMoveDown && onMoveDown && (
              <TouchableOpacity style={styles.actionPill} onPress={onMoveDown}>
                <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
                <Text style={styles.actionPillText}>Down</Text>
              </TouchableOpacity>
            )}

            {onMapPress && (
              <TouchableOpacity style={styles.actionPill} onPress={onMapPress}>
                <Ionicons name="navigate-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.actionPillText}>Map</Text>
              </TouchableOpacity>
            )}

            {onRemove && (
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillDelete]}
                onPress={onRemove}
              >
                <Ionicons name="trash-outline" size={14} color={colors.error} />
                <Text style={[styles.actionPillText, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 2,
  },
  connectionConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  connectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  connectionText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  visitedContainer: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.borderLight,
    opacity: 0.9,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkedCheckbox: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  markerBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  markerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textWhite,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
    marginRight: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    ...typography.subtitle2,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 6,
    fontWeight: '700',
  },
  visitedTitle: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  costBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  costLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 2,
  },
  note: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  visitedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  visitedStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
  },
  moreBtn: {
    padding: 6,
    marginLeft: 4,
  },
  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionPillDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    marginLeft: 'auto',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noteContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#ec4899',
    backgroundColor: '#FDF2F8',
  },
  checklistContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    backgroundColor: '#F0FDF4',
  },
  noteTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  specialItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#db2777',
  },
  noteText: {
    ...typography.body2,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  checklistRowText: {
    ...typography.body2,
    fontSize: 13,
    color: colors.textPrimary,
  },
  checklistRowChecked: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconMiniBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
})

export default PlaceItemCard
