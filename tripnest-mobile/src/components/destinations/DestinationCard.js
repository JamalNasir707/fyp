import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import Badge from '../common/Badge'
import { SafeImage } from '../common/SafeImage'

export function DestinationCard({ destination, onPress, style }) {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <SafeImage
        source={{ uri: destination.thumbnail }}
        fallbackUri={destination.hero}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

      {/* Top Badge */}
      {Boolean(destination.badge) && (
        <View style={styles.topBadge}>
          <Badge label={destination.badge} variant="primary" size="sm" />
        </View>
      )}

      {/* Bottom Info */}
      <View style={styles.bottomInfo}>
        <Text style={styles.title} numberOfLines={1}>{destination.title}</Text>
        <Text style={styles.region} numberOfLines={1}>{destination.region}</Text>
        <Text style={styles.placesCount}>
          {destination.placesCount} attractions
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
    position: 'relative',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  topBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 2,
  },
  title: {
    ...typography.h3,
    color: colors.textWhite,
    fontWeight: '700',
  },
  region: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  placesCount: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
    marginTop: 3,
  },
})

export default DestinationCard
