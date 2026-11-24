import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { API_BASE } from '../lib/constants'
import { useApp } from '../context/AppContext'
import TravelCardSwitch from './AiTravelCards'

function buildTripContextSummary(trip) {
  if (!trip) return ''

  const lines = []

  const title = trip.title || trip.name || 'Untitled Trip'
  const destination = trip.name || trip.enginePreferences?.province || 'General Destination'
  const startDate = trip.startDate || ''
  const endDate = trip.endDate || ''
  const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : (trip.dates || 'Flexible dates')

  const prefs = trip.enginePreferences || {}
  const q = prefs.questionnaire || {}
  const travelStyle = q.travelStyle || 'General'
  const companions = q.travelCompanions || 'Not specified'
  const budgetLevel = q.budgetLevel || 'Standard'

  lines.push(`Trip: "${title}"`)
  lines.push(`Destination: ${destination}`)
  lines.push(`Dates: ${dateRange}`)
  lines.push(`Travel Style: ${travelStyle} | Companions: ${companions} | Budget: ${budgetLevel}`)

  if (trip.notes && trip.notes.trim()) {
    lines.push(`Trip Notes: ${trip.notes.trim().slice(0, 150)}`)
  }

  lines.push('')
  lines.push('Itinerary Breakdown:')

  if (Array.isArray(trip.days) && trip.days.length > 0) {
    trip.days.forEach((day, idx) => {
      const dayNum = idx + 1
      const dayLabel = day.shortLabel || day.label || `Day ${dayNum}`
      const items = Array.isArray(day.items) ? day.items : []

      if (items.length === 0) {
        lines.push(`Day ${dayNum} (${dayLabel}): [Empty Day / Free Day]`)
      } else {
        lines.push(`Day ${dayNum} (${dayLabel}):`)
        items.forEach((item) => {
          const itemTitle = item.title || item.name || 'Unnamed Activity'
          const cat = item.category ? ` [${item.category}]` : ''
          const time = (item.startTime || item.endTime)
            ? ` (${item.startTime || ''}${item.startTime && item.endTime ? ' - ' : ''}${item.endTime || ''})`
            : ''
          const note = item.note ? ` - Note: ${item.note.slice(0, 60)}` : ''
          lines.push(`  • ${itemTitle}${cat}${time}${note}`)
        })
      }
    })
  } else {
    lines.push('  No days scheduled yet.')
  }

  if (Array.isArray(trip.placesPool) && trip.placesPool.length > 0) {
    lines.push('')
    const poolTitles = trip.placesPool.slice(0, 10).map((p) => p.title || p.name).filter(Boolean)
    lines.push(`Unassigned Places Pool: ${poolTitles.join(', ')}`)
  }

  return lines.join('\n')
}

const LOADING_PHRASES = [
  '✨ Reviewing your itinerary...',
  '✨ Checking nearby attractions...',
  '✨ Planning recommendations...',
  '✨ Analyzing your travel schedule...',
]

function formatTimestamp(dateObj = new Date()) {
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getDynamicQuickActions(activeTrip) {
  const suggestions = []

  const dest = activeTrip?.name || activeTrip?.enginePreferences?.province
  if (dest) {
    suggestions.push(`🍽️ Recommend restaurants in ${dest}`)
    suggestions.push(`🏨 Hotel suggestions for ${dest}`)
    suggestions.push(`📦 Packing checklist for ${dest}`)
  }

  if (Array.isArray(activeTrip?.days)) {
    const emptyDayIdx = activeTrip.days.findIndex(
      (d) => !Array.isArray(d.items) || d.items.length === 0
    )
    if (emptyDayIdx !== -1) {
      suggestions.push(`📅 Suggest activities for Day ${emptyDayIdx + 1}`)
    }
  }

  const fallbacks = [
    '✈️ Plan a weekend trip',
    '💰 Estimate my travel budget',
    '⚡ How can I optimize my itinerary?',
    '📊 Which day of my trip is busiest?',
    '🎒 Solo travel & safety tips',
  ]

  for (const item of fallbacks) {
    if (suggestions.length >= 6) break
    if (!suggestions.includes(item)) {
      suggestions.push(item)
    }
  }

  return suggestions
}

const DEFAULT_FOLLOWUPS = [
  '🍽️ Suggest nearby dining spots',
  '🌦️ Best time & weather tips',
  '💰 Estimated daily expenses?',
  '⚡ How to improve this schedule?',
]

export const MESSAGE_TYPES = {
  TEXT: 'TEXT',
  SYSTEM: 'SYSTEM',
  TRAVEL_CARD: 'TRAVEL_CARD',
  PLACE_CARD: 'PLACE_CARD',
  RESTAURANT_CARD: 'RESTAURANT_CARD',
  HOTEL_CARD: 'HOTEL_CARD',
  BUDGET_CARD: 'BUDGET_CARD',
  CHECKLIST_CARD: 'CHECKLIST_CARD',
  INFO_CARD: 'INFO_CARD',
  LOADING: 'LOADING',
  ERROR: 'ERROR',
  INFO: 'INFO',
}

export function createChatMessage({
  id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  role = 'assistant',
  content = '',
  type = MESSAGE_TYPES.TEXT,
  timestamp = formatTimestamp(),
  metadata = {},
  attachments = [],
}) {
  return {
    id,
    role,
    content,
    type,
    timestamp,
    metadata,
    attachments,
  }
}

function ChatMessageContent({ message, loadingPhrase }) {
  const { type, content, metadata } = message

  if (type === MESSAGE_TYPES.LOADING) {
    return (
      <div className="AiChatMessage__bubble AiChatMessage__bubble--loading">
        <div className="AiLoadingPulse">
          <span className="AiLoadingSparkle">✨</span>
          <span className="AiLoadingText">{loadingPhrase || 'TripNest AI is analyzing your trip...'}</span>
        </div>
        <div className="AiTypingDots">
          <span className="AiTypingDot"></span>
          <span className="AiTypingDot"></span>
          <span className="AiTypingDot"></span>
        </div>
      </div>
    )
  }

  const isCardType = [
    MESSAGE_TYPES.TRAVEL_CARD,
    MESSAGE_TYPES.PLACE_CARD,
    MESSAGE_TYPES.RESTAURANT_CARD,
    MESSAGE_TYPES.HOTEL_CARD,
    MESSAGE_TYPES.BUDGET_CARD,
    MESSAGE_TYPES.CHECKLIST_CARD,
    MESSAGE_TYPES.INFO_CARD,
  ].includes(type) || Boolean(metadata?.card)

  if (isCardType && metadata?.card) {
    return (
      <div className="AiChatMessage__bubble AiChatMessage__bubble--card">
        {content && (
          <ReactMarkdown
            components={{
              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        <TravelCardSwitch type={type} cardData={metadata.card} />
      </div>
    )
  }

  const isError = type === MESSAGE_TYPES.ERROR || metadata?.isError
  const isAssistant = message.role === 'assistant' || message.role === 'system'


  return (
    <div className="AiChatMessage__bubble">
      {isAssistant && !isError ? (
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        content
      )}
    </div>
  )
}

function ChatMessageItem({ message, copiedId, onCopy, loadingPhrase }) {
  const isUser = message.role === 'user'
  const isError = message.type === MESSAGE_TYPES.ERROR || message.metadata?.isError
  const senderClass = isUser ? 'user' : 'ai'

  return (
    <div
      className={`AiChatMessage AiChatMessage--${senderClass}${isError ? ' AiChatMessage--error' : ''}`}
    >
      <ChatMessageContent message={message} loadingPhrase={loadingPhrase} />

      <div className="AiChatMessage__meta">
        {message.timestamp && <span className="AiChatMessage__timestamp">{message.timestamp}</span>}
        {!isUser && !isError && message.type !== MESSAGE_TYPES.LOADING && (
          <button
            type="button"
            className={`AiChatMessage__copyBtn${copiedId === message.id ? ' AiChatMessage__copyBtn--copied' : ''}`}
            onClick={() => onCopy(message.id, message.content)}
            aria-label="Copy message content"
          >
            {copiedId === message.id ? '✓ Copied!' : 'Copy'}
          </button>
        )}
      </div>

    </div>
  )
}

const STORE_KEY = 'tripnest_ai_store_v2'


function createInitialWelcomeMessage() {
  return createChatMessage({
    id: 'welcome-1',
    role: 'assistant',
    type: MESSAGE_TYPES.TEXT,
    content: 'Hello! I am **TripNest AI**, your personal travel planning assistant. I can help you analyze your itinerary, recommend local dining and stays, estimate budgets, and optimize your schedule!',
  })
}

function generateAutoTitle(firstUserMsgText) {
  if (!firstUserMsgText || typeof firstUserMsgText !== 'string') return 'New Conversation'
  
  const text = firstUserMsgText.trim().toLowerCase()

  if (text.includes('day 1')) return 'Day 1 Itinerary'
  if (text.includes('day 2')) return 'Day 2 Itinerary'
  if (text.includes('day 3')) return 'Day 3 Itinerary'
  if (text.includes('day 4')) return 'Day 4 Itinerary'
  if (text.includes('day 5')) return 'Day 5 Itinerary'
  if (text.includes('day 6')) return 'Day 6 Itinerary'

  if (text.includes('pack') || text.includes('checklist')) {
    const words = firstUserMsgText.split(' ')
    const target = words.find((w) => w.length > 3 && !['pack', 'packing', 'list', 'what', 'should'].includes(w.toLowerCase()))
    return target ? `${target} Packing` : 'Packing Checklist'
  }

  if (text.includes('restaurant') || text.includes('dining') || text.includes('food') || text.includes('eat')) {
    return 'Dining & Restaurants'
  }

  if (text.includes('hotel') || text.includes('stay') || text.includes('accommodation')) {
    return 'Hotels & Stays'
  }

  if (text.includes('budget') || text.includes('cost') || text.includes('expense')) {
    return 'Travel Budget'
  }

  const cleaned = firstUserMsgText.replace(/[^\w\s]/gi, '').trim()
  if (cleaned.length > 0) {
    return cleaned.length > 26 ? `${cleaned.slice(0, 24)}...` : cleaned
  }

  return 'New Conversation'
}

export function createConversationObject(title = 'New Conversation', initialMessages = [createInitialWelcomeMessage()]) {
  const id = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const nowStr = formatTimestamp()
  return {
    id,
    title,
    isPinned: false,
    createdAt: nowStr,
    updatedAt: nowStr,
    totalMessages: initialMessages.length,
    messages: initialMessages,
  }
}

/**
 * Storage Interface for Multi-Conversation Store
 */
export function loadAiStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Array.isArray(data.conversations) && data.conversations.length > 0) {
      return data
    }
  } catch (err) {
    console.error('Failed to parse AI store from localStorage, resetting:', err)
    localStorage.removeItem(STORE_KEY)
  }
  return null
}

export function saveAiStore(storeData) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(storeData))
  } catch (err) {
    console.error('Failed to save AI store to localStorage:', err)
  }
}

export default function AiAssistantModal({ isOpen, onClose }) {
  const { activeTrip } = useApp()
  const [store, setStore] = useState(() => {
    const loaded = loadAiStore()
    if (loaded && loaded.conversations.length > 0) {
      return loaded
    }
    const initialConv = createConversationObject('New Conversation')
    const initialStore = {
      conversations: [initialConv],
      activeConversationId: initialConv.id,
    }
    saveAiStore(initialStore)
    return initialStore
  })

  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [editingConvId, setEditingConvId] = useState(null)
  const [editTitleText, setEditTitleText] = useState('')
  const [shareCopiedId, setShareCopiedId] = useState(null)
  const [inputMsg, setInputMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0)
  const [copiedId, setCopiedId] = useState(null)
  const messagesEndRef = useRef(null)

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleDocumentClick = () => setMenuOpenId(null)
    if (menuOpenId) {
      document.addEventListener('click', handleDocumentClick)
    }
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [menuOpenId])

  // Derive current active conversation
  const activeConv = store.conversations.find((c) => c.id === store.activeConversationId) || store.conversations[0]
  const messages = activeConv?.messages || []

  // Helper to update messages inside active conversation and persist store
  const updateActiveMessages = (updaterFn) => {
    setStore((prevStore) => {
      const activeId = prevStore.activeConversationId
      const updatedConvs = prevStore.conversations.map((conv) => {
        if (conv.id === activeId) {
          const newMessages = typeof updaterFn === 'function' ? updaterFn(conv.messages) : updaterFn
          const validMsgs = newMessages.filter((m) => m.type !== MESSAGE_TYPES.LOADING)

          let newTitle = conv.title
          if (conv.title === 'New Conversation') {
            const firstUserMsg = validMsgs.find((m) => m.role === 'user')
            if (firstUserMsg) {
              newTitle = generateAutoTitle(firstUserMsg.content)
            }
          }

          return {
            ...conv,
            title: newTitle,
            updatedAt: formatTimestamp(),
            totalMessages: validMsgs.length,
            messages: validMsgs,
          }
        }
        return conv
      })

      const newStorePayload = {
        ...prevStore,
        conversations: updatedConvs,
      }
      saveAiStore(newStorePayload)
      return newStorePayload
    })
  }

  // Cycle loading phrases every 2.5s
  useEffect(() => {
    let interval
    if (isLoading) {
      setLoadingPhraseIdx(0)
      interval = setInterval(() => {
        setLoadingPhraseIdx((prev) => (prev + 1) % LOADING_PHRASES.length)
      }, 2500)
    }
    return () => clearInterval(interval)
  }, [isLoading])

  // Smooth auto-scroll behavior
  useEffect(() => {
    if (isOpen) {
      const scrollBehavior = messages.length <= 1 ? 'auto' : 'smooth'
      messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior })
    }
  }, [messages, isLoading, isOpen, store.activeConversationId])

  if (!isOpen) return null

  const dynamicPrompts = getDynamicQuickActions(activeTrip)

  const handleSelectPrompt = (promptText) => {
    setInputMsg(promptText)
  }

  const handleNewChat = () => {
    const newConv = createConversationObject('New Conversation')
    setStore((prevStore) => {
      const newStore = {
        conversations: [newConv, ...prevStore.conversations],
        activeConversationId: newConv.id,
      }
      saveAiStore(newStore)
      return newStore
    })
    setInputMsg('')
    setIsHistoryOpen(false)
  }

  const handleSwitchConversation = (convId) => {
    if (editingConvId) return
    setStore((prevStore) => {
      const newStore = {
        ...prevStore,
        activeConversationId: convId,
      }
      saveAiStore(newStore)
      return newStore
    })
    setInputMsg('')
    setIsHistoryOpen(false)
  }

  const handleTogglePin = (convId, e) => {
    e?.stopPropagation()
    setStore((prevStore) => {
      const updatedConvs = prevStore.conversations.map((c) =>
        c.id === convId ? { ...c, isPinned: !c.isPinned } : c
      )
      const newStore = { ...prevStore, conversations: updatedConvs }
      saveAiStore(newStore)
      return newStore
    })
    setMenuOpenId(null)
  }

  const handleStartRename = (conv, e) => {
    e?.stopPropagation()
    setEditingConvId(conv.id)
    setEditTitleText(conv.title)
    setMenuOpenId(null)
  }

  const handleSaveRename = (convId) => {
    const trimmed = editTitleText.trim()
    if (trimmed) {
      setStore((prevStore) => {
        const updatedConvs = prevStore.conversations.map((c) =>
          c.id === convId ? { ...c, title: trimmed } : c
        )
        const newStore = { ...prevStore, conversations: updatedConvs }
        saveAiStore(newStore)
        return newStore
      })
    }
    setEditingConvId(null)
  }

  const handleShareChat = (convId, e) => {
    e?.stopPropagation()
    const conv = store.conversations.find((c) => c.id === convId)
    if (!conv || !Array.isArray(conv.messages)) return

    const lines = [`# TripNest AI Conversation: ${conv.title}`, `*Last Updated: ${conv.updatedAt}*`, '']
    conv.messages.forEach((m) => {
      if (m.type === MESSAGE_TYPES.LOADING) return
      const senderName = m.role === 'user' ? 'User' : 'TripNest AI'
      lines.push(`### ${senderName} (${m.timestamp})`)
      lines.push(m.content)
      lines.push('')
    })

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setShareCopiedId(convId)
      setTimeout(() => setShareCopiedId(null), 2000)
    }).catch((err) => {
      console.error('Failed to copy chat share text:', err)
    })
    setMenuOpenId(null)
  }

  const handleDeleteConversation = (convId, e) => {
    e?.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return

    setStore((prevStore) => {
      const filtered = prevStore.conversations.filter((c) => c.id !== convId)
      let nextActiveId = prevStore.activeConversationId

      if (filtered.length === 0) {
        const fresh = createConversationObject('New Conversation')
        const newStore = {
          conversations: [fresh],
          activeConversationId: fresh.id,
        }
        saveAiStore(newStore)
        return newStore
      }

      if (nextActiveId === convId) {
        nextActiveId = filtered[0].id
      }

      const newStore = {
        conversations: filtered,
        activeConversationId: nextActiveId,
      }
      saveAiStore(newStore)
      return newStore
    })
    setMenuOpenId(null)
  }

  // Pinned conversations stay at top of list
  const sortedConversations = [...store.conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })


  const handleCopy = (msgId, text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msgId)
      setTimeout(() => {
        setCopiedId((current) => (current === msgId ? null : current))
      }, 2000)
    }).catch((err) => {
      console.error('Failed to copy text:', err)
    })
  }

function buildConversationMemoryPrompt(messages, latestUserPrompt) {
  const validHistory = (messages || []).filter((m) => {
    if (!m || m.type === MESSAGE_TYPES.LOADING || m.type === MESSAGE_TYPES.ERROR || m.id === 'welcome-1') {
      return false
    }
    return Boolean(m.content && m.content.trim())
  })

  const recentHistory = validHistory.slice(-8)

  if (recentHistory.length === 0) {
    return latestUserPrompt
  }

  const memoryBlocks = ['[CONVERSATION HISTORY WITHIN THIS ACTIVE CHAT SESSION]']
  recentHistory.forEach((m) => {
    const sender = m.role === 'user' ? 'User' : 'TripNest AI'
    const textSnippet = m.role === 'user' ? m.content.trim() : m.content.trim().slice(0, 400)
    memoryBlocks.push(`${sender}: ${textSnippet}`)
  })

  memoryBlocks.push('')
  memoryBlocks.push(`[LATEST USER QUESTION]: ${latestUserPrompt}`)

  return memoryBlocks.join('\n')
}

  const handleSend = async (e) => {
    e?.preventDefault()
    const trimmed = inputMsg.trim()
    if (!trimmed || isLoading) return

    const userMessage = createChatMessage({
      role: 'user',
      type: MESSAGE_TYPES.TEXT,
      content: trimmed,
    })

    updateActiveMessages((prev) => [...prev, userMessage])
    setInputMsg('')
    setIsLoading(true)

    if (trimmed.toLowerCase().includes('monal demo') || trimmed.toLowerCase().includes('card demo')) {
      setTimeout(() => {
        const mockMonalMsg = createChatMessage({
          role: 'assistant',
          type: MESSAGE_TYPES.RESTAURANT_CARD,
          content: 'Here is the featured dining card for Monal Islamabad:',
          metadata: {
            card: {
              title: 'Monal Islamabad',
              subtitle: 'Margalla Hills, Islamabad',
              description: 'Famous hilltop restaurant offering authentic Pakistani BBQ & continental cuisine with panoramic night views of Islamabad.',
              rating: 4.6,
              reviewCount: 1420,
              category: 'Pakistani BBQ',
              priceLevel: '$$',
              distance: '15 mins away',
              badges: ['Must Visit', 'Scenic View'],
              actions: [
                { label: 'View Details', variant: 'primary' },
                { label: 'Open Maps', variant: 'secondary' }
              ]
            }
          }
        })
        updateActiveMessages((prev) => [...prev, mockMonalMsg])
        setIsLoading(false)
      }, 700)
      return
    }

    const memoryPrompt = buildConversationMemoryPrompt(messages, trimmed)
    const tripContext = buildTripContextSummary(activeTrip)

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: memoryPrompt,
          trip_context: tripContext,
        }),
      })


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const status = response.status
        const detailStr = (errorData.detail || '').toString()

        let userFriendlyMsg = "Something went wrong while contacting TripNest AI."
        if (status === 429 || detailStr.includes('429') || detailStr.toLowerCase().includes('quota')) {
          userFriendlyMsg = "TripNest AI has reached today's free AI usage limit. Please try again later."
        } else if (status >= 500) {
          userFriendlyMsg = "TripNest AI is temporarily unavailable. Please try again in a few minutes."
        }

        const errorMessage = createChatMessage({
          role: 'assistant',
          type: MESSAGE_TYPES.ERROR,
          content: userFriendlyMsg,
          metadata: { isError: true },
        })
        updateActiveMessages((prev) => [...prev, errorMessage])
        return
      }

      const data = await response.json()
      const aiMessage = createChatMessage({
        role: 'assistant',
        type: MESSAGE_TYPES.TEXT,
        content: data.response || 'No response returned from AI assistant.',
      })
      updateActiveMessages((prev) => [...prev, aiMessage])
    } catch (err) {
      console.error('AI Chat Error:', err)
      const errStr = (err?.message || '').toString().toLowerCase()
      let userFriendlyMsg = "Something went wrong while contacting TripNest AI."

      if (errStr.includes('failed to fetch') || errStr.includes('network') || errStr.includes('offline') || err.name === 'TypeError') {
        userFriendlyMsg = "Unable to connect to TripNest AI. Please check your internet connection."
      } else if (errStr.includes('429') || errStr.includes('quota')) {
        userFriendlyMsg = "TripNest AI has reached today's free AI usage limit. Please try again later."
      } else if (errStr.includes('500') || errStr.includes('502') || errStr.includes('503')) {
        userFriendlyMsg = "TripNest AI is temporarily unavailable. Please try again in a few minutes."
      }

      const errorMessage = createChatMessage({
        role: 'assistant',
        type: MESSAGE_TYPES.ERROR,
        content: userFriendlyMsg,
        metadata: { isError: true },
      })
      updateActiveMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const tripDest = activeTrip?.name || activeTrip?.enginePreferences?.province || 'Active Trip'
  const tripDuration = Array.isArray(activeTrip?.days) ? activeTrip.days.length : 0
  const totalActivities = Array.isArray(activeTrip?.days)
    ? activeTrip.days.reduce((acc, d) => acc + (Array.isArray(d.items) ? d.items.length : 0), 0)
    : 0

  return (
    <div className="AiAssistantOverlay" onClick={onClose}>
      <div className="AiAssistantDrawer" onClick={(e) => e.stopPropagation()}>
        <header className="AiAssistantDrawer__header">
          <div className="AiAssistantDrawer__titleGroup">
            <span className="AiAssistantDrawer__badge">AI</span>
            <div className="AiAssistantDrawer__titleText">
              <h3>{activeConv?.title || 'TripNest AI'}</h3>
              <span className="AiAssistantDrawer__subtitle">Smart Travel Planning Assistant</span>
            </div>
          </div>

          <div className="AiAssistantDrawer__actions">
            <button
              type="button"
              className={`AiHeaderActionBtn${isHistoryOpen ? ' AiHeaderActionBtn--active' : ''}`}
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              title="View Conversation History"
            >
              💬 History ({store.conversations.length})
            </button>
            <button
              type="button"
              className="AiHeaderActionBtn"
              onClick={handleNewChat}
              title="Start a new conversation"
            >
              + New Chat
            </button>
            <button
              type="button"
              className="AiAssistantDrawer__closeBtn"
              onClick={onClose}
              aria-label="Close AI Assistant"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Collapsible Multi-Conversation History Panel */}
        {isHistoryOpen && (
          <div className="AiConvSidebar">
            <div className="AiConvSidebar__header">
              <span className="AiConvSidebar__title">Conversation History</span>
              <button
                type="button"
                className="AiConvSidebar__newBtn"
                onClick={handleNewChat}
              >
                + New Chat
              </button>
            </div>
            <div className="AiConvSidebar__list">
              {sortedConversations.map((conv) => {
                const isActive = conv.id === store.activeConversationId
                const isMenuOpen = menuOpenId === conv.id
                const isEditing = editingConvId === conv.id

                return (
                  <div
                    key={conv.id}
                    className={`AiConvItem${isActive ? ' AiConvItem--active' : ''}`}
                    onClick={() => handleSwitchConversation(conv.id)}
                  >
                    <div className="AiConvItem__main">
                      {isEditing ? (
                        <input
                          type="text"
                          className="AiConvItem__editInput"
                          value={editTitleText}
                          onChange={(e) => setEditTitleText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(conv.id)
                            if (e.key === 'Escape') setEditingConvId(null)
                          }}
                          onBlur={() => handleSaveRename(conv.id)}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="AiConvItem__titleRow">
                          {conv.isPinned && <span className="AiConvItem__pinIcon" title="Pinned chat">📌</span>}
                          <span className="AiConvItem__title">{conv.title}</span>
                        </div>
                      )}
                      <span className="AiConvItem__meta">
                        {conv.updatedAt} • {conv.totalMessages} msgs
                      </span>
                    </div>

                    <div className="AiConvItem__actionsRel">
                      <button
                        type="button"
                        className="AiConvItem__dotsBtn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId((prev) => (prev === conv.id ? null : conv.id))
                        }}
                        title="Conversation actions"
                      >
                        ⋮
                      </button>

                      {isMenuOpen && (
                        <div className="AiConvMenu" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="AiConvMenu__item"
                            onClick={(e) => handleStartRename(conv, e)}
                          >
                            <span>✏️</span> Rename Chat
                          </button>
                          <button
                            type="button"
                            className="AiConvMenu__item"
                            onClick={(e) => handleTogglePin(conv.id, e)}
                          >
                            <span>📌</span> {conv.isPinned ? 'Unpin Chat' : 'Pin Chat'}
                          </button>
                          <button
                            type="button"
                            className="AiConvMenu__item"
                            onClick={(e) => handleShareChat(conv.id, e)}
                          >
                            <span>🔗</span> {shareCopiedId === conv.id ? '✓ Copied!' : 'Share'}
                          </button>
                          <button
                            type="button"
                            className="AiConvMenu__item AiConvMenu__item--danger"
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                          >
                            <span>🗑️</span> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        )}

        <div className="AiAssistantDrawer__body">
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              copiedId={copiedId}
              onCopy={handleCopy}
            />
          ))}

          {isLoading && (
            <ChatMessageItem
              message={createChatMessage({
                role: 'assistant',
                type: MESSAGE_TYPES.LOADING,
                content: '',
              })}
              loadingPhrase={LOADING_PHRASES[loadingPhraseIdx]}
            />
          )}

          <div className="AiAssistantDrawer__suggestions">
            <span className="AiAssistantDrawer__suggestionsTitle">
              {messages.length <= 1 ? '✨ Try asking...' : '💡 Suggested Follow-ups'}
            </span>
            <div className="AiAssistantDrawer__chips">
              {(messages.length <= 1 ? dynamicPrompts : DEFAULT_FOLLOWUPS).map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="AiSuggestionChip"
                  onClick={() => handleSelectPrompt(promptText)}
                >
                  {promptText}
                </button>
              ))}
            </div>
          </div>

          <div ref={messagesEndRef} />
        </div>

        {activeTrip && (
          <div className="AiTripContextBar">
            <span className="AiTripContextBar__icon">📍</span>
            <span className="AiTripContextBar__text">
              <strong>{tripDest}</strong> • {tripDuration} Days • {totalActivities} Activities
            </span>
          </div>
        )}

        <form className="AiAssistantDrawer__footer" onSubmit={handleSend}>
          <input
            type="text"
            className="AiAssistantDrawer__input"
            placeholder="Ask TripNest AI..."
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="AiAssistantDrawer__sendBtn"
            disabled={!inputMsg.trim() || isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
