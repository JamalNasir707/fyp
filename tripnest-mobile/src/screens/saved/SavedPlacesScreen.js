import React, { useState, useMemo, useEffect } from 'react'
import { useIsFocused } from '@react-navigation/native'
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { useApp } from '../../context/AppContext'
import { getPlaceImage } from '../../constants/images'
import { findVerifiedLandmark, getAuthenticPlaceImageSync } from '../../services/imageService'
import Badge from '../../components/common/Badge'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import ModalSheet from '../../components/common/ModalSheet'
import SegmentedControl from '../../components/common/SegmentedControl'
import { SafeImage } from '../../components/common/SafeImage'

export function SavedPlacesScreen({ navigation }) {
  const {
    activeTrip,
    savedTrips,
    setActiveTrip,
    addPlaceToDay,
    addPlaceToPool,
    removePlaceFromPool,
    addCustomList,
    updateCustomList,
    deleteCustomList,
    addPlaceToCustomList,
    removePlaceFromCustomList,
    addCustomListItem,
    removeCustomListItem,
    moveItemBetweenContainers,
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isPlaceInWishlist,
  } = useApp()

  // Three sections: Places Pool | Custom Lists | Wishlist
  const [activeTab, setActiveTab] = useState('pool') // 'pool' | 'customLists' | 'wishlist'
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  // Modals
  const [tripSwitcherVisible, setTripSwitcherVisible] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [selectedPlaceForSchedule, setSelectedPlaceForSchedule] = useState(null)

  const [moveToListModalVisible, setMoveToListModalVisible] = useState(false)
  const [selectedPlaceForList, setSelectedPlaceForList] = useState(null)

  const [placeDetailsModalVisible, setPlaceDetailsModalVisible] = useState(false)
  const [selectedPlaceForDetails, setSelectedPlaceForDetails] = useState(null)

  // Add Spot to Pool Modal
  const [addPoolModalVisible, setAddPoolModalVisible] = useState(false)
  const [poolTitle, setPoolTitle] = useState('')
  const [poolSubtitle, setPoolSubtitle] = useState('')
  const [poolCategory, setPoolCategory] = useState('Attraction')
  const [poolNote, setPoolNote] = useState('')

  // Create Custom List Modal
  const [createListModalVisible, setCreateListModalVisible] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [listDescription, setListDescription] = useState('')

  // Edit Custom List Modal
  const [editListModalVisible, setEditListModalVisible] = useState(false)
  const [editingListId, setEditingListId] = useState(null)
  const [editListTitle, setEditListTitle] = useState('')
  const [editListDescription, setEditListDescription] = useState('')

  // Add Item to Custom List Modal
  const [addListItemModalVisible, setAddListItemModalVisible] = useState(false)
  const [targetListId, setTargetListId] = useState(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemType, setNewItemType] = useState('place') // 'place' | 'checklist'
  const [newItemSubtitle, setNewItemSubtitle] = useState('')

  // Auto-fallback to first available trip if activeTrip is unset
  const isFocused = useIsFocused()
  useEffect(() => {
    if (isFocused && !activeTrip && Array.isArray(savedTrips) && savedTrips.length > 0) {
      setActiveTrip(savedTrips[0])
    }
  }, [isFocused, Boolean(activeTrip), savedTrips.length])

  const placesPool = useMemo(() => {
    return Array.isArray(activeTrip?.placesPool) ? activeTrip.placesPool : []
  }, [activeTrip?.placesPool])

  const customLists = useMemo(() => {
    return Array.isArray(activeTrip?.customLists) ? activeTrip.customLists : []
  }, [activeTrip?.customLists])

  const universalWishlist = useMemo(() => {
    return Array.isArray(wishlist) ? wishlist : []
  }, [wishlist])

  // Filter items in Places Pool
  const filteredPool = useMemo(() => {
    return placesPool.filter((p) => {
      if (categoryFilter !== 'All') {
        const cat = (p.category || '').toLowerCase()
        if (!cat.includes(categoryFilter.toLowerCase())) return false
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase()
        const title = (p.title || p.name || '').toLowerCase()
        const sub = (p.subtitle || p.address || '').toLowerCase()
        const note = (p.note || '').toLowerCase()
        return title.includes(q) || sub.includes(q) || note.includes(q)
      }
      return true
    })
  }, [placesPool, categoryFilter, searchQuery])

  // Filter items in Wishlist
  const filteredWishlist = useMemo(() => {
    return universalWishlist.filter((p) => {
      if (categoryFilter !== 'All') {
        const cat = (p.category || '').toLowerCase()
        if (!cat.includes(categoryFilter.toLowerCase())) return false
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase()
        const title = (p.title || p.name || '').toLowerCase()
        const sub = (p.subtitle || p.address || '').toLowerCase()
        const note = (p.note || '').toLowerCase()
        return title.includes(q) || sub.includes(q) || note.includes(q)
      }
      return true
    })
  }, [universalWishlist, categoryFilter, searchQuery])

  // Actions
  function handleOpenPlaceDetails(place) {
    setSelectedPlaceForDetails(place)
    setPlaceDetailsModalVisible(true)
  }

  function handleOpenSchedulePlace(place) {
    if (!activeTrip || !(activeTrip.days || []).length) {
      Alert.alert(
        'No Days Planned',
        'This trip has no days in its itinerary yet. Add days in the trip view first.'
      )
      return
    }
    setSelectedPlaceForSchedule(place)
    setScheduleModalVisible(true)
  }

  function handleAssignToDay(dayId) {
    if (!selectedPlaceForSchedule) return
    addPlaceToDay(dayId, selectedPlaceForSchedule, activeTrip?.id || activeTrip?.tripId)
    setScheduleModalVisible(false)
    const dayLabel = (activeTrip.days || []).find((d) => d.id === dayId)?.shortLabel || 'the selected day'
    Alert.alert(
      'Scheduled to Itinerary!',
      `"${selectedPlaceForSchedule.title || selectedPlaceForSchedule.name}" assigned to ${dayLabel}.`,
      [
        { text: 'Keep Browsing' },
        { text: 'View Itinerary', onPress: () => navigation.navigate('Itinerary') },
      ]
    )
  }

  function handleOpenMoveToList(place) {
    if (!customLists.length) {
      Alert.alert(
        'No Custom Lists',
        'Create a custom list first to organize themed spots or packing items.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: '+ Create List', onPress: () => setCreateListModalVisible(true) },
        ]
      )
      return
    }
    setSelectedPlaceForList(place)
    setMoveToListModalVisible(true)
  }

  function handleAssignToList(listId) {
    if (!selectedPlaceForList) return
    addPlaceToCustomList(listId, selectedPlaceForList)
    setMoveToListModalVisible(false)
    const listName = customLists.find((l) => l.id === listId)?.name || 'Custom List'
    Alert.alert(
      'Added to List!',
      `"${selectedPlaceForList.title || selectedPlaceForList.name}" added to "${listName}".`
    )
  }

  function handleMoveToPool(item, fromContainerId = null) {
    if (fromContainerId && fromContainerId.startsWith('custom:')) {
      const listId = fromContainerId.slice('custom:'.length)
      removePlaceFromCustomList(listId, item.id)
    }
    addPlaceToPool(item, activeTrip?.id || activeTrip?.tripId)
    Alert.alert(
      'Added to Places Pool',
      `"${item.title || item.name}" is now in your active trip's Places Pool.`
    )
  }

  function handleRemoveFromPool(place) {
    Alert.alert(
      'Remove from Pool',
      `Remove "${place.title || place.name}" from saved places?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removePlaceFromPool(place.id),
        },
      ]
    )
  }

  function handleRemoveFromWishlist(place) {
    Alert.alert(
      'Remove from Wishlist',
      `Remove "${place.title || place.name}" from your universal wishlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromWishlist(place.id || place.place_id),
        },
      ]
    )
  }

  function handleAddPoolPlaceSubmit() {
    if (!poolTitle.trim()) {
      Alert.alert('Required', 'Please enter a place name')
      return
    }

    const title = poolTitle.trim()
    const dest = poolSubtitle.trim() || activeTrip?.destination || 'Pakistan'
    const verified = findVerifiedLandmark('', title, dest)
    const imgObj = verified || getAuthenticPlaceImageSync('', poolCategory, title, dest)

    addPlaceToPool({
      id: `pool_${Date.now()}`,
      title,
      subtitle: dest,
      category: poolCategory,
      note: poolNote.trim(),
      image: imgObj.imageUrl,
      photo: imgObj.imageUrl,
      imageSource: imgObj.imageSource,
      imageAttribution: imgObj.imageAttribution,
      imageVerified: Boolean(imgObj.imageVerified),
      lat: verified?.lat || null,
      lon: verified?.lon || null,
    }, activeTrip?.id || activeTrip?.tripId)

    setAddPoolModalVisible(false)
    setPoolTitle('')
    setPoolSubtitle('')
    setPoolNote('')
  }

  function handleCreateListSubmit() {
    if (!listTitle.trim()) {
      Alert.alert('Required', 'Please enter a title for the list')
      return
    }
    addCustomList(listTitle.trim(), listDescription.trim())
    setCreateListModalVisible(false)
    setListTitle('')
    setListDescription('')
  }

  function handleOpenEditList(list) {
    setEditingListId(list.id)
    setEditListTitle(list.name || list.title || '')
    setEditListDescription(list.description || '')
    setEditListModalVisible(true)
  }

  function handleSaveEditListSubmit() {
    if (!editListTitle.trim()) {
      Alert.alert('Required', 'Please enter a list title')
      return
    }
    updateCustomList(editingListId, {
      title: editListTitle.trim(),
      name: editListTitle.trim(),
      description: editListDescription.trim(),
    })
    setEditListModalVisible(false)
    setEditingListId(null)
  }

  function handleDeleteCustomList(list) {
    Alert.alert(
      'Delete List',
      `Delete list "${list.name || list.title}" and all its contents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCustomList(list.id),
        },
      ]
    )
  }

  function handleOpenAddListItem(listId) {
    setTargetListId(listId)
    setNewItemTitle('')
    setNewItemSubtitle('')
    setNewItemType('place')
    setAddListItemModalVisible(true)
  }

  function handleAddListItemSubmit() {
    if (!newItemTitle.trim() || !targetListId) {
      Alert.alert('Required', 'Please enter an item name')
      return
    }

    if (newItemType === 'checklist') {
      addCustomListItem(targetListId, newItemTitle.trim())
    } else {
      addPlaceToCustomList(targetListId, {
        id: `custom_place_${Date.now()}`,
        title: newItemTitle.trim(),
        subtitle: newItemSubtitle.trim() || activeTrip?.destination || 'Place',
        category: 'Attraction',
        type: 'place',
      })
    }

    setAddListItemModalVisible(false)
    setNewItemTitle('')
    setNewItemSubtitle('')
  }

  function handleRemoveItemFromList(listId, item, index) {
    if (typeof item === 'object' && item?.id) {
      removePlaceFromCustomList(listId, item.id)
    } else {
      removeCustomListItem(listId, index)
    }
  }

  // 3 Section Tabs
  const savedTabs = [
    { id: 'pool', label: 'Places Pool', count: placesPool.length },
    { id: 'customLists', label: 'Custom Lists', count: customLists.length },
    { id: 'wishlist', label: 'Wishlist', count: universalWishlist.length },
  ]

  if (!activeTrip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={54} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No Trips in Workspace</Text>
          <Text style={styles.emptySubtitle}>
            Plan an itinerary to curate your places pool, manage themed custom lists, and organize your trip highlights.
          </Text>
          <Button
            title="Plan a Trip"
            pill
            onPress={() => navigation.navigate('HomeTab')}
            style={{ marginTop: 14 }}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. TOP HEADER WITH TRIP SELECTOR */}
      <View style={styles.header}>
        <View style={styles.headerCol}>
          <Text style={styles.title}>Saved Workspace</Text>
          <TouchableOpacity
            style={styles.tripSelectorPill}
            onPress={() => setTripSwitcherVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="airplane-sharp" size={12} color={colors.primary} />
            <Text style={styles.tripSelectorText} numberOfLines={1}>
              {activeTrip.title || activeTrip.destination}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              if (activeTab === 'pool') setAddPoolModalVisible(true)
              else if (activeTab === 'customLists') setCreateListModalVisible(true)
              else navigation.navigate('ExploreTab')
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={colors.textWhite} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. SEGMENTED CONTROL: PLACES POOL vs CUSTOM LISTS vs WISHLIST */}
      <View style={styles.tabsWrapper}>
        <SegmentedControl
          tabs={savedTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </View>

      {/* Contextual Subtitle Banner */}
      <View style={styles.contextBanner}>
        <Text style={styles.contextBannerText}>
          {activeTab === 'pool'
            ? 'Spots saved for this trip workspace waiting to be assigned to itinerary days.'
            : activeTab === 'customLists'
            ? 'Custom containers for themed gear, packing checklists, and places to try.'
            : 'Universal bookmarked places across Pakistan saved to your profile.'}
        </Text>
      </View>

      {/* ==================================================== */}
      {/* TAB 1: PLACES POOL */}
      {/* ==================================================== */}
      {activeTab === 'pool' && (
        <View style={{ flex: 1 }}>
          {/* Pool Search & Filter Bar */}
          <View style={styles.poolFilterWrapper}>
            <TextInput
              style={styles.poolSearchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Filter saved spots by name or notes..."
              placeholderTextColor={colors.textTertiary}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.poolCatRow}
            >
              {['All', 'Attraction', 'Scenic', 'Museum', 'Food', 'Shopping'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.poolCatChip,
                    categoryFilter === cat && styles.poolCatChipActive,
                  ]}
                  onPress={() => setCategoryFilter(cat)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.poolCatChipText,
                      categoryFilter === cat && styles.poolCatChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredPool}
            keyExtractor={(item, index) => String(item.id ? `pool-${item.id}` : (item.title ? `pool-${item.title}` : `pool-item-${index}`))}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const imageUrl = item.image || item.photo || getPlaceImage(item.id, item.category, item.title || item.name)
              return (
                <Card style={styles.poolCard}>
                  <TouchableOpacity
                    style={styles.poolCardTouch}
                    onPress={() => handleOpenPlaceDetails(item)}
                    activeOpacity={0.88}
                  >
                    <SafeImage source={{ uri: imageUrl }} style={styles.poolImage} resizeMode="cover" />
                    <View style={styles.poolDetails}>
                      <View style={styles.cardHeader}>
                        <Badge label={item.category || 'Place'} variant="primary" size="sm" />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.schedulePillBtn}
                            onPress={() => handleOpenSchedulePlace(item)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="calendar-outline" size={13} color={colors.textWhite} />
                            <Text style={styles.schedulePillText}>Schedule</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleOpenMoveToList(item)}
                            activeOpacity={0.7}
                            title="Move to Custom List"
                          >
                            <Ionicons name="folder-outline" size={15} color={colors.primary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.removePoolBtn}
                            onPress={() => handleRemoveFromPool(item)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.error || '#ef4444'} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.placeTitle} numberOfLines={1}>{item.title || item.name}</Text>
                      {Boolean(item.subtitle || item.address) && (
                        <Text style={styles.placeSubtitle} numberOfLines={1}>
                          📍 {item.subtitle || item.address}
                        </Text>
                      )}
                      {Boolean(item.note) && (
                        <Text style={styles.placeNote} numberOfLines={2}>
                          📝 {item.note}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </Card>
              )
            }}
            ListEmptyComponent={
              <EmptyState
                iconName="bookmark-outline"
                title={searchQuery ? 'No matching places' : 'Places Pool is Empty'}
                description={
                  searchQuery
                    ? 'No saved places match your search filter.'
                    : 'Save attractions from Explore to keep them in this pool without locking into a specific day.'
                }
                actionTitle={searchQuery ? 'Clear Filter' : 'Explore Places'}
                onActionPress={() => {
                  if (searchQuery) setSearchQuery('')
                  else navigation.navigate('ExploreTab')
                }}
              />
            }
          />
        </View>
      )}

      {/* ==================================================== */}
      {/* TAB 2: CUSTOM LISTS */}
      {/* ==================================================== */}
      {activeTab === 'customLists' && (
        <FlatList
          data={customLists}
          keyExtractor={(item, index) => String(item.id ? `list-${item.id}` : (item.title || item.name ? `list-${item.title || item.name}` : `custom-list-${index}`))}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: list }) => {
            const listItems = Array.isArray(list.items) ? list.items : []
            return (
              <Card style={styles.customListCard}>
                {/* List Header */}
                <View style={styles.listCardHeader}>
                  <View style={styles.listTitleLeft}>
                    <View style={[styles.listIconCircle, { backgroundColor: list.color ? `${list.color}20` : '#ECFDF5' }]}>
                      <Ionicons name="folder" size={18} color={list.color || colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{list.name || list.title || 'Untitled List'}</Text>
                      {Boolean(list.description) ? (
                        <Text style={styles.listDescription}>{list.description}</Text>
                      ) : (
                        <Text style={styles.listCountSub}>{listItems.length} items saved</Text>
                      )}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.editListBtn}
                      onPress={() => handleOpenEditList(list)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.addListItemPill}
                      onPress={() => handleOpenAddListItem(list.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={14} color={colors.primary} />
                      <Text style={styles.addListItemPillText}>Add</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeListIconBtn}
                      onPress={() => handleDeleteCustomList(list)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error || '#ef4444'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* List Items Stack */}
                <View style={styles.itemsWrapper}>
                  {listItems.length === 0 ? (
                    <Text style={styles.emptyListNotice}>
                      No items in this list yet. Tap "+ Add" to add places or checklist items.
                    </Text>
                  ) : (
                    listItems.map((listItem, i) => {
                      const isPlace = typeof listItem === 'object' && Boolean(listItem?.title || listItem?.name)
                      if (isPlace) {
                        return (
                          <View key={listItem.id || `cl-place-${i}`} style={styles.listPlaceRow}>
                            <SafeImage
                              source={{ uri: listItem.image || listItem.photo || getPlaceImage(listItem.id, listItem.category, listItem.title) }}
                              style={styles.listPlaceThumb}
                              resizeMode="cover"
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.listPlaceTitle} numberOfLines={1}>
                                {listItem.title || listItem.name}
                              </Text>
                              <Text style={styles.listPlaceSub} numberOfLines={1}>
                                {listItem.subtitle || listItem.category || 'Saved Place'}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity
                                style={styles.miniMoveBtn}
                                onPress={() => handleOpenSchedulePlace(listItem)}
                                title="Move to Itinerary Day"
                              >
                                <Ionicons name="calendar-outline" size={13} color={colors.textWhite} />
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.miniMoveBtn, { backgroundColor: '#6366f1' }]}
                                onPress={() => handleMoveToPool(listItem, `custom:${list.id}`)}
                                title="Move to Pool"
                              >
                                <Ionicons name="arrow-up-circle-outline" size={13} color={colors.textWhite} />
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleRemoveItemFromList(list.id, listItem, i)}
                                style={{ padding: 4 }}
                              >
                                <Ionicons name="close" size={16} color={colors.textTertiary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )
                      }

                      // Checklist/String item
                      return (
                        <View key={`cl-item-${i}`} style={styles.listItemRow}>
                          <Ionicons name="checkmark-circle-outline" size={17} color={colors.primary} />
                          <Text style={styles.listItemText}>{String(listItem)}</Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveItemFromList(list.id, listItem, i)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close" size={15} color={colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      )
                    })
                  )}
                </View>
              </Card>
            )
          }}
          ListEmptyComponent={
            <EmptyState
              iconName="folder-open-outline"
              title="No Custom Lists Yet"
              description="Organize themed sub-collections such as packing essentials, street food to try, or photography spots."
              actionTitle="+ Create Custom List"
              onActionPress={() => setCreateListModalVisible(true)}
            />
          }
        />
      )}

      {/* ==================================================== */}
      {/* TAB 3: WISHLIST (GLOBAL SAVED) */}
      {/* ==================================================== */}
      {activeTab === 'wishlist' && (
        <View style={{ flex: 1 }}>
          {/* Wishlist Search & Filter Bar */}
          <View style={styles.poolFilterWrapper}>
            <TextInput
              style={styles.poolSearchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search your universal wishlist..."
              placeholderTextColor={colors.textTertiary}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.poolCatRow}
            >
              {['All', 'Attraction', 'Scenic', 'Museum', 'Food', 'Shopping'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.poolCatChip,
                    categoryFilter === cat && styles.poolCatChipActive,
                  ]}
                  onPress={() => setCategoryFilter(cat)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.poolCatChipText,
                      categoryFilter === cat && styles.poolCatChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredWishlist}
            keyExtractor={(item, index) => String(item.id ? `wish-${item.id}` : (item.place_id ? `wish-${item.place_id}` : `wish-${index}`)) }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const imageUrl = item.image || item.photo || getPlaceImage(item.id, item.category, item.title || item.name)
              return (
                <Card style={styles.poolCard}>
                  <TouchableOpacity
                    style={styles.poolCardTouch}
                    onPress={() => handleOpenPlaceDetails(item)}
                    activeOpacity={0.88}
                  >
                    <SafeImage source={{ uri: imageUrl }} style={styles.poolImage} resizeMode="cover" />
                    <View style={styles.poolDetails}>
                      <View style={styles.cardHeader}>
                        <Badge label={item.category || 'Spot'} variant="primary" size="sm" />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={[styles.schedulePillBtn, { backgroundColor: colors.accentDark || '#4338ca' }]}
                            onPress={() => handleMoveToPool(item)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="add" size={13} color={colors.textWhite} />
                            <Text style={styles.schedulePillText}>To Trip Pool</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleOpenSchedulePlace(item)}
                            activeOpacity={0.7}
                            title="Schedule to Day"
                          >
                            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.removePoolBtn}
                            onPress={() => handleRemoveFromWishlist(item)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="bookmark" size={15} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.placeTitle} numberOfLines={1}>{item.title || item.name}</Text>
                      {Boolean(item.subtitle || item.destination) && (
                        <Text style={styles.placeSubtitle} numberOfLines={1}>
                          📍 {item.subtitle || item.destination}
                        </Text>
                      )}
                      {Boolean(item.note) && (
                        <Text style={styles.placeNote} numberOfLines={2}>
                          📝 {item.note}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </Card>
              )
            }}
            ListEmptyComponent={
              <EmptyState
                iconName="bookmark-outline"
                title={searchQuery ? 'No matching bookmarks' : 'Wishlist is Empty'}
                description={
                  searchQuery
                    ? 'No bookmarked spots match your search filter.'
                    : 'Explore Pakistani destinations and bookmark your favorite sights to keep them handy across trips.'
                }
                actionTitle={searchQuery ? 'Clear Filter' : 'Explore Places'}
                onActionPress={() => {
                  if (searchQuery) setSearchQuery('')
                  else navigation.navigate('ExploreTab')
                }}
              />
            }
          />
        </View>
      )}

      {/* Modal 1: Switch Active Trip */}
      <ModalSheet
        visible={tripSwitcherVisible}
        onClose={() => setTripSwitcherVisible(false)}
        title="Select Active Trip"
        subtitle="Choose which trip workspace to manage"
      >
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {savedTrips.map((t, idx) => {
            const isSelected = String(t.id || t.tripId) === String(activeTrip.id || activeTrip.tripId)
            const tripKey = `saved-target-${t.isTripmate ? 'shared' : 'personal'}-${t.id || t.tripId || idx}`
            return (
              <TouchableOpacity
                key={tripKey}
                style={[styles.tripSelectRow, isSelected && styles.tripSelectRowActive]}
                onPress={() => {
                  setActiveTrip(t)
                  setTripSwitcherVisible(false)
                }}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tripSelectTitle, isSelected && styles.tripSelectTitleActive]}>
                    {t.title || t.name}
                  </Text>
                  <Text style={styles.tripSelectSub}>{t.destination || 'Pakistan'} • {t.dates || 'Flexible dates'}</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </ModalSheet>

      {/* Modal 2: Schedule Place to Day */}
      <ModalSheet
        visible={scheduleModalVisible}
        onClose={() => setScheduleModalVisible(false)}
        title="Schedule Place to Day"
        subtitle={`Assign "${selectedPlaceForSchedule?.title || selectedPlaceForSchedule?.name}" to an itinerary day`}
      >
        <View style={{ paddingTop: 8 }}>
          <Text style={styles.inputLabel}>Select Day in "{activeTrip.title || activeTrip.destination}"</Text>
          <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
            {(activeTrip.days || []).map((d, dIdx) => (
              <TouchableOpacity
                key={d.id || `day-pick-${dIdx}`}
                style={styles.dayPickRow}
                onPress={() => handleAssignToDay(d.id)}
                activeOpacity={0.8}
              >
                <View style={styles.dayPickLeft}>
                  <View style={styles.dayPickBadge}>
                    <Text style={styles.dayPickBadgeText}>{d.shortLabel || `Day ${dIdx + 1}`}</Text>
                  </View>
                  <View>
                    <Text style={styles.dayPickTitle}>{d.label || `Day ${dIdx + 1}`}</Text>
                    <Text style={styles.dayPickSub}>
                      {(d.items || []).length} stops currently planned
                    </Text>
                  </View>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ModalSheet>

      {/* Modal 3: Move Place to Custom List */}
      <ModalSheet
        visible={moveToListModalVisible}
        onClose={() => setMoveToListModalVisible(false)}
        title="Add to Custom List"
        subtitle={`Select a list for "${selectedPlaceForList?.title || selectedPlaceForList?.name}"`}
      >
        <View style={{ paddingTop: 8 }}>
          <Text style={styles.inputLabel}>Choose Container List</Text>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {customLists.map((cl) => (
              <TouchableOpacity
                key={cl.id}
                style={styles.dayPickRow}
                onPress={() => handleAssignToList(cl.id)}
                activeOpacity={0.8}
              >
                <View style={styles.dayPickLeft}>
                  <View style={[styles.dayPickBadge, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="folder-outline" size={15} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.dayPickTitle}>{cl.name || cl.title}</Text>
                    <Text style={styles.dayPickSub}>
                      {(cl.items || []).length} items currently in list
                    </Text>
                  </View>
                </View>
                <Ionicons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ModalSheet>

      {/* Modal 4: Place Details Sheet */}
      <ModalSheet
        visible={placeDetailsModalVisible}
        onClose={() => setPlaceDetailsModalVisible(false)}
        title={selectedPlaceForDetails?.title || selectedPlaceForDetails?.name || 'Place Details'}
        subtitle={selectedPlaceForDetails?.subtitle || selectedPlaceForDetails?.address || activeTrip?.destination}
      >
        {selectedPlaceForDetails && (
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <SafeImage
              source={{ uri: selectedPlaceForDetails.image || selectedPlaceForDetails.photo || getPlaceImage(selectedPlaceForDetails.id, selectedPlaceForDetails.category, selectedPlaceForDetails.title) }}
              style={styles.detailsModalImage}
              resizeMode="cover"
            />
            <View style={{ paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Badge label={selectedPlaceForDetails.category || 'Attraction'} variant="primary" size="sm" />
                {selectedPlaceForDetails.rating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      {selectedPlaceForDetails.rating}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.detailsModalTitle}>
                {selectedPlaceForDetails.title || selectedPlaceForDetails.name}
              </Text>

              <Text style={styles.detailsModalAddress}>
                📍 {selectedPlaceForDetails.subtitle || selectedPlaceForDetails.address || selectedPlaceForDetails.destination || 'Pakistan'}
              </Text>

              {Boolean(selectedPlaceForDetails.imageAttribution || selectedPlaceForDetails.imageSource) && (
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
                  {selectedPlaceForDetails.imageVerified === false
                    ? '📷 Category reference (verified photo pending)'
                    : `📷 Verified Authentic • ${selectedPlaceForDetails.imageAttribution || 'TripNest Catalog'}`}
                </Text>
              )}

              <Text style={styles.detailsModalOverviewHeader}>Overview & Travel Advice</Text>
              <Text style={styles.detailsModalDesc}>
                {selectedPlaceForDetails.note || selectedPlaceForDetails.description || 'A remarkable travel highlight in Pakistan with verified geographic coordinates.'}
              </Text>

              {/* Action Buttons Row */}
              <View style={styles.detailsModalActions}>
                <Button
                  title="Schedule to Day"
                  variant="primary"
                  pill
                  iconName="calendar-outline"
                  onPress={() => {
                    setPlaceDetailsModalVisible(false)
                    handleOpenSchedulePlace(selectedPlaceForDetails)
                  }}
                  style={{ flex: 1.2 }}
                />
                <Button
                  title="To Pool"
                  variant="outline"
                  pill
                  iconName="bookmark-outline"
                  onPress={() => {
                    setPlaceDetailsModalVisible(false)
                    handleMoveToPool(selectedPlaceForDetails)
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </ModalSheet>

      {/* Modal 5: Save Spot to Pool */}
      <ModalSheet
        visible={addPoolModalVisible}
        onClose={() => setAddPoolModalVisible(false)}
        title="Save Spot to Pool"
        subtitle="Add a place to this trip's unscheduled list"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Place Name</Text>
          <TextInput
            style={styles.modalInput}
            value={poolTitle}
            onChangeText={setPoolTitle}
            placeholder="e.g. Attabad Lake, Daman-e-Koh"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Location / Subtitle</Text>
          <TextInput
            style={styles.modalInput}
            value={poolSubtitle}
            onChangeText={setPoolSubtitle}
            placeholder="e.g. Hunza Valley, Gilgit-Baltistan"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Travel Notes (Optional)</Text>
          <TextInput
            style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
            value={poolNote}
            onChangeText={setPoolNote}
            placeholder="e.g. Best sunset view, boat ride costs PKR 1000"
            placeholderTextColor={colors.textTertiary}
            multiline
          />

          <Button
            title="Save to Pool"
            iconName="bookmark"
            onPress={handleAddPoolPlaceSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal 6: Create Custom List */}
      <ModalSheet
        visible={createListModalVisible}
        onClose={() => setCreateListModalVisible(false)}
        title="Create Custom List"
        subtitle="Packing, gear, food, or photography collection"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>List Title</Text>
          <TextInput
            style={styles.modalInput}
            value={listTitle}
            onChangeText={setListTitle}
            placeholder="e.g. Street Food to Try, Photography Gear"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Description (Optional)</Text>
          <TextInput
            style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
            value={listDescription}
            onChangeText={setListDescription}
            placeholder="e.g. Must-visit local food stalls in Old Anarkali"
            placeholderTextColor={colors.textTertiary}
            multiline
          />

          <Button
            title="Create Custom List"
            iconName="add"
            onPress={handleCreateListSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal 7: Edit Custom List */}
      <ModalSheet
        visible={editListModalVisible}
        onClose={() => setEditListModalVisible(false)}
        title="Edit Custom List"
        subtitle="Update list title and notes"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>List Title</Text>
          <TextInput
            style={styles.modalInput}
            value={editListTitle}
            onChangeText={setEditListTitle}
            placeholder="List Title"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
            value={editListDescription}
            onChangeText={setEditListDescription}
            placeholder="Describe what belongs in this list"
            placeholderTextColor={colors.textTertiary}
            multiline
          />

          <Button
            title="Save Changes"
            iconName="checkmark"
            onPress={handleSaveEditListSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>

      {/* Modal 8: Add Item to Custom List */}
      <ModalSheet
        visible={addListItemModalVisible}
        onClose={() => setAddListItemModalVisible(false)}
        title="Add to Custom List"
        subtitle="Add a spot or checklist item"
      >
        <View style={styles.modalForm}>
          <Text style={styles.inputLabel}>Item Type</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <TouchableOpacity
              style={[
                styles.typeToggleBtn,
                newItemType === 'place' && styles.typeToggleBtnActive,
              ]}
              onPress={() => setNewItemType('place')}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={newItemType === 'place' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeToggleText,
                  newItemType === 'place' && styles.typeToggleTextActive,
                ]}
              >
                Place / Spot
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeToggleBtn,
                newItemType === 'checklist' && styles.typeToggleBtnActive,
              ]}
              onPress={() => setNewItemType('checklist')}
            >
              <Ionicons
                name="checkbox-outline"
                size={16}
                color={newItemType === 'checklist' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeToggleText,
                  newItemType === 'checklist' && styles.typeToggleTextActive,
                ]}
              >
                Checklist Item
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Name / Title</Text>
          <TextInput
            style={styles.modalInput}
            value={newItemTitle}
            onChangeText={setNewItemTitle}
            placeholder={newItemType === 'place' ? 'e.g. Waris Nihari' : 'e.g. Power bank & charger'}
            placeholderTextColor={colors.textTertiary}
          />

          {newItemType === 'place' && (
            <>
              <Text style={styles.inputLabel}>Location / Subtitle</Text>
              <TextInput
                style={styles.modalInput}
                value={newItemSubtitle}
                onChangeText={setNewItemSubtitle}
                placeholder="e.g. Anarkali Bazaar, Lahore"
                placeholderTextColor={colors.textTertiary}
              />
            </>
          )}

          <Button
            title="Add to List"
            iconName="add"
            onPress={handleAddListItemSubmit}
            style={{ marginTop: 14 }}
          />
        </View>
      </ModalSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 14,
  },
  emptySubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  headerCol: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  tripSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tripSelectorText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    maxWidth: 220,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrapper: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  contextBanner: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    marginBottom: 6,
  },
  contextBannerText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
  },
  poolFilterWrapper: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  poolSearchInput: {
    height: 42,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  poolCatRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  poolCatChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  poolCatChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  poolCatChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  poolCatChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  poolCard: {
    marginBottom: 12,
    overflow: 'hidden',
    padding: 0,
  },
  poolCardTouch: {
    flexDirection: 'row',
    padding: 10,
  },
  poolImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
  },
  poolDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  schedulePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  schedulePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textWhite,
  },
  actionIconBtn: {
    padding: 4,
  },
  removePoolBtn: {
    padding: 4,
  },
  placeTitle: {
    ...typography.subtitle2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  placeSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  placeNote: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  customListCard: {
    marginBottom: 14,
    padding: 14,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  listIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    ...typography.subtitle1,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  listDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listCountSub: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  editListBtn: {
    padding: 4,
  },
  addListItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 2,
  },
  addListItemPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  removeListIconBtn: {
    padding: 4,
  },
  itemsWrapper: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  emptyListNotice: {
    ...typography.caption,
    color: colors.textTertiary,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  listPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  listPlaceThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
  },
  listPlaceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listPlaceSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  miniMoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  listItemText: {
    flex: 1,
    ...typography.body2,
    color: colors.textPrimary,
  },
  tripSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: colors.surfaceSubtle,
  },
  tripSelectRowActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tripSelectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tripSelectTitleActive: {
    color: colors.primaryDark,
  },
  tripSelectSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dayPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    marginBottom: 8,
  },
  dayPickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayPickBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayPickBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  dayPickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayPickSub: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  detailsModalImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
  },
  detailsModalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailsModalAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  detailsModalOverviewHeader: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailsModalDesc: {
    ...typography.body2,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  detailsModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalForm: {
    paddingVertical: 8,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  typeToggleBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeToggleTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
})

export default SavedPlacesScreen

