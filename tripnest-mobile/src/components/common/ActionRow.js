import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'

export function ActionRow({
  icon,
  iconColor = colors.primary,
  iconBg = colors.primaryLight,
  title,
  subtitle,
  valueText,
  rightComponent,
  showChevron = true,
  onPress,
  destructive = false,
  style,
}) {
  const content = (
    <View style={[styles.container, style]}>
      {/* Icon Circle */}
      {icon && (
        <View style={[styles.iconCircle, { backgroundColor: destructive ? colors.dangerLight : iconBg }]}>
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? colors.danger : iconColor}
          />
        </View>
      )}

      {/* Title & Subtitle */}
      <View style={styles.textContainer}>
        <Text
          style={[styles.title, destructive && { color: colors.danger }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {Boolean(subtitle) && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right Value or Component or Chevron */}
      <View style={styles.rightContainer}>
        {Boolean(valueText) && <Text style={styles.valueText}>{valueText}</Text>}
        {rightComponent}
        {showChevron && !rightComponent && (
          <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
        )}
      </View>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...typography.subtitle1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  valueText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
})

export default ActionRow
