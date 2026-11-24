import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  listSharedBudgetExpensesRequest,
  createSharedBudgetExpenseRequest,
  updateSharedBudgetExpenseRequest,
  deleteSharedBudgetExpenseRequest,
  getTripMembersRequest,
  readStoredToken,
  listSharedBudgetSettlementsRequest,
  createSharedBudgetSettlementRequest,
  deleteSharedBudgetSettlementRequest,
} from '../lib/session'

export default function SharedBudgetSection({ sectionRef }) {
  const { activeTrip, token, user } = useApp()
  const authToken = token || readStoredToken()
  const tripId = activeTrip?.id || activeTrip?.tripId || activeTrip?._id

  const [activeTab, setActiveTab] = useState('expenses')

  // Real Backend State
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editingExpenseId, setEditingExpenseId] = useState(null)

  // Real Settlement Backend State
  const [settlements, setSettlements] = useState([])
  const [settlementsLoading, setSettlementsLoading] = useState(false)
  const [settlementsError, setSettlementsError] = useState(null)

  // Settle Modal Form State
  const [settlePayerId, setSettlePayerId] = useState('')
  const [settleReceiverId, setSettleReceiverId] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleCurrency, setSettleCurrency] = useState('PKR')
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().split('T')[0])
  const [settleNote, setSettleNote] = useState('')
  const [settleFormError, setSettleFormError] = useState(null)
  const [settleSubmitting, setSettleSubmitting] = useState(false)


  // Tripmates Roster State
  const [ownerData, setOwnerData] = useState(null)
  const [membersList, setMembersList] = useState([])

  // Modal Visibility States
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)

  // In-modal Sub-view State for Add Expense: null | 'payer' | 'destination'
  const [activeExpenseSubView, setActiveExpenseSubView] = useState(null)

  // Form States
  const [category, setCategory] = useState('Sleep')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [destination, setDestination] = useState('')
  const [currency, setCurrency] = useState('PKR')
  const [amount, setAmount] = useState('')
  const [expenseName, setExpenseName] = useState('')
  const [isPaid, setIsPaid] = useState(true)
  const [selectedPayers, setSelectedPayers] = useState([])
  const [multipliers, setMultipliers] = useState({})

  // Feedback State
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [saveToast, setSaveToast] = useState(false)

  // Fetch accepted Tripmates & Owner for the current trip
  useEffect(() => {
    if (!tripId || !authToken) return
    let isSubscribed = true
    getTripMembersRequest(authToken, tripId)
      .then((res) => {
        if (isSubscribed && res?.success) {
          if (res.owner) {
            setOwnerData(res.owner)
          }
          if (Array.isArray(res.members)) {
            setMembersList(res.members.filter((m) => m.status === 'accepted'))
          }
        }
      })
      .catch(() => {})
    return () => {
      isSubscribed = false
    }
  }, [tripId, authToken])

  // Dynamically compute availableMembers (Owner from res.owner/fallback, then accepted Tripmates)
  const availableMembers = useMemo(() => {
    const list = []
    const seenIds = new Set()

    // 1. Owner Entry from res.owner if available, or fallbacks
    const oId = String(ownerData?.userId || ownerData?.user_id || ownerData?.id || activeTrip?.userId || user?.id || user?._id || 'owner')
    const oName =
      ownerData?.name ||
      ownerData?.displayName ||
      ownerData?.userName ||
      ownerData?.username ||
      ownerData?.userEmail ||
      ownerData?.email ||
      (user && (user.id === oId || user._id === oId) ? user.name || user.username : null) ||
      'Trip Owner'

    const rawOUsername = ownerData?.userName || ownerData?.username || (user && (user.id === oId || user._id === oId) ? user.username : null)
    const oUsername = rawOUsername ? (rawOUsername.startsWith('@') ? rawOUsername : `@${rawOUsername}`) : ''
    const oProfileImage = ownerData?.profileImage || ownerData?.userProfileImage || (user && (user.id === oId || user._id === oId) ? user.profileImage : null) || null

    list.push({
      id: oId,
      name: oName,
      username: oUsername || '@owner',
      role: ownerData?.role || 'Owner',
      avatar: oName.charAt(0).toUpperCase(),
      profileImage: oProfileImage,
      color: '#4f46e5',
    })
    seenIds.add(oId)

    // 2. Accepted Tripmates Entries from res.members
    membersList.forEach((m) => {
      const mId = String(m.userId || m.user_id || m.id || '')
      if (!mId || seenIds.has(mId)) return
      seenIds.add(mId)

      const mName =
        m.name ||
        m.displayName ||
        m.userName ||
        m.username ||
        m.userEmail ||
        m.email ||
        mId

      const rawMUsername = m.userName || m.username
      const mUsername = rawMUsername
        ? (rawMUsername.startsWith('@') ? rawMUsername : `@${rawMUsername}`)
        : (m.userEmail ? `@${m.userEmail.split('@')[0]}` : '')
      const mProfileImage = m.profileImage || m.userProfileImage || m.avatar || null

      list.push({
        id: mId,
        name: mName,
        username: mUsername || '@member',
        role: m.role || 'Member',
        avatar: mName.charAt(0).toUpperCase(),
        profileImage: mProfileImage,
        color: '#10b981',
      })
    })

    return list
  }, [ownerData, membersList, activeTrip, user])

  // Dynamically compute availableDestinations from activeTrip's itinerary days, placesPool, & customLists
  const availableDestinations = useMemo(() => {
    const list = []
    const seenKeys = new Set()

    if (!activeTrip) return list

    const addPlace = (p) => {
      if (!p) return
      // Filter out notes and checklists
      if (p.type === 'note' || p.type === 'checklist') return

      const pTitle = p.title || p.name || p.placeName || p.label || p.subtitle
      if (!pTitle || typeof pTitle !== 'string' || !pTitle.trim()) return

      const cleanTitle = pTitle.trim()
      const rawId = p.id || p._id || p.place_id || cleanTitle
      const pKey = String(rawId).toLowerCase()

      if (!seenKeys.has(pKey)) {
        seenKeys.add(pKey)
        list.push({
          id: String(rawId),
          name: cleanTitle,
        })
      }
    }

    // 1. Extract days from activeTrip.days, activeTrip.itinerary?.days, activeTrip.data?.days, or activeTrip.itinerary
    const days =
      Array.isArray(activeTrip.days) ? activeTrip.days :
      Array.isArray(activeTrip.itinerary?.days) ? activeTrip.itinerary.days :
      Array.isArray(activeTrip.data?.days) ? activeTrip.data.days :
      Array.isArray(activeTrip.itinerary) ? activeTrip.itinerary : []

    days.forEach((day) => {
      const items = Array.isArray(day?.items) ? day.items : Array.isArray(day?.places) ? day.places : []
      items.forEach((item) => addPlace(item))
    })

    // 2. Extract placesPool from activeTrip.placesPool, activeTrip.itinerary?.placesPool, or activeTrip.data?.placesPool
    const pool =
      Array.isArray(activeTrip.placesPool) ? activeTrip.placesPool :
      Array.isArray(activeTrip.itinerary?.placesPool) ? activeTrip.itinerary.placesPool :
      Array.isArray(activeTrip.data?.placesPool) ? activeTrip.data.placesPool : []

    pool.forEach((item) => addPlace(item))

    // 3. Extract customLists from activeTrip.customLists, activeTrip.itinerary?.customLists, or activeTrip.data?.customLists
    const customLists =
      Array.isArray(activeTrip.customLists) ? activeTrip.customLists :
      Array.isArray(activeTrip.itinerary?.customLists) ? activeTrip.itinerary.customLists :
      Array.isArray(activeTrip.data?.customLists) ? activeTrip.data.customLists : []

    customLists.forEach((cList) => {
      const items = Array.isArray(cList?.items) ? cList.items : []
      items.forEach((item) => addPlace(item))
    })

    return list
  }, [activeTrip])

  // Fetch real Shared Budget Expenses from backend
  const fetchExpenses = async () => {
    if (!tripId || !authToken) return
    setLoading(true)
    setError(null)
    try {
      const res = await listSharedBudgetExpensesRequest(authToken, tripId)
      if (res.success && Array.isArray(res.expenses)) {
        setExpenses(res.expenses)
      } else {
        setError(res.detail || 'Failed to load shared budget expenses')
      }
    } catch (err) {
      setError(err.message || 'Error connecting to shared budget server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [tripId, authToken])

  // Fetch real Shared Budget Settlements from backend
  const fetchSettlements = async () => {
    if (!tripId || !authToken) return
    setSettlementsLoading(true)
    setSettlementsError(null)
    try {
      const res = await listSharedBudgetSettlementsRequest(authToken, tripId)
      if (res.success && Array.isArray(res.settlements)) {
        setSettlements(res.settlements)
      } else {
        setSettlementsError(res.detail || 'Failed to load settlements')
      }
    } catch (err) {
      setSettlementsError(err.message || 'Error connecting to settlement server')
    } finally {
      setSettlementsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'settlements' && tripId && authToken) {
      fetchSettlements()
    }
  }, [tripId, authToken, activeTab])

  // Open modal for Creating a new settlement
  const handleOpenSettleModal = () => {
    setSettleFormError(null)
    setSettleAmount('')
    setSettleNote('')
    setSettleCurrency('PKR')
    setSettleDate(new Date().toISOString().split('T')[0])

    const firstId = String(availableMembers[0]?.id || '')
    const secondId = String(availableMembers[1]?.id || '')
    setSettlePayerId(firstId)
    setSettleReceiverId(secondId !== firstId ? secondId : '')

    setShowSettleModal(true)
  }

  // Save (Create) Settlement to Backend API
  const handleSaveSettlement = async (e) => {
    e.preventDefault()
    if (!tripId || !authToken) {
      setSettleFormError('Missing active trip or authentication token.')
      return
    }

    const cleanPayer = String(settlePayerId || '').trim()
    const cleanReceiver = String(settleReceiverId || '').trim()

    if (!cleanPayer) {
      setSettleFormError('Please select a payer.')
      return
    }
    if (!cleanReceiver) {
      setSettleFormError('Please select a receiver.')
      return
    }
    if (cleanPayer === cleanReceiver) {
      setSettleFormError('Payer and Receiver cannot be the same person.')
      return
    }

    const numAmt = parseFloat(settleAmount) || 0
    if (numAmt <= 0) {
      setSettleFormError('Settlement amount must be greater than zero.')
      return
    }

    const payerObj = availableMembers.find((m) => String(m.id) === cleanPayer)
    const receiverObj = availableMembers.find((m) => String(m.id) === cleanReceiver)

    const payload = {
      payerId: cleanPayer,
      payerName: payerObj?.name || '',
      receiverId: cleanReceiver,
      receiverName: receiverObj?.name || '',
      amount: numAmt,
      currency: settleCurrency || 'PKR',
      date: settleDate,
      note: settleNote.trim(),
    }

    setSettleSubmitting(true)
    setSettleFormError(null)
    try {
      const res = await createSharedBudgetSettlementRequest(authToken, tripId, payload)
      if (res.success) {
        setSaveToast('Settlement recorded successfully!')
        setShowSettleModal(false)
        fetchSettlements()
      } else {
        setSettleFormError(res.detail || 'Failed to record settlement')
      }
    } catch (err) {
      setSettleFormError(err.message || 'Error recording settlement')
    } finally {
      setSettleSubmitting(false)
      setTimeout(() => setSaveToast(false), 2500)
    }
  }

  // Delete Settlement Handler
  const handleDeleteSettlement = async (settlementId) => {
    if (!tripId || !authToken) return
    if (!window.confirm('Are you sure you want to delete this settlement record?')) return
    setError(null)
    try {
      const res = await deleteSharedBudgetSettlementRequest(authToken, tripId, settlementId)
      if (res.success) {
        setSaveToast('Settlement deleted successfully')
        fetchSettlements()
      } else {
        setError(res.detail || 'Failed to delete settlement')
      }
    } catch (err) {
      setError(err.message || 'Error deleting settlement')
    } finally {
      setTimeout(() => setSaveToast(false), 2500)
    }
  }


  // Derived Balance Aggregation across paid expenses for real available members
  const memberBalances = useMemo(() => {
    const balanceMap = {}

    availableMembers.forEach((m) => {
      balanceMap[m.id] = {
        member: m,
        totalPaid: 0,
        totalShare: 0,
        netBalance: 0,
      }
    })

    expenses.forEach((exp) => {
      // Only paid expenses contribute to balances (pending expenses do not)
      if (exp.status !== 'paid') return

      // 1. Aggregate Paid Amounts per user
      if (Array.isArray(exp.payers)) {
        exp.payers.forEach((p) => {
          const pId = String(p.userId || p.id || '')
          if (balanceMap[pId]) {
            balanceMap[pId].totalPaid += parseFloat(p.amount) || 0
          } else {
            const match = availableMembers.find((m) => String(m.id) === pId || m.name === p.name)
            if (match && balanceMap[match.id]) {
              balanceMap[match.id].totalPaid += parseFloat(p.amount) || 0
            }
          }
        })
      }

      // 2. Aggregate Participant Shares per user
      if (Array.isArray(exp.participants)) {
        exp.participants.forEach((part) => {
          const partId = String(part.userId || part.id || '')
          if (balanceMap[partId]) {
            balanceMap[partId].totalShare += parseFloat(part.share) || 0
          } else {
            const match = availableMembers.find((m) => String(m.id) === partId || m.name === part.name)
            if (match && balanceMap[match.id]) {
              balanceMap[match.id].totalShare += parseFloat(part.share) || 0
            }
          }
        })
      }
    })

    return availableMembers.map((m) => {
      const b = balanceMap[m.id] || { totalPaid: 0, totalShare: 0 }
      const paid = Math.round(b.totalPaid * 100) / 100
      const share = Math.round(b.totalShare * 100) / 100
      const net = Math.round((paid - share) * 100) / 100
      return {
        ...m,
        totalPaid: paid,
        totalShare: share,
        netBalance: net,
      }
    })
  }, [expenses, availableMembers])

  // Logged-in user's balance data for top summary cards
  const currentUserId = String(user?.id || user?._id || ownerData?.userId || availableMembers[0]?.id || '')
  const currentUserBalanceData = useMemo(() => {
    const found = memberBalances.find((mb) => String(mb.id) === currentUserId)
    return found || { totalPaid: 0, totalShare: 0, netBalance: 0 }
  }, [memberBalances, currentUserId])

  // Audit existing stored expenses for unproportional 1x/1x multiplication discrepancies
  const inconsistentExpenses = useMemo(() => {
    const list = []
    expenses.forEach((exp) => {
      const total = parseFloat(exp.amount) || 0
      if (Array.isArray(exp.participants) && exp.participants.length > 0 && total > 0) {
        const sumShare = exp.participants.reduce((s, p) => s + (parseFloat(p.share) || 0), 0)
        if (Math.abs(sumShare - total) > 0.05) {
          list.push({
            id: exp.id,
            name: exp.name || 'Untitled Expense',
            amount: total,
            sumShare: Math.round(sumShare * 100) / 100,
            discrepancy: Math.round((sumShare - total) * 100) / 100,
          })
        }
      }
    })
    return list
  }, [expenses])

  // Summary Metrics calculations from real backend expenses
  const { totalCost, paidTotal, pendingTotal, categoryTotals } = useMemo(() => {
    let total = 0
    let paid = 0
    let pending = 0
    const catMap = { Sleep: 0, Transport: 0, 'See & Do': 0, 'Eat & Drink': 0, Other: 0 }

    expenses.forEach((e) => {
      const amt = parseFloat(e.amount) || 0
      total += amt
      if (e.status === 'paid') paid += amt
      else pending += amt

      const cat = e.category || 'Other'
      if (catMap[cat] !== undefined) catMap[cat] += amt
      else catMap.Other += amt
    })

    return {
      totalCost: total,
      paidTotal: paid,
      pendingTotal: pending,
      categoryTotals: catMap,
    }
  }, [expenses])

  // Toggle Payer multi-selection handler (keyed strictly by canonical userId)
  const togglePayer = (userId) => {
    const strId = String(userId || '')
    if (!strId) return
    setSelectedPayers((prev) => {
      const prevStrs = prev.map(String)
      return prevStrs.includes(strId)
        ? prevStrs.filter((id) => id !== strId)
        : [...prevStrs, strId]
    })
  }

  const handleCopyLink = () => {
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2500)
  }

  // Open modal for Creating a new expense
  const handleOpenAddModal = () => {
    setEditingExpenseId(null)
    setExpenseName('')
    setAmount('')
    setCurrency('PKR')
    setCategory('Sleep')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setDestination(availableDestinations[0]?.name || '')
    setIsPaid(true)
    const defaultOwnerId = String(availableMembers[0]?.id || '')
    setSelectedPayers(defaultOwnerId ? [defaultOwnerId] : [])

    // Default all available members to 1x weight
    const initialMults = {}
    availableMembers.forEach((m) => {
      initialMults[m.id] = 1
    })
    setMultipliers(initialMults)

    setActiveExpenseSubView(null)
    setShowAddExpenseModal(true)
  }

  // Open modal for Editing an existing expense
  const handleOpenEditModal = (exp) => {
    setEditingExpenseId(exp.id)
    setExpenseName(exp.name || '')
    setAmount(exp.amount !== undefined ? String(exp.amount) : '')
    setCurrency(exp.currency || 'PKR')
    setCategory(exp.category || 'Sleep')
    setExpenseDate(exp.date || new Date().toISOString().split('T')[0])
    setDestination(exp.destinationReference || availableDestinations[0]?.name || '')
    setIsPaid(exp.status === 'paid')
    if (Array.isArray(exp.payers) && exp.payers.length > 0) {
      const restoredIds = exp.payers
        .map((p) => {
          const pId = String(p.userId || p.id || '')
          if (pId) return pId
          const match = availableMembers.find((m) => m.name === p.name)
          return match ? String(match.id) : ''
        })
        .filter(Boolean)
      const defaultOwnerId = String(availableMembers[0]?.id || '')
      setSelectedPayers(restoredIds.length > 0 ? restoredIds : (defaultOwnerId ? [defaultOwnerId] : []))
    } else {
      const defaultOwnerId = String(availableMembers[0]?.id || '')
      setSelectedPayers(defaultOwnerId ? [defaultOwnerId] : [])
    }

    // Restore multipliers based on stored participants if present
    const initialMults = {}
    availableMembers.forEach((m) => {
      initialMults[m.id] = 1
    })
    if (Array.isArray(exp.participants) && exp.participants.length > 0) {
      exp.participants.forEach((part) => {
        const pId = String(part.userId || part.id || '')
        const match =
          (pId && availableMembers.find((m) => String(m.id) === pId)) ||
          (!pId ? availableMembers.find((m) => m.name === part.name) : undefined)
        if (match) {
          const partShare = parseFloat(part.share) || 0
          if (partShare === 0) {
            initialMults[match.id] = 0
          } else {
            initialMults[match.id] = 1
          }
        }
      })
    }
    setMultipliers(initialMults)

    setActiveExpenseSubView(null)
    setShowAddExpenseModal(true)
  }

  // Save (Create or Update) Expense to Backend API with Proportional Participant Splits & Tie-Breaker Rounding
  const handleSaveExpense = async (e) => {
    e.preventDefault()
    if (!tripId || !authToken) {
      setError('Missing active trip or authentication token.')
      return
    }

    const numAmount = parseFloat(amount) || 0
    const payerCount = selectedPayers.length || 1
    const perPayerAmount = isPaid ? numAmount / payerCount : 0

    // PROPORTIONAL PARTICIPANT SHARE CALCULATION WITH DETERMINISTIC REMAINDER ADJUSTMENT
    const memberWeights = availableMembers.map((m) => {
      const w = multipliers[m.id] !== undefined ? multipliers[m.id] : 1
      return { member: m, weight: w }
    })

    const totalWeight = memberWeights.reduce((sum, item) => sum + item.weight, 0)
    let calculatedParticipants = []

    if (totalWeight <= 0 || numAmount <= 0) {
      calculatedParticipants = memberWeights.map(({ member }) => ({
        userId: member.id,
        name: member.name,
        share: 0,
      }))
    } else {
      // Compute unrounded raw shares & rounded shares
      const initialShares = memberWeights.map(({ member, weight }) => {
        const raw = (numAmount * weight) / totalWeight
        const rounded = Math.floor(raw * 100) / 100
        return {
          member,
          weight,
          raw,
          rounded,
        }
      })

      const sumRounded = initialShares.reduce((s, item) => s + item.rounded, 0)
      let diffCents = Math.round((numAmount - sumRounded) * 100)

      // Deterministic tie-breaker: find participant with highest selected weight (first in array order on ties)
      let highestIndex = 0
      let maxW = -1
      initialShares.forEach((item, idx) => {
        if (item.weight > maxW) {
          maxW = item.weight
          highestIndex = idx
        }
      })

      // Allocate remainder cents to highest weighted participant
      calculatedParticipants = initialShares.map((item, idx) => {
        let finalShare = item.rounded
        if (idx === highestIndex && diffCents !== 0) {
          finalShare = Math.round((finalShare + diffCents / 100) * 100) / 100
        }
        return {
          userId: item.member.id,
          name: item.member.name,
          share: finalShare,
        }
      })
    }

    const payload = {
      name: expenseName.trim() || 'Untitled Expense',
      amount: numAmount,
      currency: currency || 'PKR',
      category: category || 'Sleep',
      date: expenseDate,
      destinationReference: destination || '',
      status: isPaid ? 'paid' : 'pending',
      payers: selectedPayers.map((pId) => {
        const strId = String(pId)
        const match = availableMembers.find((m) => String(m.id) === strId)
        return {
          userId: match?.id || strId,
          name: match?.name || 'Unknown',
          amount: perPayerAmount,
        }
      }),
      participants: calculatedParticipants,
    }

    setError(null)
    try {
      if (editingExpenseId) {
        const res = await updateSharedBudgetExpenseRequest(authToken, tripId, editingExpenseId, payload)
        if (res.success) {
          setSaveToast('Expense updated successfully!')
          setShowAddExpenseModal(false)
          setActiveExpenseSubView(null)
          setEditingExpenseId(null)
          fetchExpenses()
        } else {
          setError(res.detail || 'Failed to update expense')
        }
      } else {
        const res = await createSharedBudgetExpenseRequest(authToken, tripId, payload)
        if (res.success) {
          setSaveToast('Expense added successfully!')
          setShowAddExpenseModal(false)
          setActiveExpenseSubView(null)
          fetchExpenses()
        } else {
          setError(res.detail || 'Failed to create expense')
        }
      }
    } catch (err) {
      setError(err.message || 'Error saving expense')
    } finally {
      setTimeout(() => setSaveToast(false), 2500)
    }
  }

  // Delete Expense Handler
  const handleDeleteExpense = async (expenseId) => {
    if (!tripId || !authToken) return
    if (!window.confirm('Are you sure you want to delete this shared expense?')) return
    setError(null)
    try {
      const res = await deleteSharedBudgetExpenseRequest(authToken, tripId, expenseId)
      if (res.success) {
        setSaveToast('Expense deleted successfully')
        fetchExpenses()
      } else {
        setError(res.detail || 'Failed to delete expense')
      }
    } catch (err) {
      setError(err.message || 'Error deleting expense')
    } finally {
      setTimeout(() => setSaveToast(false), 2500)
    }
  }

  const handleCloseAddExpenseModal = () => {
    setShowAddExpenseModal(false)
    setActiveExpenseSubView(null)
    setEditingExpenseId(null)
  }

  return (
    <div
      ref={sectionRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* Toast Notification Banner */}
      {saveToast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✨</span>
          <span>{typeof saveToast === 'string' ? saveToast : 'Shared Budget updated!'}</span>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 18px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ border: 'none', background: 'transparent', color: '#991b1b', fontSize: '16px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Shared Budget Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
              🤝 Shared Budget
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.08)',
                color: '#4f46e5',
                border: '1px solid rgba(99, 102, 241, 0.15)',
              }}
            >
              Workspace View
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
            Track group trip expenses, split costs with travel companions, and manage shared settlements.
          </p>
        </div>

        <button
          type="button"
          className="PlannerPillButton PlannerPillButton--accent"
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
            cursor: 'pointer',
          }}
          onClick={handleOpenAddModal}
        >
          + Add Expense
        </button>
      </div>

      {/* Main Two-Column Workspace Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Internal Tab Navigation & Tab Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sub-Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '5px',
            }}
          >
            <button
              type="button"
              className={`PlannerPillButton ${activeTab === 'expenses' ? 'PlannerPillButton--accent' : 'PlannerPillButton--light'}`}
              style={{
                flex: 1,
                minHeight: '38px',
                fontSize: '13px',
                fontWeight: '700',
                borderRadius: '8px',
                border: activeTab === 'expenses' ? 'none' : '1px solid transparent',
              }}
              onClick={() => setActiveTab('expenses')}
            >
              💳 Expenses ({expenses.length})
            </button>
            <button
              type="button"
              className={`PlannerPillButton ${activeTab === 'balance' ? 'PlannerPillButton--accent' : 'PlannerPillButton--light'}`}
              style={{
                flex: 1,
                minHeight: '38px',
                fontSize: '13px',
                fontWeight: '700',
                borderRadius: '8px',
                border: activeTab === 'balance' ? 'none' : '1px solid transparent',
              }}
              onClick={() => setActiveTab('balance')}
            >
              ⚖️ Balance
            </button>
            <button
              type="button"
              className={`PlannerPillButton ${activeTab === 'settlements' ? 'PlannerPillButton--accent' : 'PlannerPillButton--light'}`}
              style={{
                flex: 1,
                minHeight: '38px',
                fontSize: '13px',
                fontWeight: '700',
                borderRadius: '8px',
                border: activeTab === 'settlements' ? 'none' : '1px solid transparent',
              }}
              onClick={() => setActiveTab('settlements')}
            >
              🤝 Settlements
            </button>
          </div>

          {/* Dedicated Tab Content Container */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: expenses.length > 0 && activeTab === 'expenses' ? '20px' : '36px 32px',
              minHeight: '430px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
            }}
          >
            {/* 1. EXPENSES TAB */}
            {activeTab === 'expenses' && (
              loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
                  ⏳ Loading shared budget expenses...
                </div>
              ) : expenses.length > 0 ? (
                /* REAL BACKEND EXPENSES LIST */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                      Shared Expenses ({expenses.length})
                    </div>
                    <button
                      type="button"
                      className="PlannerPillButton PlannerPillButton--accent"
                      style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                      onClick={handleOpenAddModal}
                    >
                      + Add Expense
                    </button>
                  </div>

                  {expenses.map((exp) => {
                    const categoryIconMap = {
                      Sleep: '🛏️',
                      Transport: '🚗',
                      'See & Do': '🎟️',
                      'Eat & Drink': '🍽️',
                      Other: '📦',
                    }
                    const icon = categoryIconMap[exp.category] || '📦'
                    const payerNames = Array.isArray(exp.payers) && exp.payers.length > 0
                      ? exp.payers.map((p) => {
                          const pId = String(p.userId || p.id || '')
                          const match =
                            (pId && availableMembers.find((m) => String(m.id) === pId)) ||
                            (!pId ? availableMembers.find((m) => m.name === p.name) : undefined)
                          if (match) {
                            const sameNameCount = availableMembers.filter((m) => m.name === match.name).length
                            return sameNameCount > 1 ? `${match.name} (${match.role})` : match.name
                          }
                          return p.name
                        }).join(', ')
                      : 'You (Owner)'

                    return (
                      <div
                        key={exp.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          background: '#f8fafc',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          gap: '16px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '20px',
                              flexShrink: 0,
                            }}
                          >
                            {icon}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {exp.name || 'Untitled Expense'}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                              <span>🗓️ {exp.date}</span>
                              {exp.destinationReference && (
                                <span style={{ padding: '2px 8px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#334155' }}>
                                  📍 {exp.destinationReference}
                                </span>
                              )}
                              <span>Paid by: <strong style={{ color: '#0f172a' }}>{payerNames}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '800',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: exp.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                              color: exp.status === 'paid' ? '#10b981' : '#d97706',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {exp.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>

                          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', minWidth: '90px', textAlign: 'right' }}>
                            {exp.currency || 'PKR'} {parseFloat(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              style={{
                                border: 'none',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '13px',
                              }}
                              onClick={() => handleOpenEditModal(exp)}
                              title="Edit expense"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              style={{
                                border: 'none',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#ef4444',
                              }}
                              onClick={() => handleDeleteExpense(exp.id)}
                              title="Delete expense"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* EMPTY STATE */
                <div style={{ textAlign: 'center', maxWidth: '460px', margin: 'auto' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '72px',
                      height: '72px',
                      margin: '0 auto 20px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(79, 70, 229, 0.04) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      border: '1px solid rgba(99, 102, 241, 0.18)',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)',
                    }}
                  >
                    💳
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' }}>
                    No Shared Expenses Yet
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                    Add custom expenses or record stop costs. Expenses will automatically calculate member shares, individual balances, and category summaries.
                  </p>

                  <button
                    type="button"
                    className="PlannerPillButton PlannerPillButton--accent"
                    style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '700', marginBottom: '24px', cursor: 'pointer' }}
                    onClick={handleOpenAddModal}
                  >
                    + Add First Expense
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '14px 20px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #f1f5f9',
                      fontSize: '12px',
                      color: '#475569',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Shared Budget Capabilities
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#334155' }}>
                      <span style={{ color: '#4f46e5' }}>✨</span> Equal & Custom Cost Splitting
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#334155' }}>
                      <span style={{ color: '#4f46e5' }}>✨</span> Payer Assignment & Member Trackers
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#334155' }}>
                      <span style={{ color: '#4f46e5' }}>✨</span> Real-time Category Expense Summaries
                    </div>
                  </div>
                </div>
              )
            )}

            {/* 2. BALANCE TAB (REAL CALCULATED METRICS) */}
            {activeTab === 'balance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      YOUR TOTAL PAID
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                      PKR {currentUserBalanceData.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '18px 20px', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      YOUR NET BALANCE
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: '800',
                        color: currentUserBalanceData.netBalance > 0 ? '#10b981' : currentUserBalanceData.netBalance < 0 ? '#ef4444' : '#0f172a',
                        marginTop: '4px',
                      }}
                    >
                      {currentUserBalanceData.netBalance > 0 ? '+' : ''}PKR {currentUserBalanceData.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '14px',
                      borderRadius: '12px',
                      border: '1px border-dashed #cbd5e1',
                      background: '#ffffff',
                      color: '#4f46e5',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                    onClick={() => setShowInviteModal(true)}
                  >
                    <span>👤+</span> Invite a friend
                  </button>

                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '14px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                    onClick={handleOpenSettleModal}
                  >
                    <span>✔</span> Settle expenses
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Group Member Balances
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {memberBalances.map((m) => {
                      const isPositive = m.netBalance > 0
                      const isNegative = m.netBalance < 0
                      const statusText = isPositive ? 'Gets back' : isNegative ? 'Owes' : 'Settled'
                      const badgeBg = isPositive ? 'rgba(16, 185, 129, 0.1)' : isNegative ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)'
                      const badgeColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#64748b'

                      return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {m.profileImage ? (
                              <img
                                src={m.profileImage}
                                alt={m.name}
                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: m.color, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
                                {m.avatar}
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {m.role} · Paid: <strong style={{ color: '#334155' }}>PKR {m.totalPaid.toFixed(2)}</strong> · Share: <strong style={{ color: '#334155' }}>PKR {m.totalShare.toFixed(2)}</strong>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: isPositive ? '#10b981' : isNegative ? '#ef4444' : '#0f172a' }}>
                              {isPositive ? '+' : ''}PKR {m.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', background: badgeBg, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {statusText}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. SETTLEMENTS TAB (CONNECTED TO BACKEND API) */}
            {activeTab === 'settlements' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                      Settlement History & Activity
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Record of past repayments and group balance settlements.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="PlannerPillButton PlannerPillButton--accent"
                    style={{ fontSize: '12px', padding: '8px 16px', fontWeight: '700', cursor: 'pointer' }}
                    onClick={handleOpenSettleModal}
                  >
                    + New Settlement
                  </button>
                </div>

                {settlementsError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                    ⚠️ {settlementsError}
                  </div>
                )}

                {settlementsLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13px', fontWeight: '600' }}>
                    ⏳ Loading settlements...
                  </div>
                ) : settlements.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    {settlements.map((s) => {
                      const sId = s.settlementId || s.id || s._id
                      const payerObj = availableMembers.find((m) => String(m.id) === String(s.payerId))
                      const receiverObj = availableMembers.find((m) => String(m.id) === String(s.receiverId))

                      const payerName = payerObj?.name || s.payerName || s.payerId
                      const receiverName = receiverObj?.name || s.receiverName || s.receiverId

                      return (
                        <div
                          key={sId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            background: '#f8fafc',
                            borderRadius: '14px',
                            border: '1px solid #e2e8f0',
                            gap: '16px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                color: '#10b981',
                                flexShrink: 0,
                              }}
                            >
                              🤝
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                                <span style={{ color: '#4f46e5' }}>{payerName}</span> paid <span style={{ color: '#10b981' }}>{receiverName}</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#64748b' }}>
                                <span>🗓️ {s.date}</span>
                                {s.note && (
                                  <span style={{ fontStyle: 'italic', color: '#475569' }}>
                                    "{s.note}"
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', textAlign: 'right' }}>
                              {s.currency || 'PKR'} {parseFloat(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>

                            <button
                              type="button"
                              style={{
                                border: 'none',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#ef4444',
                              }}
                              onClick={() => handleDeleteSettlement(sId)}
                              title="Delete settlement"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤝</div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      No Settlements Recorded
                    </h4>
                    <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b', maxWidth: '380px', marginInline: 'auto' }}>
                      Record repayments between travel companions when cash or online settlements take place.
                    </p>
                    <button
                      type="button"
                      className="PlannerPillButton PlannerPillButton--accent"
                      style={{ fontSize: '12px', padding: '8px 16px', fontWeight: '700', cursor: 'pointer' }}
                      onClick={handleOpenSettleModal}
                    >
                      + Record First Settlement
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Budget Summary & Statistics Panel */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Budget Summary
            </h3>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              PKR
            </span>
          </div>

          {/* Circular Total Visualization */}
          <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
            <div
              style={{
                width: '124px',
                height: '124px',
                borderRadius: '50%',
                border: '8px solid #f1f5f9',
                borderTopColor: '#4f46e5',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <span style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'lowercase' }}>total</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', fontSize: '12px', color: '#64748b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} />
                <span>Pending: <strong style={{ color: '#0f172a' }}>PKR {pendingTotal.toLocaleString()}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span>Paid: <strong style={{ color: '#0f172a' }}>PKR {paidTotal.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: 0 }} />

          {/* Category Breakdown List */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              By Category
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: '🛏️', label: 'Sleep / Accommodation', amount: `PKR ${categoryTotals.Sleep.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                { icon: '🚗', label: 'Transport', amount: `PKR ${categoryTotals.Transport.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                { icon: '🎟️', label: 'See & Do', amount: `PKR ${categoryTotals['See & Do'].toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                { icon: '🍽️', label: 'Eat & Drink', amount: `PKR ${categoryTotals['Eat & Drink'].toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                { icon: '📦', label: 'Other', amount: `PKR ${categoryTotals.Other.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: '500' }}>
                    <span style={{ fontSize: '14px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{item.amount}</span>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: 0 }} />

          <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.45', fontStyle: 'italic', textAlign: 'center' }}>
            💡 Summary metrics and category breakdowns update automatically from real backend expenses.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT EXPENSE MODAL & SUB-VIEWS                            */}
      {/* ========================================================================= */}
      {showAddExpenseModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9990,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={handleCloseAddExpenseModal}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '540px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              minHeight: '440px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* SUB-VIEW 1: WHO PAID FOR THIS EXPENSE? */}
            {activeExpenseSubView === 'payer' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: '#f1f5f9',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        color: '#0f172a',
                        cursor: 'pointer',
                      }}
                      onClick={() => setActiveExpenseSubView(null)}
                      title="Back to main expense form"
                    >
                      ←
                    </button>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                      Who paid for this expense?
                    </h3>
                  </div>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'transparent', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
                    onClick={handleCloseAddExpenseModal}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  {availableMembers.map((member) => {
                    const isSelected = selectedPayers.map(String).includes(String(member.id))
                    return (
                      <div
                        key={member.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          background: isSelected ? 'rgba(16, 185, 129, 0.04)' : '#ffffff',
                          borderRadius: '12px',
                          border: isSelected ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => togglePayer(member.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {member.profileImage ? (
                            <img
                              src={member.profileImage}
                              alt={member.name}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: member.color,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: '700',
                              }}
                            >
                              {member.avatar}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{member.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{member.role}</div>
                          </div>
                        </div>

                        {/* Multi-select Checkmark indicator */}
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isSelected ? '#10b981' : '#ffffff',
                            border: isSelected ? 'none' : '2px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: '800',
                            boxSizing: 'border-box',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected && '✓'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : activeExpenseSubView === 'destination' ? (
              /* SUB-VIEW 2: SELECT DESTINATION */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: '#f1f5f9',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        color: '#0f172a',
                        cursor: 'pointer',
                      }}
                      onClick={() => setActiveExpenseSubView(null)}
                      title="Back to main expense form"
                    >
                      ←
                    </button>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                      Select destination
                    </h3>
                  </div>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'transparent', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
                    onClick={handleCloseAddExpenseModal}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  {availableDestinations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b', fontSize: '13px', fontStyle: 'italic', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      📍 No itinerary places available
                    </div>
                  ) : (
                    availableDestinations.map((dest) => {
                      const isSelected = destination === dest.name
                      return (
                        <div
                          key={dest.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            background: isSelected ? 'rgba(79, 70, 229, 0.04)' : '#ffffff',
                            borderRadius: '12px',
                            border: isSelected ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => {
                            setDestination(dest.name)
                            setActiveExpenseSubView(null)
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                            <span>📍</span>
                            <span>{dest.name}</span>
                          </div>

                          {/* Radio selection indicator */}
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              border: isSelected ? '6px solid #4f46e5' : '2px solid #cbd5e1',
                              background: '#ffffff',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              /* MAIN ADD / EDIT EXPENSE FORM VIEW */
              <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    {editingExpenseId ? 'Edit shared expense' : 'Add new expense'}
                  </h3>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'transparent', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
                    onClick={handleCloseAddExpenseModal}
                  >
                    ✕
                  </button>
                </div>

                {/* Top Control Bar: Category | Date | Destination (Interactive Button) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#334155',
                      background: '#f8fafc',
                    }}
                  >
                    <option value="Sleep">🛏️ Sleep</option>
                    <option value="Transport">🚗 Transport</option>
                    <option value="See & Do">🎟️ See & Do</option>
                    <option value="Eat & Drink">🍽️ Eat & Drink</option>
                    <option value="Other">📦 Other</option>
                  </select>

                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#334155',
                      background: '#f8fafc',
                    }}
                  />

                  {/* Destination selection interactive button */}
                  <button
                    type="button"
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#334155',
                      background: '#f8fafc',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    onClick={() => setActiveExpenseSubView('destination')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {destination || 'Select'}</span>
                    <span style={{ color: '#94a3b8', marginLeft: '4px' }}>›</span>
                  </button>
                </div>

                {/* Currency & Amount Input Row */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '16px 20px', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: '800',
                      color: '#0f172a',
                      background: '#ffffff',
                    }}
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                {/* Expense Title Field */}
                <div>
                  <input
                    type="text"
                    value={expenseName}
                    onChange={(e) => setExpenseName(e.target.value)}
                    placeholder="Enter expense name (e.g. Hotel deposit, Taxi fare)..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                {/* Paid / Unpaid Status Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                    <span>Status</span>
                    <span style={{ fontSize: '11px', color: isPaid ? '#10b981' : '#f59e0b', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', background: isPaid ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }}>
                      {isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>

                  <button
                    type="button"
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: 'none',
                      background: isPaid ? '#10b981' : '#cbd5e1',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                    onClick={() => setIsPaid(!isPaid)}
                  >
                    Toggle {isPaid ? 'Unpaid' : 'Paid'}
                  </button>
                </div>

                {/* Payer Selection Interactive Button Row */}
                {isPaid && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                    onClick={() => setActiveExpenseSubView('payer')}
                  >
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Paid by</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>
                        {(() => {
                          const selectedObjs = selectedPayers
                            .map((id) => availableMembers.find((m) => String(m.id) === String(id)))
                            .filter(Boolean)
                          if (selectedObjs.length === 0) return 'Select payers'
                          if (selectedObjs.length === 1) {
                            const p = selectedObjs[0]
                            const sameName = availableMembers.filter((m) => m.name === p.name).length > 1
                            return sameName ? `${p.name} (${p.role})` : p.name
                          }
                          if (selectedObjs.length <= 2) {
                            return selectedObjs.map((p) => {
                              const sameName = availableMembers.filter((m) => m.name === p.name).length > 1
                              return sameName ? `${p.name} (${p.role})` : p.name
                            }).join(', ')
                          }
                          return `${selectedObjs.length} people selected`
                        })()}
                      </span>
                      <span style={{ color: '#94a3b8' }}>›</span>
                    </span>
                  </div>
                )}

                {/* Split & Participant Multipliers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase' }}>
                      Split: Everyone 1x
                    </span>
                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', color: '#64748b', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => {
                        const resetMults = {}
                        availableMembers.forEach((m) => {
                          resetMults[m.id] = 1
                        })
                        setMultipliers(resetMults)
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  {availableMembers.map((m) => {
                    const currentMult = multipliers[m.id] !== undefined ? multipliers[m.id] : 1
                    const numAmt = parseFloat(amount) || 0

                    // Live proportional share calculation preview
                    const totalW = availableMembers.reduce((sum, mem) => {
                      const w = multipliers[mem.id] !== undefined ? multipliers[mem.id] : 1
                      return sum + w
                    }, 0)

                    let liveShare = 0
                    if (totalW > 0 && numAmt > 0 && currentMult > 0) {
                      liveShare = Math.round(((numAmt * currentMult) / totalW) * 100) / 100
                    }

                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {m.profileImage ? (
                            <img src={m.profileImage} alt={m.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: m.color, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>
                              {m.avatar}
                            </div>
                          )}
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>
                            {m.name} <span style={{ fontSize: '11px', color: '#64748b' }}>({m.role})</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[0, 1, 2].map((val) => (
                              <button
                                key={val}
                                type="button"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: currentMult === val ? '#4f46e5' : '#ffffff',
                                  color: currentMult === val ? '#ffffff' : '#334155',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setMultipliers((prev) => ({ ...prev, [m.id]: val }))}
                              >
                                {val}x
                              </button>
                            ))}
                          </div>
                          <span style={{ fontWeight: '700', color: '#0f172a', minWidth: '75px', textAlign: 'right' }}>
                            {currency} {liveShare.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  className="PlannerPillButton PlannerPillButton--accent"
                  style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', marginTop: '4px' }}
                >
                  {editingExpenseId ? 'Save changes' : 'Save expense'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INVITE FRIENDS MODAL                                             */}
      {/* ========================================================================= */}
      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9990,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Invite friends
              </h3>
              <button
                type="button"
                style={{ border: 'none', background: 'transparent', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setShowInviteModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
              Invite your friends to join this trip. Plan together and split expenses amongst your group!
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '12px 14px',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#4f46e5',
                fontWeight: '600',
                wordBreak: 'break-all',
              }}
            >
              {window.location.origin}/workspace?trip={tripId}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <button
                type="button"
                className="PlannerPillButton PlannerPillButton--accent"
                style={{ padding: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                onClick={handleCopyLink}
              >
                {copyFeedback ? '✓ Copied!' : 'Copy invite link'}
              </button>
              <button
                type="button"
                className="PlannerPillButton PlannerPillButton--light"
                style={{ padding: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                onClick={() => alert('Use Tripmates tab on the sidebar to send direct user invitations!')}
              >
                ✉️ Tripmate invites
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TRIP MEMBERS ({availableMembers.length})
              </div>

              {availableMembers.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: m.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px' }}>
                      {m.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{m.role}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#4f46e5', padding: '2px 8px', background: 'rgba(79,70,229,0.1)', borderRadius: '12px' }}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SETTLE EXPENSES MODAL                                           */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL 3: SETTLE EXPENSES / RECORD SETTLEMENT MODAL                      */}
      {/* ========================================================================= */}
      {showSettleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9990,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowSettleModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                🤝 Record a Settlement
              </h3>
              <button
                type="button"
                style={{ border: 'none', background: 'transparent', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setShowSettleModal(false)}
              >
                ✕
              </button>
            </div>

            {settleFormError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                ⚠️ {settleFormError}
              </div>
            )}

            <form onSubmit={handleSaveSettlement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Payer Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Who paid the money? (Payer)
                </label>
                <select
                  value={settlePayerId}
                  onChange={(e) => setSettlePayerId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    background: '#f8fafc',
                  }}
                  required
                >
                  <option value="" disabled>Select Payer</option>
                  {availableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Receiver Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Who received the money? (Receiver)
                </label>
                <select
                  value={settleReceiverId}
                  onChange={(e) => setSettleReceiverId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    background: '#f8fafc',
                  }}
                  required
                >
                  <option value="" disabled>Select Receiver</option>
                  {availableMembers.map((m) => (
                    <option key={m.id} value={m.id} disabled={String(m.id) === String(settlePayerId)}>
                      {m.name} ({m.role}) {String(m.id) === String(settlePayerId) ? '(Cannot be payer)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency & Amount */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <select
                  value={settleCurrency}
                  onChange={(e) => setSettleCurrency(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#0f172a',
                    background: '#ffffff',
                  }}
                >
                  <option value="PKR">PKR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: '24px',
                    fontWeight: '800',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              {/* Date & Note Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#334155',
                      background: '#f8fafc',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                    placeholder="e.g. Cash repayment, Raast transfer"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="PlannerPillButton PlannerPillButton--accent"
                style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', marginTop: '6px' }}
                disabled={settleSubmitting}
              >
                {settleSubmitting ? 'Recording settlement...' : 'Record Settlement'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
