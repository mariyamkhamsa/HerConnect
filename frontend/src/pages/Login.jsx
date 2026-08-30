import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Button from '../components/Button.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const role = await login(email, password)
      navigate(role === 'entrepreneur' ? '/entrepreneur' : '/worker')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>🌸 HerConnect</h1>
          <p>Welcome back. Log in to continue.</p>
        </div>
        {error && <div className="error-banner">{error}</div>}
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
              className="form-input" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            />
          </div>
          <Button type="submit" block disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</Button>
        </form>
        <p className="auth-footer">
          New to HerConnect? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
