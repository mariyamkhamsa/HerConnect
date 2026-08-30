import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Button from '../components/Button.jsx'

export default function Register() {
  const { register, login } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('worker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, role)
      const userRole = await login(email, password)
      navigate(userRole === 'entrepreneur' ? '/entrepreneur/profile/edit' : '/worker/profile/edit')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>🌸 Join HerConnect</h1>
          <p>Choose how you'd like to use the platform.</p>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="role-toggle">
          <div
            className={`role-option ${role === 'worker' ? 'selected' : ''}`}
            onClick={() => setRole('worker')}
          >
            I'm a Skilled Woman<br />looking for work
          </div>
          <div
            className={`role-option ${role === 'entrepreneur' ? 'selected' : ''}`}
            onClick={() => setRole('entrepreneur')}
          >
            I'm an Entrepreneur<br />hiring help
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input" type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters"
            />
          </div>
          <Button type="submit" block disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</Button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
