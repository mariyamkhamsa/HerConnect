import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ role, children }) {
  const { isAuthenticated, role: userRole } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (role && userRole !== role) {
    return <Navigate to={userRole === 'entrepreneur' ? '/entrepreneur' : '/worker'} replace />
  }
  return children
}
