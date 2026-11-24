import React from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { getDestinationImage } from '../../constants/images'
import Badge from '../common/Badge'
import { SafeImage } from '../common/SafeImage'

export function TripCard({ trip, onPress, onLongPress, onOptionsPress, style }) {
  const isTripmate = Boolean(trip?.isTripmate)
  const destination = trip?.destination || trip?.name || 'Pakistan'
  const title = trip?.title || trip?.name || 'Untitled Trip'
  const imageUrl = getDestinationImage(destination)

  const daysCount = Array.isArray(trip?.days) ? trip.days.length : 0
  const allStops = Array.isArray(trip?.days)
    ? trip.days.flatMap((d) => (Array.isArray(d.items) ? d.items : []))
    : []
  const placesCount = allStops.length
  const visitedCount = allStops.filter((s) => s.visitDetails?.visited).length

  const dateText =
    trip?.dates ||
    (trip?.startDate && trip?.endDate ? `${trip.startDate} - ${trip.endDate}` : 'Dates not set')

  const budget = trip?.budget?.amount
    ? `${trip.budget.currency || 'PKR'} ${Number(trip.budget.amount).toLocaleString()}`
    : null

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      onLongPress={onLongPress || onOptionsPress}
      activeOpacity={0.92}
    >
      {/* Destination Image Banner */}
      <View style={styles.imageContainer}>
        <SafeImage source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        <View style={styles.imageOverlay} />

        {/* Top Badges on Banner */}
        <View style={styles.topBadgesRow}>
          {isTripmate ? (
            <Badge
              label={`Tripmates • ${trip.tripmateRole || 'Member'}`}
              variant="tripmate"
              size="sm"
            />
          ) : (
            <Badge label="Personal Trip" variant="primary" size="sm" />
          )}

          <View style={styles.topRightActions}>
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={12} color={colors.textWhite} />
              <Text style={styles.durationText}>
                {daysCount} {daysCount === 1 ? 'Day' : 'Days'}
              </Text>
            </View>

            {Boolean(onOptionsPress) && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={onOptionsPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textWhite} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Destination Title on Banner Bottom */}
        <View style={styles.bannerBottom}>
          <View style={styles.locationTag}>
            <Ionicons name="location-sharp" size={13} color={colors.accent} />
            <Text style={styles.locationTagText}>{destination}</Text>
          </View>
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.dateText}>{dateText}</Text>
        </View>

        {/* Metadata Footer */}
        <View style={styles.footer}>
          <View style={styles.metricItem}>
            <Ionicons name="map-outline" size={14} color={colors.primary} />
            <Text style={styles.metricLabel}>
              <Text style={styles.metricValue}>{placesCount}</Text> stops
            </Text>
          </View>

          {placesCount > 0 && (
            <View style={styles.metricItem}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
              <Text style={styles.metricLabel}>
                <Text style={styles.metricValue}>{visitedCount}</Text> visited
              </Text>
            </View>
          )}

          {budget ? (
            <View style={styles.metricItem}>
              <Ionicons name="wallet-outline" size={14} color={colors.accent} />
              <Text style={styles.metricLabel}>
                <Text style={styles.metricValue}>{budget}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Progress Bar (if stops exist) */}
        {placesCount > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                { width: `${Math.min(100, (visitedCount / placesCount) * 100)}%` },
              ]}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 145,
    backgroundColor: colors.surfaceSubtle,
    position: 'relative',
    justifyContent: 'space-between',
    padding: 12,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  moreButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {
    ...typography.caption,
    color: colors.textWhite,
    fontWeight: '700',
  },
  bannerBottom: {
    zIndex: 2,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  locationTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  body: {
    padding: 14,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  dateText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metricValue: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
})

export default TripCard
