import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { BRANDING_ASSETS } from '../../../assets/branding'
import { useApp } from '../../context/AppContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export function RegisterScreen({ navigation }) {
  const { register, login, loading } = useApp()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required')
      return
    }
    setError(null)
    try {
      const res = await register({
        username: username.trim(),
        email: email.trim(),
        password,
      })
      if (res?.success) {
        setSuccess('Account created successfully! Logging you in...')
        await login({ username: username.trim(), password })
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.brandingHeader}>
            <Image
              source={BRANDING_ASSETS.logo}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandSubtext}>Create your personalized travel profile</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Get Started</Text>
            <Text style={styles.formSubtitle}>Join fellow explorers in discovering Pakistan</Text>

            {error ? (
              <View style={styles.feedbackBoxError}>
                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                <Text style={styles.feedbackTextError}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.feedbackBoxSuccess}>
                <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                <Text style={styles.feedbackTextSuccess}>{success}</Text>
              </View>
            ) : null}

            {/* Username */}
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="e.g. northern_traveler"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Email */}
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="traveler@tripnest.dev"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Password */}
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Choose a secure password"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.registerBtn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.registerBtnText}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Switch to Sign In */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.switchLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F5',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandLogo: {
    width: Math.min(SCREEN_WIDTH * 0.58, 220),
    height: Math.min(SCREEN_WIDTH * 0.58, 220) * 0.95,
  },
  brandSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: -4,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8E3D8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B242A',
    marginBottom: 2,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  feedbackBoxError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
  },
  feedbackTextError: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  feedbackBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
  },
  feedbackTextSuccess: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  registerBtn: {
    backgroundColor: '#0E442B',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  switchText: {
    fontSize: 13,
    color: '#64748B',
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0E442B',
  },
})

export default RegisterScreen
