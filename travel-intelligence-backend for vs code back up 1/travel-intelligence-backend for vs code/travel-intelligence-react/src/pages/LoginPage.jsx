import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AuthLayout from '../components/auth/AuthLayout'
import AuthDivider from '../components/auth/AuthDivider'
import LoginForm from '../components/auth/LoginForm'
import SignupForm from '../components/auth/SignupForm'
import GoogleButton from '../components/landing/GoogleButton'
import '../styles/landing.css'
import '../styles/auth.css'

export default function LoginPage({ initialMode = 'login' }) {
  const navigate = useNavigate()
  const { isAuthenticated, login, register, googleLogin } = useApp()
  const [mode, setMode] = useState(initialMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const googleTokenClientRef = useRef(null)

  useEffect(() => {
    if (isAuthenticated) navigate('/home', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    setMode(initialMode === 'register' ? 'register' : 'login')
  }, [initialMode])

  useEffect(() => {
    function initializeGoogleClient() {
      if (!googleClientId || !window.google?.accounts?.oauth2 || googleTokenClientRef.current) return

      googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response?.error) {
            setBusy(false)
            setError(response.error_description || response.error || 'Google login failed')
            return
          }

          if (!response?.access_token) {
            setBusy(false)
            setError('Google login did not return an access token')
            return
          }

          try {
            const data = await googleLogin(response.access_token)
            setSuccess(data.message || 'Google login successful! Redirecting...')
            navigate('/home', { replace: true })
          } catch (err) {
            setError(err.message)
          } finally {
            setBusy(false)
          }
        },
      })
    }

    if (!googleClientId) return undefined

    if (window.google?.accounts?.oauth2) {
      initializeGoogleClient()
      return undefined
    }

    const existingScript = document.querySelector('script[data-google-identity="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', initializeGoogleClient)
      return () => existingScript.removeEventListener('load', initializeGoogleClient)
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.addEventListener('load', initializeGoogleClient)
    script.addEventListener('error', () => {
      setError('Unable to load Google login. Please try again.')
    })
    document.head.appendChild(script)

    return () => {
      script.removeEventListener('load', initializeGoogleClient)
    }
  }, [googleClientId, googleLogin, navigate])

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!loginForm.username || !loginForm.password) {
      setError('Please enter username and password')
      return
    }
    setBusy(true)
    try {
      await login(loginForm)
      setSuccess('Login successful! Redirecting...')
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.confirm) {
      setError('Please fill all fields')
      return
    }
    if (registerForm.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (registerForm.password !== registerForm.confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await register({ username: registerForm.username, email: registerForm.email, password: registerForm.password })
      await login({ username: registerForm.username, password: registerForm.password })
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleGoogleSignIn() {
    setError('')
    setSuccess('')

    if (!googleClientId) {
      setError('Google login is not configured. Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID first.')
      return
    }

    if (!googleTokenClientRef.current) {
      setError('Google login is still loading. Please try again.')
      return
    }

    setBusy(true)
    googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' })
  }

  const banner = error
    ? <div className="AuthBanner AuthBanner--error">{error}</div>
    : success
      ? <div className="AuthBanner AuthBanner--success">{success}</div>
      : null

  const actions = (
    <>
      <GoogleButton
        className="AuthGoogleButton"
        onClick={handleGoogleSignIn}
        disabled={busy}
        title="Continue with Google"
      />
      <AuthDivider />
    </>
  )

  const footer = (
    <p className="AuthSupportNote">
      Demo Credentials: <strong>demo</strong> / <strong>demo123</strong>
    </p>
  )

  return (
    <div className="AuthPageShell">
      <AuthLayout mode={mode} banner={banner} actions={actions} footer={footer}>
        {mode === 'login' ? (
          <LoginForm
            values={loginForm}
            onChange={setLoginForm}
            onSubmit={handleLogin}
            busy={busy}
            onSwitchMode={() => setMode('register')}
          />
        ) : (
          <SignupForm
            values={registerForm}
            onChange={setRegisterForm}
            onSubmit={handleRegister}
            busy={busy}
            onSwitchMode={() => setMode('login')}
          />
        )}
      </AuthLayout>
    </div>
  )
}
