import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
import JobBrowse from './pages/JobBrowse.jsx'
import RecommendationResults from './pages/RecommendationResults.jsx'
import ApplicationsView from './pages/ApplicationsView.jsx'

function Landing() {
  const { isAuthenticated, role } = useAuth()
  if (isAuthenticated) {
    return <Navigate to={role === 'entrepreneur' ? '/entrepreneur' : '/worker'} replace />
  }
  return <Home />
}

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Entrepreneur */}
        <Route path="/entrepreneur" element={<ProtectedRoute role="entrepreneur"><EntrepreneurDashboard /></ProtectedRoute>} />
        <Route path="/entrepreneur/profile/edit" element={<ProtectedRoute role="entrepreneur"><EntrepreneurProfileForm /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/new" element={<ProtectedRoute role="entrepreneur"><JobPostingForm /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/:jobId/edit" element={<ProtectedRoute role="entrepreneur"><JobPostingForm /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/:jobId/recommendations" element={<ProtectedRoute role="entrepreneur"><RecommendationResults mode="workers" /></ProtectedRoute>} />
        <Route path="/entrepreneur/jobs/:jobId/applications" element={<ProtectedRoute role="entrepreneur"><ApplicationsView mode="received" /></ProtectedRoute>} />

        {/* Worker */}
        <Route path="/worker" element={<ProtectedRoute role="worker"><WorkerDashboard /></ProtectedRoute>} />
        <Route path="/worker/profile/edit" element={<ProtectedRoute role="worker"><WorkerProfileForm /></ProtectedRoute>} />
        <Route path="/worker/jobs" element={<ProtectedRoute role="worker"><JobBrowse /></ProtectedRoute>} />
        <Route path="/worker/:workerId/recommendations" element={<ProtectedRoute role="worker"><RecommendationResults mode="jobs" /></ProtectedRoute>} />
        <Route path="/worker/:workerId/applications" element={<ProtectedRoute role="worker"><ApplicationsView mode="mine" /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
