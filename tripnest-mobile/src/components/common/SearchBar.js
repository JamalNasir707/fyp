import React from 'react'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search destinations, trips, places...',
  onClear,
  style,
  inputStyle,
  ...restProps
}) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
      <TextInput
        style={[styles.input, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        {...restProps}
      />
      {value && value.length > 0 ? (
        <TouchableOpacity
          onPress={() => {
            if (onClear) onClear()
            else if (onChangeText) onChangeText('')
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    ...typography.body2,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
})

export default SearchBar
