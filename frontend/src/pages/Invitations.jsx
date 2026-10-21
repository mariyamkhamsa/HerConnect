import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import ConsentCheckbox from '../components/ConsentCheckbox.jsx'
import { formatApiError } from '../utils/errors.js'

const STATUS_BADGE = {
  pending: 'badge-warning',
  accepted: 'badge-success',
  declined: 'badge-danger',
}

/**
 * mode="received" -> worker: invitations from entrepreneurs; she can accept or decline once.
 * mode="sent"     -> entrepreneur: invitations she has sent, with their current status.
 */
export default function Invitations({ mode }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [shareById, setShareById] = useState({})

  useEffect(() => {
    api.get('/invitations')
      .then((res) => setItems(res.data))
      .catch((err) => setError(formatApiError(err, 'Could not load invitations.')))
      .finally(() => setLoading(false))
  }, [])

  const respond = async (inv, status) => {
    if (busyId !== null) return
    setBusyId(inv.id)
    setError('')
    try {
      const res = await api.put(`/invitations/${inv.id}`, {
        status,
        share_contact: status === 'accepted' && !!shareById[inv.id],
      })
      setItems((prev) => prev.map((i) => (i.id === inv.id ? res.data : i)))
      window.dispatchEvent(new Event('herconnect:notifications-changed'))
    } catch (err) {
      setError(formatApiError(err, 'Could not respond to this invitation.'))
    } finally {
      setBusyId(null)
    }
  }

  const received = mode === 'received'

  return (
    <div className="page-container">
      <h2>{received ? 'Invitations For You' : 'Invitations You Sent'}</h2>
      <p>
        {received
          ? 'Review invitations and choose whether to accept. You control whether to share your contact details.'
          : "See the invitations you've sent and their status."}      
      </p>

      {loading && <div className="spinner" />}
      {error && <div className="error-banner">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state"><p>{received ? 'No invitations yet.' : "You haven't invited anyone yet. Visit a job's recommended workers to send an invitation."}</p></div>
      )}

      {items.map((inv) => (
        <Card key={inv.id}>
          <div className="section-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ProfileAvatar role={received ? 'entrepreneur' : 'worker'} profileId={received ? inv.entrepreneur_id : inv.worker_id} hasPhoto size={48} />
              <div><h3>{inv.job_title}</h3>
              <p className="form-hint">
                {received ? `From ${inv.business_name}` : `To ${inv.worker_name}`} · 📍 {inv.job_locality} · {inv.job_work_type}
              </p></div>
            </div>
            <span className={`badge ${STATUS_BADGE[inv.status]}`}>{inv.status}</span>
          </div>
          <p>{inv.job_description}</p>

          {received && inv.status === 'pending' && (
            <>
              <ConsentCheckbox
                checked={shareById[inv.id]}
                onChange={(v) => setShareById((prev) => ({ ...prev, [inv.id]: v }))}
                disabled={busyId === inv.id}
              >
                If I accept, share my contact details with {inv.business_name}
              </ConsentCheckbox>
              <div className="card-actions">
                <Button variant="success" size="sm" disabled={busyId !== null} onClick={() => respond(inv, 'accepted')}>
                  {busyId === inv.id ? 'Saving...' : 'Accept'}
                </Button>
                <Button variant="danger" size="sm" disabled={busyId !== null} onClick={() => respond(inv, 'declined')}>Decline</Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/worker/businesses/${inv.entrepreneur_id}`)}>
                  View Business Profile
                </Button>
              </div>
            </>
          )}

          {received && inv.status !== 'pending' && (
            <div className="card-actions">
              <Button variant="outline" size="sm" onClick={() => navigate(`/worker/businesses/${inv.entrepreneur_id}`)}>
                View Business Profile
              </Button>
              {inv.status === 'accepted' && (
                <Button variant="secondary" size="sm" onClick={() => navigate('/connections')}>Contact details</Button>
              )}
            </div>
          )}

          {!received && (
            <div className="card-actions">
              <Button variant="outline" size="sm" onClick={() => navigate(`/entrepreneur/workers/${inv.worker_id}`)}>
                View Worker Profile
              </Button>
              {inv.status === 'accepted' && (
                <Button variant="secondary" size="sm" onClick={() => navigate('/connections')}>Contact details</Button>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
