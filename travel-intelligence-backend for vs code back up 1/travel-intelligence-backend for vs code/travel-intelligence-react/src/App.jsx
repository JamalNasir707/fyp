import { Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import AdminV2Page from './pages/AdminV2Page'
import PlanTripPage from './pages/PlanTripPage'
import WorkspacePage from './pages/WorkspacePage'
import PrintTripPage from './pages/PrintTripPage'
import TripViewPage from './pages/TripViewPage'
import PublicTripPage from './pages/PublicTripPage'
import './App.css'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<LoginPage initialMode="register" />} />
      <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/profile/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/admin-v2" element={<AdminRoute><AdminV2Page /></AdminRoute>} />
      <Route path="/plan-trip" element={<ProtectedRoute><PlanTripPage /></ProtectedRoute>} />
      <Route path="/workspace" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
      <Route path="/trip-view" element={<ProtectedRoute><TripViewPage /></ProtectedRoute>} />
      <Route path="/trips/public/:tripId" element={<PublicTripPage />} />
      <Route path="/share/edit/:token" element={<TripViewPage />} />
      <Route path="/share/:token" element={<TripViewPage />} />
      <Route path="/print-trip" element={<ProtectedRoute><PrintTripPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}
