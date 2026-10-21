import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api.js'
import Button from '../components/Button.jsx'
import { formatApiError } from '../utils/errors.js'
import { checkNewPassword } from '../utils/validation.js'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [form, setForm] = useState({ next: '', confirm: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const problem = checkNewPassword(form.next, form.confirm)
    if (problem) return setError(problem)
    setLoading(true)
    try {
      const res = await api.post('/auth/reset-password', { token, new_password: form.next, confirm_password: form.confirm })
      setDone(res.data?.message || 'Your password has been reset.')
    } catch (err) {
      setError(formatApiError(err, 'Could not reset your password. Please request a new link.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>🌸 Reset password</h1>
          <p>Choose a new password for your account.</p>
        </div>
        {!token ? (
          <>
            <div className="error-banner" role="alert">This reset link is incomplete. Please request a new one.</div>
            <p className="auth-footer"><Link to="/forgot-password">Request a new link</Link></p>
          </>
        ) : done ? (
          <>
            <div className="success-banner" role="status">{done}</div>
            <p className="auth-footer"><Link to="/login">Go to log in</Link></p>
          </>
        ) : (
          <>
            {error && <div className="error-banner" role="alert">{error}</div>}
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="rp-new">New password</label>
                <input id="rp-new" className="form-input" type="password" autoComplete="new-password" value={form.next}
                  onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} />
                <div className="form-hint">At least 8 characters, with a letter and a number.</div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="rp-confirm">Confirm new password</label>
                <input id="rp-confirm" className="form-input" type="password" autoComplete="new-password" value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
              </div>
              <Button type="submit" block disabled={loading}>{loading ? 'Saving...' : 'Reset password'}</Button>
            </form>
            <p className="auth-footer"><Link to="/forgot-password">Link expired? Request a new one</Link></p>
          </>
        )}
      </div>
    </div>
  )
}
