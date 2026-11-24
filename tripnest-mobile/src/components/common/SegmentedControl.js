import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'

export function SegmentedControl({
  tabs = [],
  activeTab,
  onTabChange,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      {tabs.map((tab) => {
        const isSelected = tab.id === activeTab
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isSelected && styles.tabActive]}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                isSelected && styles.tabTextActive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
              {tab.count !== undefined && tab.count !== null ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.card,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
})

export default SegmentedControl
