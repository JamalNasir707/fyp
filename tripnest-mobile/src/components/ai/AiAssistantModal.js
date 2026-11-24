import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Clipboard,
  Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import * as Speech from 'expo-speech'
import { useApp } from '../../context/AppContext'
import { colors } from '../../theme/colors'

const QUICK_TOPIC_PROMPTS = [
  { id: 'attractions', label: '🗺️ Top Sights', prompt: 'What are the top must-visit sights and hidden gems here?' },
  { id: 'food', label: '🍲 Famous Food', prompt: 'What are the most famous local dishes and best food spots?' },
  { id: 'packing', label: '🎒 Packing List', prompt: 'What essential things should I pack for this trip?' },
  { id: 'budget', label: '💰 Budget Tips', prompt: 'How much budget do I need and how can I save money?' },
  { id: 'safety', label: '🛡️ Safety & Travel', prompt: 'What safety and transport tips should I keep in mind?' },
]

const QUICK_VOICE_QUESTIONS = [
  'What are the best places to visit in Lahore?',
  'What should I pack for northern areas?',
  'Give me budget tips for travelling in Pakistan.',
  'What local street food should I try?',
  'Is it safe to travel to Hunza with family?',
  'How to plan a 3-day itinerary?',
]

export function AiAssistantModal({
  visible,
  onClose,
  initialContext = '',
  initialPrompt = '',
  initialVoiceMode = true,
}) {
  const { askAiAssistant, activeTrip } = useApp()

  const [activeDestination, setActiveDestination] = useState(
    initialContext || activeTrip?.destination || activeTrip?.title || 'Pakistan Travel'
  )

  useEffect(() => {
    if (initialContext) {
      setActiveDestination(initialContext)
    } else if (activeTrip?.destination || activeTrip?.title) {
      setActiveDestination(activeTrip.destination || activeTrip.title)
    }
  }, [initialContext, activeTrip?.destination, activeTrip?.title])

  const destinationContext = activeDestination

  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: 'Hello! I am your TripNest AI Travel Guide. Ask me anything about destinations, itineraries, local food, or budget in Pakistan — or switch to Voice Mode for audio readout!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(initialVoiceMode)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [speakingMessageId, setSpeakingMessageId] = useState(null)

  const scrollViewRef = useRef(null)

  const insets = useSafeAreaInsets()
  const isIOS = Platform.OS === 'ios'
  const topPadding = isIOS ? Math.max(insets?.top || 0, 56) + 14 : Math.max(insets?.top || 0, 24) + 8

  // Voice Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    if (isVoiceMode || isSpeaking) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.18,
              duration: 900,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.9,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 900,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.4,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
        ])
      )
      pulseLoop.start()
      return () => pulseLoop.stop()
    } else {
      pulseAnim.setValue(1)
      glowAnim.setValue(0.4)
    }
  }, [isVoiceMode, isSpeaking])

  // Handle modal open/close
  useEffect(() => {
    if (visible) {
      setIsVoiceMode(initialVoiceMode)
      if (initialVoiceMode && autoSpeak) {
        const dest = destinationContext || 'Pakistan'
        const greeting = `Hello! I am your TripNest AI Travel Guide for ${dest}. Tap any question below or ask me anything!`
        speakResponse(greeting, 'welcome-1')
      }
    } else {
      stopVoiceSpeech()
    }
  }, [visible, initialVoiceMode])

  // Clean Markdown/Symbols for Speech
  function cleanTextForSpeech(raw) {
    if (!raw) return ''
    return raw
      .replace(/[*#_~`>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/•/g, ', ')
      .trim()
  }

  // Text-to-Speech Handler
  async function speakResponse(text, messageId = null) {
    try {
      await Speech.stop()
      const clean = cleanTextForSpeech(text)
      if (!clean) return

      setIsSpeaking(true)
      setSpeakingMessageId(messageId)

      Speech.speak(clean, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.95,
        onStart: () => setIsSpeaking(true),
        onDone: () => {
          setIsSpeaking(false)
          setSpeakingMessageId(null)
        },
        onStopped: () => {
          setIsSpeaking(false)
          setSpeakingMessageId(null)
        },
        onError: () => {
          setIsSpeaking(false)
          setSpeakingMessageId(null)
        },
      })
    } catch (err) {
      console.warn('Speech synthesis error:', err)
      setIsSpeaking(false)
      setSpeakingMessageId(null)
    }
  }

  function stopVoiceSpeech() {
    try {
      if (Speech && typeof Speech.stop === 'function') {
        Speech.stop().catch(() => {})
      }
    } catch {}
    setIsSpeaking(false)
    setSpeakingMessageId(null)
  }

  // Send message
  async function handleSendMessage(promptToSend) {
    const text = (promptToSend || inputText).trim()
    if (!text || isLoading) return

    // Detect if user is asking about a specific city and update context dynamically
    const lowerQuery = text.toLowerCase()
    const PAKISTAN_CITIES = [
      'Islamabad', 'Lahore', 'Karachi', 'Rawalpindi', 'Peshawar', 'Quetta', 'Multan',
      'Swat', 'Murree', 'Skardu', 'Hunza', 'Gwadar', 'Faisalabad', 'Bahawalpur',
      'Chitral', 'Naran', 'Kalam', 'Neelum', 'Gilgit', 'Ziarat', 'Hyderabad', 'Sukkur'
    ]
    for (const city of PAKISTAN_CITIES) {
      if (lowerQuery.includes(city.toLowerCase())) {
        setActiveDestination(city)
        break
      }
    }

    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)

    try {
      // Build trip context string
      const tripContextStr = activeTrip
        ? `Trip: ${activeTrip.title || activeTrip.name || destinationContext}, Destination: ${activeTrip.destination || destinationContext}, Days: ${(activeTrip.days || []).length}`
        : `Destination: ${destinationContext}`

      const res = await askAiAssistant(text, tripContextStr)
      const aiReply =
        res?.response ||
        res?.reply ||
        res?.message ||
        res?.data?.response ||
        'I am ready to assist you! Feel free to ask about hotels, scenic viewpoints, local foods, or driving routes in Pakistan.'

      const botMsg = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])

      // Auto-speak in voice mode or if autoSpeak is on
      if (isVoiceMode || autoSpeak) {
        speakResponse(aiReply, botMsg.id)
      }
    } catch (err) {
      const errorMsg = {
        id: 'bot-err-' + Date.now(),
        role: 'assistant',
        text: 'I could not reach the travel intelligence server right now. Make sure the backend server is running, or check your internet connection!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 150)
    }
  }

  function handleCopyText(text) {
    try {
      Clipboard.setString(text)
      Alert.alert('Copied', 'Response copied to clipboard')
    } catch {}
  }

  return (
    <Modal
      visible={Boolean(visible)}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          {/* HEADER WITH PROPER SAFE AREA INSET */}
          <View style={[styles.header, { paddingTop: topPadding }]}>
            <View style={styles.headerLeft}>
              <View style={styles.aiBadgeIcon}>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.headerTitleWrap}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>TripNest AI Guide</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {destinationContext ? `📍 ${destinationContext}` : 'Smart Travel & Voice Assistant'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Speaker Toggle */}
              <TouchableOpacity
                style={[styles.headerIconBtn, autoSpeak && styles.headerIconBtnActive]}
                onPress={() => {
                  if (isSpeaking) {
                    stopVoiceSpeech()
                  }
                  setAutoSpeak((prev) => !prev)
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                accessibilityLabel="Toggle voice readout"
              >
                <Ionicons
                  name={isSpeaking ? 'volume-high' : autoSpeak ? 'volume-medium' : 'volume-mute'}
                  size={19}
                  color={autoSpeak ? '#0E442B' : '#94A3B8'}
                />
              </TouchableOpacity>

              {/* Mode Switch (Voice vs Chat) */}
              <TouchableOpacity
                style={[styles.modeTogglePill, isVoiceMode && styles.modeTogglePillActive]}
                onPress={() => {
                  if (isVoiceMode) {
                    stopVoiceSpeech()
                  }
                  setIsVoiceMode((prev) => !prev)
                }}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                accessibilityLabel="Switch between voice and chat mode"
              >
                <Ionicons
                  name={isVoiceMode ? 'chatbubbles-outline' : 'mic'}
                  size={14}
                  color={isVoiceMode ? '#0E442B' : '#FFFFFF'}
                />
                <Text style={[styles.modeToggleText, isVoiceMode && styles.modeToggleTextActive]}>
                  {isVoiceMode ? 'Chat' : 'Voice'}
                </Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  stopVoiceSpeech()
                  onClose()
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
                accessibilityLabel="Close assistant"
              >
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* BODY: VOICE MODE OR CHAT MODE */}
          {isVoiceMode ? (
            /* ==================== VOICE AGENT MODE ==================== */
            <View style={styles.voiceModeContainer}>
              <ScrollView
                style={styles.voiceModeScroll}
                contentContainerStyle={styles.voiceModeContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
              <View style={styles.voiceVisualizerContainer}>
                {/* Pulsing Glow Rings */}
                <Animated.View
                  style={[
                    styles.voiceOuterGlow,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: glowAnim,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.voiceMiddleRing,
                    {
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                />

                {/* Central Microphone / Speaker Circle */}
                <TouchableOpacity
                  style={[
                    styles.voiceCenterCircle,
                    isSpeaking && styles.voiceCenterCircleSpeaking,
                  ]}
                  onPress={() => {
                    if (isSpeaking) {
                      stopVoiceSpeech()
                    } else {
                      const lastBot = [...messages].reverse().find((m) => m.role === 'assistant')
                      if (lastBot) {
                        speakResponse(lastBot.text, lastBot.id)
                      }
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={isSpeaking ? 'volume-high' : 'mic'}
                    size={46}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              {/* Voice Status Text */}
              <View style={styles.voiceStatusWrap}>
                <Text style={styles.voiceStatusTitle}>
                  {isSpeaking
                    ? 'TripNest AI is Speaking...'
                    : isLoading
                    ? 'Consulting Gemini AI...'
                    : 'Voice Assistant Ready'}
                </Text>
                <Text style={styles.voiceStatusSubtitle}>
                  {isSpeaking
                    ? 'Tap the circle or "Stop" to pause voice readout'
                    : 'Tap a travel question below or speak to your assistant'}
                </Text>
              </View>

              {/* Voice Controls Row */}
              <View style={styles.voiceControlsRow}>
                {isSpeaking && (
                  <TouchableOpacity
                    style={styles.voiceStopBtn}
                    onPress={stopVoiceSpeech}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="stop" size={16} color="#DC2626" />
                    <Text style={styles.voiceStopBtnText}>Stop Voice</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.voiceSwitchChatBtn}
                  onPress={() => setIsVoiceMode(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses" size={16} color="#0E442B" />
                  <Text style={styles.voiceSwitchChatBtnText}>View Chat Log</Text>
                </TouchableOpacity>
              </View>

              {/* Latest AI Answer Card in Voice Mode */}
              {messages.length > 1 && (
                <View style={styles.voiceLatestCard}>
                  <View style={styles.voiceLatestHeader}>
                    <Ionicons name="sparkles" size={15} color="#059669" />
                    <Text style={styles.voiceLatestTitle}>Latest Travel Insight</Text>
                  </View>
                  <Text style={styles.voiceLatestBody}>
                    {[...messages].reverse().find((m) => m.role === 'assistant')?.text || ''}
                  </Text>
                </View>
              )}

              {/* Spoken Travel Prompt Chips */}
              <View style={styles.voicePromptsSection}>
                <Text style={styles.voicePromptsHeader}>QUICK VOICE QUESTIONS</Text>
                <View style={styles.voiceQuestionsGrid}>
                  {QUICK_VOICE_QUESTIONS.map((q, idx) => (
                    <TouchableOpacity
                      key={`voice-q-${idx}`}
                      style={styles.voiceQuestionCard}
                      onPress={() => handleSendMessage(q)}
                      activeOpacity={0.75}
                      disabled={isLoading}
                    >
                      <View style={styles.voiceQuestionIconBox}>
                        <Ionicons name="mic-outline" size={15} color="#059669" />
                      </View>
                      <Text style={styles.voiceQuestionText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Voice Mode Input Bar */}
            <View style={styles.inputBarWrapper}>
              <View style={styles.inputContainer}>
                <View style={styles.inputVoiceBtnActive}>
                  <Ionicons name="mic" size={18} color="#FFFFFF" />
                </View>

                <TextInput
                  style={styles.textInput}
                  placeholder="Ask AI via voice or type here..."
                  placeholderTextColor="#94A3B8"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline={false}
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={() => handleSendMessage()}
                />

                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
                  ]}
                  onPress={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
            /* ==================== CHAT MODE ==================== */
            <View style={styles.chatModeContainer}>
              {/* Quick Topic Chips */}
              <View style={styles.topicChipsWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.topicChipsScroll}
                >
                  {QUICK_TOPIC_PROMPTS.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.topicChip}
                      onPress={() => handleSendMessage(item.prompt)}
                      activeOpacity={0.7}
                      disabled={isLoading}
                    >
                      <Text style={styles.topicChipText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Messages ScrollView */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesScroll}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((msg) => {
                  const isUser = msg.role === 'user'
                  const isThisSpeaking = isSpeaking && speakingMessageId === msg.id

                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.messageRow,
                        isUser ? styles.messageRowUser : styles.messageRowAssistant,
                      ]}
                    >
                      {!isUser && (
                        <View style={styles.msgAvatar}>
                          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                        </View>
                      )}

                      <View
                        style={[
                          styles.bubble,
                          isUser ? styles.bubbleUser : styles.bubbleAssistant,
                          isThisSpeaking && styles.bubbleSpeaking,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                          ]}
                          selectable={true}
                        >
                          {msg.text}
                        </Text>

                        {/* Footer with Timestamp and Action Buttons */}
                        <View style={styles.bubbleFooter}>
                          <Text
                            style={[
                              styles.timestampText,
                              isUser ? styles.timestampTextUser : styles.timestampTextAssistant,
                            ]}
                          >
                            {msg.timestamp}
                          </Text>

                          {!isUser && (
                            <View style={styles.bubbleActions}>
                              {/* Speak Button */}
                              <TouchableOpacity
                                style={styles.bubbleActionBtn}
                                onPress={() => {
                                  if (isThisSpeaking) {
                                    stopVoiceSpeech()
                                  } else {
                                    speakResponse(msg.text, msg.id)
                                  }
                                }}
                                activeOpacity={0.6}
                              >
                                <Ionicons
                                  name={isThisSpeaking ? 'stop-circle' : 'volume-medium-outline'}
                                  size={16}
                                  color={isThisSpeaking ? '#DC2626' : '#059669'}
                                />
                              </TouchableOpacity>

                              {/* Copy Button */}
                              <TouchableOpacity
                                style={styles.bubbleActionBtn}
                                onPress={() => handleCopyText(msg.text)}
                                activeOpacity={0.6}
                              >
                                <Ionicons name="copy-outline" size={14} color="#64748B" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )
                })}

                {/* Loading indicator bubble */}
                {isLoading && (
                  <View style={[styles.messageRow, styles.messageRowAssistant]}>
                    <View style={styles.msgAvatar}>
                      <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                    </View>
                    <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleLoading]}>
                      <ActivityIndicator size="small" color="#0E442B" />
                      <Text style={styles.loadingBubbleText}>TripNest AI is thinking...</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Smart Input Bar */}
              <View style={styles.inputBarWrapper}>
                <View style={styles.inputContainer}>
                  {/* Voice Button on input bar */}
                  <TouchableOpacity
                    style={styles.inputVoiceBtn}
                    onPress={() => setIsVoiceMode(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="mic" size={20} color="#059669" />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.textInput}
                    placeholder="Ask anything about Pakistan travel..."
                    placeholderTextColor="#94A3B8"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline={true}
                    maxLength={500}
                    returnKeyType="default"
                  />

                  {/* Send Button */}
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
                    ]}
                    onPress={() => handleSendMessage()}
                    disabled={!inputText.trim() || isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardContainer: {
    flex: 1,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0E442B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleWrap: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: {
    backgroundColor: '#ECFDF5',
  },
  modeTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E442B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  modeTogglePillActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modeToggleTextActive: {
    color: '#0E442B',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  /* VOICE MODE */
  voiceModeContainer: {
    flex: 1,
  },
  inputVoiceBtnActive: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  voiceModeScroll: {
    flex: 1,
  },
  voiceModeContent: {
    padding: 20,
    alignItems: 'center',
  },
  voiceVisualizerContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  voiceOuterGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#A7F3D0',
  },
  voiceMiddleRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#34D399',
    opacity: 0.5,
  },
  voiceCenterCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0E442B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  voiceCenterCircleSpeaking: {
    backgroundColor: '#059669',
  },
  voiceStatusWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  voiceStatusTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  voiceStatusSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  voiceControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  voiceStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  voiceStopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  voiceSwitchChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  voiceSwitchChatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0E442B',
  },
  voiceLatestCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  voiceLatestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  voiceLatestTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  voiceLatestBody: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 21,
  },
  voicePromptsSection: {
    width: '100%',
  },
  voicePromptsHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  voiceQuestionsGrid: {
    gap: 8,
  },
  voiceQuestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  voiceQuestionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceQuestionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },

  /* CHAT MODE */
  chatModeContainer: {
    flex: 1,
  },
  topicChipsWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  topicChipsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  topicChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0E442B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: '#0E442B',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  bubbleSpeaking: {
    borderColor: '#10B981',
    borderWidth: 1.5,
    backgroundColor: '#F0FDF4',
  },
  bubbleLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingBubbleText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bubbleTextAssistant: {
    color: '#1E293B',
    fontWeight: '400',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  timestampText: {
    fontSize: 10,
    fontWeight: '500',
  },
  timestampTextUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  timestampTextAssistant: {
    color: '#94A3B8',
  },
  bubbleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bubbleActionBtn: {
    padding: 2,
  },

  /* INPUT BAR */
  inputBarWrapper: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputVoiceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 90,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0E442B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
})

export default AiAssistantModal
