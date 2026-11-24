import React, { useState, useEffect, useMemo } from 'react'
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
  Alert,
  Modal,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { BRANDING_ASSETS } from '../../../assets/branding'
import { useApp } from '../../context/AppContext'
import { colors } from '../../theme/colors'
import { getCurrentEnvironment, ENVIRONMENTS } from '../../config/env'
import { isGoogleSignInAvailable, promptGoogleSignIn } from '../../services/googleAuth'
import ModalSheet from '../../components/common/ModalSheet'

// Google OAuth constants
const GOOGLE_CLIENT_ID = '936993641755-ah2t0aeg4hnqc0dj7s02pgv0okhq7ril.apps.googleusercontent.com'
const GOOGLE_REDIRECT_URI = 'tripnest://auth/google'

function getGoogleOAuthUrl() {
  const scope = encodeURIComponent('openid email profile')
  return (
    'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(GOOGLE_REDIRECT_URI) +
    '&response_type=token' +
    '&scope=' + scope +
    '&prompt=select_account'
  )
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export const WORLD_LANGUAGES = [
  { id: 'en', code: 'en', name: 'English', native: 'English', flag: '🇬🇧', country: 'Global / UK / US' },
  { id: 'ur', code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰', country: 'Pakistan (پاکستان)' },
  { id: 'id', code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩', country: 'Indonesia' },
  { id: 'ms', code: 'ms', name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾', country: 'Malaysia' },
  { id: 'da', code: 'da', name: 'Danish', native: 'Dansk', flag: '🇩🇰', country: 'Danmark' },
  { id: 'de', code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪', country: 'Deutschland' },
  { id: 'es', code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸', country: 'España' },
  { id: 'fr', code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷', country: 'France' },
  { id: 'it', code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹', country: 'Italia' },
  { id: 'nl', code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱', country: 'Nederland' },
  { id: 'no', code: 'no', name: 'Norwegian', native: 'Norsk', flag: '🇳🇴', country: 'Norge' },
  { id: 'pl', code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱', country: 'Polska' },
  { id: 'pt', code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇵🇹', country: 'Portugal / Brasil' },
  { id: 'tr', code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷', country: 'Türkiye' },
  { id: 'ar', code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦', country: 'العالم العربي' },
  { id: 'fa', code: 'fa', name: 'Persian', native: 'فارسی', flag: '🇮🇷', country: 'ایران' },
  { id: 'ru', code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺', country: 'Россия' },
  { id: 'zh', code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳', country: '中国' },
  { id: 'ja', code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵', country: '日本' },
  { id: 'ko', code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷', country: '대한민국' },
]

export const AUTH_TRANSLATIONS = {
  en: {
    signIn: "Sign In",
    signUp: "Sign Up",
    welcomeBack: "Welcome Back",
    signInSubtitle: "Sign in to access your planned trips",
    createAccount: "Create Account",
    signUpSubtitle: "Join TripNest to plan and explore Pakistan",
    usernameOrEmail: "Username or Email",
    usernamePlaceholder: "Enter your username or email",
    fullName: "Full Name",
    fullNamePlaceholder: "e.g. Ali Ahmed",
    usernameLabel: "Username",
    usernameOnlyPlaceholder: "e.g. ali_ahmed",
    emailLabel: "Email Address",
    emailPlaceholder: "ali@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    choosePasswordLabel: "Choose Password",
    choosePasswordPlaceholder: "Create a secure password",
    countryLanguageLabel: "Country & Language",
    countryLanguageSubtitle: "Select your preferred country language",
    continueGoogle: "Continue with Google",
    guestDemo: "Explore App as Guest (Instant Demo)",
    guestDemoSub: "View trips, daily itineraries & 530+ sights",
    orContinueWith: "or continue with",
  },
  ur: {
    signIn: "سائن ان",
    signUp: "نیا اکاؤنٹ",
    welcomeBack: "خوش آمدید",
    signInSubtitle: "اپنے محفوظ شدہ ٹرپس دیکھنے کے لیے لاگ ان کریں",
    createAccount: "نیا اکاؤنٹ بنائیں",
    signUpSubtitle: "پاکستان کی سیر اور ٹرپ پلاننگ کے لیے شامل ہوں",
    usernameOrEmail: "یوزر نیم یا ای میل",
    usernamePlaceholder: "اپنا یوزر نیم یا ای میل درج کریں",
    fullName: "پورا نام",
    fullNamePlaceholder: "مثال: علی احمد",
    usernameLabel: "یوزر نیم",
    usernameOnlyPlaceholder: "مثال: ali_ahmed",
    emailLabel: "ای میل ایڈریس",
    emailPlaceholder: "ali@example.com",
    passwordLabel: "پاس ورڈ",
    passwordPlaceholder: "اپنا پاس ورڈ درج کریں",
    choosePasswordLabel: "پاس ورڈ چنیں",
    choosePasswordPlaceholder: "کم از کم 6 ہندسوں کا پاس ورڈ",
    countryLanguageLabel: "ملک اور مادری زبان",
    countryLanguageSubtitle: "اپنی پسندیدہ زبان منتخب کریں",
    continueGoogle: "گوگل کے ساتھ جاری رکھیں",
    guestDemo: "بطور مہمان ایپ دیکھیں (فوری ڈیمو)",
    guestDemoSub: "بغیر لاگ ان 530+ مقامات اور روٹ پلانر دیکھیں",
    orContinueWith: "یا اس کے ذریعے لاگ ان کریں",
  },
  ar: {
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    welcomeBack: "مرحباً بك مجدداً",
    signInSubtitle: "سجل الدخول للوصول إلى رحلاتك المخططة",
    createAccount: "إنشاء حساب جديد",
    signUpSubtitle: "انضم إلى TripNest لاستكشاف معالم باكستان",
    usernameOrEmail: "اسم المستخدم أو البريد الإلكتروني",
    usernamePlaceholder: "أدخل اسم المستخدم أو البريد الإلكتروني",
    fullName: "الاسم الكامل",
    fullNamePlaceholder: "مثال: أحمد علي",
    usernameLabel: "اسم المستخدم",
    usernameOnlyPlaceholder: "ahmed_ali",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "ahmed@example.com",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    choosePasswordLabel: "اختر كلمة مرور آمنة",
    choosePasswordPlaceholder: "6 أحرف على الأقل",
    countryLanguageLabel: "البلد واللغة المفضلة",
    countryLanguageSubtitle: "اختر لغة بلدك للتطبيق",
    continueGoogle: "المتابعة باستخدام Google",
    guestDemo: "استكشف كضيف (عرض فوري)",
    guestDemoSub: "شاهد أكثر من 530 معلماً ومسارات الرحلات",
    orContinueWith: "أو المتابعة عبر",
  },
  zh: {
    signIn: "登录",
    signUp: "注册新账号",
    welcomeBack: "欢迎回来",
    signInSubtitle: "登录以查看您的行程规划",
    createAccount: "创建新账号",
    signUpSubtitle: "加入TripNest，探索巴基斯坦名胜",
    usernameOrEmail: "用户名或邮箱",
    usernamePlaceholder: "请输入用户名或邮箱",
    fullName: "全名",
    fullNamePlaceholder: "例如：李明",
    usernameLabel: "用户名",
    usernameOnlyPlaceholder: "li_ming",
    emailLabel: "电子邮箱",
    emailPlaceholder: "liming@example.com",
    passwordLabel: "密码",
    passwordPlaceholder: "请输入密码",
    choosePasswordLabel: "设置安全密码",
    choosePasswordPlaceholder: "至少6个字符",
    countryLanguageLabel: "国家与首选语言",
    countryLanguageSubtitle: "选择您偏好的语言",
    continueGoogle: "通过 Google 继续",
    guestDemo: "以访客身份体验（即时演示）",
    guestDemoSub: "浏览530+景点与智能路线规划",
    orContinueWith: "或通过其他方式登录",
  },
  es: {
    signIn: "Iniciar Sesión",
    signUp: "Registrarse",
    welcomeBack: "Bienvenido de nuevo",
    signInSubtitle: "Inicia sesión para acceder a tus viajes",
    createAccount: "Crear Cuenta",
    signUpSubtitle: "Únete a TripNest para explorar Pakistán",
    usernameOrEmail: "Usuario o Correo",
    usernamePlaceholder: "Introduce tu usuario o correo",
    fullName: "Nombre Completo",
    fullNamePlaceholder: "Ej: Carlos Gómez",
    usernameLabel: "Nombre de Usuario",
    usernameOnlyPlaceholder: "carlos_gomez",
    emailLabel: "Correo Electrónico",
    emailPlaceholder: "carlos@example.com",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Introduce tu contraseña",
    choosePasswordLabel: "Elige una Contraseña",
    choosePasswordPlaceholder: "Mínimo 6 caracteres",
    countryLanguageLabel: "País e Idioma Preferido",
    countryLanguageSubtitle: "Selecciona tu idioma",
    continueGoogle: "Continuar con Google",
    guestDemo: "Explorar como Invitado (Demo Rápido)",
    guestDemoSub: "Ver itinerarios y más de 530 atracciones",
    orContinueWith: "o continuar con",
  },
  fr: {
    signIn: "Connexion",
    signUp: "S'inscrire",
    welcomeBack: "Bon retour parmi nous",
    signInSubtitle: "Connectez-vous pour voir vos voyages",
    createAccount: "Créer un Compte",
    signUpSubtitle: "Rejoignez TripNest pour explorer le Pakistan",
    usernameOrEmail: "Nom d'utilisateur ou Email",
    usernamePlaceholder: "Entrez votre identifiant",
    fullName: "Nom Complet",
    fullNamePlaceholder: "Ex: Jean Dupont",
    usernameLabel: "Nom d'utilisateur",
    usernameOnlyPlaceholder: "jean_dupont",
    emailLabel: "Adresse Email",
    emailPlaceholder: "jean@example.com",
    passwordLabel: "Mot de Passe",
    passwordPlaceholder: "Entrez votre mot de passe",
    choosePasswordLabel: "Choisir un Mot de Passe",
    choosePasswordPlaceholder: "Au moins 6 caractères",
    countryLanguageLabel: "Pays & Langue Préférée",
    countryLanguageSubtitle: "Sélectionnez votre langue",
    continueGoogle: "Continuer avec Google",
    guestDemo: "Explorer en tant qu'invité (Démo)",
    guestDemoSub: "Découvrez 530+ sites et itinéraires",
    orContinueWith: "ou continuer avec",
  },
  de: {
    signIn: "Anmelden",
    signUp: "Registrieren",
    welcomeBack: "Willkommen zurück",
    signInSubtitle: "Melden Sie sich an, um Ihre Reisen zu sehen",
    createAccount: "Konto Erstellen",
    signUpSubtitle: "Treten Sie TripNest bei, um Pakistan zu erkunden",
    usernameOrEmail: "Benutzername oder E-Mail",
    usernamePlaceholder: "Benutzername oder E-Mail eingeben",
    fullName: "Vollständiger Name",
    fullNamePlaceholder: "z.B. Max Mustermann",
    usernameLabel: "Benutzername",
    usernameOnlyPlaceholder: "max_mustermann",
    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "max@example.com",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Passwort eingeben",
    choosePasswordLabel: "Passwort wählen",
    choosePasswordPlaceholder: "Mindestens 6 Zeichen",
    countryLanguageLabel: "Land & Bevorzugte Sprache",
    countryLanguageSubtitle: "Wählen Sie Ihre Sprache",
    continueGoogle: "Mit Google fortfahren",
    guestDemo: "Als Gast erkunden (Sofort-Demo)",
    guestDemoSub: "530+ Sehenswürdigkeiten & Routen ansehen",
    orContinueWith: "oder fortfahren mit",
  },
  tr: {
    signIn: "Giriş Yap",
    signUp: "Kayıt Ol",
    welcomeBack: "Tekrar Hoş Geldiniz",
    signInSubtitle: "Planlanmış gezilerinize erişmek için giriş yapın",
    createAccount: "Hesap Oluştur",
    signUpSubtitle: "Pakistan'ı keşfetmek için TripNest'e katılın",
    usernameOrEmail: "Kullanıcı Adı veya E-posta",
    usernamePlaceholder: "Kullanıcı adı veya e-posta girin",
    fullName: "Ad Soyad",
    fullNamePlaceholder: "Örn: Ahmet Yılmaz",
    usernameLabel: "Kullanıcı Adı",
    usernameOnlyPlaceholder: "ahmet_yilmaz",
    emailLabel: "E-posta Adresi",
    emailPlaceholder: "ahmet@example.com",
    passwordLabel: "Şifre",
    passwordPlaceholder: "Şifrenizi girin",
    choosePasswordLabel: "Güvenli Şifre Seçin",
    choosePasswordPlaceholder: "En az 6 karakter",
    countryLanguageLabel: "Ülke ve Tercih Edilen Dil",
    countryLanguageSubtitle: "Tercih ettiğiniz dili seçin",
    continueGoogle: "Google ile Devam Et",
    guestDemo: "Misafir Olarak Keşfet (Anında Demo)",
    guestDemoSub: "530+ turistik yeri ve rotayı inceleyin",
    orContinueWith: "veya şununla devam edin",
  },
}

export function LoginScreen({ navigation }) {
  const { login, register, googleLogin, loading } = useApp()
  const [activeTab, setActiveTab] = useState('signin') // 'signin' | 'signup'
  const [selectedLanguage, setSelectedLanguage] = useState(WORLD_LANGUAGES[0]) // Default English
  const [languageModalVisible, setLanguageModalVisible] = useState(false)
  const [languageSearchQuery, setLanguageSearchQuery] = useState('')

  const t = AUTH_TRANSLATIONS[selectedLanguage.code] || AUTH_TRANSLATIONS.en

  const filteredLanguages = useMemo(() => {
    const q = languageSearchQuery.trim().toLowerCase()
    if (!q) return WORLD_LANGUAGES
    return WORLD_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q)
    )
  }, [languageSearchQuery])

  const [googleLoading, setGoogleLoading] = useState(false)

  // Diagnostic log for render state
  console.log('[DEBUG_LOGIN] LoginScreen render - loading:', loading, 'activeTab:', activeTab)

  useEffect(() => {
    console.log('[DEBUG_LOGIN] LoginScreen MOUNTED')
    return () => {
      console.log('[DEBUG_LOGIN] LoginScreen UNMOUNTED')
    }
  }, [])

  // Deep-link listener: handles tripnest://auth/google?access_token=... callback
  useEffect(() => {
    function extractToken(url) {
      if (!url) return null
      const match = url.match(/[#?&]access_token=([^&]+)/)
      return match ? decodeURIComponent(match[1]) : null
    }

    async function handleUrl(event) {
      const url = event?.url || event
      const token = extractToken(url)
      if (token) {
        setGoogleLoading(false)
        setError(null)
        setSuccessMsg('Google account verified. Signing in...')
        try {
          await googleLogin({ accessToken: token })
        } catch (err) {
          setError(err?.message || 'Google login failed')
          setSuccessMsg(null)
        }
      }
    }

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }) }).catch(() => {})
    const sub = Linking.addEventListener('url', handleUrl)
    return () => sub?.remove?.()
  }, [googleLogin])

  // Sign In State
  const [signInIdentifier, setSignInIdentifier] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [showSignInPassword, setShowSignInPassword] = useState(false)

  // Sign Up State
  const [signUpName, setSignUpName] = useState('')
  const [signUpUsername, setSignUpUsername] = useState('')
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false)
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)

  // Status & Validation
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // 1. Handle Sign In
  async function handleSignIn() {
    const trimmedId = (signInIdentifier || '').trim()
    const trimmedPw = (signInPassword || '').trim()
    if (!trimmedId) {
      setError('Please enter your username or email')
      return
    }
    if (!trimmedPw) {
      setError('Please enter your password')
      return
    }

    setError(null)
    setSuccessMsg(null)
    try {
      await login({
        username: trimmedId,
        password: trimmedPw,
      })
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    }
  }

  function handleNameChange(name) {
    setSignUpName(name)
    if (!usernameManuallyEdited) {
      const suggested = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
      setSignUpUsername(suggested)
    }
  }

  // 2. Handle Sign Up
  async function handleSignUp() {
    const cleanName = (signUpName || '').trim()
    const cleanUsername = ((signUpUsername || signUpName) || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const cleanEmail = (signUpEmail || '').trim().toLowerCase()
    const cleanPassword = (signUpPassword || '').trim()

    if (!cleanName) {
      setError('Please enter your full name')
      return
    }
    if (!cleanUsername) {
      setError('Please enter a username')
      return
    }
    if (!cleanEmail) {
      setError('Please enter your email address')
      return
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await register({
        username: cleanUsername,
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName,
      })
      if (res?.success) {
        setSuccessMsg('Account created successfully! Logging you in...')
        // Automatically sign in with newly created username
        await login({
          username: cleanUsername,
          password: cleanPassword,
        })
      } else {
        throw new Error(res?.error || res?.detail || 'Sign up failed')
      }
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    }
  }

  // 3. Continue as Guest (Instant 1-tap explore)
  async function handleGuestAccess() {
    setError(null)
    try {
      await login({
        username: 'guest_explorer',
        name: 'Guest Explorer',
      })
    } catch (err) {
      setError('Guest mode initialization failed')
    }
  }

  // 4. Continue with Google — native SDK first, browser OAuth fallback
  async function handleGoogleAccess() {
    setError(null)
    setSuccessMsg(null)

    if (isGoogleSignInAvailable()) {
      // Native Google Sign-In (development build / bare workflow)
      try {
        const res = await promptGoogleSignIn()
        if (res?.cancelled) return
        if (res?.success) {
          await handleGoogleSuccess(res)
          return
        }
        if (res?.error) setError(res.error)
      } catch (err) {
        setError(err?.message || 'Google sign-in failed')
      }
    } else {
      // Expo Go fallback: open Google OAuth in system browser
      // The app handles the callback via tripnest://auth/google deep link
      setGoogleLoading(true)
      setSuccessMsg('Opening Google sign-in...')
      try {
        const oauthUrl = getGoogleOAuthUrl()
        const canOpen = await Linking.canOpenURL(oauthUrl)
        if (canOpen) {
          await Linking.openURL(oauthUrl)
          setSuccessMsg('Complete sign-in in the browser, then return here.')
        } else {
          setGoogleLoading(false)
          setSuccessMsg(null)
          setError('Cannot open browser. Please check your device settings.')
        }
      } catch (err) {
        setGoogleLoading(false)
        setSuccessMsg(null)
        setError('Failed to open Google sign-in: ' + (err?.message || 'Unknown error'))
      }
    }
  }

  async function handleGoogleSuccess(tokenResult) {
    setError(null)
    setSuccessMsg('Google account verified. Signing in...')
    try {
      await googleLogin(tokenResult)
    } catch (err) {
      setError(err?.message || 'Google login failed')
      setSuccessMsg(null)
    }
  }

  function handleOpenLegal(title) {
    Alert.alert(
      title,
      `TripNest ${title}\n\nTripNest protects your personal data and itineraries according to travel industry security standards.`,
      [{ text: 'OK' }]
    )
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
          keyboardShouldPersistTaps="always"
        >
                    {/* Top Floating Language Selector Bar */}
          <View style={styles.topLanguageBar}>
            <TouchableOpacity
              style={styles.languagePill}
              onPress={() => setLanguageModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.languagePillFlag}>{selectedLanguage.flag}</Text>
              <Text style={styles.languagePillText}>{selectedLanguage.native} ({selectedLanguage.name})</Text>
              <Ionicons name="globe-outline" size={13} color="#0E442B" style={{ marginLeft: 3 }} />
              <Ionicons name="chevron-down" size={12} color="#0E442B" />
            </TouchableOpacity>
          </View>

          {/* Section 1: Official TripNest Branding Header */}
          <View style={styles.brandingHeader}>
            <View style={styles.countryPill}>
              <Ionicons name="sparkles" size={13} color="#10B981" />
              <Text style={styles.countryPillText}>AI-Powered Travel Platform • Pakistan</Text>
              <View style={styles.liveDot} />
            </View>

            <Image
              source={BRANDING_ASSETS.logo}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandSubtext}>Explore • Plan • Optimize Itineraries</Text>

            {/* Feature Highlights Row */}
            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <Ionicons name="flash" size={12} color="#0E442B" />
                <Text style={styles.featureText}>TSP 2-Opt</Text>
              </View>
              <Text style={styles.featureDot}>•</Text>
              <View style={styles.featureItem}>
                <Ionicons name="location" size={12} color="#0E442B" />
                <Text style={styles.featureText}>530+ Sights</Text>
              </View>
              <Text style={styles.featureDot}>•</Text>
              <View style={styles.featureItem}>
                <Ionicons name="wallet" size={12} color="#0E442B" />
                <Text style={styles.featureText}>Smart Budget</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Tab Switcher (Sign In vs Create Account) */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'signin' && styles.tabButtonActive]}
              onPress={() => {
                console.log('[DEBUG_LOGIN] Tab Switcher: "Sign In" tab selected')
                setActiveTab('signin')
                setError(null)
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="log-in-outline"
                size={16}
                color={activeTab === 'signin' ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabButtonText, activeTab === 'signin' && styles.tabButtonTextActive]}>
                {t.signIn}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'signup' && styles.tabButtonActive]}
              onPress={() => {
                console.log('[DEBUG_LOGIN] Tab Switcher: "Sign Up" tab selected')
                setActiveTab('signup')
                setError(null)
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-add-outline"
                size={16}
                color={activeTab === 'signup' ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabButtonText, activeTab === 'signup' && styles.tabButtonTextActive]}>
                {t.signUp}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error / Success Feedback */}
          {error ? (
            <View style={styles.feedbackBoxError}>
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.feedbackTextError}>{error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.feedbackBoxSuccess}>
              <Ionicons name="checkmark-circle" size={18} color="#15803D" />
              <Text style={styles.feedbackTextSuccess}>{successMsg}</Text>
            </View>
          ) : null}

          {/* Section 3: Auth Form Card */}
          <View style={styles.formCard}>
            {activeTab === 'signin' ? (
              /* --- SIGN IN FORM --- */
              <View>
                <Text style={styles.formTitle}>{t.welcomeBack}</Text>
                <Text style={styles.formSubtitle}>{t.signInSubtitle}</Text>

                {/* Username or Email Input */}
                <Text style={styles.inputLabel}>{t.usernameOrEmail}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t.usernamePlaceholder}
                    placeholderTextColor="#94A3B8"
                    value={signInIdentifier}
                    onChangeText={setSignInIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Password Input */}
                <Text style={styles.inputLabel}>{t.passwordLabel}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t.passwordPlaceholder}
                    placeholderTextColor="#94A3B8"
                    value={signInPassword}
                    onChangeText={setSignInPassword}
                    secureTextEntry={!showSignInPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowSignInPassword(!showSignInPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showSignInPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Primary Sign In Button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    console.log('[DEBUG_LOGIN] 0. Primary Sign In TouchableOpacity tapped, disabled =', Boolean(loading))
                    handleSignIn()
                  }}
                  disabled={Boolean(loading)}
                  activeOpacity={0.88}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText}>{t.signIn}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* --- SIGN UP FORM --- */
              <View>
                <Text style={styles.formTitle}>{t.createAccount}</Text>
                <Text style={styles.formSubtitle}>{t.signUpSubtitle}</Text>

                {/* Full Name Input */}
                <Text style={styles.inputLabel}>{t.fullName}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t.fullNamePlaceholder}
                    placeholderTextColor="#94A3B8"
                    value={signUpName}
                    onChangeText={handleNameChange}
                  />
                </View>

                {/* Username Input */}
                <Text style={styles.inputLabel}>{t.usernameLabel}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="at-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. ali_ahmed"
                    placeholderTextColor="#94A3B8"
                    value={signUpUsername}
                    onChangeText={(val) => {
                      setUsernameManuallyEdited(true)
                      setSignUpUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                                {/* Country & Language Preference Field */}
                <Text style={styles.inputLabel}>{t.countryLanguageLabel}</Text>
                <TouchableOpacity
                  style={styles.languageSelectorCard}
                  onPress={() => setLanguageModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.languageFlagCircle}>
                    <Text style={{ fontSize: 22 }}>{selectedLanguage.flag}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.languageSelectTitle}>
                      {selectedLanguage.native} • {selectedLanguage.name}
                    </Text>
                    <Text style={styles.languageSelectCountry}>
                      {selectedLanguage.country}
                    </Text>
                  </View>
                  <View style={styles.languageChangeBadge}>
                    <Text style={styles.languageChangeText}>Change</Text>
                    <Ionicons name="chevron-forward" size={13} color="#059669" />
                  </View>
                </TouchableOpacity>

                {/* Email Input */}
                <Text style={styles.inputLabel}>{t.emailLabel}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t.emailPlaceholder}
                    placeholderTextColor="#94A3B8"
                    value={signUpEmail}
                    onChangeText={setSignUpEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                {/* Password Input */}
                <Text style={styles.inputLabel}>{t.choosePasswordLabel}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t.choosePasswordPlaceholder}
                    placeholderTextColor="#94A3B8"
                    value={signUpPassword}
                    onChangeText={setSignUpPassword}
                    secureTextEntry={!showSignUpPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowSignUpPassword(!showSignUpPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showSignUpPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Primary Sign Up Button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSignUp}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText}>{t.createAccount}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Section 4: Fast & Social Alternatives */}
          <View style={styles.alternativesSection}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.orContinueWith}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Continue Button */}
            <TouchableOpacity
              style={[styles.socialButton, googleLoading && { opacity: 0.7 }]}
              onPress={handleGoogleAccess}
              activeOpacity={0.82}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#EA4335" style={{ marginRight: 10 }} />
              ) : (
                <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 10 }} />
              )}
              <Text style={styles.socialButtonText}>{t.continueGoogle}</Text>
            </TouchableOpacity>

            {/* Continue as Guest / Instant 1-Tap Explore */}
            <TouchableOpacity
              style={styles.guestButton}
              onPress={handleGuestAccess}
              activeOpacity={0.88}
            >
              <View style={styles.guestIconCircle}>
                <Ionicons name="compass" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.guestButtonTitle}>{t.guestDemo}</Text>
                <Text style={styles.guestButtonSubtitle}>{t.guestDemoSub}</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={24} color="#0E442B" />
            </TouchableOpacity>

            {/* Feature Trust Badges */}
            <View style={styles.trustBadgesRow}>
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#059669" />
                <Text style={styles.trustBadgeText}>Offline Support</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="navigate" size={13} color="#059669" />
                <Text style={styles.trustBadgeText}>TSP Road Routing</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="people" size={13} color="#059669" />
                <Text style={styles.trustBadgeText}>Tripmates</Text>
              </View>
            </View>
          </View>

          {/* Section 5: Legal Footer */}
          <View style={styles.legalFooter}>
            <Text style={styles.legalText}>By continuing, you agree to our</Text>
            <View style={styles.legalLinksRow}>
              <TouchableOpacity onPress={() => handleOpenLegal('Terms of Service')}>
                <Text style={styles.legalLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.legalText}> and </Text>
              <TouchableOpacity onPress={() => handleOpenLegal('Privacy Policy')}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    
            {/* EXACT DESIGN MATCH: CHANGE LANGUAGE BOTTOM SHEET */}
      <Modal
        visible={languageModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.langModalBackdrop}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.langModalSheet}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle */}
            <View style={styles.langDragHandle} />

            {/* Header: Centered Title & Subtitle */}
            <Text style={styles.langModalTitle}>Change language</Text>
            <Text style={styles.langModalSubtitle}>
              We think you might prefer this language based on your location and device settings
            </Text>

            {/* Top Suggested Language (Default / Current Location) */}
            <TouchableOpacity
              style={styles.langItemRow}
              onPress={() => {
                setSelectedLanguage(WORLD_LANGUAGES[0])
                setLanguageModalVisible(false)
              }}
              activeOpacity={0.65}
            >
              <Text style={styles.langItemText}>{WORLD_LANGUAGES[0].native}</Text>
              {selectedLanguage.id === WORLD_LANGUAGES[0].id && (
                <Ionicons name="checkmark" size={22} color="#111827" />
              )}
            </TouchableOpacity>

            {/* Thin Horizontal Divider */}
            <View style={styles.langModalDivider} />

            {/* Full Languages List */}
            <ScrollView
              style={styles.langScrollList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              {WORLD_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage.id === lang.id
                return (
                  <TouchableOpacity
                    key={lang.id}
                    style={styles.langItemRow}
                    onPress={() => {
                      setSelectedLanguage(lang)
                      setLanguageModalVisible(false)
                    }}
                    activeOpacity={0.65}
                  >
                    <Text style={[styles.langItemText, isSelected && styles.langItemTextSelected]}>
                      {lang.native}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={22} color="#111827" />
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({

  langModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  langModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  langDragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  langModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  langModalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  langItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  langItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '400',
  },
  langItemTextSelected: {
    fontWeight: '600',
    color: '#111827',
  },
  langModalDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
    marginBottom: 8,
  },
  langScrollList: {
    maxHeight: 380,
  },


  topLanguageBar: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  languagePillFlag: {
    fontSize: 14,
  },
  languagePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E442B',
  },
  languageSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  languageFlagCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  languageSelectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  languageSelectCountry: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  languageChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  languageChangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  langSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  langSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  langOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  langOptionRowSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  langFlagBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptionNative: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  langOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  langCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0E442B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F5', // Signature warm cream background
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },

  // 1. Branding Header
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 4,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 6,
  },
  countryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.2,
  },
  brandLogo: {
    width: Math.min(SCREEN_WIDTH * 0.58, 220),
    height: Math.min(SCREEN_WIDTH * 0.58, 220) * 0.88,
  },
  brandSubtext: {
    fontSize: 13,
    color: '#475569',
    marginTop: -4,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E442B',
  },
  featureDot: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // 2. Tab Switcher
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EAE5DB',
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
    width: '100%',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#0E442B', // Deep forest green
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Feedback Messages
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

  // 3. Form Card
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
    marginBottom: 16,
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
    marginBottom: 18,
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
  eyeButton: {
    padding: 6,
  },
  primaryButton: {
    backgroundColor: '#0E442B', // Deep brand green
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // 4. Alternatives Section
  alternativesSection: {
    width: '100%',
    marginBottom: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  socialButton: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  guestButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#0E442B',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  guestIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0E442B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0E442B',
  },
  guestButtonSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  trustBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },

  // 5. Legal Footer
  legalFooter: {
    alignItems: 'center',
    marginTop: 6,
    paddingBottom: 8,
  },
  legalText: {
    fontSize: 11,
    color: '#64748B',
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  legalLink: {
    fontSize: 11,
    color: '#0E442B',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
})

export default LoginScreen
