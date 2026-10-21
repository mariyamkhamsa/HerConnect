import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatApiError } from '../utils/errors.js'

/**
 * Accepted applications and invitations for both roles.
 * Contact details only appear when the OTHER side has agreed to share; the server never
 * sends them otherwise. Each side controls only its own sharing switch.
 */
export default function Connections() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState(null)

  useEffect(() => {
    api.get('/connections')
      .then((res) => setItems(res.data))
      .catch((err) => setError(formatApiError(err, 'Could not load connections.')))
      .finally(() => setLoading(false))
  }, [])

  const keyOf = (c) => `${c.source}-${c.source_id}`

  const toggleSharing = async (c) => {
    if (busyKey) return
    setBusyKey(keyOf(c))
    setError('')
    try {
      const res = await api.put(`/connections/${c.source}/${c.source_id}/consent`, { share: !c.my_share_contact })
      setItems((prev) => prev.map((x) => (keyOf(x) === keyOf(c) ? res.data : x)))
    } catch (err) {
      setError(formatApiError(err, 'Could not update contact sharing.'))
    } finally {
      setBusyKey(null)
    }
  }

  const viewProfile = (c) => (
    role === 'entrepreneur'
      ? navigate(`/entrepreneur/workers/${c.counterpart_profile_id}`)
      : navigate(`/worker/businesses/${c.counterpart_profile_id}`)
  )

  return (
    <div className="page-container">
      <h2>Your Connections</h2>
      <p>
        People you've connected with through accepted invitations or applications.
      
      </p>

      {loading && <div className="spinner" />}
      {error && <div className="error-banner">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state"><p>No connections yet. Accepted invitations and applications will appear here.</p></div>
      )}

      {items.map((c) => (
        <Card key={keyOf(c)}>
          <div className="section-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ProfileAvatar role={role === 'entrepreneur' ? 'worker' : 'entrepreneur'} profileId={c.counterpart_profile_id} hasPhoto size={48} />
              <div><h3>{c.counterpart_name}</h3>
              <p className="form-hint">For "{c.job_title}"</p></div>
            </div>
            <span className="badge badge-success">{c.source === 'invitation' ? 'Via invitation' : 'Via application'}</span>
          </div>

          {c.contact ? (
            <div className="contact-box">
              <strong>Contact details</strong>
              <div>✉️ {c.contact.email}</div>
              <div>📞 {c.contact.phone || 'No phone number provided'}</div>
            </div>
          ) : (
            <p className="form-hint">Contact details aren't shared yet.</p>
          )}

          <p className="form-hint">
            Your contact details are <strong>{c.my_share_contact ? 'shared' : 'not shared'}</strong> with this person.
          </p>
          <div className="card-actions">
            <Button
              variant={c.my_share_contact ? 'outline' : 'secondary'}
              size="sm"
              disabled={busyKey === keyOf(c)}
              onClick={() => toggleSharing(c)}
            >
              {c.my_share_contact ? 'Stop sharing contact details' : 'Share contact details'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => viewProfile(c)}>
              {role === 'entrepreneur' ? 'View Worker Profile' : 'View Business Profile'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
