import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth } from './context/AuthContext.jsx'

import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import EntrepreneurDashboard from './pages/EntrepreneurDashboard.jsx'
import EntrepreneurProfileForm from './pages/EntrepreneurProfileForm.jsx'
import JobPostingForm from './pages/JobPostingForm.jsx'
import WorkerDashboard from './pages/WorkerDashboard.jsx'
import WorkerProfileForm from './pages/WorkerProfileForm.jsx'
import WorkerProfileView from './pages/WorkerProfileView.jsx'
import BusinessProfileView from './pages/BusinessProfileView.jsx'
import MyProfile from './pages/MyProfile.jsx'
import JobBrowse from './pages/JobBrowse.jsx'
import RecommendationResults from './pages/RecommendationResults.jsx'
import ApplicationsView from './pages/ApplicationsView.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import Invitations from './pages/Invitations.jsx'
import Notifications from './pages/Notifications.jsx'
import Connections from './pages/Connections.jsx'
import AccountSettings from './pages/AccountSettings.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import { homePathFor } from './utils/roles.js'

function Landing() {
  const { isAuthenticated, role } = useAuth()
  if (isAuthenticated) {
    return <Navigate to={homePathFor(role)} replace />
  }
  return <Home />
}

export default function App() {
  const location = useLocation()
  const isHomePage = location.pathname === '/'
  return (
    <div className={`app-shell ${isHomePage ? 'home-shell' : 'inner-shell'}`}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Entrepreneur */}
        <Route path="/entrepreneur" element={<ProtectedRoute role="entrepreneur"><EntrepreneurDashboard /></ProtectedRoute>} />
        <Route path="/entrepreneur/my-profile" element={<ProtectedRoute role="entrepreneur"><MyProfile /></ProtectedRoute>} />
        <Route path="/entrepreneur/profile/edit" element={<ProtectedRoute role="entrepreneur"><EntrepreneurProfileForm /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/new" element={<ProtectedRoute role="entrepreneur"><JobPostingForm /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/:jobId/edit" element={<ProtectedRoute role="entrepreneur"><JobPostingForm /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/:jobId/recommendations" element={<ProtectedRoute role="entrepreneur"><RecommendationResults mode="workers" /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/:jobId/applications" element={<ProtectedRoute role="entrepreneur"><ApplicationsView mode="received" /></ProtectedRoute>} />
        <Route path="/entrepreneur/workers/:workerId" element={<ProtectedRoute role="entrepreneur"><WorkerProfileView /></ProtectedRoute>} />
        <Route path="/entrepreneur/invitations" element={<ProtectedRoute role="entrepreneur"><Invitations mode="sent" /></ProtectedRoute>} />

        {/* Worker */}
        <Route path="/worker" element={<ProtectedRoute role="worker"><WorkerDashboard /></ProtectedRoute>} />
        <Route path="/worker/my-profile" element={<ProtectedRoute role="worker"><MyProfile /></ProtectedRoute>} />
        <Route path="/worker/profile/edit" element={<ProtectedRoute role="worker"><WorkerProfileForm /></ProtectedRoute>} />
        <Route path="/worker/jobs" element={<ProtectedRoute role="worker"><JobBrowse /></ProtectedRoute>} />
        <Route path="/worker/:workerId/recommendations" element={<ProtectedRoute role="worker"><RecommendationResults mode="jobs" /></ProtectedRoute>} />
        <Route path="/worker/:workerId/applications" element={<ProtectedRoute role="worker"><ApplicationsView mode="mine" /></ProtectedRoute>} />
        <Route path="/worker/businesses/:entrepreneurId" element={<ProtectedRoute role="worker"><BusinessProfileView /></ProtectedRoute>} />
        <Route path="/worker/invitations" element={<ProtectedRoute role="worker"><Invitations mode="received" /></ProtectedRoute>} />

        {/* Both roles */}
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
        <Route path="/account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
