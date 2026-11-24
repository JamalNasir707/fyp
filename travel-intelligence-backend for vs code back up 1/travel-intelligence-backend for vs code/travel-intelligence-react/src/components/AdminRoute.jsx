import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function AdminRoute({ children }) {
  const { isAuthenticated, user } = useApp()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/home" replace state={{ from: location.pathname }} />
  }

  return children
}
