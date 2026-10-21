import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import { formatApiError } from '../utils/errors.js'

const formatWhen = (value) => {
  if (!value) return ''
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

/** In-website notifications for both roles (invitations, applications, decisions, shared contacts). */
export default function Notifications() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshBell = () => window.dispatchEvent(new Event('herconnect:notifications-changed'))

  useEffect(() => {
    api.get('/notifications')
      .then((res) => setNotes(res.data))
      .catch((err) => setError(formatApiError(err, 'Could not load notifications.')))
      .finally(() => setLoading(false))
  }, [])

  const open = async (note) => {
    if (!note.is_read) {
      try {
        await api.put(`/notifications/${note.id}/read`)
        setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, is_read: true } : n)))
        refreshBell()
      } catch (err) {
        // Opening the linked page matters more than the read flag.
      }
    }
    if (note.link) navigate(note.link)
  }

  const markAll = async () => {
    try {
      await api.put('/notifications/read-all')
      setNotes((prev) => prev.map((n) => ({ ...n, is_read: true })))
      refreshBell()
    } catch (err) {
      setError(formatApiError(err, 'Could not update notifications.'))
    }
  }

  const unread = notes.filter((n) => !n.is_read).length

  return (
    <div className="page-container notifications-page">
      <section className="notifications-hero">
        <div className="notifications-hero-icon" aria-hidden="true">♧</div>
        <div className="notifications-hero-copy">
          <span className="notifications-eyebrow">YOUR HERCONNECT UPDATES</span>
          <h2>Notifications</h2>
          <p>Stay in the loop with invitations, applications, and connection updates.</p>
        </div>
        <div className="notifications-summary">
          <span className="notifications-summary-number">{unread}</span>
          <span>{unread === 1 ? 'unread update' : 'unread updates'}</span>
        </div>
      </section>

      <div className="notifications-toolbar">
        <div>
          <h3>Recent activity</h3>
          <p>{unread > 0 ? 'Here are the updates waiting for you.' : 'You are all caught up.'}</p>
        </div>
        {unread > 0 && <Button variant="outline" size="sm" onClick={markAll}>Mark all as read</Button>}
      </div>

      {loading && <div className="notifications-loading"><div className="spinner" /><span>Loading your updates…</span></div>}
      {error && <div className="error-banner">{error}</div>}
      {!loading && !error && notes.length === 0 && (
        <div className="empty-state notifications-empty">
          <div className="notifications-empty-icon" aria-hidden="true">♡</div>
          <h3>All quiet for now</h3>
          <p>When you receive an invitation, application update, or new connection activity, it will appear here.</p>
        </div>
      )}

      {!loading && !error && notes.length > 0 && (
        <div className="notifications-list">
          {notes.map((note) => (
            <Card key={note.id} hover className={`notification-card ${note.is_read ? 'notification-read' : 'notification-unread'}`}>
              <button type="button" className="notification-item" onClick={() => open(note)}>
                <span className={`notification-symbol ${note.is_read ? 'is-read' : 'is-unread'}`} aria-hidden="true">{note.is_read ? '✓' : '✦'}</span>
                <span className="notification-content">
                  <span className="notification-message">{note.message}</span>
                  <span className="notification-time">{formatWhen(note.created_at)}</span>
                </span>
                <span className="notification-open" aria-hidden="true">›</span>
              </button>
              {!note.is_read && <span className="notification-new-label">NEW</span>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
