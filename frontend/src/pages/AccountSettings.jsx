import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Button from '../components/Button.jsx'
import { formatApiError } from '../utils/errors.js'
import { isValidEmail, checkNewPassword } from '../utils/validation.js'

const card = { border: '1px solid #f0dce4', borderRadius: 20, background: '#fff', padding: 'clamp(20px, 4vw, 30px)', boxShadow: '0 8px 24px rgba(100,45,65,.06)', marginBottom: 20 }

export default function AccountSettings() {
  const { role, email, updateEmail, replaceToken } = useAuth()

  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' })
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' })
  const [emailBusy, setEmailBusy] = useState(false)

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })
  const [pwBusy, setPwBusy] = useState(false)

  // Show the address the server has on record (the one saved at login may be out of date).
  useEffect(() => {
    let cancelled = false
    api.get('/auth/me')
      .then((res) => { if (!cancelled && res.data?.email) updateEmail(res.data.email) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [updateEmail])

  const submitEmail = async (e) => {
    e.preventDefault()
    setEmailMsg({ type: '', text: '' })
    if (!isValidEmail(emailForm.newEmail)) return setEmailMsg({ type: 'error', text: 'Enter a valid email address.' })
    if (!emailForm.password) return setEmailMsg({ type: 'error', text: 'Enter your current password to confirm.' })
    setEmailBusy(true)
    try {
      const res = await api.post('/auth/change-email', { new_email: emailForm.newEmail.trim(), current_password: emailForm.password })
      updateEmail(res.data.email)
      setEmailForm({ newEmail: '', password: '' })
      setEmailMsg({ type: 'success', text: `Your email is now ${res.data.email}. Use it the next time you log in.` })
    } catch (err) {
      setEmailMsg({ type: 'error', text: formatApiError(err, 'Could not change your email.') })
    } finally {
      setEmailBusy(false)
    }
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    if (!pwForm.current) return setPwMsg({ type: 'error', text: 'Enter your current password.' })
    const problem = checkNewPassword(pwForm.next, pwForm.confirm, pwForm.current)
    if (problem) return setPwMsg({ type: 'error', text: problem })
    setPwBusy(true)
    try {
      const res = await api.post('/auth/change-password', {
        current_password: pwForm.current, new_password: pwForm.next, confirm_password: pwForm.confirm,
      })
      replaceToken(res.data.access_token) // keeps this browser signed in; other sessions are signed out
      setPwForm({ current: '', next: '', confirm: '' })
      setPwMsg({ type: 'success', text: 'Your password has been changed. Other devices have been signed out.' })
    } catch (err) {
      setPwMsg({ type: 'error', text: formatApiError(err, 'Could not change your password.') })
    } finally {
      setPwBusy(false)
    }
  }

  const banner = (m) => m.text && (
    <div className={m.type === 'success' ? 'success-banner' : 'error-banner'} role={m.type === 'success' ? 'status' : 'alert'}>{m.text}</div>
  )
  const setE = (k) => (ev) => setEmailForm((f) => ({ ...f, [k]: ev.target.value }))
  const setP = (k) => (ev) => setPwForm((f) => ({ ...f, [k]: ev.target.value }))

  return (
    <main className="page-container" style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 48 }}>
      <p style={{ color: '#b56782', fontWeight: 700, margin: '0 0 6px' }}>MY ACCOUNT</p>
      <h2 style={{ margin: 0 }}>Account settings</h2>
      <p style={{ color: '#7d6a73', marginBottom: 22 }}>Change your login email or password. Your profile, privacy choices and connections stay exactly as they are.</p>

      <section style={card} aria-labelledby="change-email-title">
        <h3 id="change-email-title" style={{ marginTop: 0 }}>Change email</h3>
        <div className="form-hint" style={{ marginBottom: 14 }}>Current email: <strong>{email || '—'}</strong></div>
        {banner(emailMsg)}
        <form onSubmit={submitEmail} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="new-email">New email</label>
            <input id="new-email" className="form-input" type="email" autoComplete="email" value={emailForm.newEmail} onChange={setE('newEmail')} placeholder="you@gmail.com" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="email-password">Current password</label>
            <input id="email-password" className="form-input" type="password" autoComplete="current-password" value={emailForm.password} onChange={setE('password')} />
            <div className="form-hint">We ask for your password to confirm it's you.</div>
          </div>
          <Button type="submit" disabled={emailBusy}>{emailBusy ? 'Saving…' : 'Change email'}</Button>
        </form>
      </section>

      <section style={card} aria-labelledby="change-password-title">
        <h3 id="change-password-title" style={{ marginTop: 0 }}>Change password</h3>
        {banner(pwMsg)}
        <form onSubmit={submitPassword} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-current">Current password</label>
            <input id="pw-current" className="form-input" type="password" autoComplete="current-password" value={pwForm.current} onChange={setP('current')} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-new">New password</label>
            <input id="pw-new" className="form-input" type="password" autoComplete="new-password" value={pwForm.next} onChange={setP('next')} />
            <div className="form-hint">At least 8 characters, with a letter and a number.</div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-confirm">Confirm new password</label>
            <input id="pw-confirm" className="form-input" type="password" autoComplete="new-password" value={pwForm.confirm} onChange={setP('confirm')} />
          </div>
          <Button type="submit" disabled={pwBusy}>{pwBusy ? 'Saving…' : 'Change password'}</Button>
        </form>
      </section>

      <Link to={role === 'worker' ? '/worker/my-profile' : '/entrepreneur/my-profile'}><Button variant="secondary">Back to My Profile</Button></Link>
    </main>
  )
}
