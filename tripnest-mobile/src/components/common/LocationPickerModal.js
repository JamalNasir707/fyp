import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../../api/client.js'
import { ALL_PAKISTAN_CITIES } from '../trips/TripCreationWizard.js'
import { guessProvinceFromTripName, getDestinationCoordinates } from '../../utils/locationService.js'

const PROVINCE_TABS = [
  'All',
  'Azad Kashmir',
  'Gilgit-Baltistan',
  'Khyber Pakhtunkhwa',
  'Punjab',
  'Sindh',
  'Balochistan',
  'Islamabad',
]

/**
 * Universal Pakistan-Wide Location Picker Component.
 * - Searches backend live API (44,989 locations) with 300ms debounce.
 * - Instant offline fallback from ALL_PAKISTAN_CITIES (80+ curated hubs).
 * - Multi-province filter chips.
 * - Autocomplete suggestion list with type, province, and coordinates.
 * - Responsive on both mobile and desktop views.
 */
export default function LocationPickerModal({
  visible,
  onClose,
  onSelectLocation,
  title = 'Select Location in Pakistan',
  placeholder = 'Search city, valley, district, fort, or sight...',
  selectedLocation = null,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('All')
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const debounceTimer = useRef(null)

  // Reset state on open
  useEffect(() => {
    if (visible) {
      setSearchQuery('')
      setSelectedProvince('All')
      setSearchResults([])
    }
  }, [visible])

  // Live search with debounce
  useEffect(() => {
    const q = searchQuery.trim()

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (!q && selectedProvince === 'All') {
      // Default initial view: show curated Pakistan cities
      setSearchResults(
        ALL_PAKISTAN_CITIES.map((c) => ({
          id: c.id,
          name: c.name,
          province: c.province,
          category: 'City / Destination',
          isCurated: true,
        }))
      )
      setIsLoading(false)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await apiClient.searchLocations(q, {
          province: selectedProvince === 'All' ? '' : selectedProvince,
          limit: 35,
        })
        if (res && Array.isArray(res.locations)) {
          setSearchResults(res.locations)
        } else {
          fallbackLocalFilter(q, selectedProvince)
        }
      } catch (err) {
        // Fallback to local curated list on network failure
        fallbackLocalFilter(q, selectedProvince)
      } finally {
        setIsLoading(false)
      }
    }, 280)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [searchQuery, selectedProvince])

  function fallbackLocalFilter(q, prov) {
    const qLow = q.toLowerCase()
    let list = ALL_PAKISTAN_CITIES
    if (prov !== 'All') {
      list = list.filter((c) => c.province.toLowerCase().includes(prov.toLowerCase()))
    }
    if (qLow) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(qLow) ||
          c.province.toLowerCase().includes(qLow)
      )
    }
    setSearchResults(
      list.map((c) => ({
        id: c.id,
        name: c.name,
        province: c.province,
        category: 'Destination',
        isCurated: true,
      }))
    )
  }

  function handleSelect(item) {
    const coords = item.lat && item.lon
      ? { lat: Number(item.lat), lon: Number(item.lon) }
      : getDestinationCoordinates(item.name)

    const locPayload = {
      id: item.id || item.name,
      name: item.name,
      city: item.city || item.name,
      province: item.province || guessProvinceFromTripName(item.name),
      category: item.category || 'Destination',
      lat: coords.lat,
      lon: coords.lon,
      rating: item.rating || 4.7,
    }

    if (onSelectLocation) {
      onSelectLocation(locPayload)
    }
    onClose()
  }

  function handleCustomSelect() {
    const q = searchQuery.trim()
    if (!q) return
    const prov = guessProvinceFromTripName(q)
    const coords = getDestinationCoordinates(q)
    handleSelect({
      id: q,
      name: q,
      city: q,
      province: prov,
      category: 'Custom Destination',
      lat: coords.lat,
      lon: coords.lon,
      rating: 4.5,
    })
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
              <Text style={styles.headerSubtitle}>44,000+ verified places across Pakistan</Text>
            </View>
            {selectedLocation && (
              <TouchableOpacity
                onPress={() => {
                  if (onSelectLocation) onSelectLocation(null)
                  onClose()
                }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Input */}
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Province Filter Chips */}
          <View style={styles.provinceFilterContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={PROVINCE_TABS}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.provinceFilterScroll}
              renderItem={({ item }) => {
                const active = selectedProvince === item
                return (
                  <TouchableOpacity
                    style={[styles.provinceChip, active && styles.provinceChipActive]}
                    onPress={() => setSelectedProvince(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.provinceChipText, active && styles.provinceChipTextActive]}>
                      {item === 'Khyber Pakhtunkhwa' ? 'KPK' : item}
                    </Text>
                  </TouchableOpacity>
                )
              }}
            />
          </View>

          {/* Custom Typed Option */}
          {searchQuery.trim().length > 1 && (
            <TouchableOpacity style={styles.customOptionCard} onPress={handleCustomSelect} activeOpacity={0.7}>
              <View style={styles.customOptionIcon}>
                <Ionicons name="add-circle" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.customOptionTitle}>Select "{searchQuery.trim()}"</Text>
                <Text style={styles.customOptionSub}>Use custom location anywhere in Pakistan</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Results List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Searching Pakistan database...</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.id || item.name}-${index}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selectedLocation && (selectedLocation.name === item.name || selectedLocation.id === item.id)
                return (
                  <TouchableOpacity
                    style={[styles.resultItem, isSelected && styles.resultItemActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.resultIconCircle, isSelected && styles.resultIconCircleActive]}>
                      <Ionicons
                        name={item.category?.toLowerCase().includes('hotel') ? 'bed' : 'location'}
                        size={18}
                        color={isSelected ? '#FFFFFF' : '#2563EB'}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.resultItemTitle, isSelected && styles.resultItemTitleActive]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultItemSubtitle} numberOfLines={1}>
                        {item.province ? `${item.province} • ` : ''}{item.category || 'Attraction'}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="location-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No matching locations found</Text>
                  <Text style={styles.emptySub}>
                    Try searching for another city, valley or sight, or tap "Select '{searchQuery.trim()}'" above.
                  </Text>
                </View>
              }
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    padding: 0,
  },
  provinceFilterContainer: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  provinceFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  provinceChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  provinceChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  provinceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  provinceChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  customOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  customOptionSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  resultItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  resultIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconCircleActive: {
    backgroundColor: '#2563EB',
  },
  resultItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  resultItemTitleActive: {
    color: '#1E40AF',
  },
  resultItemSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
})
