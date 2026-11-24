import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'

export function Badge({
  label,
  variant = 'default', // 'primary' | 'tripmate' | 'success' | 'warning' | 'accent' | 'danger' | 'category' | 'default'
  iconName,
  size = 'md', // 'sm' | 'md'
  color, // Backward compatibility override
  textColor, // Backward compatibility override
  style,
  textStyle,
}) {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primaryLight, text: colors.primaryDark, border: colors.primaryBorder }
      case 'tripmate':
        return { bg: colors.tripmateBg, text: colors.tripmate, border: colors.tripmateBorder }
      case 'success':
        return { bg: colors.successLight, text: colors.successDark, border: '#A7F3D0' }
      case 'warning':
        return { bg: colors.warningLight, text: colors.warning, border: '#FED7AA' }
      case 'accent':
        return { bg: colors.accentLight, text: colors.accentDark, border: colors.accentMuted }
      case 'danger':
        return { bg: colors.dangerLight, text: colors.dangerDark, border: '#FECACA' }
      case 'category':
        return { bg: colors.surfaceSubtle, text: colors.textSecondary, border: colors.border }
      default:
        return { bg: colors.surfaceSubtle, text: colors.textSecondary, border: colors.border }
    }
  }

  const tokenStyle = getBadgeStyle()
  const finalBg = color || tokenStyle.bg
  const finalText = textColor || tokenStyle.text

  const isSmall = size === 'sm'

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: finalBg,
          borderColor: tokenStyle.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 9,
          borderRadius: isSmall ? 6 : 8,
        },
        style,
      ]}
    >
      {iconName && (
        <Ionicons
          name={iconName}
          size={isSmall ? 10 : 12}
          color={finalText}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.badgeText,
          {
            color: finalText,
            fontSize: isSmall ? 10 : 11,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})

export default Badge
