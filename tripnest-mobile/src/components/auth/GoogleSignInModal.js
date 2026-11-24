import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'

const GOOGLE_CLIENT_ID = '936993641755-ah2t0aeg4hnqc0dj7s02pgv0okhq7ril.apps.googleusercontent.com'

// Supported mobile deep-link redirect URI
const REDIRECT_URI = 'tripnest://auth/google'

/**
 * Builds Google OAuth 2.0 authorization URL for system browser
 */
function getOAuthUrl(redirectUri = REDIRECT_URI) {
  const scope = encodeURIComponent('openid email profile')
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    GOOGLE_CLIENT_ID
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=token&scope=${scope}&prompt=select_account`
}

/**
 * TripNest Google Sign-In Component
 * 
 * Replaces embedded WebView with Google's RFC 8252 compliant system browser flow,
 * deep link listener, and token verification to eliminate the
 * "Access blocked: Authorization Error".
 */
export function GoogleSignInModal({ visible, onClose, onSuccess, onError }) {
  const [loading, setLoading] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [browserLaunched, setBrowserLaunched] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [activeTab, setActiveTab] = useState('browser') // 'browser' | 'manual' | 'setup'

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setLoading(false)
      setAuthError(null)
      setManualToken('')
      setBrowserLaunched(false)
      setActiveTab('browser')
    }
  }, [visible])

  // Extract access_token from incoming URL
  function extractTokenFromUrl(url) {
    if (!url) return null
    const tokenMatch = url.match(/[#?&]access_token=([^&]+)/)
    if (tokenMatch && tokenMatch[1]) {
      return decodeURIComponent(tokenMatch[1])
    }
    return null
  }

  function extractErrorFromUrl(url) {
    if (!url) return null
    const errMatch = url.match(/[#?&]error=([^&]+)/)
    if (errMatch && errMatch[1]) {
      return decodeURIComponent(errMatch[1])
    }
    return null
  }

  // Deep linking listener for mobile
  useEffect(() => {
    if (!visible) return

    function handleOpenUrl(event) {
      const url = event?.url || event
      if (!url) return

      const token = extractTokenFromUrl(url)
      if (token) {
        setLoading(false)
        if (onSuccess) onSuccess(token)
        if (onClose) onClose()
        return
      }

      const errReason = extractErrorFromUrl(url)
      if (errReason) {
        setLoading(false)
        setAuthError(`Google returned error: ${errReason}`)
        if (onError) onError(new Error(errReason))
      }
    }

    // Check initial URL if opened via scheme
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) handleOpenUrl({ url: initialUrl })
    }).catch(() => {})

    // Add subscription
    const subscription = Linking.addEventListener('url', handleOpenUrl)
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove()
      }
    }
  }, [visible, onSuccess, onClose, onError])

  // Web platform GIS (Google Identity Services) integration
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'openid email profile',
            callback: (response) => {
              if (response?.access_token) {
                if (onSuccess) onSuccess(response.access_token)
                if (onClose) onClose()
              } else if (response?.error) {
                const msg = response.error_description || response.error
                setAuthError(msg)
                if (onError) onError(new Error(msg))
              }
            },
          })
          client.requestAccessToken({ prompt: 'select_account' })
        } catch (err) {
          console.warn('GIS error on web:', err)
        }
      }
    }
  }, [visible, onSuccess, onClose, onError])

  // Launch system browser for Google OAuth
  async function handleLaunchBrowser() {
    setAuthError(null)
    setLoading(true)
    const oauthUrl = getOAuthUrl()

    try {
      const canOpen = await Linking.canOpenURL(oauthUrl)
      if (canOpen) {
        await Linking.openURL(oauthUrl)
        setBrowserLaunched(true)
      } else {
        throw new Error('Cannot open system browser')
      }
    } catch (err) {
      setAuthError('Could not launch system browser. Please use direct token verification.')
      setActiveTab('manual')
    } finally {
      setLoading(false)
    }
  }

  // Handle manual token submission
  function handleManualSubmit() {
    const trimmed = manualToken.trim()
    if (!trimmed) {
      setAuthError('Please enter a valid Google access token')
      return
    }
    setLoading(true)
    setAuthError(null)
    try {
      if (onSuccess) onSuccess(trimmed)
      if (onClose) onClose()
    } catch (err) {
      setAuthError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.googleIconBadge}>
              <Ionicons name="logo-google" size={16} color="#DB4437" />
            </View>
            <Text style={styles.headerTitle}>Google Sign-In</Text>
          </View>

          <View style={{ width: 28 }} />
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'browser' && styles.tabItemActive]}
            onPress={() => setActiveTab('browser')}
          >
            <Ionicons
              name="globe-outline"
              size={16}
              color={activeTab === 'browser' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === 'browser' && styles.tabLabelActive]}>
              System Browser
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'manual' && styles.tabItemActive]}
            onPress={() => setActiveTab('manual')}
          >
            <Ionicons
              name="key-outline"
              size={16}
              color={activeTab === 'manual' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === 'manual' && styles.tabLabelActive]}>
              Verify Token
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'setup' && styles.tabItemActive]}
            onPress={() => setActiveTab('setup')}
          >
            <Ionicons
              name="settings-outline"
              size={16}
              color={activeTab === 'setup' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === 'setup' && styles.tabLabelActive]}>
              Config Help
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error notification */}
        {authError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.errorText}>{authError}</Text>
          </View>
        )}

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'browser' && (
            <View style={styles.card}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="logo-google" size={36} color="#DB4437" />
              </View>

              <Text style={styles.cardTitle}>Sign in with Google</Text>
              <Text style={styles.cardSubtitle}>
                TripNest connects securely via your device's native browser (Chrome/Safari) without using unsafe embedded WebViews.
              </Text>

              <View style={styles.infoBox}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                <Text style={styles.infoText}>
                  Your Google credentials are never stored by TripNest. Google validates identity and returns a secure token directly to our FastAPI server.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleLaunchBrowser}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="open-outline" size={18} color={colors.textWhite} style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>Open Google in Browser</Text>
                  </>
                )}
              </TouchableOpacity>

              {browserLaunched && (
                <View style={styles.waitingNotice}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.waitingText}>
                    Waiting for Google authorization callback... If your browser doesn't redirect automatically, switch to "Verify Token" tab.
                  </Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'manual' && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.card}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="key-outline" size={32} color={colors.primary} />
                </View>

                <Text style={styles.cardTitle}>Direct Token Exchange</Text>
                <Text style={styles.cardSubtitle}>
                  Paste any valid Google OAuth access token to authenticate immediately against the backend <Text style={{ fontWeight: '700' }}>POST /auth/google</Text> endpoint and sync with MongoDB Atlas.
                </Text>

                <TextInput
                  style={styles.tokenInput}
                  placeholder="Paste access_token (e.g. ya29.a0AfH6...)"
                  placeholderTextColor={colors.textTertiary}
                  value={manualToken}
                  onChangeText={(val) => {
                    setManualToken(val)
                    if (authError) setAuthError(null)
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, !manualToken.trim() && styles.btnDisabled]}
                  onPress={handleManualSubmit}
                  disabled={!manualToken.trim() || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.textWhite} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify & Sign In</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}

          {activeTab === 'setup' && (
            <View style={styles.card}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="information-circle-outline" size={36} color={colors.primary} />
              </View>

              <Text style={styles.cardTitle}>OAuth Configuration Reference</Text>
              <Text style={styles.cardSubtitle}>
                Native Android Google Sign-In is configured for TripNest. Ensure your Google Cloud Console project contains:
              </Text>

              <View style={styles.configStep}>
                <Text style={styles.configStepNum}>1</Text>
                <View style={styles.configStepBody}>
                  <Text style={styles.configStepTitle}>Server / Web Client ID</Text>
                  <Text style={styles.configStepValue}>{GOOGLE_CLIENT_ID}</Text>
                </View>
              </View>

              <View style={styles.configStep}>
                <Text style={styles.configStepNum}>2</Text>
                <View style={styles.configStepBody}>
                  <Text style={styles.configStepTitle}>Android Client ID</Text>
                  <Text style={styles.configStepValue}>936993641755-tmcle1vo27naa7a81odnt0pet4qv24kapps.googleusercontent.com</Text>
                </View>
              </View>

              <View style={styles.configStep}>
                <Text style={styles.configStepNum}>3</Text>
                <View style={styles.configStepBody}>
                  <Text style={styles.configStepTitle}>Android Package Name</Text>
                  <Text style={styles.configStepValue}>com.tripnest.mobile</Text>
                </View>
              </View>

              <View style={styles.configStep}>
                <Text style={styles.configStepNum}>4</Text>
                <View style={styles.configStepBody}>
                  <Text style={styles.configStepTitle}>Registered Android SHA-1 Fingerprints</Text>
                  <Text style={styles.configStepValue}>• Registered Client: A8:9A:02:5C:2A:C9:A2:54:C8:23:E2:52:BB:E6:74:60:6F:0D:73:3C</Text>
                  <Text style={styles.configStepValue}>• Local Machine Debug: DF:1B:1A:AD:75:3A:35:0C:DA:2F:62:40:D2:4B:11:48:22:20:C8:FA</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    padding: 6,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  googleIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF1F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.subtitle1,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorBox: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight || '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark || '#166534',
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.textWhite,
    fontSize: 15,
    fontWeight: '700',
  },
  waitingNotice: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  waitingText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  tokenInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  configStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  configStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: colors.textWhite,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '700',
  },
  configStepBody: {
    flex: 1,
  },
  configStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  configStepValue: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
})
