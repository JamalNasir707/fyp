import React from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'

export function Button({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'accent' | 'navy'
  size = 'md', // 'sm' | 'md' | 'lg'
  pill = false,
  fullWidth = false,
  iconName,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: colors.surfaceSubtle,
          border: colors.border,
          text: colors.textPrimary,
          iconColor: colors.textSecondary,
        }
      case 'outline':
        return {
          bg: 'transparent',
          border: colors.primary,
          text: colors.primary,
          iconColor: colors.primary,
        }
      case 'danger':
        return {
          bg: colors.danger,
          border: colors.danger,
          text: colors.textWhite,
          iconColor: colors.textWhite,
        }
      case 'accent':
        return {
          bg: colors.accent,
          border: colors.accent,
          text: colors.textWhite,
          iconColor: colors.textWhite,
        }
      case 'navy':
        return {
          bg: colors.navyHero || '#0F172A',
          border: colors.navyHero || '#0F172A',
          text: colors.textWhite,
          iconColor: colors.textWhite,
        }
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          text: colors.primary,
          iconColor: colors.primary,
        }
      default:
        return {
          bg: colors.primary,
          border: colors.primary,
          text: colors.textWhite,
          iconColor: colors.textWhite,
        }
    }
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 8,
          paddingHorizontal: 14,
          fontSize: 13,
          iconSize: 16,
          borderRadius: pill ? 9999 : 10,
          minHeight: 36,
        }
      case 'lg':
        return {
          paddingVertical: 15,
          paddingHorizontal: 24,
          fontSize: 16,
          iconSize: 20,
          borderRadius: pill ? 9999 : 16,
          minHeight: 52,
        }
      default:
        return {
          paddingVertical: 12,
          paddingHorizontal: 18,
          fontSize: 14,
          iconSize: 18,
          borderRadius: pill ? 9999 : 14,
          minHeight: 46,
        }
    }
  }

  const { bg, border, text, iconColor } = getVariantStyles()
  const sizeConfig = getSizeStyles()

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingVertical: sizeConfig.paddingVertical,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderRadius: sizeConfig.borderRadius,
          minHeight: sizeConfig.minHeight,
          width: fullWidth ? '100%' : undefined,
        },
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={text} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {iconName && iconPosition === 'left' && (
            <Ionicons
              name={iconName}
              size={sizeConfig.iconSize}
              color={iconColor}
              style={styles.leftIcon}
            />
          )}
          <Text
            style={[
              styles.text,
              { color: text, fontSize: sizeConfig.fontSize },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {iconName && iconPosition === 'right' && (
            <Ionicons
              name={iconName}
              size={sizeConfig.iconSize}
              color={iconColor}
              style={styles.rightIcon}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})

export default Button
