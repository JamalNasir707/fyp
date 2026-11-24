import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/colors'

export function Card({ children, style, variant = 'default' }) {
  const getCardStyle = () => {
    switch (variant) {
      case 'elevated':
        return styles.elevated
      case 'flat':
        return styles.flat
      case 'outlined':
        return styles.outlined
      default:
        return styles.default
    }
  }

  return <View style={[styles.base, getCardStyle(), style]}>{children}</View>
}

export default Card

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  default: {
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  flat: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 0,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
})
