import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import Button from '../components/Button.jsx'
import { formatApiError } from '../utils/errors.js'
import { isValidEmail } from '../utils/validation.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() })
      setDone(res.data?.message || 'If an account exists for that email, a password reset link has been sent.')
    } catch (err) {
      setError(formatApiError(err, 'Could not send the reset link. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>🌸 Forgot password</h1>
          <p>Enter your account email and we'll send you a link to reset it.</p>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {done ? (
          <>
            <div className="success-banner" role="status">{done}</div>
            <p className="form-hint">Didn't get it? Check your spam folder, or try again in a few minutes.</p>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="fp-email">Email</label>
              <input id="fp-email" className="form-input" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
            </div>
            <Button type="submit" block disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</Button>
          </form>
        )}
        <p className="auth-footer"><Link to="/login">Back to log in</Link></p>
      </div>
    </div>
  )
}
