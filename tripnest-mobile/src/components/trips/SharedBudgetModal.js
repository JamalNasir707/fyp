import React, { useState, useEffect, useMemo } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import Card from '../common/Card'
import Button from '../common/Button'

const EXPENSE_CATEGORIES = ['Eat & Drink', 'Sleep', 'Transport', 'See & Do', 'Other']

const CATEGORY_ICONS = {
  'Eat & Drink': 'restaurant-outline',
  Sleep: 'bed-outline',
  Transport: 'car-outline',
  'See & Do': 'camera-outline',
  Other: 'receipt-outline',
}

const CATEGORY_COLORS = {
  'Eat & Drink': '#F59E0B',
  Sleep: '#6366F1',
  Transport: '#0D9488',
  'See & Do': '#EC4899',
  Other: '#64748B',
}

export function SharedBudgetModal({ visible, onClose, trip, tripId: directTripId, tripTitle }) {
  const {
    user,
    sharedBudgetExpenses,
    sharedBudgetSettlements,
    sharedBudgetLoading,
    loadSharedBudget,
    addSharedBudgetExpense,
    updateSharedBudgetExpense,
    deleteSharedBudgetExpense,
    addSharedBudgetSettlement,
    deleteSharedBudgetSettlement,
    tripMembers,
    loadTripMembers,
  } = useApp()

  // 3 Clear Sections: 'expenses' | 'balances' | 'settlements'
  const [activeTab, setActiveTab] = useState('expenses')

  // Add / Edit Expense Form State
  const [expenseModalVisible, setExpenseModalVisible] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Eat & Drink')
  const [expenseDestination, setExpenseDestination] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedPayerId, setSelectedPayerId] = useState('')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([])
  const [submittingExpense, setSubmittingExpense] = useState(false)

  // Record Settlement Form State
  const [settleModalVisible, setSettleModalVisible] = useState(false)
  const [settlePayerId, setSettlePayerId] = useState('')
  const [settleReceiverId, setSettleReceiverId] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleNote, setSettleNote] = useState('')
  const [submittingSettlement, setSubmittingSettlement] = useState(false)

  const tripId = directTripId || trip?.tripId || trip?.id

  useEffect(() => {
    if (visible && tripId) {
      loadSharedBudget(tripId)
      if (loadTripMembers) {
        loadTripMembers(tripId)
      }
    }
  }, [visible, tripId])

  // Tripmates Roster (Trip Owner + Accepted Members)
  const membersRoster = useMemo(() => {
    const list = []
    const seen = new Set()

    // 1. Owner
    if (tripMembers?.owner) {
      const oId = String(tripMembers.owner.id || tripMembers.owner.userId || 'owner')
      seen.add(oId)
      list.push({
        id: oId,
        name: tripMembers.owner.name || tripMembers.owner.displayName || tripMembers.owner.username || 'Trip Owner',
        role: 'Organizer',
        isOwner: true,
        color: '#4F46E5',
      })
    } else {
      const defaultOwnerId = String(trip?.userId || user?.id || 'owner')
      seen.add(defaultOwnerId)
      list.push({
        id: defaultOwnerId,
        name: trip?.ownerName || user?.name || user?.username || 'Trip Organizer',
        role: 'Organizer',
        isOwner: true,
        color: '#4F46E5',
      })
    }

    // 2. Members
    if (Array.isArray(tripMembers?.members)) {
      tripMembers.members.forEach((m) => {
        const mId = String(m.id || m.userId || m.username)
        if (!seen.has(mId)) {
          seen.add(mId)
          list.push({
            id: mId,
            name: m.displayName || m.name || m.username || 'Tripmate',
            role: 'Tripmate',
            isOwner: false,
            color: '#0D9488',
          })
        }
      })
    }

    return list
  }, [tripMembers, trip, user])

  // Available itinerary destinations and stops for tagging expenses
  const availableDestinations = useMemo(() => {
    const list = []
    const seen = new Set()
    const addPlace = (title) => {
      if (!title || typeof title !== 'string') return
      const clean = title.trim()
      if (!clean || seen.has(clean.toLowerCase())) return
      seen.add(clean.toLowerCase())
      list.push(clean)
    }
    if (trip?.destination) addPlace(trip.destination)
    ;(trip?.days || []).forEach((d) => {
      ;(d?.items || d?.places || []).forEach((item) => {
        addPlace(item?.title || item?.name)
      })
    })
    ;(trip?.placesPool || []).forEach((p) => {
      addPlace(p?.title || p?.name)
    })
    return list
  }, [trip])

  // Total shared spent
  const totalSharedSpent = useMemo(() => {
    return (sharedBudgetExpenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  }, [sharedBudgetExpenses])

  // Calculate Net Balances per member (strictly following Web app logic)
  const memberBalances = useMemo(() => {
    const balances = {}
    membersRoster.forEach((m) => {
      balances[m.id] = { id: m.id, name: m.name, role: m.role, color: m.color, paid: 0, share: 0, net: 0 }
    })

    const rosterCount = Math.max(1, membersRoster.length)

    // 1. Tally Expenses
    ;(sharedBudgetExpenses || []).forEach((exp) => {
      // Pending expenses are excluded from settlement balances in Web logic
      if (exp.status && exp.status !== 'paid') return

      const amt = Number(exp.amount) || 0

      // Who paid
      if (Array.isArray(exp.payers) && exp.payers.length > 0) {
        exp.payers.forEach((p) => {
          const pId = String(p.userId || p.id || '')
          if (balances[pId]) {
            balances[pId].paid += Number(p.amount) || amt
          } else {
            const match = membersRoster.find((m) => m.id === pId || m.name === p.name)
            if (match && balances[match.id]) {
              balances[match.id].paid += Number(p.amount) || amt
            }
          }
        })
      } else {
        const defaultPayerId = membersRoster[0]?.id
        if (defaultPayerId && balances[defaultPayerId]) {
          balances[defaultPayerId].paid += amt
        }
      }

      // Who participates (shares cost)
      if (Array.isArray(exp.participants) && exp.participants.length > 0) {
        exp.participants.forEach((pt) => {
          const ptId = String(pt.userId || pt.id || '')
          if (balances[ptId]) {
            balances[ptId].share += Number(pt.share) || amt / exp.participants.length
          } else {
            const match = membersRoster.find((m) => m.id === ptId || m.name === pt.name)
            if (match && balances[match.id]) {
              balances[match.id].share += Number(pt.share) || amt / exp.participants.length
            }
          }
        })
      } else {
        const equalShare = amt / rosterCount
        membersRoster.forEach((m) => {
          if (balances[m.id]) balances[m.id].share += equalShare
        })
      }
    })

    // 2. Tally Recorded Settlements
    ;(sharedBudgetSettlements || []).forEach((stl) => {
      const amt = Number(stl.amount) || 0
      const pId = String(stl.payerId)
      const rId = String(stl.receiverId)
      if (balances[pId]) balances[pId].paid += amt
      if (balances[rId]) balances[rId].paid -= amt
    })

    // 3. Compute net balance (paid - share)
    Object.values(balances).forEach((b) => {
      b.paid = Math.round(b.paid)
      b.share = Math.round(b.share)
      b.net = Math.round(b.paid - b.share)
    })

    return Object.values(balances)
  }, [membersRoster, sharedBudgetExpenses, sharedBudgetSettlements])

  // Current logged in user balance info
  const currentUserId = String(user?.id || user?._id || membersRoster[0]?.id || '')
  const currentUserBalance = useMemo(() => {
    return memberBalances.find((m) => m.id === currentUserId) || {
      id: currentUserId,
      name: user?.name || 'You',
      paid: 0,
      share: 0,
      net: 0,
    }
  }, [memberBalances, currentUserId, user])

  // Calculate "Who Needs to Pay Whom" (Pairwise debts to settle all balances)
  const whoNeedsToPayWhom = useMemo(() => {
    const creditors = memberBalances
      .filter((m) => m.net > 0)
      .map((m) => ({ ...m, remaining: m.net }))
      .sort((a, b) => b.remaining - a.remaining)

    const debtors = memberBalances
      .filter((m) => m.net < 0)
      .map((m) => ({ ...m, remaining: Math.abs(m.net) }))
      .sort((a, b) => b.remaining - a.remaining)

    const debts = []
    let cIdx = 0
    let dIdx = 0

    while (cIdx < creditors.length && dIdx < debtors.length) {
      const creditor = creditors[cIdx]
      const debtor = debtors[dIdx]

      const amt = Math.min(creditor.remaining, debtor.remaining)
      if (amt >= 1) {
        debts.push({
          debtorId: debtor.id,
          debtorName: debtor.name,
          creditorId: creditor.id,
          creditorName: creditor.name,
          amount: Math.round(amt),
        })
      }

      creditor.remaining -= amt
      debtor.remaining -= amt

      if (creditor.remaining < 0.5) cIdx++
      if (debtor.remaining < 0.5) dIdx++
    }

    return debts
  }, [memberBalances])

  // Open Add Expense modal
  function handleOpenAddExpense() {
    setEditingExpenseId(null)
    setExpenseTitle('')
    setExpenseAmount('')
    setExpenseCategory('Eat & Drink')
    setExpenseDestination(availableDestinations[0] || '')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setSelectedPayerId(membersRoster[0]?.id || '')
    setSelectedParticipantIds(membersRoster.map((m) => m.id))
    setExpenseModalVisible(true)
  }

  // Open Edit Expense modal
  function handleOpenEditExpense(exp) {
    setEditingExpenseId(exp.id)
    setExpenseTitle(exp.name || exp.title || '')
    setExpenseAmount(String(exp.amount || ''))
    setExpenseCategory(exp.category || 'Eat & Drink')
    setExpenseDestination(exp.destinationReference || '')
    setExpenseDate(exp.date || new Date().toISOString().split('T')[0])
    setSelectedPayerId(exp.payers?.[0]?.userId || membersRoster[0]?.id || '')
    const partIds =
      Array.isArray(exp.participants) && exp.participants.length > 0
        ? exp.participants.map((p) => String(p.userId || p.id))
        : membersRoster.map((m) => m.id)
    setSelectedParticipantIds(partIds)
    setExpenseModalVisible(true)
  }

  // Quick 1-tap Settle from debt card
  function handleQuickSettle(debt) {
    setSettlePayerId(debt.debtorId)
    setSettleReceiverId(debt.creditorId)
    setSettleAmount(String(debt.amount))
    setSettleNote(`Settlement payment to ${debt.creditorName}`)
    setSettleModalVisible(true)
  }

  // Open generic settlement modal
  function handleOpenRecordSettlement() {
    const firstPayer = membersRoster[0]?.id || ''
    const firstReceiver = membersRoster[1]?.id || membersRoster[0]?.id || ''
    setSettlePayerId(firstPayer)
    setSettleReceiverId(firstReceiver)
    setSettleAmount('')
    setSettleNote('')
    setSettleModalVisible(true)
  }

  // Toggle participant inclusion
  function toggleParticipant(memberId) {
    setSelectedParticipantIds((prev) => {
      if (prev.includes(memberId)) {
        if (prev.length === 1) {
          Alert.alert('Notice', 'At least one person must be included in the expense.')
          return prev
        }
        return prev.filter((id) => id !== memberId)
      } else {
        return [...prev, memberId]
      }
    })
  }

  // Toggle select all participants
  function toggleSelectAllParticipants() {
    if (selectedParticipantIds.length === membersRoster.length) {
      // Deselect all except primary payer
      setSelectedParticipantIds([selectedPayerId || membersRoster[0]?.id])
    } else {
      setSelectedParticipantIds(membersRoster.map((m) => m.id))
    }
  }

  // Submit Expense (Create or Update)
  async function handleSubmitExpense() {
    const cleanTitle = expenseTitle.trim()
    const amt = parseFloat(expenseAmount)

    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.')
      return
    }

    const payer = membersRoster.find((m) => m.id === selectedPayerId) || membersRoster[0]
    const includedMembers = membersRoster.filter((m) =>
      selectedParticipantIds.length > 0 ? selectedParticipantIds.includes(m.id) : true
    )

    if (includedMembers.length === 0) {
      Alert.alert('Required', 'Please select at least one person included in this expense.')
      return
    }

    setSubmittingExpense(true)
    try {
      // Deterministic proportional split with remainder cents assigned to first member
      const initialShares = includedMembers.map((m) => {
        const raw = amt / includedMembers.length
        return {
          m,
          rounded: Math.floor(raw * 100) / 100,
        }
      })
      const sumRounded = initialShares.reduce((s, item) => s + item.rounded, 0)
      let diffCents = Math.round((amt - sumRounded) * 100)

      const participants = initialShares.map((item, idx) => {
        let share = item.rounded
        if (idx === 0 && diffCents !== 0) {
          share = Math.round((share + diffCents / 100) * 100) / 100
        }
        return {
          userId: item.m.id,
          name: item.m.name,
          share,
        }
      })

      const payload = {
        name: cleanTitle || expenseCategory,
        amount: amt,
        currency: 'PKR',
        category: expenseCategory,
        date: expenseDate,
        destinationReference: expenseDestination || '',
        status: 'paid',
        payers: [{ userId: payer.id, name: payer.name, amount: amt }],
        participants,
      }

      if (editingExpenseId) {
        await updateSharedBudgetExpense(tripId, editingExpenseId, payload)
      } else {
        await addSharedBudgetExpense(tripId, payload)
      }

      setExpenseModalVisible(false)
      setEditingExpenseId(null)
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save shared expense.')
    } finally {
      setSubmittingExpense(false)
    }
  }

  // Submit Settlement
  async function handleSubmitSettlement() {
    if (!settlePayerId || !settleReceiverId) {
      Alert.alert('Required', 'Please select both who paid and who received.')
      return
    }
    if (settlePayerId === settleReceiverId) {
      Alert.alert('Invalid', 'The person paying and person receiving cannot be the same.')
      return
    }

    const amt = parseFloat(settleAmount)
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid settlement amount.')
      return
    }

    const payer = membersRoster.find((m) => m.id === settlePayerId)
    const receiver = membersRoster.find((m) => m.id === settleReceiverId)

    setSubmittingSettlement(true)
    try {
      await addSharedBudgetSettlement(tripId, {
        payerId: payer.id,
        payerName: payer.name,
        receiverId: receiver.id,
        receiverName: receiver.name,
        amount: amt,
        currency: 'PKR',
        date: new Date().toISOString().split('T')[0],
        note: settleNote.trim(),
      })
      setSettleModalVisible(false)
      setSettleAmount('')
      setSettleNote('')
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not record settlement.')
    } finally {
      setSubmittingSettlement(false)
    }
  }

  // Delete Expense Confirmation
  function handleDeleteExpense(exp) {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to remove "${exp.name || 'this expense'}"? This will update group balances.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSharedBudgetExpense(tripId, exp.id),
        },
      ]
    )
  }

  // Delete Settlement Confirmation
  function handleDeleteSettlement(stl) {
    Alert.alert(
      'Delete Settlement',
      `Remove this recorded payment of PKR ${Number(stl.amount).toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSharedBudgetSettlement(tripId, stl.id),
        },
      ]
    )
  }

  // Format participant names summary for an expense card
  function getParticipantsSummary(exp) {
    if (!Array.isArray(exp.participants) || exp.participants.length === 0) {
      return 'All group members'
    }
    if (exp.participants.length === membersRoster.length && membersRoster.length > 1) {
      return `All members (${membersRoster.length})`
    }
    return exp.participants.map((p) => p.name || 'Member').join(', ')
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Shared Budget</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {tripTitle || trip?.destination || trip?.title || 'Trip'} • {membersRoster.length} {membersRoster.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Total Spend Summary Bar */}
        <View style={styles.totalSpendBar}>
          <View>
            <Text style={styles.totalSpendLabel}>TOTAL GROUP SPEND</Text>
            <Text style={styles.totalSpendAmount}>PKR {totalSharedSpent.toLocaleString()}</Text>
          </View>
          <View style={styles.totalSpendMeta}>
            <View style={styles.metaBadge}>
              <Ionicons name="receipt" size={13} color={colors.primary} />
              <Text style={styles.metaBadgeText}>{sharedBudgetExpenses.length} expenses</Text>
            </View>
          </View>
        </View>

        {/* Solo Traveler Notice if only 1 member */}
        {membersRoster.length <= 1 && (
          <View style={styles.soloNotice}>
            <Ionicons name="information-circle" size={18} color="#4F46E5" />
            <Text style={styles.soloNoticeText}>
              Add tripmates from trip settings to split bills and settle debts together.
            </Text>
          </View>
        )}

        {/* 3 Clear Navigation Sections: Expenses, Balances, Settlements */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'expenses' && styles.tabItemActive]}
            onPress={() => setActiveTab('expenses')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="receipt-outline"
              size={16}
              color={activeTab === 'expenses' ? colors.primary : colors.textTertiary}
            />
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
              Expenses ({sharedBudgetExpenses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'balances' && styles.tabItemActive]}
            onPress={() => setActiveTab('balances')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="scale-outline"
              size={16}
              color={activeTab === 'balances' ? colors.primary : colors.textTertiary}
            />
            <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
              Balances
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'settlements' && styles.tabItemActive]}
            onPress={() => setActiveTab('settlements')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="checkmark-done-circle-outline"
              size={16}
              color={activeTab === 'settlements' ? colors.primary : colors.textTertiary}
            />
            <Text style={[styles.tabText, activeTab === 'settlements' && styles.tabTextActive]}>
              Settlements ({sharedBudgetSettlements.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {sharedBudgetLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Syncing shared budget...</Text>
            </View>
          ) : null}

          {/* ==================================================== */}
          {/* SECTION 1: EXPENSES */}
          {/* ==================================================== */}
          {activeTab === 'expenses' && (
            <View>
              {/* Section Header with Add Action */}
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Shared Expenses</Text>
                  <Text style={styles.sectionSubtitle}>Bills and costs split among travelers</Text>
                </View>
                <TouchableOpacity
                  style={styles.primaryAddBtn}
                  onPress={handleOpenAddExpense}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryAddBtnText}>Add Expense</Text>
                </TouchableOpacity>
              </View>

              {sharedBudgetExpenses.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="receipt-outline" size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>No shared expenses yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Add group spending on food, hotels, transport, or tickets to split costs automatically.
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryAddBtn, { marginTop: 14 }]}
                    onPress={handleOpenAddExpense}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryAddBtnText}>Add First Expense</Text>
                  </TouchableOpacity>
                </Card>
              ) : (
                sharedBudgetExpenses.map((exp) => {
                  const payerName = exp.payers?.[0]?.name || membersRoster[0]?.name || 'Organizer'
                  const cat = exp.category || 'Other'
                  const catColor = CATEGORY_COLORS[cat] || '#64748B'
                  const catIcon = CATEGORY_ICONS[cat] || 'receipt-outline'
                  const participantsText = getParticipantsSummary(exp)
                  const sharePerPerson =
                    Array.isArray(exp.participants) && exp.participants.length > 0 && exp.participants[0]?.share != null
                      ? Math.round(Number(exp.participants[0].share))
                      : exp.amount && exp.participants?.length
                      ? Math.round(Number(exp.amount) / exp.participants.length)
                      : null

                  return (
                    <Card key={exp.id} style={styles.expenseCard}>
                      <View style={styles.expenseCardTop}>
                        {/* Category Icon */}
                        <View style={[styles.expenseIconWrap, { backgroundColor: `${catColor}18` }]}>
                          <Ionicons name={catIcon} size={18} color={catColor} />
                        </View>

                        {/* Title, Date & Amount */}
                        <View style={styles.expenseMainInfo}>
                          <Text style={styles.expenseTitle}>{exp.name || exp.title || 'Shared Expense'}</Text>
                          <Text style={styles.expenseMetaText}>
                            {cat} • {exp.date || 'Recent'}
                          </Text>
                        </View>

                        {/* Amount */}
                        <View style={styles.expenseAmountWrap}>
                          <Text style={styles.expenseAmountText}>
                            PKR {Number(exp.amount || 0).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      {/* Who Paid & Who is Included */}
                      <View style={styles.expenseDetailsRow}>
                        <View style={styles.expensePayerTag}>
                          <Ionicons name="person" size={11} color="#4F46E5" />
                          <Text style={styles.expensePayerText}>
                            Paid by <Text style={{ fontWeight: '700' }}>{payerName}</Text>
                          </Text>
                        </View>

                        <View style={styles.expenseParticipantsTag}>
                          <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.expenseParticipantsText} numberOfLines={1}>
                            Included: {participantsText}
                          </Text>
                        </View>

                        {sharePerPerson != null && (
                          <View style={styles.expenseShareTag}>
                            <Ionicons name="pie-chart-outline" size={11} color="#0D9488" />
                            <Text style={styles.expenseShareText}>
                              PKR {sharePerPerson.toLocaleString()} each ({exp.participants?.length || 1} {exp.participants?.length === 1 ? 'person' : 'people'})
                            </Text>
                          </View>
                        )}

                        {Boolean(exp.destinationReference) && (
                          <View style={styles.expenseDestTag}>
                            <Ionicons name="location-outline" size={11} color="#D97706" />
                            <Text style={styles.expenseDestText} numberOfLines={1}>
                              {exp.destinationReference}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Card Action Buttons */}
                      <View style={styles.expenseCardActions}>
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => handleOpenEditExpense(exp)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="pencil" size={15} color={colors.textSecondary} />
                          <Text style={styles.actionBtnText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionIconBtn, { marginLeft: 16 }]}
                          onPress={() => handleDeleteExpense(exp)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={15} color="#EF4444" />
                          <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  )
                })
              )}
            </View>
          )}

          {/* ==================================================== */}
          {/* SECTION 2: BALANCES */}
          {/* ==================================================== */}
          {activeTab === 'balances' && (
            <View>
              {/* User Personal Status Card */}
              <View
                style={[
                  styles.personalStatusCard,
                  currentUserBalance.net > 0
                    ? styles.statusCardGreen
                    : currentUserBalance.net < 0
                    ? styles.statusCardRed
                    : styles.statusCardNeutral,
                ]}
              >
                <View style={styles.statusCardHeader}>
                  <View style={styles.statusIconWrap}>
                    <Ionicons
                      name={
                        currentUserBalance.net > 0
                          ? 'arrow-down-circle'
                          : currentUserBalance.net < 0
                          ? 'arrow-up-circle'
                          : 'checkmark-circle'
                      }
                      size={24}
                      color={
                        currentUserBalance.net > 0
                          ? '#10B981'
                          : currentUserBalance.net < 0
                          ? '#EF4444'
                          : '#64748B'
                      }
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.statusCardLabel}>YOUR PERSONAL STANDING</Text>
                    <Text
                      style={[
                        styles.statusCardTitle,
                        {
                          color:
                            currentUserBalance.net > 0
                              ? '#047857'
                              : currentUserBalance.net < 0
                              ? '#B91C1C'
                              : '#1E293B',
                        },
                      ]}
                    >
                      {currentUserBalance.net > 0
                        ? `You get back PKR ${currentUserBalance.net.toLocaleString()}`
                        : currentUserBalance.net < 0
                        ? `You owe PKR ${Math.abs(currentUserBalance.net).toLocaleString()}`
                        : "You're all settled up"}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusBreakdownRow}>
                  <View style={styles.statusBreakdownItem}>
                    <Text style={styles.statusBreakdownLabel}>Total You Paid</Text>
                    <Text style={styles.statusBreakdownValue}>PKR {currentUserBalance.paid.toLocaleString()}</Text>
                  </View>
                  <View style={styles.statusDivider} />
                  <View style={styles.statusBreakdownItem}>
                    <Text style={styles.statusBreakdownLabel}>Your Actual Share</Text>
                    <Text style={styles.statusBreakdownValue}>PKR {currentUserBalance.share.toLocaleString()}</Text>
                  </View>
                </View>
              </View>

              {/* Quick Action Button */}
              <View style={styles.balancesActionRow}>
                <TouchableOpacity
                  style={styles.balancesActionBtn}
                  onPress={handleOpenRecordSettlement}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                  <Text style={styles.balancesActionBtnText}>Record a Settlement Payment</Text>
                </TouchableOpacity>
              </View>

              {/* Group Balances List */}
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Group Member Balances</Text>
                  <Text style={styles.sectionSubtitle}>Net balance for each person in this trip</Text>
                </View>
              </View>

              {memberBalances.map((mb) => {
                const isPositive = mb.net > 0
                const isNegative = mb.net < 0

                return (
                  <Card key={mb.id} style={styles.balanceMemberCard}>
                    {/* Avatar */}
                    <View style={[styles.avatarCircle, { backgroundColor: `${mb.color}20` }]}>
                      <Text style={[styles.avatarText, { color: mb.color }]}>
                        {mb.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Member Info */}
                    <View style={styles.memberInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.memberName}>{mb.name}</Text>
                        {mb.role === 'Organizer' && (
                          <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>Organizer</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberSubText}>
                        Paid: PKR {mb.paid.toLocaleString()} • Share: PKR {mb.share.toLocaleString()}
                      </Text>
                    </View>

                    {/* Simple Human Status Badge */}
                    <View style={styles.balanceStatusCol}>
                      <View
                        style={[
                          styles.humanStatusBadge,
                          isPositive
                            ? styles.humanBadgeGreen
                            : isNegative
                            ? styles.humanBadgeRed
                            : styles.humanBadgeGray,
                        ]}
                      >
                        <Text
                          style={[
                            styles.humanStatusText,
                            isPositive
                              ? styles.humanTextGreen
                              : isNegative
                              ? styles.humanTextRed
                              : styles.humanTextGray,
                          ]}
                        >
                          {isPositive
                            ? `Gets back PKR ${mb.net.toLocaleString()}`
                            : isNegative
                            ? `Owes PKR ${Math.abs(mb.net).toLocaleString()}`
                            : 'Settled'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                )
              })}
            </View>
          )}

          {/* ==================================================== */}
          {/* SECTION 3: SETTLEMENTS */}
          {/* ==================================================== */}
          {activeTab === 'settlements' && (
            <View>
              {/* Header with Record Payment button */}
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Settlements</Text>
                  <Text style={styles.sectionSubtitle}>Clear debts and record repayments</Text>
                </View>
                <TouchableOpacity
                  style={styles.primaryAddBtn}
                  onPress={handleOpenRecordSettlement}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryAddBtnText}>Record Payment</Text>
                </TouchableOpacity>
              </View>

              {/* Sub-section 1: Who Needs to Pay Whom */}
              <View style={styles.subSectionHeader}>
                <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                <Text style={styles.subSectionTitle}>Who Needs to Pay Whom</Text>
              </View>

              {whoNeedsToPayWhom.length === 0 ? (
                <Card style={styles.allSettledCard}>
                  <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                  <Text style={styles.allSettledTitle}>All Balances Settled</Text>
                  <Text style={styles.allSettledSub}>
                    {sharedBudgetExpenses.length === 0
                      ? 'Add shared expenses to calculate member balances and settlements.'
                      : 'No one owes money right now. All expenses and reimbursements are balanced!'}
                  </Text>
                </Card>
              ) : (
                whoNeedsToPayWhom.map((debt, idx) => (
                  <Card key={`debt-${idx}`} style={styles.debtCard}>
                    <View style={styles.debtMainRow}>
                      <View style={styles.debtIconSquare}>
                        <Ionicons name="arrow-forward" size={18} color="#D97706" />
                      </View>

                      <View style={styles.debtTextWrap}>
                        <Text style={styles.debtSentence}>
                          <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{debt.debtorName}</Text>
                          {' owes '}
                          <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{debt.creditorName}</Text>
                        </Text>
                        <Text style={styles.debtAmount}>PKR {debt.amount.toLocaleString()}</Text>
                      </View>

                      {/* 1-Tap Settle Up Action */}
                      <TouchableOpacity
                        style={styles.settleUpBtn}
                        onPress={() => handleQuickSettle(debt)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        <Text style={styles.settleUpBtnText}>Settle Up</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))
              )}

              {/* Sub-section 2: Recorded Settlements History */}
              <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.subSectionTitle}>Payment History</Text>
              </View>

              {sharedBudgetSettlements.length === 0 ? (
                <Card style={[styles.emptyCard, { paddingVertical: 20 }]}>
                  <Ionicons name="checkmark-done-circle-outline" size={28} color={colors.textTertiary} />
                  <Text style={[styles.emptyTitle, { fontSize: 14 }]}>No payments recorded yet</Text>
                  <Text style={styles.emptySubtitle}>
                    When travelers pay each other back, use the "Settle Up" or "Record Payment" button above to log it.
                  </Text>
                </Card>
              ) : (
                sharedBudgetSettlements.map((stl) => (
                  <Card key={stl.id} style={styles.settlementItemCard}>
                    <View style={styles.settleCheckCircle}>
                      <Ionicons name="checkmark" size={16} color="#10B981" />
                    </View>

                    <View style={styles.settleInfoCol}>
                      <Text style={styles.settleNames}>
                        <Text style={{ fontWeight: '700', color: '#4F46E5' }}>{stl.payerName}</Text>
                        {' paid '}
                        <Text style={{ fontWeight: '700', color: '#0D9488' }}>{stl.receiverName}</Text>
                      </Text>
                      <Text style={styles.settleMeta}>
                        PKR {Number(stl.amount).toLocaleString()} • {stl.date || 'Recorded'}
                        {stl.note ? ` • "${stl.note}"` : ''}
                      </Text>
                    </View>

                    <View style={styles.settleRightCol}>
                      <View style={styles.settleStatusPill}>
                        <Text style={styles.settleStatusText}>Settled</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteSettlement(stl)}
                        style={{ padding: 4, marginTop: 4 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* ==================================================== */}
        {/* MODAL: ADD / EDIT EXPENSE */}
        {/* ==================================================== */}
        <Modal
          visible={expenseModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setExpenseModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalSheet}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingExpenseId ? 'Edit Shared Expense' : 'Add Shared Expense'}
                  </Text>
                  <Text style={styles.modalSubtitle}>Split costs with your travel group</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setExpenseModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                {/* Title */}
                <Text style={styles.fieldLabel}>What was this for? *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Hotel stay, Dinner at Monal, Jeep rental"
                  placeholderTextColor={colors.textTertiary}
                  value={expenseTitle}
                  onChangeText={setExpenseTitle}
                />

                {/* Amount */}
                <Text style={styles.fieldLabel}>Amount (PKR) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 5000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                />

                {/* Category */}
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.categoryChipsRow}>
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = expenseCategory === cat
                    const catColor = CATEGORY_COLORS[cat] || '#64748B'
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.catChip,
                          isSelected && { backgroundColor: `${catColor}20`, borderColor: catColor },
                        ]}
                        onPress={() => setExpenseCategory(cat)}
                      >
                        <Ionicons
                          name={CATEGORY_ICONS[cat] || 'receipt-outline'}
                          size={13}
                          color={isSelected ? catColor : colors.textSecondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.catChipText, isSelected && { color: catColor, fontWeight: '800' }]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Destination / Itinerary Stop Reference */}
                {availableDestinations.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.fieldLabel}>Itinerary Stop (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      <View style={styles.destChipsRow}>
                        <TouchableOpacity
                          style={[styles.destChip, !expenseDestination && styles.destChipSelected]}
                          onPress={() => setExpenseDestination('')}
                        >
                          <Text style={[styles.destChipText, !expenseDestination && styles.destChipTextSelected]}>
                            None
                          </Text>
                        </TouchableOpacity>
                        {availableDestinations.map((dName) => {
                          const isSel = expenseDestination === dName
                          return (
                            <TouchableOpacity
                              key={dName}
                              style={[styles.destChip, isSel && styles.destChipSelected]}
                              onPress={() => setExpenseDestination(dName)}
                            >
                              <Ionicons
                                name="location-outline"
                                size={12}
                                color={isSel ? '#D97706' : colors.textSecondary}
                                style={{ marginRight: 3 }}
                              />
                              <Text style={[styles.destChipText, isSel && styles.destChipTextSelected]}>
                                {dName}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {/* Who Paid */}
                <Text style={styles.fieldLabel}>Who Paid?</Text>
                <View style={styles.memberChipsRow}>
                  {membersRoster.map((m) => {
                    const isSelected = selectedPayerId === m.id
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.memberChip, isSelected && styles.memberChipSelected]}
                        onPress={() => setSelectedPayerId(m.id)}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={14}
                          color={isSelected ? '#4F46E5' : colors.textTertiary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.memberChipText, isSelected && styles.memberChipTextSelected]}>
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Who is Included */}
                <View style={styles.includedHeaderRow}>
                  <Text style={styles.fieldLabel}>Who is included in this cost?</Text>
                  <TouchableOpacity onPress={toggleSelectAllParticipants}>
                    <Text style={styles.toggleAllText}>
                      {selectedParticipantIds.length === membersRoster.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.memberChipsRow}>
                  {membersRoster.map((m) => {
                    const isChecked = selectedParticipantIds.includes(m.id)
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.memberChip, isChecked && styles.participantChipChecked]}
                        onPress={() => toggleParticipant(m.id)}
                      >
                        <Ionicons
                          name={isChecked ? 'checkbox' : 'square-outline'}
                          size={15}
                          color={isChecked ? '#0D9488' : colors.textTertiary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.memberChipText, isChecked && styles.participantChipTextChecked]}>
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Dynamic Share Calculation Preview */}
                {Boolean(expenseAmount && !isNaN(parseFloat(expenseAmount)) && selectedParticipantIds.length > 0) && (
                  <View style={styles.splitPreviewCard}>
                    <Ionicons name="calculator-outline" size={15} color="#0D9488" />
                    <Text style={styles.splitPreviewText}>
                      PKR {Math.round(parseFloat(expenseAmount) / selectedParticipantIds.length).toLocaleString()} per person ({selectedParticipantIds.length} {selectedParticipantIds.length === 1 ? 'person' : 'people'})
                    </Text>
                  </View>
                )}

                {/* Save Button */}
                <Button
                  title={
                    submittingExpense
                      ? 'Saving...'
                      : editingExpenseId
                      ? 'Update Expense'
                      : 'Save Expense'
                  }
                  pill
                  size="lg"
                  onPress={handleSubmitExpense}
                  disabled={submittingExpense}
                  style={{ marginTop: 20, marginBottom: 16 }}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ==================================================== */}
        {/* MODAL: RECORD SETTLEMENT */}
        {/* ==================================================== */}
        <Modal
          visible={settleModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setSettleModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalSheet}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Record Settlement</Text>
                  <Text style={styles.modalSubtitle}>Log a reimbursement payment between members</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSettleModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                {/* Who paid? */}
                <Text style={styles.fieldLabel}>Who Paid? (Debtor)</Text>
                <View style={styles.memberChipsRow}>
                  {membersRoster.map((m) => {
                    const isSelected = settlePayerId === m.id
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.memberChip, isSelected && styles.memberChipSelected]}
                        onPress={() => setSettlePayerId(m.id)}
                      >
                        <Text style={[styles.memberChipText, isSelected && styles.memberChipTextSelected]}>
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Who received? */}
                <Text style={styles.fieldLabel}>Who Received? (Creditor)</Text>
                <View style={styles.memberChipsRow}>
                  {membersRoster.map((m) => {
                    const isSelected = settleReceiverId === m.id
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.memberChip, isSelected && styles.participantChipChecked]}
                        onPress={() => setSettleReceiverId(m.id)}
                      >
                        <Text style={[styles.memberChipText, isSelected && styles.participantChipTextChecked]}>
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Amount */}
                <Text style={styles.fieldLabel}>Amount Paid (PKR) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 2500"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={settleAmount}
                  onChangeText={setSettleAmount}
                />

                {/* Note */}
                <Text style={styles.fieldLabel}>Payment Note (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Nayapay, JazzCash, Cash settlement"
                  placeholderTextColor={colors.textTertiary}
                  value={settleNote}
                  onChangeText={setSettleNote}
                />

                {/* Submit button */}
                <Button
                  title={submittingSettlement ? 'Recording...' : 'Record Payment'}
                  pill
                  size="lg"
                  onPress={handleSubmitSettlement}
                  disabled={submittingSettlement}
                  style={{ marginTop: 20, marginBottom: 16 }}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  totalSpendBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
  },
  totalSpendLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  totalSpendAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  totalSpendMeta: {
    alignItems: 'flex-end',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  soloNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  soloNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#3730A3',
    lineHeight: 15,
  },
  // 3-Tab Segmented Control
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  tabItemActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 4,
  },
  primaryAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Empty State Card
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  // Expense Card
  expenseCard: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expenseCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseMainInfo: {
    flex: 1,
    marginLeft: 10,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  expenseMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  expenseAmountWrap: {
    alignItems: 'flex-end',
  },
  expenseAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  expenseDetailsRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  expensePayerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expensePayerText: {
    fontSize: 12,
    color: '#4F46E5',
  },
  expenseParticipantsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expenseParticipantsText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  expenseShareTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expenseShareText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  expenseDestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expenseDestText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  expenseCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Section 2: Personal Standing Status Card
  personalStatusCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 12,
  },
  statusCardGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusCardRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusCardNeutral: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  statusCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  statusBreakdownRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  statusBreakdownItem: {
    flex: 1,
  },
  statusBreakdownLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  statusBreakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  statusDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 12,
  },
  balancesActionRow: {
    marginBottom: 14,
  },
  balancesActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
  },
  balancesActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  // Member Balance Card
  balanceMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    borderRadius: 14,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  memberInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  memberSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  balanceStatusCol: {
    alignItems: 'flex-end',
  },
  humanStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  humanBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  humanBadgeRed: {
    backgroundColor: '#FEE2E2',
  },
  humanBadgeGray: {
    backgroundColor: '#F1F5F9',
  },
  humanStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  humanTextGreen: {
    color: '#15803D',
  },
  humanTextRed: {
    color: '#B91C1C',
  },
  humanTextGray: {
    color: '#475569',
  },
  // Section 3: Settlements
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  allSettledCard: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderRadius: 14,
  },
  allSettledTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
    marginTop: 6,
  },
  allSettledSub: {
    fontSize: 12,
    color: '#15803D',
    textAlign: 'center',
    marginTop: 2,
  },
  debtCard: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderRadius: 12,
  },
  debtMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtIconSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  debtSentence: {
    fontSize: 13,
    color: '#475569',
  },
  debtAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  settleUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  settleUpBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settlementItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  settleCheckCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleInfoCol: {
    flex: 1,
    marginLeft: 10,
  },
  settleNames: {
    fontSize: 13,
    color: '#0F172A',
  },
  settleMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settleRightCol: {
    alignItems: 'flex-end',
  },
  settleStatusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  settleStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  // Modal Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  memberChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  memberChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  memberChipTextSelected: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  includedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 10,
  },
  participantChipChecked: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  participantChipTextChecked: {
    color: '#047857',
    fontWeight: '800',
  },
  destChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  destChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  destChipSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  destChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  destChipTextSelected: {
    color: '#B45309',
    fontWeight: '800',
  },
  splitPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  splitPreviewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
})

export default SharedBudgetModal
